// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { bundledPatches, DRUMS_ID, PIANO_ID } from './bundled'

const pianoFiles = Object.keys(import.meta.glob('../../assets/piano/*.{ogg,m4a}', { query: '?url' }))
const drumFiles = Object.keys(import.meta.glob('../../assets/drums/*.{ogg,m4a}', { query: '?url' }))

describe('bundled patches', () => {
  const [piano, drums] = bundledPatches(new URL('https://example.test/assets/'))

  it('ships the piano notes within C2–C7 in both formats', () => {
    expect(piano.id).toBe(PIANO_ID)
    const source = piano.source
    if (source.kind !== 'sampler') throw new Error('Expected a piano sampler')
    expect(source).toMatchObject({ formats: ['ogg', 'm4a'] })
    expect(source.baseUrl).toBe('https://example.test/assets/piano/')
    const notes = Object.keys(source.samples)
    expect(notes).toEqual(expect.arrayContaining(['C2', 'C7']))
    for (const [note, file] of Object.entries(source.samples)) {
      expect(note).toMatch(/^(?:(?:[CDEFGAB]|[DEGAB]b)[2-6]|C7)$/)
      expect(file).toBe(note + '.ogg')
      for (const ext of ['ogg', 'm4a']) {
        expect(pianoFiles).toContain('../../assets/piano/' + note + '.' + ext)
      }
    }
  })

  it('uses exact-only, one-shot drum playback and ships all declared formats', () => {
    expect(drums.id).toBe(DRUMS_ID)
    const source = drums.source
    if (source.kind !== 'sampler') throw new Error('Expected a drum sampler')
    expect(source).toMatchObject({ exactOnly: true, oneShot: true, formats: expect.arrayContaining(['ogg']) })
    if (!('formats' in source) || !Array.isArray(source.formats)) throw new Error('Expected drum formats')
    expect(source.baseUrl).toBe('https://example.test/assets/drums/')
    expect(source.samples).toMatchObject({
      B1: 'acoustic-Kick.ogg',
      C2: 'acoustic-Kick.ogg',
      F3: 'acoustic-RideBell.ogg',
      B3: 'acoustic-Ride.ogg',
    })
    expect(source.samples).not.toHaveProperty('Eb2') // MIDI 39
    for (const file of Object.values(source.samples)) {
      if (typeof file !== 'string') throw new Error('Expected a single drum sample per note')
      for (const ext of source.formats) {
        const path = file.replace(/\.ogg$/, '.' + ext)
        expect(drumFiles).toContain('../../assets/drums/' + path)
      }
    }
  })

  it('keeps a root-relative asset override root-relative', () => {
    expect(bundledPatches('/static/kb')[0].source).toMatchObject({ baseUrl: '/static/kb/piano/' })
  })
})
