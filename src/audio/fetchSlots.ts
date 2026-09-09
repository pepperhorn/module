// A process-wide limit on how many sample fetches are in flight at once.
//
// Mobile Firefox / Android silently fail `decodeAudioData` when too many
// decodes are kicked off in parallel, and smplr fires one per sample — 81+ at
// once for a large instrument. Throttling the fetches makes the decodes happen
// in waves instead of a thunderclap.
//
// The limit is deliberately global rather than per-loader: an audition or an
// offline download running alongside an active patch load shares the same
// budget, because the browser's decoder is what is being protected.

const MAX_CONCURRENT_FETCHES = 4

let active = 0
const waiting: Array<() => void> = []

/** How many fetches hold a slot right now. Exposed for tests and diagnostics. */
export function activeFetchCount(): number {
  return active
}

export function maxConcurrentFetches(): number {
  return MAX_CONCURRENT_FETCHES
}

export async function withFetchSlot<T>(fn: () => Promise<T>): Promise<T> {
  // `while`, not `if`. Releasing a slot only *resolves* a waiter's promise —
  // its continuation runs a microtask later, and a caller arriving in that
  // window sees the decremented count, takes the slot without queueing, and
  // then the waking waiter takes one too. With `if` the total stays over the
  // cap for the rest of the drain; re-checking on wake closes that hole.
  while (active >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  active += 1
  try {
    return await fn()
  } finally {
    active -= 1
    waiting.shift()?.()
  }
}
