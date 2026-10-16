import { useEffect, useRef } from 'react'
import { useStore, type MidiDeviceInfo } from '../state/useStore'
import { BreathController, type BreathOutputs } from './breath'
import { autoRequestMidi, onMidiAccess } from './midiAccess'
import { breathMonitor } from './midiMonitor'
import { observeLearn, type LearnState } from './midiProfile'

type WebMidiCallbacks = BreathOutputs

/**
 * Wires granted MIDI access to the note/breath path. Access itself is requested
 * on demand (see midiAccess.ts); on mount we only reconnect silently when the
 * browser already granted it. Returns a stable panic function that releases
 * every MIDI-held note.
 */
export function useWebMidi(callbacks: WebMidiCallbacks): () => void {
  const controllersRef = useRef(new Map<string, BreathController>())

  // Reconnect without prompting if permission is already held.
  useEffect(() => {
    void autoRequestMidi()
  }, [])

  useEffect(() => {
    let access: MIDIAccess | null = null
    // One breath controller per input, so a wind controller's breath only
    // gates its own notes; a keyboard on another port stays pass-through.
    const controllers = controllersRef.current
    const handlers = new Map<MIDIInput, EventListener>()

    // Hot-path snapshot of the profile, refreshed by a store subscription, so
    // a MIDI message never touches zustand state beyond cheap reads.
    let profile = useStore.getState().midiProfile
    let learning = useStore.getState().midiLearning
    let learnState: LearnState = new Map()

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.midiProfile !== prev.midiProfile) {
        profile = s.midiProfile
        if (s.midiProfile.breath.cc !== prev.midiProfile.breath.cc) breathMonitor.raw = -1
        for (const c of controllers.values()) c.setConfig(profile.breath, profile.enabled)
      }
      if (s.midiLearning !== prev.midiLearning) {
        learning = s.midiLearning
        learnState = new Map()
      }
    })

    const handlerFor = (input: MIDIInput): EventListener => {
      let breath = controllers.get(input.id)
      if (!breath) {
        breath = new BreathController(callbacks, profile.breath, undefined, profile.enabled)
        controllers.set(input.id, breath)
      }
      const b = breath
      const inputId = input.id
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
          const cc = data[1]
          const value = data[2]
          b.controlChange(cc, value)
          breathMonitor.lastCc = cc
          breathMonitor.lastCcValue = value
          if (cc === profile.breath.cc) {
            breathMonitor.raw = value
            breathMonitor.at = performance.now()
          }
          if (learning) {
            const learned = observeLearn(learnState, inputId, cc, value)
            if (learned !== null) {
              learning = false
              const st = useStore.getState()
              st.setMidiLearning(false)
              st.updateBreath({ cc: learned })
            }
          }
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
      const devices: MidiDeviceInfo[] = []
      access.inputs.forEach((input) => {
        if (input.state === 'disconnected') return
        present.add(input.id)
        devices.push({
          id: input.id,
          name: input.name ?? 'MIDI input',
          manufacturer: input.manufacturer ?? '',
        })
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
      const st = useStore.getState()
      st.setMidiDevices(devices)
      st.setMidiConnected(handlers.size > 0)
    }

    const unlisten = onMidiAccess((a) => {
      if (access) access.removeEventListener('statechange', attach)
      access = a
      attach()
      a.addEventListener('statechange', attach)
    })

    return () => {
      unlisten()
      unsubscribe()
      detachAll()
      if (access) access.removeEventListener('statechange', attach)
      for (const breath of controllers.values()) breath.reset()
      controllers.clear()
    }
  }, [callbacks])

  const panicRef = useRef(() => {
    for (const breath of controllersRef.current.values()) breath.releaseAll()
  })
  return panicRef.current
}
