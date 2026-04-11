// Custom smplr Storage that wraps fetch() so we can log every sample request,
// count failures, and surface "silent omission" bugs from smplr's loader.
//
// Resolution cascade for every request:
//   1.  /smplr-samples/<host>/<path>            (vendored at build time)
//   2.  /smplr-samples/<host>/<alt-format-path> (.ogg ⇄ .m4a fallback)
//   3.  Cache API ('module-cdn-v1')             (persistent across reloads)
//   4.  Upstream CDN fetch                      (network — saved to Cache API)
//
// The Cache API tier means a patch is "downloaded for offline" automatically
// the moment it loads successfully. The download button in the picker just
// pre-fills this cache without making the patch the active one.

export type SourceTier = 'local' | 'localAlt' | 'cache' | 'cdn'

export interface LoggedStorageStats {
  attempted: number
  succeeded: number
  failed: string[]
  bySource: Record<SourceTier, number>
}

export interface PatchSourceTag {
  tier: 'local' | 'cache' | 'cdn' | 'mixed' | 'unknown'
  local: number
  cache: number
  cdn: number
  total: number
}

export function computeSourceTag(stats: LoggedStorageStats): PatchSourceTag {
  const local = stats.bySource.local + stats.bySource.localAlt
  const cache = stats.bySource.cache
  const cdn = stats.bySource.cdn
  const total = local + cache + cdn
  if (total === 0) return { tier: 'unknown', local, cache, cdn, total }
  // 100% local — fully vendored
  if (local === total) return { tier: 'local', local, cache, cdn, total }
  // No local, all from browser cache (offline-ready from a previous session)
  if (cache > 0 && cdn === 0 && local === 0) {
    return { tier: 'cache', local, cache, cdn, total }
  }
  // No local, all from cdn (first load over the network)
  if (cdn === total) return { tier: 'cdn', local, cache, cdn, total }
  return { tier: 'mixed', local, cache, cdn, total }
}

export interface LoggedStorage {
  fetch: (url: string) => Promise<Response>
  reset(): void
  snapshot(): LoggedStorageStats
}

const HOST_REWRITES: Array<[string, string]> = [
  ['https://smpldsnds.github.io/', '/smplr-samples/smpldsnds/'],
  ['https://gleitz.github.io/', '/smplr-samples/gleitz/'],
  ['https://goldst.dev/', '/smplr-samples/goldst/'],
]

function rewriteToLocal(url: string): string | null {
  for (const [from, to] of HOST_REWRITES) {
    if (url.startsWith(from)) return to + url.slice(from.length)
  }
  return null
}

// Vite's dev server returns the SPA index.html (200 OK, text/html) for any
// unknown path under /smplr-samples/. We need to detect this and treat it as
// a miss so the storage falls through to the next tier.
function isAudioResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.startsWith('audio/')) return true
  if (ct.startsWith('application/octet-stream')) return true
  if (ct.startsWith('binary/')) return true
  // Anything text-shaped (html, json, plain) is definitely not audio bytes.
  if (ct.startsWith('text/') || ct.startsWith('application/json')) return false
  // Unknown content-type — be permissive but log so we notice.
  return true
}

const CACHE_NAME = 'module-cdn-v1'
let _cachePromise: Promise<Cache> | null = null
function openCache(): Promise<Cache> | null {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  if (!_cachePromise) {
    _cachePromise = caches.open(CACHE_NAME).catch(() => {
      _cachePromise = null
      throw new Error('cache open failed')
    }) as Promise<Cache>
  }
  return _cachePromise
}

async function tryCache(url: string): Promise<Response | null> {
  const cachePromise = openCache()
  if (!cachePromise) return null
  try {
    const cache = await cachePromise
    const hit = await cache.match(url)
    return hit ?? null
  } catch {
    return null
  }
}

