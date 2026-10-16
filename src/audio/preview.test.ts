import { describe, expect, it } from 'vitest'
import { previewDurationMs, previewRootMidi, previewSequence } from './preview'

describe('previewSequence', () => {
  it('plays a C–D–E–F–G run then a C major triad', () => {
    const events = previewSequence(60)
    expect(events.map((e) => e.notes)).toEqual([
      [60],
      [62],
      [64],
      [65],
      [67],
      [60, 64, 67],
    ])
  })

  it('schedules each event strictly after the previous one', () => {
    const events = previewSequence(60)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].at).toBeGreaterThan(events[i - 1].at)
    }
  })

  it('transposes the whole audition with the root', () => {
    const low = previewSequence(48)
    const mid = previewSequence(60)
    low.forEach((event, i) => {
      expect(event.notes).toEqual(mid[i].notes.map((n) => n - 12))
      expect(event.at).toBe(mid[i].at)
    })
  })
})

describe('previewDurationMs', () => {
  it('covers the release of the final chord', () => {
    const events = previewSequence(60)
    const last = events[events.length - 1]
    expect(previewDurationMs(events)).toBe(last.at + last.hold)
  })
})

describe('previewRootMidi', () => {
  it('uses C of the patch default octave', () => {
    expect(previewRootMidi({ defaultOctave: 4 })).toBe(60)
    expect(previewRootMidi({ defaultOctave: 2 })).toBe(36)
  })

  it('falls back to C4 when the patch has no preference', () => {
    expect(previewRootMidi({})).toBe(60)
  })

  it('clamps to a range every sample set can reach', () => {
    expect(previewRootMidi({ defaultOctave: 0 })).toBe(24)
    expect(previewRootMidi({ defaultOctave: 8 })).toBe(96)
  })
})
