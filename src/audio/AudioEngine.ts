import type { PatchManifest, PatchSource } from '../patches/types'
import { buildEffectChain } from './effects'
import type { EffectId } from './effects'
import { instantiatePatch, type LoadedInstrument, type LoadProgress } from './loadPatch'
import { createLoggedStorage, clearCdnCache, computeSourceTag, type PatchSourceTag } from './loggedStorage'

const MAX_CACHED_INSTRUMENTS = 3

function sourceKey(src: PatchSource): string {
  switch (src.kind) {
    case 'piano':
      return 'piano'
    case 'soundfont':
      return `sf/${src.kit ?? 'MusyngKite'}/${src.instrument}`
    case 'electric-piano':
      return `ep/${src.instrument}`
    case 'mallet':
      return `mallet/${src.instrument}`
    case 'mellotron':
      return `mellotron/${src.instrument}`
    case 'smolken':
      return `smolken/${src.instrument}`
    case 'sampler':
      return `sampler/${src.baseUrl}`
  }
}

interface CachedInstrument {
  instrument: LoadedInstrument
  source: PatchSourceTag
  loadedAt: number
}

export type { PatchSourceTag } from './loggedStorage'

export type { LoadProgress } from './loadPatch'

const _logSubs: Array<(line: string) => void> = []
export function subscribeEngineLog(fn: (line: string) => void): () => void {
  _logSubs.push(fn)
  return () => {
    const idx = _logSubs.indexOf(fn)
    if (idx !== -1) _logSubs.splice(idx, 1)
  }
}

// Wrap context.decodeAudioData with a serial queue. Mobile Firefox silently
// fails decodeAudioData calls under parallel pressure (smplr fires 81+ decode
// calls at once during loadInstrument). Serializing them eliminates the race.
// We also count every decode and log failures to the engine log so we can
// see if any sample is genuinely undecodable.
const decodeCounters = {
  attempted: 0,
  succeeded: 0,
  failed: 0,
  failures: [] as string[],
}
export function resetDecodeCounters() {
  decodeCounters.attempted = 0
  decodeCounters.succeeded = 0
  decodeCounters.failed = 0
  decodeCounters.failures = []
}
export function snapshotDecodeCounters() {
  return { ...decodeCounters, failures: [...decodeCounters.failures] }
}

function emitToLogSubs(line: string) {
  for (const fn of _logSubs) {
    try {
      fn(line)
    } catch {
      // noop
    }
  }
}

function serializeDecodeAudioData(context: AudioContext) {
  const original = context.decodeAudioData.bind(context)
  let queue: Promise<unknown> = Promise.resolve()
  context.decodeAudioData = function patchedDecode(
    audioData: ArrayBuffer,
    successCallback?: DecodeSuccessCallback,
    errorCallback?: DecodeErrorCallback,
  ): Promise<AudioBuffer> {
    decodeCounters.attempted += 1
    const tag = decodeCounters.attempted
    const byteLength = audioData.byteLength
    const next = queue
      .catch(() => undefined)
      .then(async () => {
        try {
          const buffer = await original(audioData)
          decodeCounters.succeeded += 1
          if (decodeCounters.succeeded <= 2) {
            emitToLogSubs(
              `decode ✓ #${tag} (${byteLength}b → ${buffer.duration.toFixed(2)}s)`,
            )
          }
          if (successCallback) successCallback(buffer)
          return buffer
        } catch (err) {
          decodeCounters.failed += 1
          const msg = err instanceof Error ? err.message : String(err)
          decodeCounters.failures.push(`#${tag} ${msg}`)
          emitToLogSubs(`⚠ decode ✗ #${tag} (${byteLength}b) ${msg.slice(0, 100)}`)
          if (errorCallback) errorCallback(err as DOMException)
          throw err
        }
      })
    queue = next
    return next as Promise<AudioBuffer>
  } as typeof context.decodeAudioData
}

