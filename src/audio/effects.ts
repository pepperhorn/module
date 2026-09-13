import type { PatchColor } from '../patches/types'

export type EffectId = 'distortion' | 'doubler1' | 'doubler2' | 'chorus' | 'delay' | 'reverb'

export interface EffectParamDef {
  id: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
  labels?: string[]
}

export interface EffectDef {
  id: EffectId
  name: string
  color: PatchColor
  params: EffectParamDef[]
}

/**
 * The effects that actually exist as audio nodes, in their default order.
 *
 * The doublers are deliberately absent: they are note-level triggers fired in
 * AudioEngine.noteOn, not nodes in the graph, so "where they sit in the chain"
 * has no meaning and they cannot be reordered.
 */
export const CHAIN_EFFECT_IDS = ['distortion', 'chorus', 'delay', 'reverb'] as const

export type ChainEffectId = (typeof CHAIN_EFFECT_IDS)[number]

export function isChainEffectId(id: string): id is ChainEffectId {
  return (CHAIN_EFFECT_IDS as readonly string[]).includes(id)
}

/**
 * Coerce anything — persisted state, a saved preset from an older build — into
 * a usable chain order: every effect exactly once. Unknown ids are dropped and
 * missing ones appended in default order, so a stored order can never leave an
 * effect silently unwired.
 */
