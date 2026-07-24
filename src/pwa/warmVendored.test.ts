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
})
