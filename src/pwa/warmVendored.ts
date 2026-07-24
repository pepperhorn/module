// Idle-triggered warm loop: fetches every vendored sample URL so the service
// worker's CacheFirst route (module-vendored-v1) populates. Runs at low
// priority with bounded concurrency; individual failures are tolerated (a
// flaky/offline network just leaves some samples uncached for next time).
export interface WarmOptions {
  urls: string[]
  fetchFn?: typeof fetch
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface WarmResult {
  done: number
  total: number
  failed: number
}

export async function warmVendored(opts: WarmOptions): Promise<WarmResult> {
  const { urls, onProgress, signal } = opts
  const fetchFn = opts.fetchFn ?? fetch
  const concurrency = Math.max(1, opts.concurrency ?? 4)
  const total = urls.length
  let done = 0
  let failed = 0
  let cursor = 0

  onProgress?.(done, total)
  if (total === 0) return { done, total, failed }

  async function worker() {
    while (cursor < total) {
      if (signal?.aborted) return
      const url = urls[cursor++]
      try {
        // `low` priority keeps this from competing with active audio loads.
        await fetchFn(url, { priority: 'low' } as RequestInit)
      } catch {
        failed++
      }
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  )
  return { done, total, failed }
}