export function normalizeFxOrder(input: unknown): ChainEffectId[] {
  const out: ChainEffectId[] = []
  if (Array.isArray(input)) {
    for (const entry of input) {
      if (typeof entry !== 'string' || !isChainEffectId(entry)) continue
      if (out.includes(entry)) continue
      out.push(entry)
    }
  }
  for (const id of CHAIN_EFFECT_IDS) {
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** The order with `id` moved by `delta` places, clamped at the ends. */
export function moveInOrder(
  order: ChainEffectId[],
  id: ChainEffectId,
  delta: number,
): ChainEffectId[] {
  const from = order.indexOf(id)
  if (from === -1) return order
  const to = from + delta
  if (to < 0 || to >= order.length) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

export const DOUBLER_SNAPS = [
  { st: -12, label: '-OCT' },
  { st: -11, label: '-M7' },
  { st: -10, label: '-m7' },
  { st: -7,  label: '-5' },
  { st: -5,  label: '-4' },
  { st: -4,  label: '-M3' },
  { st: -3,  label: '-m3' },
  { st: 0,   label: 'UNI' },
  { st: 3,   label: 'm3' },
  { st: 4,   label: 'M3' },
  { st: 5,   label: '4' },
  { st: 7,   label: '5' },
  { st: 10,  label: 'm7' },
  { st: 11,  label: 'M7' },
  { st: 12,  label: '+OCT' },
] as const

const SNAP_LABELS = DOUBLER_SNAPS.map((s) => s.label)
const SNAP_DEFAULT = DOUBLER_SNAPS.findIndex((s) => s.st === 0)

export const EFFECT_DEFS: EffectDef[] = [
  {
    id: 'distortion',
    name: 'DIST',
    color: 'coral',
    params: [
      { id: 'drive', label: 'drive', min: 0, max: 1, step: 0.01, default: 0.4 },
      { id: 'tone', label: 'tone', min: 0, max: 1, step: 0.01, default: 0.55 },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'doubler1',
    name: 'DBL 1',
    color: 'lavender',
    params: [
      { id: 'pitch', label: 'pitch', min: 0, max: DOUBLER_SNAPS.length - 1, step: 1, default: SNAP_DEFAULT, labels: [...SNAP_LABELS] },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'doubler2',
    name: 'DBL 2',
    color: 'rose',
    params: [
      { id: 'pitch', label: 'pitch', min: 0, max: DOUBLER_SNAPS.length - 1, step: 1, default: SNAP_DEFAULT, labels: [...SNAP_LABELS] },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'chorus',
    name: 'CHORUS',
    color: 'lime',
    params: [
      { id: 'rate', label: 'rate', min: 0.1, max: 8, step: 0.05, default: 1.5, unit: 'Hz' },
      { id: 'depth', label: 'depth', min: 0, max: 1, step: 0.01, default: 0.55 },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'delay',
    name: 'DELAY',
    color: 'amber',
    params: [
      { id: 'time', label: 'time', min: 0.02, max: 1.2, step: 0.01, default: 0.32, unit: 's' },
      { id: 'feedback', label: 'fbk', min: 0, max: 0.92, step: 0.01, default: 0.4 },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'reverb',
    name: 'REVERB',
    color: 'sky',
    params: [
      { id: 'size', label: 'size', min: 0.1, max: 8, step: 0.1, default: 2.5, unit: 's' },
      { id: 'predelay', label: 'pre', min: 0, max: 0.2, step: 0.005, default: 0.02, unit: 's' },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
]

export function defaultParams(): Record<EffectId, Record<string, number>> {
  const out = {} as Record<EffectId, Record<string, number>>
  for (const def of EFFECT_DEFS) {
    const params: Record<string, number> = {}
    for (const p of def.params) params[p.id] = p.default
    out[def.id] = params
  }
  return out
}

interface FxNode {
  input: AudioNode
  output: AudioNode
  setParam: (paramId: string, value: number) => void
  setEnabled: (on: boolean) => void
  dispose: () => void
}

// ───────────────────────────────────────────────────────────────────────
// Distortion: WaveShaper with tanh curve + post low-pass tone shaper
// ───────────────────────────────────────────────────────────────────────
function makeDistortion(ctx: AudioContext): FxNode {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  shaper.oversample = '2x'
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 4000
  tone.Q.value = 0.5

  let drive = 0.4
  let mix = 0
  let bypass = false

  const buildCurve = (amount: number) => {
    const n = 1024
    const curve = new Float32Array(n)
    const k = amount * 100
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
    }
    return curve
  }

  shaper.curve = buildCurve(drive)
  dry.gain.value = 1
  wet.gain.value = 0

  // Routing: input → dry → output
  //          input → shaper → tone → wet → output
  input.connect(dry).connect(output)
  input.connect(shaper)
  shaper.connect(tone)
  tone.connect(wet)
  wet.connect(output)

  const apply = () => {
    const effectiveMix = bypass ? 0 : mix
    wet.gain.value = effectiveMix
    dry.gain.value = 1 - effectiveMix * 0.5
  }

  return {
    input,
    output,
    setParam: (paramId, value) => {
      switch (paramId) {
        case 'drive':
          drive = value
          shaper.curve = buildCurve(value)
          break
        case 'tone':
          tone.frequency.value = 200 + value * 9000
          break
        case 'mix':
          mix = value
          apply()
          break
      }
    },
    setEnabled: (on) => {
      bypass = !on
      apply()
    },
    dispose: () => {
      try {
        input.disconnect()
        shaper.disconnect()
        tone.disconnect()
        wet.disconnect()
        dry.disconnect()
        output.disconnect()
      } catch {
        // noop
      }
    },
  }
}

// ───────────────────────────────────────────────────────────────────────
// Chorus: LFO-modulated delay (single voice — keep it simple/cheap)
// ───────────────────────────────────────────────────────────────────────
function makeChorus(ctx: AudioContext): FxNode {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const delay = ctx.createDelay(0.05)
  delay.delayTime.value = 0.012

  const lfo = ctx.createOscillator()
  lfo.frequency.value = 1.5
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.0035 // depth in seconds (3.5ms swing)
  lfo.connect(lfoGain).connect(delay.delayTime)
  try {
    lfo.start()
  } catch {
    // noop
  }

  dry.gain.value = 1
  wet.gain.value = 0

  input.connect(dry).connect(output)
  input.connect(delay)
  delay.connect(wet)
  wet.connect(output)

  let mix = 0
  let bypass = false
  const apply = () => {
    wet.gain.value = bypass ? 0 : mix
  }

  return {
    input,
    output,
    setParam: (paramId, value) => {
      switch (paramId) {
        case 'rate':
          lfo.frequency.value = value
          break
        case 'depth':
          // 0..1 → 0.5ms..6ms swing
          lfoGain.gain.value = 0.0005 + value * 0.0055
          break
        case 'mix':
          mix = value
          apply()
          break
      }
    },
    setEnabled: (on) => {
      bypass = !on
      apply()
    },
    dispose: () => {
      try {
        lfo.stop()
        lfo.disconnect()
        lfoGain.disconnect()
        delay.disconnect()
        dry.disconnect()
        wet.disconnect()
        input.disconnect()
        output.disconnect()
      } catch {
        // noop
      }
    },
  }
}

// ───────────────────────────────────────────────────────────────────────
// Delay: feedback delay with tone-shaped feedback loop
// ───────────────────────────────────────────────────────────────────────
function makeDelay(ctx: AudioContext): FxNode {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const delay = ctx.createDelay(2.0)
  delay.delayTime.value = 0.32
  const feedback = ctx.createGain()
  feedback.gain.value = 0.4
  const fbTone = ctx.createBiquadFilter()
  fbTone.type = 'lowpass'
  fbTone.frequency.value = 3500

  dry.gain.value = 1
  wet.gain.value = 0

  input.connect(dry).connect(output)
  input.connect(delay)
  delay.connect(fbTone)
  fbTone.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  wet.connect(output)

  let mix = 0
  let bypass = false
  const apply = () => {
    wet.gain.value = bypass ? 0 : mix
  }

  return {
    input,
    output,
    setParam: (paramId, value) => {
      switch (paramId) {
        case 'time':
          delay.delayTime.value = value
          break
        case 'feedback':
          feedback.gain.value = value
          break
        case 'mix':
          mix = value
          apply()
          break
      }
    },
    setEnabled: (on) => {
      bypass = !on
      apply()
    },
    dispose: () => {
      try {
        input.disconnect()
        delay.disconnect()
        fbTone.disconnect()
        feedback.disconnect()
        wet.disconnect()
        dry.disconnect()
        output.disconnect()
      } catch {
        // noop
      }
    },
  }
}

// ───────────────────────────────────────────────────────────────────────
// Reverb: ConvolverNode with a synthesised exponential noise IR
// ───────────────────────────────────────────────────────────────────────
function makeReverb(ctx: AudioContext): FxNode {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const preDelay = ctx.createDelay(0.25)
  preDelay.delayTime.value = 0.02
  const convolver = ctx.createConvolver()

  let size = 2.5

  const buildIR = (decaySeconds: number) => {
    const sr = ctx.sampleRate
    const len = Math.max(1, Math.floor(sr * decaySeconds))
    const ir = ctx.createBuffer(2, len, sr)
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const t = i / len
        // exponential decay × white noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.0)
      }
    }
    return ir
  }
  convolver.buffer = buildIR(size)

  dry.gain.value = 1
  wet.gain.value = 0

  input.connect(dry).connect(output)
  input.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(wet)
  wet.connect(output)

  let mix = 0
  let bypass = false
  let pendingIR: number | null = null
  const apply = () => {
    wet.gain.value = bypass ? 0 : mix
  }

  return {
    input,
    output,
    setParam: (paramId, value) => {
      switch (paramId) {
        case 'size':
          size = value
          // debounce IR rebuild
          if (pendingIR != null) window.clearTimeout(pendingIR)
          pendingIR = window.setTimeout(() => {
            convolver.buffer = buildIR(size)
            pendingIR = null
          }, 60)
          break
        case 'predelay':
          preDelay.delayTime.value = value
          break
        case 'mix':
          mix = value
          apply()
          break
      }
    },
    setEnabled: (on) => {
      bypass = !on
      apply()
    },
    dispose: () => {
      try {
        input.disconnect()
        preDelay.disconnect()
        convolver.disconnect()
        wet.disconnect()
        dry.disconnect()
        output.disconnect()
      } catch {
        // noop
      }
    },
  }
}

export interface EffectChain {
  /**
   * Where instruments connect. This node's identity never changes, including
   * across a reorder — instruments are wired to it at construction and kept in
   * the engine's LRU cache, so a chain whose input was the first effect would
   * silence every cached instrument the moment the order changed.
   */
  inputNode: AudioNode
  master: GainNode
  setEnabled: (id: EffectId, on: boolean) => void
  setParam: (id: EffectId, paramId: string, value: number) => void
  setOrder: (order: ChainEffectId[]) => void
  getOrder: () => ChainEffectId[]
  dispose: () => void
}

export function buildEffectChain(context: AudioContext): EffectChain {
  const distortion = makeDistortion(context)
  const chorus = makeChorus(context)
  const delay = makeDelay(context)
  const reverb = makeReverb(context)
  const master = context.createGain()
  master.gain.value = 0.85
  master.connect(context.destination)

  // A fixed entry point, so instruments keep a stable destination no matter how
  // the effects behind it are reordered.
  const entry = context.createGain()

  const chainMap: Record<ChainEffectId, FxNode> = {
    distortion,
    chorus,
    delay,
    reverb,
  }
  const fxMap: Partial<Record<EffectId, FxNode>> = chainMap

  let order: ChainEffectId[] = normalizeFxOrder(null)

  // Rewire entry → … → master. Every node between them is disconnected first;
  // each effect's output only ever feeds the next stage, so a bare disconnect()
  // cannot tear down any of an effect's internal wet/dry routing.
  const setOrder = (next: ChainEffectId[]) => {
    const wanted = normalizeFxOrder(next)
    try {
      entry.disconnect()
      for (const id of CHAIN_EFFECT_IDS) chainMap[id].output.disconnect()
    } catch {
      // noop
    }
    let previous: AudioNode = entry
    for (const id of wanted) {
      previous.connect(chainMap[id].input)
      previous = chainMap[id].output
    }
    previous.connect(master)
    order = wanted
  }

  setOrder(order)

  const inputNode = entry

  const setEnabled = (id: EffectId, on: boolean) => {
    fxMap[id]?.setEnabled(on)
  }
  const setParam = (id: EffectId, paramId: string, value: number) => {
    fxMap[id]?.setParam(paramId, value)
  }

  // Apply defaults (skips doublers since they're not in fxMap)
  for (const def of EFFECT_DEFS) {
    for (const p of def.params) setParam(def.id, p.id, p.default)
  }

  const dispose = () => {
    try {
      entry.disconnect()
    } catch {
      // noop
    }
    distortion.dispose()
    chorus.dispose()
    delay.dispose()
    reverb.dispose()
    try {
      master.disconnect()
    } catch {
      // noop
    }
  }

  return { inputNode, master, setEnabled, setParam, setOrder, getOrder: () => [...order], dispose }
}
