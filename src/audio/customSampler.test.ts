// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PatchSource } from '../patches/types'
import { CustomSampler } from './customSampler'

type SamplerSource = Extract<PatchSource, { kind: 'sampler' }>

async function loadSampler(overrides: Partial<SamplerSource> = {}) {
  const output = { gain: { value: 1 } }
  const node = {
    buffer: null,
    playbackRate: { value: 1 },
    connect: vi.fn(() => ({ connect: vi.fn() })),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const context = {
    currentTime: 4,
    createGain: vi.fn(() => output),
    createBufferSource: vi.fn(() => node),
    decodeAudioData: vi.fn(async () => ({})),
  }
  const storage = { fetch: vi.fn(async (_url: string) => new Response(new ArrayBuffer(1))) }
  const source: SamplerSource = {
    kind: 'sampler',
    baseUrl: '/samples',
    samples: { C4: 'c4.ogg' },
    ...overrides,
  }
  const sampler = new CustomSampler(context as unknown as AudioContext, { source, storage })
  await sampler.load
  return { sampler, storage, context, node }
}

afterEach(() => vi.unstubAllGlobals())

describe('CustomSampler', () => {
  it.each(['ogg', 'm4a'])('formats: picks first playable extension (%s)', async (extension) => {
    const canPlayType = vi.fn((mime: string) => {
      if (mime === 'audio/ogg') return extension === 'ogg' ? 'probably' : ''
      return mime === 'audio/mp4' ? 'maybe' : ''
    })
    vi.stubGlobal('Audio', class {
      canPlayType = canPlayType
    })

    const { storage } = await loadSampler({
      formats: ['ogg', 'm4a', 'mp3'],
      samples: {
        C4: 'c4.ogg',
        D4: ['d4-1.ogg', 'd4-2.ogg'],
        E4: { f: 'https://example.test/e4.ogg?v=1.0#sample', p: ['e4-p.ogg'] },
      },
    })

    expect(canPlayType.mock.calls).toEqual(
      extension === 'ogg' ? [['audio/ogg']] : [['audio/ogg'], ['audio/mp4']],
    )
    expect(storage.fetch.mock.calls.flat()).toEqual([
      `/samples/c4.${extension}`,
      `/samples/d4-1.${extension}`,
      `/samples/d4-2.${extension}`,
      `https://example.test/e4.${extension}?v=1.0#sample`,
      `/samples/e4-p.${extension}`,
    ])
  })

  it('exactOnly: unmapped note returns a no-op and starts no source', async () => {
    const { sampler, context, node } = await loadSampler({ exactOnly: true })

    sampler.start({ note: 61 })()
    sampler.start({ note: 'not a note' })()
    expect(context.createBufferSource).not.toHaveBeenCalled()

    sampler.start({ note: 'C4' })
    expect(node.start).toHaveBeenCalledOnce()
    expect(node.playbackRate.value).toBe(1)
  })

  it('oneShot: calling stop does not stop the source', async () => {
    const { sampler, node } = await loadSampler({ oneShot: true })
    const stop = sampler.start({ note: 60 })
    expect(node.start).toHaveBeenCalledOnce()

    stop()
    sampler.stop(60)
    expect(node.stop).not.toHaveBeenCalled()

    sampler.stop()
    expect(node.stop).toHaveBeenCalledExactlyOnceWith()
  })

  it('default: nearest sample repitched and 40ms release unchanged', async () => {
    const { sampler, storage, node } = await loadSampler()

    const stop = sampler.start({ note: 63 })
    expect(storage.fetch).toHaveBeenCalledExactlyOnceWith('/samples/c4.ogg')
    expect(node.start).toHaveBeenCalledOnce()
    expect(node.playbackRate.value).toBeCloseTo(2 ** (3 / 12))

    stop()
    expect(node.stop).toHaveBeenNthCalledWith(1, 4.04)
    sampler.stop(63)
    expect(node.stop).toHaveBeenNthCalledWith(2, 4.05)
  })
})
