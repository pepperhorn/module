import { describe, expect, it } from 'vitest'
import { chordNotes } from './chords'
import { VoiceTracker } from './voices'

const sorted = (a: number[]) => [...a].sort((x, y) => x - y)

describe('VoiceTracker', () => {
  it('starts every tone of a fresh chord and stops them on release', () => {
    const v = new VoiceTracker()
    expect(sorted(v.press(60, chordNotes(60, 'maj')))).toEqual([60, 64, 67])
    expect(sorted(v.release(60))).toEqual([60, 64, 67])
    expect(v.held().size).toBe(0)
  })

  it('keeps shared tones sounding until the last chord using them is released', () => {
    const v = new VoiceTracker()
    expect(sorted(v.press(60, chordNotes(60, 'maj')))).toEqual([60, 64, 67])
    // A min = 57, 60, 64 shares C and E
    expect(v.press(57, chordNotes(57, 'min'))).toEqual([57])
    expect(sorted([...v.held()])).toEqual([57, 60, 64, 67])
    expect(v.release(60)).toEqual([67])
    expect(sorted([...v.held()])).toEqual([57, 60, 64])
    expect(sorted(v.release(57))).toEqual([57, 60, 64])
    expect(v.held().size).toBe(0)
  })

  it('does not double-count pressing the same key twice', () => {
    const v = new VoiceTracker()
    expect(sorted(v.press(60, [60, 64, 67]))).toEqual([60, 64, 67])
    expect(v.press(60, [60, 64, 67])).toEqual([])
    expect(sorted(v.release(60))).toEqual([60, 64, 67])
    expect(v.release(60)).toEqual([])
  })

  it('releases the tones it recorded, whatever the later chord type', () => {
    const v = new VoiceTracker()
    v.press(60, chordNotes(60, 'maj'))
    expect(sorted(v.release(60))).toEqual([60, 64, 67])
  })

  it('tracks held root keys', () => {
    const v = new VoiceTracker()
    v.press(60, [60, 64, 67])
    v.press(62, [62, 66, 69])
    expect(sorted([...v.roots()])).toEqual([60, 62])
    v.release(60)
    expect([...v.roots()]).toEqual([62])
  })

  it('ignores a release for a key that is not held', () => {
    expect(new VoiceTracker().release(40)).toEqual([])
  })
})
