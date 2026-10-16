import { useEffect, useRef } from 'react'
import { useStore } from '../state/useStore'
import { BreathController, type BreathOutputs } from './breath'

type WebMidiCallbacks = BreathOutputs

/** Returns a stable panic function that releases every MIDI-held note. */
export function useWebMidi(callbacks: WebMidiCallbacks): () => void {
  const controllersRef = useRef(new Map<string, BreathController>())

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return
    }
    let cancelled = false
    let access: MIDIAccess | null = null
    // One breath controller per input, so a wind controller's breath only
    // gates its own notes; a keyboard on another port stays pass-through.
    const controllers = controllersRef.current
    const handlers = new Map<MIDIInput, EventListener>()

    const handlerFor = (input: MIDIInput): EventListener => {
      let breath = controllers.get(input.id)
      if (!breath) {
        breath = new BreathController(callbacks)
        controllers.set(input.id, breath)
      }
      const b = breath
      return ((msg: MIDIMessageEvent) => {
        const data = msg.data
        if (!data || data.length < 1) return
        // Dispatch notes before any UI bookkeeping so audio starts ASAP.
        const status = data[0] & 0xf0
        if (status === 0x90) {
          const midi = data[1]
          const vel = data[2] ?? 0
          if (vel === 0) b.noteOff(midi)
          else b.noteOn(midi, vel)
        } else if (status === 0x80) {
          b.noteOff(data[1])
        } else if (status === 0xb0 && data.length >= 3) {
          b.controlChange(data[1], data[2])
        }
        useStore.getState().flashMidiActivity()
      }) as EventListener
    }

    const detachAll = () => {
      for (const [input, h] of handlers) input.removeEventListener('midimessage', h)
      handlers.clear()
    }

    const attach = () => {
      if (!access) return
      detachAll()
      const present = new Set<string>()
      access.inputs.forEach((input) => {
        if (input.state === 'disconnected') return
        present.add(input.id)
        const h = handlerFor(input)
        input.addEventListener('midimessage', h)
        handlers.set(input, h)
      })
      // A device went away (e.g. sax unplugged): release its notes and lift
      // the breath gain so other inputs aren't left gated at silence.
      for (const [id, breath] of controllers) {
        if (present.has(id)) continue
        breath.reset()
        controllers.delete(id)
      }
      useStore.getState().setMidiConnected(handlers.size > 0)
    }

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((a) => {
        if (cancelled) return
        access = a
        attach()
        a.onstatechange = attach
      })
      .catch(() => {
        useStore.getState().setMidiConnected(false)
      })

    return () => {
      cancelled = true
      detachAll()
      if (access) access.onstatechange = null
      for (const breath of controllers.values()) breath.reset()
      controllers.clear()
    }
  }, [callbacks])

  const panicRef = useRef(() => {
    for (const breath of controllersRef.current.values()) breath.releaseAll()
  })
  return panicRef.current
}
