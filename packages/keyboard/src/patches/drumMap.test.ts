// @vitest-environment node
import { describe, expect, it } from 'vitest'
import kit from '../../assets/drums/kit.json'
import { DRUM_MAP, DRUM_RANGE, drumPadFor } from './drumMap'

describe('GM drum map', () => {
  const rows = [
    [[35, 36], 'kick'],
    [[37], 'crossstick'],
    [[38], 'snare-on1'],
    [[40], 'snare-on2'],
    [[41, 43], 'floor-tom'],
    [[42], 'hh-closed1'],
    [[44], 'hh-foot'],
    [[46], 'hh-open'],
    [[45, 47, 48, 50], 'hi-tom'],
    [[49, 57], 'crash'],
    [[51, 59], 'ride'],
    [[53], 'ride-bell'],
  ] as const

  it('maps every note in the spec and adds no other mapped notes', () => {
    for (const [notes, sample] of rows) {
      for (const midi of notes) {
        expect(drumPadFor(midi)).toMatchObject({ midi, sample })
      }
    }
    expect(DRUM_MAP).toHaveLength(rows.reduce((count, [notes]) => count + notes.length, 0))
    expect(DRUM_RANGE).toEqual({ low: 35, high: 59 })
  })

  it('leaves MIDI 39 unmapped', () => {
    expect(drumPadFor(39)).toBeUndefined()
  })

  it('ships a drum sample file for every mapped pad', () => {
    const samples: Record<string, { file: string }> = kit.samples
    const files = Object.keys(import.meta.glob('../../assets/drums/*.ogg', { query: '?url' }))
    for (const { sample } of DRUM_MAP) {
      expect(samples[sample], sample).toBeDefined()
      expect(files).toContain('../../assets/drums/' + samples[sample].file)
    }
  })
})
