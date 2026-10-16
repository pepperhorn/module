// Web MIDI access, requested on demand (Chrome 124+ prompts for ALL MIDI).
// Spec: docs/superpowers/specs/2026-09-18-breath-control-design.md — Permission gating.

import { useStore } from '../state/useStore'
import { loadMidiEnabledFlag, saveMidiEnabledFlag } from './midiProfile'

let access: MIDIAccess | null = null
let inFlight: Promise<void> | null = null
const listeners = new Set<(a: MIDIAccess) => void>()

export function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export function getMidiAccess(): MIDIAccess | null {
  return access
}

/** Called with the MIDIAccess once granted (immediately if already held). */
export function onMidiAccess(fn: (a: MIDIAccess) => void): () => void {
  listeners.add(fn)
  if (access) fn(access)
  return () => {
    listeners.delete(fn)
  }
}

/** Classify a requestMIDIAccess rejection. */
export function classifyMidiError(err: unknown): 'denied' | 'error' {
  const name = (err as { name?: string } | null)?.name
  return name === 'SecurityError' || name === 'NotAllowedError' ? 'denied' : 'error'
}

/** Ask for MIDI access (shows Chrome's prompt the first time). Deduped. */
export function requestMidi(): Promise<void> {
  const store = useStore.getState()
  if (!isMidiSupported()) {
    store.setMidiStatus('unsupported')
    return Promise.resolve()
  }
  if (access) return Promise.resolve()
  if (inFlight) return inFlight
  store.setMidiStatus('pending')
  inFlight = navigator
    .requestMIDIAccess({ sysex: false })
    .then((a) => {
      access = a
      saveMidiEnabledFlag(true)
      useStore.getState().setMidiStatus('granted')
      for (const fn of listeners) fn(a)
    })
    .catch((err) => {
      const status = classifyMidiError(err)
      if (status === 'denied') saveMidiEnabledFlag(false)
      useStore.getState().setMidiStatus(status)
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * On load, reconnect silently only when it cannot raise a prompt: the browser
 * already reports `granted`, or the user enabled MIDI on a previous visit.
 * A `denied` permission is reflected straight away so the UI can explain it.
 */
export async function autoRequestMidi(): Promise<void> {
  if (!isMidiSupported()) {
    useStore.getState().setMidiStatus('unsupported')
    return
  }
  let state: PermissionState | null = null
  try {
    const status = await navigator.permissions?.query({ name: 'midi' as PermissionName })
    if (status) {
      state = status.state
      // Re-allowed in site settings while the app is open → connect.
      status.onchange = () => {
        if (status.state === 'granted') void requestMidi()
        else if (status.state === 'denied') useStore.getState().setMidiStatus('denied')
      }
    }
  } catch {
    // Permissions API without a 'midi' descriptor: fall back to the flag.
  }
  if (state === 'denied') {
    useStore.getState().setMidiStatus('denied')
    return
  }
  if (state === 'granted' || loadMidiEnabledFlag()) await requestMidi()
}
