import { describe, it, expect, vi } from 'vitest'
import { warmVendored } from './warmVendored'

describe('warmVendored', () => {
  it('fetches every url and reports final progress', async () => {
    const urls = ['/a.ogg', '/b.ogg', '/c.ogg']
    const fetchFn = vi.fn(async () => new Response('x', { status: 200 }))
    const progress: Array<[number, number]> = []

    const result = await warmVendored({
      urls,
      fetchFn: fetchFn as unknown as typeof fetch,
      concurrency: 2,
      onProgress: (done, total) => progress.push([done, total]),
    })

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ done: 3, total: 3, failed: 0 })
    expect(progress.at(-1)).toEqual([3, 3])
  })

  it('counts failures but still completes', async () => {
    const urls = ['/a.ogg', '/b.ogg']
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('x', { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'))

    const result = await warmVendored({
      urls,
      fetchFn: fetchFn as unknown as typeof fetch,
      concurrency: 1,
    })

    expect(result).toEqual({ done: 2, total: 2, failed: 1 })
  })

  it('does nothing for an empty list', async () => {
    const fetchFn = vi.fn()
    const result = await warmVendored({
      urls: [],
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result).toEqual({ done: 0, total: 0, failed: 0 })
  })

  it('never exceeds the configured concurrency', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const resolvers: Array<() => void> = []
    const fetchFn = ((_url: string) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise<Response>((resolve) => {
        resolvers.push(() => {
          inFlight--
          resolve(new Response('x', { status: 200 }))
        })
      })
    }) as unknown as typeof fetch

    const urls = Array.from({ length: 10 }, (_, i) => `/s${i}.ogg`)
    const promise = warmVendored({ urls, fetchFn, concurrency: 3 })

    // Drain: repeatedly let the event loop advance and resolve any pending fetches.
    while (resolvers.length > 0 || inFlight > 0) {
      const next = resolvers.shift()
      if (next) next()
      await Promise.resolve()
    }
    const result = await promise

    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(result).toEqual({ done: 10, total: 10, failed: 0 })
  })

  it('stops starting new fetches once the signal is aborted', async () => {
    const controller = new AbortController()
    let started = 0
    const fetchFn = (async (_url: string) => {
      started++
      // Abort as soon as the first fetch begins, so remaining workers/urls stop.
      controller.abort()
      return new Response('x', { status: 200 })
    }) as unknown as typeof fetch

    const urls = Array.from({ length: 20 }, (_, i) => `/s${i}.ogg`)
    const result = await warmVendored({
      urls,
      fetchFn,
      concurrency: 1,
      signal: controller.signal,
    })

    // With concurrency 1 and abort on the first fetch, far fewer than 20 run.
    expect(started).toBeLessThan(20)
    expect(result.done).toBeLessThan(result.total)
    expect(result.total).toBe(20)
  })
})
