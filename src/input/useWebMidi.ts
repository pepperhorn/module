import { useEffect } from 'react'
import { useStore } from '../state/useStore'
import { BreathController, type BreathOutputs } from './breath'

type WebMidiCallbacks = BreathOutputs

export function useWebMidi(callbacks: WebMidiCallbacks): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return
    }
    let cancelled = false
    let access: MIDIAccess | null = null
    const inputs: MIDIInput[] = []
    // Inactive (pass-through) until a breath CC arrives, so keyboards are
    // unaffected; a wind controller arms it with its first breath message.
    const breath = new BreathController(callbacks)

    const handle = (msg: MIDIMessageEvent) => {
      const data = msg.data
      if (!data || data.length < 1) return
      // Dispatch notes before any UI bookkeeping so audio starts ASAP.
      const status = data[0] & 0xf0
      if (status === 0x90) {
        const midi = data[1]
        const vel = data[2] ?? 0
        if (vel === 0) breath.noteOff(midi)
        else breath.noteOn(midi, vel)
      } else if (status === 0x80) {
        breath.noteOff(data[1])
      } else if (status === 0xb0 && data.length >= 3) {
        breath.controlChange(data[1], data[2])
      }
      useStore.getState().flashMidiActivity()
    }

    const attach = () => {
      if (!access) return
      const previousIds = new Set(inputs.map((i) => i.id))
      for (const input of inputs) input.removeEventListener('midimessage', handle as EventListener)
      inputs.length = 0
      access.inputs.forEach((input) => {
        if (input.state === 'disconnected') return
        input.addEventListener('midimessage', handle as EventListener)
        inputs.push(input)
      })
      // An input went away (e.g. sax unplugged): release held notes and lift
      // the breath gain so other inputs aren't left gated at silence. Port
      // open/close events for devices that are still present don't count.
      const currentIds = new Set(inputs.map((i) => i.id))
      for (const id of previousIds) {
        if (!currentIds.has(id)) {
          breath.reset()
          break
        }
      }
      useStore.getState().setMidiConnected(inputs.length > 0)
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
      for (const input of inputs) input.removeEventListener('midimessage', handle as EventListener)
      if (access) access.onstatechange = null
      breath.reset()
    }
  }, [callbacks])
}