async function putCache(url: string, response: Response): Promise<void> {
  const cachePromise = openCache()
  if (!cachePromise) return
  try {
    const cache = await cachePromise
    await cache.put(url, response.clone())
  } catch {
    // quota exceeded or unavailable — ignore
  }
}

export async function clearCdnCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return
  try {
    await caches.delete(CACHE_NAME)
    _cachePromise = null
  } catch {
    // noop
  }
}

// Mobile Firefox / Android: too many concurrent decodeAudioData calls cause
// silent decode failures. Throttle storage fetches so decodes happen in waves
// instead of an 81-wide thunderclap.
const MAX_CONCURRENT_FETCHES = 4
let activeFetches = 0
const fetchQueue: Array<() => void> = []

async function withFetchSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve) => fetchQueue.push(resolve))
  }
  activeFetches += 1
  try {
    return await fn()
  } finally {
    activeFetches -= 1
    const next = fetchQueue.shift()
    if (next) next()
  }
}

export function createLoggedStorage(
  onEvent?: (line: string) => void,
): LoggedStorage {
  let attempted = 0
  let succeeded = 0
  const failed: string[] = []
  const bySource: Record<SourceTier, number> = {
    local: 0,
    localAlt: 0,
    cache: 0,
    cdn: 0,
  }

  return {
    fetch: (url: string): Promise<Response> =>
      withFetchSlot(async () => {
      attempted++
      const localPath = rewriteToLocal(url)
      if (localPath) {
        try {
          const localRes = await fetch(localPath)
          if (
            localRes.status >= 200 &&
            localRes.status < 300 &&
            isAudioResponse(localRes)
          ) {
            succeeded++
            bySource.local++
            onEvent?.(`local ✓ ${shortUrl(url)}`)
            return localRes
          }
        } catch {
          // local fetch failed (file missing) — try alternate format below
        }
        // Smplr's loader picks ogg-only or m4a-only per browser. If the chosen
        // format is missing locally, try the other format — many CDN files only
        // exist in one of the two encodings.
        const altLocal = swapAudioExt(localPath)
        if (altLocal && altLocal !== localPath) {
          try {
            const altRes = await fetch(altLocal)
            if (
              altRes.status >= 200 &&
              altRes.status < 300 &&
              isAudioResponse(altRes)
            ) {
              succeeded++
              bySource.localAlt++
              onEvent?.(`local ✓ ${shortUrl(url)} (alt format)`)
              return altRes
            }
          } catch {
            // alt local also missing — fall through to CDN
          }
        }
      }
      // Tier 3: persistent browser cache from a previous load
      const cached = await tryCache(url)
      if (cached) {
        succeeded++
        bySource.cache++
        onEvent?.(`cache ✓ ${shortUrl(url)}`)
        return cached
      }
      // Tier 4: live CDN fetch — store the response in cache for next time
      try {
        const res = await fetch(url)
        if (res.status >= 200 && res.status < 300) {
          succeeded++
          bySource.cdn++
          onEvent?.(`cdn ✓ ${shortUrl(url)}`)
          void putCache(url, res)
        } else {
          failed.push(`${res.status} ${url}`)
          onEvent?.(`cdn ${res.status} ${shortUrl(url)}`)
        }
        return res
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        failed.push(`THREW ${msg} ${url}`)
        onEvent?.(`cdn THREW ${shortUrl(url)} ${msg}`)
        throw err
      }
      }),
    reset: () => {
      attempted = 0
      succeeded = 0
      failed.length = 0
      bySource.local = 0
      bySource.localAlt = 0
      bySource.cache = 0
      bySource.cdn = 0
    },
    snapshot: () => ({
      attempted,
      succeeded,
      failed: failed.slice(),
      bySource: { ...bySource },
    }),
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.slice(-2).join('/')
  } catch {
    return url
  }
}

function swapAudioExt(path: string): string | null {
  if (path.endsWith('.ogg')) return path.slice(0, -4) + '.m4a'
  if (path.endsWith('.m4a')) return path.slice(0, -4) + '.ogg'
  return null
}
