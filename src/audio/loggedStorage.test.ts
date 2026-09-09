import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyLoad, isOfflineReady, type LoggedStorageStats } from './loggedStorage'

function stats(partial: Partial<LoggedStorageStats>): LoggedStorageStats {
  return {
    attempted: 0,
    succeeded: 0,
    failed: [],
    bySource: { local: 0, localAlt: 0, cache: 0, cdn: 0 },
    ...partial,
  }
}

describe('classifyLoad', () => {
  // smplr resolves its load promise even when every sample was dropped, so
  // these counts are the only evidence of whether a patch can make a sound.
  it('calls a load with no successes empty', () => {
    expect(classifyLoad(stats({ attempted: 81, succeeded: 0, failed: ['429 a'] }))).toBe(
      'empty',
    )
  })

  it('calls a partial load degraded', () => {
    expect(classifyLoad(stats({ attempted: 81, succeeded: 60, failed: ['404 a'] }))).toBe(
      'degraded',
    )
  })

  it('calls a load degraded when samples went missing without a recorded failure', () => {
    expect(classifyLoad(stats({ attempted: 81, succeeded: 80 }))).toBe('degraded')
  })

  it('calls a whole load complete', () => {
    expect(classifyLoad(stats({ attempted: 81, succeeded: 81 }))).toBe('complete')
  })

  it('does not call a patch that requested nothing empty', () => {
    expect(classifyLoad(stats({}))).toBe('complete')
  })
})

describe('isOfflineReady', () => {
  it('is true when every sample resolved', () => {
    expect(isOfflineReady(stats({ attempted: 12, succeeded: 12 }))).toBe(true)
  })

  it('is false when any sample failed', () => {
    expect(
      isOfflineReady(stats({ attempted: 12, succeeded: 11, failed: ['404 x.ogg'] })),
    ).toBe(false)
  })

  it('is false on a partial load even with no recorded failures', () => {
    expect(isOfflineReady(stats({ attempted: 12, succeeded: 11 }))).toBe(false)
  })

  it('is false when nothing was fetched at all', () => {
    expect(isOfflineReady(stats({}))).toBe(false)
  })
})

describe('createLoggedStorage CDN caching', () => {
  const stored: Array<{ url: string; bytes: number }> = []
  let put: ReturnType<typeof vi.fn>

  /**
   * The real Cache API is IndexedDB-backed, so `caches.open()` settles a task
   * later — not on the next microtask. The delay is the whole point of this
   * mock: it is the window in which the caller consumes the response body.
   */
  function stubCaches() {
    put = vi.fn(async (url: string, res: Response) => {
      stored.push({ url, bytes: (await res.arrayBuffer()).byteLength })
    })
    vi.stubGlobal('caches', {
      open: vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ match: async () => undefined, put }), 0),
          ),
      ),
    })
  }

  function stubFetch(response: () => Response) {
    vi.stubGlobal('fetch', vi.fn(async () => response()))
  }

  // Each test needs a module instance with a fresh memoised cache handle.
  async function freshStorage() {
    vi.resetModules()
    const { createLoggedStorage } = await import('./loggedStorage')
    return createLoggedStorage()
  }

  beforeEach(() => {
    stored.length = 0
    stubCaches()
    stubFetch(
      () =>
        new Response(new Uint8Array([1, 2, 3, 4, 5]), {
          status: 200,
          headers: { 'content-type': 'audio/ogg' },
        }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Regression: the copy used to be taken after `await caches.open(...)`, by
  // which time smplr had already locked the body reading it — `clone()` threw,
  // the write was swallowed, and nothing ever reached the offline cache.
  it('caches the response even when the caller consumes the body immediately', async () => {
    const storage = await freshStorage()
    const res = await storage.fetch('https://cdn.example.test/samples/C4.ogg')

    // Exactly what smplr does the instant it gets the response.
    await res.arrayBuffer()

    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(stored[0]).toEqual({
      url: 'https://cdn.example.test/samples/C4.ogg',
      bytes: 5,
    })
  })

  it('reports a clean CDN load as offline-ready', async () => {
    const storage = await freshStorage()
    await storage.fetch('https://cdn.example.test/samples/C4.ogg')
    expect(isOfflineReady(storage.snapshot())).toBe(true)
  })

  it('serves a bundled patch sample from the cache when the network is gone', async () => {
    // Fill the cache from a first, online load...
    const online = await freshStorage()
    await online.fetch('/patches/poly-bass/C3.wav')
    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const cached = stored[0]

    // ...then go offline. The cache write above is only worth making if a
    // later load actually reads it back.
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('caches', {
      open: vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  match: async (url: string) =>
                    url === cached.url ? new Response(new Uint8Array(cached.bytes)) : undefined,
                  put: vi.fn(),
                }),
              0,
            ),
          ),
      ),
    })
    const offline = await freshStorage()
    const res = await offline.fetch('/patches/poly-bass/C3.wav')
    expect(res.ok).toBe(true)
    expect((await res.arrayBuffer()).byteLength).toBe(5)
    expect(isOfflineReady(offline.snapshot())).toBe(true)
  })

  it('rejects an SPA fallback served in place of a missing bundled sample', async () => {
    // A host with a catch-all rewrite answers a missing /patches/** file with
    // index.html and a 200. Accepting it would count HTML as a resolved sample
    // and pin it in the cache, which is read in preference to the network — so
    // the sample would stay broken even after the correct file was deployed.
    stubFetch(
      () =>
        new Response('<!doctype html><title>MODULE</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    )
    const storage = await freshStorage()
    const res = await storage.fetch('/patches/poly-bass/typo.wav')

    expect(res.ok).toBe(false)
    const snapshot = storage.snapshot()
    expect(snapshot.succeeded).toBe(0)
    expect(snapshot.failed).toEqual(['NOT AUDIO /patches/poly-bass/typo.wav'])
    expect(isOfflineReady(snapshot)).toBe(false)
    // Nothing may reach the offline cache.
    expect(put).not.toHaveBeenCalled()
  })

  it('does not report a load with a missing sample as offline-ready', async () => {
    stubFetch(() => new Response(null, { status: 404 }))
    const storage = await freshStorage()
    await storage.fetch('https://cdn.example.test/samples/missing.ogg')
    expect(isOfflineReady(storage.snapshot())).toBe(false)
  })
})
