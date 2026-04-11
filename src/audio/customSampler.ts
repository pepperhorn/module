import type { SampleEntry, VelocityTag } from '../patches/types'

const VEL_RANGES: Record<VelocityTag, [number, number]> = {
  pp: [0, 24],
  p: [25, 48],
  mp: [49, 72],
  mf: [73, 96],
  f: [97, 112],
  ff: [113, 127],
  default: [0, 127],
}

interface Region {
  midi: number
  velMin: number
  velMax: number
  variants: AudioBuffer[]
  rrIndex: number
}

interface SamplerSource {
  baseUrl: string
  samples: Record<string, SampleEntry>
}

interface LoadProgressLike {
  loaded: number
  total: number
}

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function noteNameToMidi(name: string): number | null {
  const m = name.match(/^([A-Ga-g])([#b]?)(-?\d+)$/)
  if (!m) return null
  const [, letter, acc, octStr] = m
  const base = NOTE_OFFSETS[letter.toUpperCase()]
  if (base == null) return null
  const accVal = acc === '#' ? 1 : acc === 'b' ? -1 : 0
  return (parseInt(octStr, 10) + 1) * 12 + base + accVal
}

function joinUrl(base: string, path: string): string {
  if (/^https?:|^\//.test(path)) return path
  return base.endsWith('/') ? base + path : `${base}/${path}`
}

export class CustomSampler {
  readonly context: AudioContext
  readonly output: GainNode
  readonly load: Promise<this>
  private regions: Region[] = []
  private byMidi: Map<number, Region[]> = new Map()
  private active: Map<number, AudioBufferSourceNode[]> = new Map()
  private destination?: AudioNode

  private onLoadProgress?: (progress: LoadProgressLike) => void
  private totalSamples = 0
  private loadedSamples = 0

  constructor(
    context: AudioContext,
    options: {
      source: SamplerSource
      destination?: AudioNode
      onLoadProgress?: (progress: LoadProgressLike) => void
    },
  ) {
    this.context = context
    this.output = context.createGain()
    this.destination = options.destination
    this.onLoadProgress = options.onLoadProgress
    if (this.destination) this.output.connect(this.destination)
    this.load = this.loadSource(options.source).then(() => this)
  }

  private async loadSource(source: SamplerSource): Promise<void> {
    // Pre-count samples for progress reporting
    this.totalSamples = 0
    this.loadedSamples = 0
    for (const entry of Object.values(source.samples)) {
      if (typeof entry === 'string') this.totalSamples += 1
      else if (Array.isArray(entry)) this.totalSamples += entry.length
      else {
        for (const v of Object.values(entry)) {
          if (v == null) continue
          this.totalSamples += Array.isArray(v) ? v.length : 1
        }
      }
    }
    this.onLoadProgress?.({ loaded: 0, total: this.totalSamples })

    const tasks: Promise<void>[] = []
    for (const [noteName, entry] of Object.entries(source.samples)) {
      const midi = noteNameToMidi(noteName)
      if (midi == null) continue
      tasks.push(this.loadEntry(midi, entry, source.baseUrl))
    }
    await Promise.all(tasks)
    for (const r of this.regions) {
      const list = this.byMidi.get(r.midi) ?? []
      list.push(r)
      this.byMidi.set(r.midi, list)
    }
  }

  private async loadEntry(midi: number, entry: SampleEntry, baseUrl: string): Promise<void> {
    if (typeof entry === 'string') {
      const buf = await this.fetchBuffer(joinUrl(baseUrl, entry))
      this.regions.push({ midi, velMin: 0, velMax: 127, variants: [buf], rrIndex: 0 })
      return
    }
    if (Array.isArray(entry)) {
      const bufs = await Promise.all(entry.map((p) => this.fetchBuffer(joinUrl(baseUrl, p))))
      this.regions.push({ midi, velMin: 0, velMax: 127, variants: bufs, rrIndex: 0 })
      return
    }
    for (const [tag, paths] of Object.entries(entry)) {
      if (paths == null) continue
      const [velMin, velMax] = VEL_RANGES[tag as VelocityTag] ?? VEL_RANGES.default
      const arr = Array.isArray(paths) ? paths : [paths]
      const bufs = await Promise.all(arr.map((p) => this.fetchBuffer(joinUrl(baseUrl, p))))
      this.regions.push({ midi, velMin, velMax, variants: bufs, rrIndex: 0 })
    }
  }

  private async fetchBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`sample fetch failed: ${url} (${res.status})`)
    const buf = await res.arrayBuffer()
    const decoded = await this.context.decodeAudioData(buf)
    this.loadedSamples += 1
    this.onLoadProgress?.({ loaded: this.loadedSamples, total: this.totalSamples })
    return decoded
  }

  start(event: { note: number | string; velocity?: number }): () => void {
    const target =
      typeof event.note === 'number' ? event.note : (noteNameToMidi(event.note) ?? 60)
    const vel = event.velocity ?? 100
    const nearest = this.findNearestMidi(target)
    if (nearest == null) return () => {}
    const candidates = (this.byMidi.get(nearest) ?? []).filter(
      (r) => vel >= r.velMin && vel <= r.velMax,
    )
    const region = candidates[0] ?? this.byMidi.get(nearest)?.[0]
    if (!region || region.variants.length === 0) return () => {}
    const buf = region.variants[region.rrIndex % region.variants.length]
    region.rrIndex = (region.rrIndex + 1) % region.variants.length

    const src = this.context.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = Math.pow(2, (target - nearest) / 12)
    const gain = this.context.createGain()
    gain.gain.value = (vel / 127) * 0.85
    src.connect(gain).connect(this.output)
    src.start()

    const list = this.active.get(target) ?? []
    list.push(src)
    this.active.set(target, list)

    src.onended = () => {
      const cur = this.active.get(target)
      if (!cur) return
      const idx = cur.indexOf(src)
      if (idx !== -1) cur.splice(idx, 1)
    }

    return () => {
      try {
        src.stop(this.context.currentTime + 0.04)
      } catch {
        // already stopped
      }
    }
  }

  stop(target?: number | string): void {
    if (target == null) {
      for (const list of this.active.values()) {
        for (const s of list) {
          try {
            s.stop()
          } catch {
            // noop
          }
        }
      }
      this.active.clear()
      return
    }
    const midi = typeof target === 'number' ? target : (noteNameToMidi(target) ?? -1)
    const list = this.active.get(midi) ?? []
    for (const s of list) {
      try {
        s.stop(this.context.currentTime + 0.05)
      } catch {
        // noop
      }
    }
    this.active.delete(midi)
  }

  disconnect(): void {
    this.stop()
    try {
      this.output.disconnect()
    } catch {
      // noop
    }
  }

  private findNearestMidi(target: number): number | null {
    if (this.byMidi.size === 0) return null
    let best = -1
    let bestDist = Infinity
    for (const m of this.byMidi.keys()) {
      const d = Math.abs(m - target)
      if (d < bestDist) {
        bestDist = d
        best = m
      }
    }
    return best
  }
}