// Intercept console.warn so smplr's silent decode failures
// ("Error loading buffer", "Invalid status") show up in the on-screen log.
let _consoleShimInstalled = false
function installConsoleShim() {
  if (_consoleShimInstalled) return
  _consoleShimInstalled = true
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    try {
      const text = args
        .map((a) => {
          if (a instanceof Error) return a.message
          if (typeof a === 'string') return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ')
      if (
        text.includes('Error loading buffer') ||
        text.includes('Invalid status') ||
        text.includes('decodeAudioData') ||
        text.includes('EncodingError')
      ) {
        const line = `⚠ ${text.slice(0, 240)}`
        for (const fn of _logSubs) {
          try {
            fn(line)
          } catch {
            // noop
          }
        }
      }
    } catch {
      // noop
    }
    originalWarn.apply(console, args as Parameters<typeof console.warn>)
  }
}

const log = (msg: string, ...rest: unknown[]) => {
  console.log(`[engine] ${msg}`, ...rest)
  let payload = ''
  if (rest.length > 0) {
    try {
      payload =
        ' ' +
        rest
          .map((r) => {
            if (r instanceof Error) return r.message
            if (typeof r === 'string') return r
            try {
              return JSON.stringify(r)
            } catch {
              return String(r)
            }
          })
          .join(' ')
    } catch {
      payload = ''
    }
  }
  const line = `${msg}${payload}`
  for (const fn of _logSubs) {
    try {
      fn(line)
    } catch {
      // noop
    }
  }
}

export class AudioEngine {
  readonly context: AudioContext
  private chain: ReturnType<typeof buildEffectChain> | null = null
  private current: LoadedInstrument | null = null
  private currentId: string | null = null
  private loadingId: string | null = null
  private loadSeq = 0
  onLoaded?: (id: string, source: PatchSourceTag) => void
  onLoading?: (id: string | null) => void
  onProgress?: (id: string, progress: LoadProgress) => void
  onError?: (id: string, err: unknown) => void
  private currentSource: PatchSourceTag | null = null
  // LRU cache of loaded smplr instruments keyed by source identity. Multiple
  // patches that share the same source (e.g. user-saved variants of CP80) map
  // to a single cached instrument. Map iteration order is insertion order, so
  // re-inserting on access promotes to most-recently-used.
  private instrumentCache: Map<string, CachedInstrument> = new Map()

  constructor() {
    installConsoleShim()
    this.context = new AudioContext()
    serializeDecodeAudioData(this.context)
    log('ctor', { state: this.context.state, sampleRate: this.context.sampleRate })
  }

  async resume(): Promise<void> {
    if (this.context.state !== 'running') {
      try {
        await this.context.resume()
        log('context resumed', { state: this.context.state })
      } catch (err) {
        log('context resume failed', err)
      }
    }
    if (!this.chain) {
      this.chain = buildEffectChain(this.context)
      log('chain built', {
        state: this.context.state,
        sampleRate: this.context.sampleRate,
      })
      // Confirmation chirp through the FX chain so the user knows audio works.
      this.testTone(0.18, 0.08)
    }
  }

  /** Play a short sine pop through the FX chain to confirm the audio path. */
  testTone(seconds = 0.2, gain = 0.12): void {
    if (!this.chain) {
      log('testTone: no chain')
      return
    }
    if (this.context.state !== 'running') {
      log('testTone: context not running', { state: this.context.state })
      void this.context.resume()
    }
    try {
      const ctx = this.context
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 440
      const env = ctx.createGain()
      env.gain.value = 0
      osc.connect(env)
      env.connect(this.chain.inputNode)
      const now = ctx.currentTime
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(gain, now + 0.005)
      env.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
      osc.start(now)
      osc.stop(now + seconds + 0.02)
      log('testTone fired', { seconds, gain })
    } catch (err) {
      log('testTone threw', err)
    }
  }

  async loadPatch(patch: PatchManifest): Promise<void> {
    await this.resume()
    if (!this.chain) {
      log('loadPatch: no chain, abort', patch.id)
      return
    }

    // Fast path: instrument already in memory from this session.
    const cacheKey = sourceKey(patch.source)
    const cached = this.instrumentCache.get(cacheKey)
    if (cached) {
      log('loadPatch cache hit', { id: patch.id, key: cacheKey })
      // Stop voices on whatever was previously current
      if (this.current && this.current !== cached.instrument) {
        try {
          this.current.stop()
        } catch {
          // noop
        }
      }
      // Promote in LRU order
      this.instrumentCache.delete(cacheKey)
      this.instrumentCache.set(cacheKey, cached)
      this.current = cached.instrument
      this.currentId = patch.id
      this.currentSource = cached.source
      this.loadingId = null
      this.loadSeq += 1 // bump so any in-flight load is superseded
      this.onLoading?.(null)
      this.onLoaded?.(patch.id, cached.source)
      return
    }

    const seq = ++this.loadSeq
    this.loadingId = patch.id
    this.onLoading?.(patch.id)
    resetDecodeCounters()
    log('loadPatch start', { id: patch.id, seq, kind: patch.source.kind, key: cacheKey })

    const previous = this.current
    const previousId = this.currentId
    const loggedStorage = createLoggedStorage((line) => log(`[${patch.id}] ${line}`))
    let instrument: LoadedInstrument
    try {
      instrument = instantiatePatch({
        context: this.context,
        destination: this.chain.inputNode,
        patch,
        storage: loggedStorage,
        onLoadProgress: (progress) => {
          // Only report progress for the latest in-flight load
          if (seq !== this.loadSeq) return
          this.onProgress?.(patch.id, progress)
        },
      })
    } catch (err) {
      log('instantiate failed', patch.id, err)
      this.onError?.(patch.id, err)
      this.onLoading?.(null)
      this.loadingId = null
      return
    }
    log('instantiated, awaiting load', patch.id)

    try {
      await instrument.load
    } catch (err) {
      log('load rejected', patch.id, err)
      this.onError?.(patch.id, err)
      if (this.loadingId === patch.id) {
        this.onLoading?.(null)
        this.loadingId = null
      }
      try {
        instrument.disconnect()
      } catch {
        // noop
      }
      return
    }
    const stats = loggedStorage.snapshot()
    const decodeStats = snapshotDecodeCounters()
    log('load resolved', patch.id, {
      seq,
      currentSeq: this.loadSeq,
      fetched: `${stats.succeeded}/${stats.attempted}`,
      decoded: `${decodeStats.succeeded}/${decodeStats.attempted}`,
      decodeFailed: decodeStats.failed,
      failedCount: stats.failed.length,
    })
    if (decodeStats.failed > 0) {
      log('DECODES FAILED', patch.id, decodeStats.failures.slice(0, 5))
    }
    if (stats.failed.length > 0) {
      log('SAMPLES FAILED', patch.id, stats.failed.slice(0, 5))
    }
    if (stats.attempted > 0 && stats.succeeded === 0) {
      log('NO SAMPLES LOADED — instrument will be silent', patch.id)
    }

    if (seq !== this.loadSeq) {
      log('superseded by newer load — discarding', { id: patch.id, seq, currentSeq: this.loadSeq })
      try {
        instrument.disconnect()
      } catch {
        // noop
      }
      return
    }

    // Stop voices on the previous instrument but DON'T disconnect/dispose it —
    // it stays in the cache so we can switch back to it instantly.
    if (previous && previous !== instrument) {
      try {
        previous.stop()
        log('previous voices stopped (kept in cache)', previousId)
      } catch (err) {
        log('previous.stop failed', err)
      }
    }
    this.current = instrument
    this.currentId = patch.id
    this.loadingId = null
    this.currentSource = computeSourceTag(stats)
    // Add to LRU cache and evict the oldest non-current entries if over cap.
    const cacheEntry: CachedInstrument = {
      instrument,
      source: this.currentSource,
      loadedAt: Date.now(),
    }
    this.instrumentCache.set(cacheKey, cacheEntry)
    this.evictCacheIfNeeded()
    log('current set', patch.id, this.currentSource)
    this.onLoading?.(null)
    this.onLoaded?.(patch.id, this.currentSource)
  }

  private evictCacheIfNeeded(): void {
    while (this.instrumentCache.size > MAX_CACHED_INSTRUMENTS) {
      // Iterate to find the oldest entry that ISN'T currently active.
      let evictKey: string | null = null
      for (const [key, entry] of this.instrumentCache) {
        if (entry.instrument !== this.current) {
          evictKey = key
          break
        }
      }
      if (!evictKey) break
      const entry = this.instrumentCache.get(evictKey)
      this.instrumentCache.delete(evictKey)
      try {
        entry?.instrument.stop()
        entry?.instrument.disconnect()
      } catch {
        // noop
      }
      log('evicted from instrument cache', evictKey)
    }
  }

  /** Drop the in-memory instrument cache (used by purgeAndReload). */
  private clearInstrumentCache(): void {
    for (const [key, entry] of this.instrumentCache) {
      try {
        entry.instrument.stop()
        entry.instrument.disconnect()
      } catch {
        // noop
      }
      log('cleared cached instrument', key)
    }
    this.instrumentCache.clear()
  }

  get loadedPatchSource(): PatchSourceTag | null {
    return this.currentSource
  }

  private noteOnCount = 0
  noteOn(midi: number, velocity = 100): void {
    this.noteOnCount += 1
    const tag = this.noteOnCount
    if (!this.current) {
      log('noteOn ✗ no current', { tag, midi, currentId: this.currentId })
      return
    }
    if (this.context.state !== 'running') {
      log('noteOn ✗ context not running', { tag, state: this.context.state })
      void this.context.resume()
    }
    try {
      this.current.start({ note: midi, velocity })
      // Only log every 4th note to avoid log spam during chord/slide play.
      if (tag % 4 === 1) {
        log('noteOn ✓', { tag, midi, vel: velocity, patch: this.currentId })
      }
    } catch (err) {
      log('noteOn ✗ start threw', { tag, midi, currentId: this.currentId, err })
    }
  }

  /**
   * Pre-load a patch into the persistent browser cache without making it the
   * active instrument. Used by the picker's "download for offline" button.
   * Returns true if the load completed (samples are now cached).
   */
  async preloadPatch(patch: PatchManifest): Promise<{
    ok: boolean
    fetched: number
    attempted: number
    failed: string[]
  }> {
    await this.resume()
    if (!this.chain) {
      return { ok: false, fetched: 0, attempted: 0, failed: ['no chain'] }
    }
    log('preloadPatch start', patch.id)
    const loggedStorage = createLoggedStorage((line) => log(`[preload ${patch.id}] ${line}`))
    let instrument: LoadedInstrument
    try {
      instrument = instantiatePatch({
        context: this.context,
        // Send to a dead-end gain so the instrument never produces audible
        // output during preload.
        destination: this.context.createGain(),
        patch,
        storage: loggedStorage,
      })
    } catch (err) {
      log('preload instantiate failed', patch.id, err)
      return { ok: false, fetched: 0, attempted: 0, failed: [String(err)] }
    }
    try {
      await instrument.load
    } catch (err) {
      log('preload load rejected', patch.id, err)
      try {
        instrument.disconnect()
      } catch {
        // noop
      }
      const stats = loggedStorage.snapshot()
      return {
        ok: false,
        fetched: stats.succeeded,
        attempted: stats.attempted,
        failed: stats.failed,
      }
    }
    const stats = loggedStorage.snapshot()
    try {
      instrument.disconnect()
    } catch {
      // noop
    }
    log('preload done', patch.id, {
      fetched: stats.succeeded,
      attempted: stats.attempted,
      failed: stats.failed.length,
    })
    return {
      ok: stats.attempted === 0 || stats.succeeded > 0,
      fetched: stats.succeeded,
      attempted: stats.attempted,
      failed: stats.failed,
    }
  }

  /** Trigger middle C through the current instrument — independent of touch input. */
  testCurrentNote(): void {
    if (!this.current) {
      log('testCurrentNote: no current instrument', { currentId: this.currentId })
      return
    }
    if (this.context.state !== 'running') {
      log('testCurrentNote: context not running', { state: this.context.state })
      void this.context.resume()
    }
    try {
      const stop = this.current.start({ note: 60, velocity: 100 })
      const stopType = typeof stop
      log('testCurrentNote ✓', { patch: this.currentId, stopType })
      window.setTimeout(() => {
        try {
          stop?.()
        } catch {
          // noop
        }
      }, 800)
    } catch (err) {
      log('testCurrentNote: start threw', { err })
    }
  }

  /**
   * Nuke every cached/stale layer for the given patch and re-fetch from
   * scratch. Use when Firefox's HTTP cache, the Cache API, OR a stale
   * smplr instance is suspected of holding bad state.
   */
  async purgeAndReload(patch: PatchManifest): Promise<void> {
    log('purgeAndReload start', patch.id)
    // 1. Drop the in-memory instrument cache so we don't reuse stale buffers
    this.clearInstrumentCache()
    this.current = null
    this.currentId = null
    // 2. Clear the persistent Cache API store
    try {
      await clearCdnCache()
      log('Cache API cleared')
    } catch (err) {
      log('clearCdnCache failed', err)
    }
    // 3. Bump load sequence so any in-flight load is discarded
    this.loadSeq += 1
    // 4. Re-load the patch (will refetch all samples)
    log('purgeAndReload reloading', patch.id)
    await this.loadPatch(patch)
  }

  /**
   * Diagnostic: walk a chromatic scale through the current instrument and
   * log which notes return a non-null voice. Used to figure out why some
   * notes silently produce no sound.
   */
  async testScale(): Promise<void> {
    if (!this.current) {
      log('testScale: no current instrument')
      return
    }
    if (this.context.state !== 'running') {
      try {
        await this.context.resume()
      } catch {
        // noop
      }
    }
    const start = 60 // C4
    const end = 72 // C5
    log('testScale start', { from: start, to: end, patch: this.currentId })
    for (let m = start; m <= end; m++) {
      try {
        const stop = this.current.start({ note: m, velocity: 100 })
        log(`testScale ${m}`, { stopType: typeof stop })
        // hold the note briefly so it's audible
        await new Promise((r) => setTimeout(r, 350))
        try {
          stop?.()
        } catch {
          // noop
        }
      } catch (err) {
        log(`testScale ${m} threw`, err)
      }
    }
    log('testScale done')
  }

  /**
   * Diagnostic: fetch a known vendored sample, decode, and play it directly
   * through the FX chain via a raw AudioBufferSource — bypassing smplr's
   * Channel/Voice/scheduler entirely. If THIS produces sound but live patch
   * notes don't, the bug is inside smplr's voice path. If neither produces
   * sound, the FX chain is broken.
   */
  async testRawBuffer(): Promise<void> {
    if (!this.chain) {
      log('testRawBuffer: no chain')
      return
    }
    if (this.context.state !== 'running') {
      try {
        await this.context.resume()
      } catch {
        // noop
      }
    }
    const url =
      '/smplr-samples/smpldsnds/sfzinstruments-greg-sullivan-e-pianos/cp80/samples/060-C4-MP.ogg'
    try {
      const res = await fetch(url)
      log('testRawBuffer fetch', { status: res.status, contentType: res.headers.get('content-type') })
      if (!res.ok) return
      const data = await res.arrayBuffer()
      log('testRawBuffer arrayBuffer', { byteLength: data.byteLength })
      const buffer = await this.context.decodeAudioData(data)
      log('testRawBuffer decoded', {
        duration: buffer.duration.toFixed(3),
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
      })
      const src = this.context.createBufferSource()
      src.buffer = buffer
      const g = this.context.createGain()
      g.gain.value = 0.7
      src.connect(g).connect(this.chain.inputNode)
      src.start(this.context.currentTime)
      log('testRawBuffer started — listen for piano C')
    } catch (err) {
      log('testRawBuffer threw', err)
    }
  }

  noteOff(midi: number): void {
    if (!this.current) return
    try {
      this.current.stop(midi)
    } catch (err) {
      log('noteOff: stop threw', { midi, err })
    }
  }

  panic(): void {
    if (!this.current) return
    try {
      this.current.stop()
    } catch {
      // noop
    }
  }

  setEffectParam(id: EffectId, paramId: string, value: number): void {
    this.chain?.setParam(id, paramId, value)
  }

  setEffectEnabled(id: EffectId, on: boolean): void {
    this.chain?.setEnabled(id, on)
  }

  get loadedPatchId(): string | null {
    return this.currentId
  }
}

let _engine: AudioEngine | null = null
export function getEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine()
  return _engine
}
