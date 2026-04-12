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
}

export interface EffectDef {
  id: EffectId
  name: string
  color: PatchColor
  params: EffectParamDef[]
}

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
      { id: 'pitch', label: 'pitch', min: -12, max: 12, step: 1, default: 0, unit: 'st' },
      { id: 'mix', label: 'mix', min: 0, max: 1, step: 0.01, default: 0 },
    ],
  },
  {
    id: 'doubler2',
    name: 'DBL 2',
    color: 'rose',
    params: [
      { id: 'pitch', label: 'pitch', min: -12, max: 12, step: 1, default: 0, unit: 'st' },
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

// ───────────────────────────────────────────────────────────────────────
// Doubler / harmoniser: granular pitch shifter using two cross-fading
// delay lines with a sawtooth LFO. The LFO modulates delay time to
// create a continuous pitch shift up to ±12 semitones. Two delay lines
// 180° out of phase provide seamless cross-fade at grain boundaries.
// ───────────────────────────────────────────────────────────────────────
function makeDoubler(ctx: AudioContext): FxNode {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()

  const GRAIN_HZ = 18
  const BASE_DELAY = 0.04

  const delay1 = ctx.createDelay(0.5)
  const delay2 = ctx.createDelay(0.5)
  delay1.delayTime.value = BASE_DELAY
  delay2.delayTime.value = BASE_DELAY

  const fade1 = ctx.createGain()
  const fade2 = ctx.createGain()
  fade1.gain.value = 0
  fade2.gain.value = 0

  const lfo = ctx.createOscillator()
  lfo.type = 'sawtooth'
  lfo.frequency.value = GRAIN_HZ

  const lfoDepth1 = ctx.createGain()
  lfoDepth1.gain.value = 0
  const invertGain = ctx.createGain()
  invertGain.gain.value = -1
  const lfoDepth2 = ctx.createGain()
  lfoDepth2.gain.value = 0

  // WaveShaper: abs(x) → triangle envelope from sawtooth
  const absCurveLen = 256
  const absCurve = new Float32Array(absCurveLen)
  for (let i = 0; i < absCurveLen; i++) {
    const x = (i / (absCurveLen - 1)) * 2 - 1
    absCurve[i] = 1 - Math.abs(x)
  }
  const fadeShaper1 = ctx.createWaveShaper()
  fadeShaper1.curve = absCurve
  const fadeShaper2 = ctx.createWaveShaper()
  fadeShaper2.curve = absCurve

  // LFO → delay modulation
  lfo.connect(lfoDepth1)
  lfoDepth1.connect(delay1.delayTime)
  lfo.connect(invertGain)
  invertGain.connect(lfoDepth2)
  lfoDepth2.connect(delay2.delayTime)

  // LFO → cross-fade envelopes
  lfo.connect(fadeShaper1)
  fadeShaper1.connect(fade1.gain)
  invertGain.connect(fadeShaper2)
  fadeShaper2.connect(fade2.gain)

  try {
    lfo.start()
  } catch {
    // noop
  }

  // Audio path
  dry.gain.value = 1
  wet.gain.value = 0
  input.connect(dry).connect(output)
  input.connect(delay1)
  delay1.connect(fade1)
  fade1.connect(wet)
  input.connect(delay2)
  delay2.connect(fade2)
  fade2.connect(wet)
  wet.connect(output)

  let pitchSt = 0
  let mix = 0
  let bypass = false

  const applyPitch = () => {
    if (pitchSt === 0) {
      lfoDepth1.gain.value = 0
      lfoDepth2.gain.value = 0
      return
    }
    const ratio = Math.pow(2, pitchSt / 12)
    const depth = (1 - ratio) / (2 * GRAIN_HZ)
    lfoDepth1.gain.value = depth
    lfoDepth2.gain.value = depth
  }

  const applyMix = () => {
    const effectiveMix = bypass ? 0 : mix
    wet.gain.value = effectiveMix
    dry.gain.value = 1
  }

  return {
    input,
    output,
    setParam: (paramId, value) => {
      switch (paramId) {
        case 'pitch':
          pitchSt = Math.round(value)
          applyPitch()
          break
        case 'mix':
          mix = value
          applyMix()
          break
      }
    },
    setEnabled: (on) => {
      bypass = !on
      applyMix()
    },
    dispose: () => {
      try {
        lfo.stop()
        lfo.disconnect()
        lfoDepth1.disconnect()
        lfoDepth2.disconnect()
        invertGain.disconnect()
        fadeShaper1.disconnect()
        fadeShaper2.disconnect()
        delay1.disconnect()
        delay2.disconnect()
        fade1.disconnect()
        fade2.disconnect()
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

export interface EffectChain {
  inputNode: AudioNode
  master: GainNode
  setEnabled: (id: EffectId, on: boolean) => void
  setParam: (id: EffectId, paramId: string, value: number) => void
  dispose: () => void
}

export function buildEffectChain(context: AudioContext): EffectChain {
  const distortion = makeDistortion(context)
  const doubler1 = makeDoubler(context)
  const doubler2 = makeDoubler(context)
  const chorus = makeChorus(context)
  const delay = makeDelay(context)
  const reverb = makeReverb(context)
  const master = context.createGain()
  master.gain.value = 0.85

  // Wire: input → DIST → DBL1 → DBL2 → CHORUS → DELAY → REVERB → master → out
  distortion.output.connect(doubler1.input)
  doubler1.output.connect(doubler2.input)
  doubler2.output.connect(chorus.input)
  chorus.output.connect(delay.input)
  delay.output.connect(reverb.input)
  reverb.output.connect(master)
  master.connect(context.destination)

  const inputNode = distortion.input

  const fxMap: Record<EffectId, FxNode> = {
    distortion,
    doubler1,
    doubler2,
    chorus,
    delay,
    reverb,
  }

  const setEnabled = (id: EffectId, on: boolean) => {
    fxMap[id].setEnabled(on)
  }
  const setParam = (id: EffectId, paramId: string, value: number) => {
    fxMap[id].setParam(paramId, value)
  }

  // Apply defaults
  for (const def of EFFECT_DEFS) {
    for (const p of def.params) setParam(def.id, p.id, p.default)
  }

  const dispose = () => {
    distortion.dispose()
    doubler1.dispose()
    doubler2.dispose()
    chorus.dispose()
    delay.dispose()
    reverb.dispose()
    try {
      master.disconnect()
    } catch {
      // noop
    }
  }

  return { inputNode, master, setEnabled, setParam, dispose }
}
