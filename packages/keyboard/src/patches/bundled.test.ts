// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import drumKit from '../../assets/drums/kit.json'
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
    expect(drumKit.formats).toEqual(['ogg', 'm4a'])
    expect(source).toMatchObject({ exactOnly: true, oneShot: true, formats: drumKit.formats })
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
      for (const ext of drumKit.formats) {
        const path = file.replace(/\.ogg$/, '.' + ext)
        expect(drumFiles).toContain('../../assets/drums/' + path)
      }
    }
  })

  it.each(['ogg', 'm4a'])('uses absolute %s sample URLs and distinct cache keys by default', (format) => {
    const playable = format === 'ogg' ? 'audio/ogg; codecs="vorbis"' : 'audio/mp4; codecs="mp4a.40.2"'
    vi.stubGlobal('Audio', class {
      canPlayType(mime: string) { return mime === playable ? 'probably' : '' }
    })
    try {
      const [piano, drums] = bundledPatches().map(patch => patch.source)
      if (piano.kind !== 'sampler' || drums.kind !== 'sampler') throw new Error('Expected sampler patches')
      expect(piano.baseUrl).not.toBe(drums.baseUrl)
      expect(piano.formats).toBeUndefined()
      expect(drums.formats).toBeUndefined()
      expect(new URL(String(piano.samples.C2)).pathname).toMatch(new RegExp(`/assets/piano/C2\\.${format}$`))
      expect(new URL(String(drums.samples.B1)).pathname).toMatch(new RegExp(`/assets/drums/acoustic-Kick\\.${format}$`))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps a root-relative asset override root-relative', () => {
    expect(bundledPatches('/static/kb')[0].source).toMatchObject({ baseUrl: '/static/kb/piano/' })
  })
})
