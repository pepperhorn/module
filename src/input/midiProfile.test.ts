import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MIDI_PRESET,
  MIDI_PRESETS,
  normalizeMidiProfile,
  observeLearn,
  presetProfile,
  profileMatchesPreset,
  type LearnState,
} from './midiProfile'

describe('MIDI presets', () => {
  it('wind presets use CC2, fixed velocity, gate 2, exponential', () => {
    for (const id of ['travel-sax-2', 'travel-clarinet', 'ewi-usb'] as const) {
      const p = MIDI_PRESETS[id]
      expect(p.enabled).toBe(true)
      expect(p.breath).toMatchObject({ cc: 2, velocityMode: 'fixed', gateThreshold: 2, curve: 'exponential' })
    }
  })

  it('keyboard preset is breath off / pass-through', () => {
    expect(MIDI_PRESETS.keyboard.enabled).toBe(false)
    expect(MIDI_PRESETS.keyboard.breath.velocityMode).toBe('passthrough')
  })

  it('defaults to Travel Sax 2', () => {
    expect(DEFAULT_MIDI_PRESET).toBe('travel-sax-2')
    expect(normalizeMidiProfile(undefined)).toEqual(presetProfile('travel-sax-2'))
  })
})

describe('normalizeMidiProfile', () => {
  it('never throws on garbage', () => {
    for (const raw of [null, undefined, 42, 'x', [], { breath: 'nope' }, { breath: [] }, NaN]) {
      expect(() => normalizeMidiProfile(raw)).not.toThrow()
      expect(normalizeMidiProfile(raw)).toEqual(presetProfile('travel-sax-2'))
    }
    const hostile = {
      get preset() {
        throw new Error('boom')
      },
    }
    expect(normalizeMidiProfile(hostile)).toEqual(presetProfile('travel-sax-2'))
  })

  it('round-trips a valid profile unchanged', () => {
    const p = presetProfile('ewi-usb')
    p.breath = { ...p.breath, cc: 11, floor: 0.1, ceiling: 0.9, curve: 'logarithmic', smoothingMs: 20 }
    expect(normalizeMidiProfile(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('clamps every numeric field', () => {
    const p = normalizeMidiProfile({
      preset: 'travel-sax-2',
      enabled: true,
      breath: {
        cc: 2,
        gateThreshold: 999,
        floor: -3,
        ceiling: 7,
        smoothingMs: -10,
        fixedVelocity: 1000,
        curve: 'linear',
        velocityMode: 'fixed',
      },
    })
    expect(p.breath).toMatchObject({ gateThreshold: 127, floor: 0, ceiling: 1, smoothingMs: 1, fixedVelocity: 127 })
    const q = normalizeMidiProfile({ breath: { gateThreshold: 3.6, fixedVelocity: 0, smoothingMs: 500 } })
    expect(q.breath).toMatchObject({ gateThreshold: 4, fixedVelocity: 1, smoothingMs: 60 })
  })

  it('keeps floor at or below ceiling', () => {
    const p = normalizeMidiProfile({ breath: { floor: 0.8, ceiling: 0.5 } })
    expect(p.breath.floor).toBe(0.5)
    expect(p.breath.ceiling).toBe(0.5)
  })

  it('falls back to the preset value for unknown curve / cc / velocityMode', () => {
    const p = normalizeMidiProfile({
      preset: 'keyboard',
      breath: { curve: 'cubic', cc: 200, velocityMode: 'loud', gateThreshold: 'x', floor: Infinity },
    })
    const ref = MIDI_PRESETS.keyboard.breath
    expect(p.preset).toBe('keyboard')
    expect(p.enabled).toBe(false)
    expect(p.breath.curve).toBe(ref.curve)
    expect(p.breath.cc).toBe(ref.cc)
    expect(p.breath.velocityMode).toBe('passthrough')
    expect(p.breath.gateThreshold).toBe(ref.gateThreshold)
    expect(p.breath.floor).toBe(ref.floor)
  })

  it('rejects fractional and channel-mode CCs, accepts learned ones', () => {
    expect(normalizeMidiProfile({ breath: { cc: 2.5 } }).breath.cc).toBe(2)
    expect(normalizeMidiProfile({ breath: { cc: 121 } }).breath.cc).toBe(2)
    expect(normalizeMidiProfile({ breath: { cc: 4 } }).breath.cc).toBe(4)
  })

  it('unknown preset id falls back to the default preset', () => {
    expect(normalizeMidiProfile({ preset: 'kazoo' }).preset).toBe('travel-sax-2')
  })

  it('profileMatchesPreset tracks tweaks', () => {
    const p = presetProfile('travel-clarinet')
    expect(profileMatchesPreset(p)).toBe(true)
    expect(profileMatchesPreset({ ...p, breath: { ...p.breath, gateThreshold: 5 } })).toBe(false)
    expect(profileMatchesPreset({ ...p, enabled: false })).toBe(false)
  })
})

describe('observeLearn', () => {
  const feed = (state: LearnState, input: string, cc: number, values: number[]) => {
    let out: number | null = null
    for (const v of values) out = observeLearn(state, input, cc, v) ?? out
    return out
  }

  it('learns a CC that sweeps across a range (a blow)', () => {
    const s: LearnState = new Map()
    expect(feed(s, 'sax', 11, [0, 8, 20, 35, 50, 64])).toBe(11)
  })

  it('ignores a switch that jumps 0 → 127 in one message (sustain pedal)', () => {
    const s: LearnState = new Map()
    expect(feed(s, 'kb', 64, [0, 127, 0, 127])).toBeNull()
  })

  it('ignores a small nudge of a knob', () => {
    const s: LearnState = new Map()
    expect(feed(s, 'kb', 74, [60, 61, 62, 63, 64, 65, 66, 67])).toBeNull()
  })

  it('tracks each input/CC pair separately', () => {
    const s: LearnState = new Map()
    // Interleaved: two inputs each send part of a sweep on CC2 — neither alone spans enough.
    for (const v of [0, 10, 20]) {
      expect(observeLearn(s, 'a', 2, v)).toBeNull()
      expect(observeLearn(s, 'b', 2, v + 20)).toBeNull()
    }
    expect(feed(s, 'a', 2, [30, 40, 50])).toBe(2)
  })

  it('never learns channel-mode messages', () => {
    const s: LearnState = new Map()
    expect(feed(s, 'x', 123, [0, 20, 40, 60, 80, 100, 127])).toBeNull()
  })
})
