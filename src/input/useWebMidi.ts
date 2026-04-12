import { useEffect } from 'react'
import { useStore } from '../state/useStore'

interface WebMidiCallbacks {
  noteOn: (midi: number, velocity: number) => void
  noteOff: (midi: number) => void
}

export function useWebMidi(callbacks: WebMidiCallbacks): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return
    }
    let cancelled = false
    let access: MIDIAccess | null = null
    const inputs: MIDIInput[] = []

    const handle = (msg: MIDIMessageEvent) => {
      const data = msg.data
      if (!data || data.length < 1) return
      useStore.getState().flashMidiActivity()
      const status = data[0] & 0xf0
      if (status === 0x90) {
        const midi = data[1]
        const vel = data[2] ?? 0
        if (vel === 0) callbacks.noteOff(midi)
        else callbacks.noteOn(midi, vel)
      } else if (status === 0x80) {
        callbacks.noteOff(data[1])
      }
    }

    const attach = () => {
      if (!access) return
      for (const input of inputs) input.removeEventListener('midimessage', handle as EventListener)
      inputs.length = 0
      access.inputs.forEach((input) => {
        input.addEventListener('midimessage', handle as EventListener)
        inputs.push(input)
      })
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
    }
  }, [callbacks])
}
