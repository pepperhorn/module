import { describe, expect, it } from 'vitest'
import { CHORD_INTERVALS, CHORD_TYPES, chordNotes } from './chords'

describe('chordNotes', () => {
  it('lists the six types in display order', () => {
    expect(CHORD_TYPES).toEqual(['maj', 'min', 'dim', 'aug', '7', 'maj7'])
  })

  for (const type of CHORD_TYPES) {
    it(`${type}: intervals from every root`, () => {
      for (let pc = 0; pc < 12; pc++) {
        const root = 48 + pc
        expect(chordNotes(root, type)).toEqual(CHORD_INTERVALS[type].map((i) => root + i))
      }
    })
  }

  it('matches the interval table', () => {
    expect(CHORD_INTERVALS).toEqual({
      maj: [0, 4, 7],
      min: [0, 3, 7],
      dim: [0, 3, 6],
      aug: [0, 4, 8],
      '7': [0, 4, 7, 10],
      maj7: [0, 4, 7, 11],
    })
  })

  it('clamps chord tones to 0..127', () => {
    expect(chordNotes(125, 'maj7')).toEqual([125])
    expect(chordNotes(124, 'maj7')).toEqual([124])
    expect(chordNotes(120, 'maj7')).toEqual([120, 124, 127])
    expect(chordNotes(127, 'maj')).toEqual([127])
  })
})
