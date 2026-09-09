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

/**
 * True when a completed load left the patch genuinely playable offline: every
 * sample request was satisfied and at least one actually resolved. A load with
 * missing samples still makes noise, but marking it "downloaded" would lie to
 * the picker's offline greyout, so it does not count.
 */
export function isOfflineReady(stats: LoggedStorageStats): boolean {
  if (stats.failed.length > 0) return false
  return stats.attempted > 0 && stats.succeeded === stats.attempted
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

/** True for a URL served by this app itself rather than a sample CDN. */
function isSameOriginAsset(url: string): boolean {
  if (url.startsWith('/')) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(url, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

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

// Store a copy of a network response for offline replay.
//
// The clone is taken synchronously, before this function yields. The same
// response is handed straight back to the loader, which reads its body at once;
// `Response.clone()` throws on a body that is already locked or disturbed, so
// taking the copy up front means the cache write cannot lose that race however
// the cache handle happens to settle.
function putCache(url: string, response: Response): void {
  const cachePromise = openCache()
  if (!cachePromise) return
  let copy: Response
  try {
    copy = response.clone()
  } catch {
    // Body already consumed — nothing we can safely store.
    return
  }
  void cachePromise
    .then((cache) => cache.put(url, copy))
    .catch(() => {
      // quota exceeded or unavailable — ignore
    })
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
      // Bundled patches (public/patches/**) are requested by their own URL and
      // never match a CDN rewrite. Fetch them directly, count them as local,
      // and still copy them into the cache so they survive going offline.
      if (isSameOriginAsset(url)) {
        try {
          const res = await fetch(url)
          if (res.status >= 200 && res.status < 300) {
            succeeded++
            bySource.local++
            onEvent?.(`bundled ✓ ${shortUrl(url)}`)
            putCache(url, res)
            return res
          }
          failed.push(`${res.status} ${url}`)
          onEvent?.(`bundled ${res.status} ${shortUrl(url)}`)
          return res
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          failed.push(`THREW ${msg} ${url}`)
          onEvent?.(`bundled THREW ${shortUrl(url)} ${msg}`)
          throw err
        }
      }
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
          putCache(url, res)
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
