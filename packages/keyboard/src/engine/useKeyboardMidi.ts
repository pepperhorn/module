import { useCallback, useEffect, useRef, useState } from 'react'

interface MidiOptions {
  press(midi: number, velocity: number): boolean | void
  release(midi: number): void
  deviceId: string | null
  setDeviceId(id: string | null): void
}

export function useKeyboardMidi(options: MidiOptions) {
  const { deviceId, setDeviceId } = options
  const [access, setAccess] = useState<MIDIAccess>()
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([])
  const latest = useRef(options)
  latest.current = options
  const request = useRef<Promise<MIDIAccess> | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const requestMidi = useCallback(async () => {
    if (!navigator.requestMIDIAccess || request.current) return
    try {
      request.current = navigator.requestMIDIAccess()
      const result = await request.current
      if (mounted.current) setAccess(result)
    } catch {
      request.current = null
    }
  }, [])

  useEffect(() => {
    const midi = access
    if (!midi) return
    const bindings = new Map<MIDIInput, () => void>()

    function bind(input: MIDIInput) {
      const held = new Map<number, number>()
      const onMessage = ({ data }: MIDIMessageEvent) => {
        if (!data || data.length < 3 || data[1] > 127 || data[2] > 127) return
        const status = data[0] & 0xf0
        const midi = data[1]
        const key = (data[0] & 0x0f) * 128 + midi
        if (status === 0x90 && data[2] > 0) {
          if (held.has(key)) return
          if (latest.current.press(midi, data[2]) !== false) held.set(key, midi)
        } else if ((status === 0x80 || status === 0x90) && held.delete(key)) {
          latest.current.release(midi)
        }
      }
      input.addEventListener('midimessage', onMessage)
      return () => {
        input.removeEventListener('midimessage', onMessage)
        for (const midi of held.values()) latest.current.release(midi)
        held.clear()
      }
    }

    const sync = () => {
      const present = [...midi.inputs.values()].filter(input => input.state !== 'disconnected')
      setDevices(present.map(input => ({ id: input.id, name: input.name ?? 'MIDI input' })))
      const selected = present.filter(input => deviceId === null || deviceId === input.id)
      for (const [input, unbind] of bindings) {
        if (selected.includes(input)) continue
        unbind()
        bindings.delete(input)
      }
      for (const input of selected) if (!bindings.has(input)) bindings.set(input, bind(input))
    }

    sync()
    midi.addEventListener('statechange', sync)
    return () => {
      midi.removeEventListener('statechange', sync)
      for (const unbind of bindings.values()) unbind()
    }
  }, [access, deviceId])

  return { devices, deviceId, setDeviceId, requestMidi }
}
