import { useSyncExternalStore } from 'react'

// Notes currently sounding, from ANY input source (computer keyboard, MIDI,
// on-screen touch). Kept outside React/zustand state so a note event only
// re-renders the subscribers that draw it (the on-screen keyboard), not the
// whole App tree — a fast legato run from a wind controller would otherwise
// trigger a full App render per note and stall the main thread between
// MIDI events.
let notes: ReadonlySet<number> = new Set()
const subs = new Set<() => void>()

function emit(next: ReadonlySet<number>) {
  notes = next
  for (const fn of subs) fn()
}

export function addActiveNote(midi: number): void {
  if (notes.has(midi)) return
  const next = new Set(notes)
  next.add(midi)
  emit(next)
}

export function removeActiveNote(midi: number): void {
  if (!notes.has(midi)) return
  const next = new Set(notes)
  next.delete(midi)
  emit(next)
}

export function clearActiveNotes(): void {
  if (notes.size === 0) return
  emit(new Set())
}

function subscribe(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export function useActiveNotes(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, () => notes)
}
