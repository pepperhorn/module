import { beforeEach, describe, expect, it } from 'vitest'

type Slots = typeof import('./fetchSlots')

let slots: Slots

/** Each test needs the module's counter and queue back at zero. */
beforeEach(async () => {
  const { resetModules } = await import('vitest').then((v) => ({ resetModules: v.vi.resetModules }))
  resetModules()
  slots = await import('./fetchSlots')
})

/** A task whose completion the test controls, tracking real overlap. */
function gatedTasks() {
  const gates: Array<() => void> = []
  let running = 0
  let peak = 0
  const start = () =>
    slots.withFetchSlot(() => {
      running += 1
      peak = Math.max(peak, running)
      return new Promise<void>((resolve) => {
        gates.push(() => {
          running -= 1
          resolve()
        })
      })
    })
  return {
    start,
    release: () => gates.shift()?.(),
    /**
     * Release repeatedly until nothing is left. A queued task only creates its
     * gate once it starts, so draining needs a yield between releases.
     */
    drain: async () => {
      for (let guard = 0; guard < 200; guard++) {
        if (gates.length === 0 && running === 0) return
        gates.shift()?.()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    },
    peak: () => peak,
    running: () => running,
  }
}

describe('withFetchSlot', () => {
  it('runs up to the cap immediately and queues the rest', async () => {
    const cap = slots.maxConcurrentFetches()
    const tasks = gatedTasks()
    for (let i = 0; i < cap + 3; i++) void tasks.start()
    await Promise.resolve()
    await Promise.resolve()
    expect(tasks.running()).toBe(cap)
  })

  it('lets a queued task run when a slot is released', async () => {
    const cap = slots.maxConcurrentFetches()
    const tasks = gatedTasks()
    const all = Array.from({ length: cap + 1 }, () => tasks.start())
    await Promise.resolve()
    tasks.release()
    await new Promise((r) => setTimeout(r, 0))
    expect(tasks.running()).toBe(cap)
    await tasks.drain()
    await Promise.all(all)
    expect(slots.activeFetchCount()).toBe(0)
  })

  // Regression. Releasing a slot only *resolves* the waiter's promise; its
  // continuation runs a microtask later. This test lands a fresh caller in
  // exactly that window — the interleaving that happens for real when a
  // preview or a download starts while a patch load is draining. With the old
  // `if` (rather than `while`) the waiter did not re-check on wake, so both
  // the newcomer and the waiter took a slot and the pool stayed over its cap.
  it('does not let a caller arriving mid-release barge past the cap', async () => {
    const cap = slots.maxConcurrentFetches()
    const tasks = gatedTasks()

    // Saturate, then park one waiter behind the full pool.
    const all = Array.from({ length: cap }, () => tasks.start())
    all.push(tasks.start())
    await new Promise((r) => setTimeout(r, 0))
    expect(tasks.running()).toBe(cap)

    // Free one slot, then let exactly one microtask elapse: the release has
    // decremented the counter, but the woken waiter has not resumed yet.
    tasks.release()
    await Promise.resolve()
    expect(slots.activeFetchCount()).toBeLessThan(cap)

    // A newcomer arrives right here.
    all.push(tasks.start())
    await new Promise((r) => setTimeout(r, 0))

    expect(slots.activeFetchCount()).toBeLessThanOrEqual(cap)
    expect(tasks.peak()).toBeLessThanOrEqual(cap)

    await tasks.drain()
    await Promise.all(all)
    expect(slots.activeFetchCount()).toBe(0)
  })

  it('releases the slot when the task throws', async () => {
    const before = slots.activeFetchCount()
    await expect(
      slots.withFetchSlot(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(slots.activeFetchCount()).toBe(before)
  })
})
