import { describe, expect, it } from 'vitest'
import { noteColor } from './colors'

const CRF = [
  '#f86e6e', '#f58841', '#ffbc57', '#b8a334', '#fff56d', '#b3f888',
  '#93d154', '#6bc6a0', '#7ee8df', '#88a7f8', '#cc97e8', '#e277b1',
]

describe('noteColor', () => {
  it('matches the CRF table for all 12 pitch classes', () => {
    CRF.forEach((hex, pc) => expect(noteColor(60 + pc)).toBe(hex))
  })

  it('ignores the octave', () => {
    expect(noteColor(36)).toBe(noteColor(96))
    expect(noteColor(0)).toBe(CRF[0])
    expect(noteColor(127)).toBe(CRF[7])
  })
})
