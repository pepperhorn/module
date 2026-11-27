import { describe, expect, it } from 'vitest'
import { CHORD_TYPES, chordNotes } from './chords'
import { pitchName, spellChord } from './spelling'

describe('pitchName', () => {
  it('spells black keys by setting', () => {
    expect(pitchName(61, 'flat')).toBe('D♭')
    expect(pitchName(61, 'sharp')).toBe('C♯')
    expect(pitchName(60, 'flat')).toBe('C')
    expect(pitchName(71, 'sharp')).toBe('B')
  })
})

describe('spellChord', () => {
  it('follows the root', () => {
    expect(spellChord(64, 'maj', 'flat')).toEqual(['E', 'G♯', 'B'])
    expect(spellChord(60, 'min', 'flat')).toEqual(['C', 'E♭', 'G'])
    expect(spellChord(65, 'maj', 'flat')).toEqual(['F', 'A', 'C'])
    expect(spellChord(71, 'dim', 'flat')).toEqual(['B', 'D', 'F'])
    expect(spellChord(60, 'aug', 'flat')).toEqual(['C', 'E', 'G♯'])
  })

  it('uses sharps for a C♯ chord and flats for a D♭ chord', () => {
    expect(spellChord(61, 'maj', 'sharp')).toEqual(['C♯', 'E♯', 'G♯'])
    expect(spellChord(61, 'maj', 'flat')).toEqual(['D♭', 'F', 'A♭'])
  })

  it('falls back to the simple name instead of a double accidental', () => {
    expect(spellChord(68, 'aug', 'sharp')).toEqual(['G♯', 'B♯', 'E'])
  })

  it('spells seventh chords', () => {
    expect(spellChord(60, '7', 'flat')).toEqual(['C', 'E', 'G', 'B♭'])
    expect(spellChord(60, 'maj7', 'flat')).toEqual(['C', 'E', 'G', 'B'])
  })

  it('never produces a double accidental, for any type, root or setting', () => {
    for (const type of CHORD_TYPES) {
      for (let pc = 0; pc < 12; pc++) {
        for (const acc of ['flat', 'sharp'] as const) {
          const names = spellChord(48 + pc, type, acc)
          expect(names.join(' ')).not.toMatch(/[𝄪𝄫]/u)
          expect(names.every((n) => /^[A-G][♯♭]?$/u.test(n))).toBe(true)
        }
      }
    }
  })

  it('names the right pitch classes', () => {
    const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    for (const type of CHORD_TYPES) {
      for (let pc = 0; pc < 12; pc++) {
        for (const acc of ['flat', 'sharp'] as const) {
          const root = 48 + pc
          const names = spellChord(root, type, acc)
          const notes = chordNotes(root, type)
          expect(names).toHaveLength(notes.length)
          names.forEach((n, i) => {
            const shift = n.endsWith('♯') ? 1 : n.endsWith('♭') ? -1 : 0
            expect((PC[n[0]] + shift + 12) % 12).toBe(notes[i] % 12)
          })
        }
      }
    }
  })

  it('stays aligned with chordNotes when tones fall off the top', () => {
    expect(spellChord(125, 'maj7', 'flat')).toEqual(['F'])
    expect(spellChord(120, 'maj7', 'flat')).toEqual(['C', 'E', 'G'])
  })
})
