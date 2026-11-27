import { useCallback, useEffect, useRef, useState } from 'react'
import { drumPadFor } from './patches/drumMap'
import { chordNotes, noteColor, pitchName, spellChord, VoiceTracker, type Accidentals, type ChordType } from './theory'

export interface LitKey { name: string; color: string; root: boolean }
interface PlayerOptions {
  mode: 'play' | 'chord'
  chord: ChordType
  isDrums: boolean
  noteOn(m: number, v: number): void
  noteOff(m: number): void
}
interface ChordPlayer {
  press(key: number, velocity: number): void
  release(key: number): void
  lit: ReadonlyMap<number, LitKey>
}
interface HeldKey { count: number; chord?: ChordType }

export function useChordPlayer(opts: PlayerOptions): ChordPlayer {
  return useChordPlayerState(opts)
}

export function useChordPlayerState(opts: PlayerOptions, accidentals: Accidentals = 'flat') {
  const optionsRef = useRef(opts)
  optionsRef.current = opts
  const tracker = useRef(new VoiceTracker())
  const holds = useRef(new Map<number, HeldKey>())
  const cancelled = useRef(new Map<number, number>())
  const [snapshot, setSnapshot] = useState<ReadonlyMap<number, HeldKey>>(() => new Map())

  const press = useCallback((key: number, velocity: number) => {
    if (!Number.isInteger(key) || key < 0 || key > 127 || cancelled.current.has(key)) return false
    const { chord, mode, isDrums, noteOn } = optionsRef.current
    if (isDrums && !drumPadFor(key)) return false
    const existing = holds.current.get(key)
    if (existing) {
      existing.count++
      return true
    }
    const chordType = mode === 'chord' && !isDrums ? chord : undefined
    holds.current.set(key, { count: 1, chord: chordType })
    const notes = chordType ? chordNotes(key, chordType) : [key]
    for (const midi of tracker.current.press(key, notes)) noteOn(midi, velocity)
    setSnapshot(new Map(holds.current))
    return true
  }, [])

  const release = useCallback((key: number) => {
    const remaining = cancelled.current.get(key)
    if (remaining !== undefined) {
      if (remaining === 1) cancelled.current.delete(key)
      else cancelled.current.set(key, remaining - 1)
      return
    }
    const held = holds.current.get(key)
    if (!held || --held.count > 0) return
    holds.current.delete(key)
    for (const midi of tracker.current.release(key)) optionsRef.current.noteOff(midi)
    setSnapshot(new Map(holds.current))
  }, [])

  const stopVoices = useCallback(() => {
    for (const midi of tracker.current.held()) optionsRef.current.noteOff(midi)
    tracker.current = new VoiceTracker()
    holds.current.clear()
  }, [])

  const releaseAll = useCallback(() => {
    if (!holds.current.size) return
    // Wait for the old key-ups before allowing these roots to sound on the new patch.
    for (const [key, held] of holds.current) cancelled.current.set(key, held.count)
    stopVoices()
    setSnapshot(new Map())
  }, [stopVoices])

  useEffect(() => stopVoices, [stopVoices])

  const lit = new Map<number, LitKey>()
  const badges = new Set<number>()
  for (const [root, { chord }] of snapshot) {
    if (chord) {
      const names = spellChord(root, chord, accidentals)
      chordNotes(root, chord).forEach((midi, index) => {
        badges.add(midi)
        if (midi === root || !lit.has(midi)) {
          lit.set(midi, { name: names[index], color: noteColor(midi), root: midi === root })
        }
      })
    } else {
      lit.set(root, { name: pitchName(root, accidentals), color: noteColor(root), root: true })
    }
  }
  return { press, release, releaseAll, lit, badges }
}
