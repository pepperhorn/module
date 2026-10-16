import { describe, expect, it, vi } from 'vitest'
import { BreathController, breathToGain, WIND_BREATH_DEFAULTS, type BreathConfig } from './breath'

const cfg = (over: Partial<BreathConfig> = {}): BreathConfig => ({ ...WIND_BREATH_DEFAULTS, ...over })

describe('breathToGain', () => {
  it.each([
    ['linear', 127, 1],
    ['linear', 0, 0],
    ['exponential', 127, 1],
    ['logarithmic', 127, 1],
  ] as const)('%s at %i → %f', (curve, cc, expected) => {
    expect(breathToGain(cc, cfg({ curve }))).toBeCloseTo(expected)
  })

  it('exponential is quieter than linear mid-range, logarithmic louder', () => {
    const lin = breathToGain(64, cfg({ curve: 'linear' }))
    expect(breathToGain(64, cfg({ curve: 'exponential' }))).toBeLessThan(lin)
    expect(breathToGain(64, cfg({ curve: 'logarithmic' }))).toBeGreaterThan(lin)
  })

  it('returns 0 below the gate threshold even with a floor', () => {
    expect(breathToGain(1, cfg({ floor: 0.2 }))).toBe(0)
    expect(breathToGain(2, cfg({ floor: 0.2 }))).toBeGreaterThanOrEqual(0.2)
  })

  it('clamps out-of-range input and respects the ceiling', () => {
    expect(breathToGain(500, cfg({ curve: 'linear', ceiling: 0.8 }))).toBeCloseTo(0.8)
    expect(breathToGain(-5, cfg())).toBe(0)
  })
})

function setup() {
  const calls: string[] = []
  let t = 0
  const out = {
    noteOn: vi.fn((m: number, v: number) => calls.push(`on ${m} ${v}`)),
    noteOff: vi.fn((m: number) => calls.push(`off ${m}`)),
    setBreath: vi.fn(),
  }
  const ctrl = new BreathController(out, WIND_BREATH_DEFAULTS, () => t)
  return { ctrl, out, calls, advance: (ms: number) => (t += ms) }
}

describe('BreathController', () => {
  it('passes notes straight through until a breath CC arrives (keyboards)', () => {
    const { ctrl, calls } = setup()
    ctrl.noteOn(60, 37)
    ctrl.noteOff(60)
    expect(calls).toEqual(['on 60 37', 'off 60'])
  })

  it('ignores non-breath CCs', () => {
    const { ctrl } = setup()
    expect(ctrl.controlChange(11, 0)).toBe(false)
    expect(ctrl.isActive).toBe(false)
  })

  it('holds a note-on while breath is gated, starts it when breath opens', () => {
    const { ctrl, calls, out } = setup()
    ctrl.controlChange(2, 0) // armed, gate shut
    ctrl.noteOn(61, 20) // idle C#4
    expect(calls).toEqual([])
    ctrl.controlChange(2, 90)
    expect(calls).toEqual(['on 61 100']) // fixed velocity
    // gain set immediately before the note starts
    expect(out.setBreath).toHaveBeenLastCalledWith(expect.any(Number), 8, true)
    expect(out.setBreath.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      out.noteOn.mock.invocationCallOrder[0],
    )
  })

  it('releases sounding notes when breath stops and resumes held keys', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(62, 90)
    ctrl.controlChange(2, 0)
    ctrl.controlChange(2, 70)
    ctrl.noteOff(62)
    expect(calls).toEqual(['on 62 100', 'off 62', 'on 62 100', 'off 62'])
  })

  it('does not send a second note-off for a key released while gated', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(62, 90)
    ctrl.controlChange(2, 0)
    ctrl.noteOff(62)
    ctrl.controlChange(2, 80)
    expect(calls).toEqual(['on 62 100', 'off 62'])
  })

  it('throttles continuous breath writes, latest value wins', () => {
    vi.useFakeTimers()
    try {
      const { ctrl, out, advance } = setup()
      ctrl.controlChange(2, 40) // gate opens → immediate write
      out.setBreath.mockClear()
      advance(1)
      ctrl.controlChange(2, 50)
      ctrl.controlChange(2, 60)
      ctrl.controlChange(2, 127)
      expect(out.setBreath).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(out.setBreath).toHaveBeenCalledTimes(1)
      expect(out.setBreath).toHaveBeenCalledWith(1, 8, false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reset releases notes, un-gates, and restores full gain', () => {
    const { ctrl, calls, out } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(64, 90)
    ctrl.reset()
    expect(calls).toEqual(['on 64 100', 'off 64'])
    expect(out.setBreath).toHaveBeenLastCalledWith(1, 8, true)
    ctrl.noteOn(65, 33) // back to pass-through
    expect(calls.at(-1)).toBe('on 65 33')
  })
})

describe('BreathController multi-source', () => {
  it('lifts the shared gain to full for pass-through notes', () => {
    const { ctrl, out } = setup()
    ctrl.noteOn(60, 80)
    expect(out.setBreath).toHaveBeenCalledWith(1, 8, true)
  })

  it('releaseAll forgets held keys so panic-killed notes do not return', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(61, 90)
    ctrl.releaseAll()
    ctrl.controlChange(2, 0)
    ctrl.controlChange(2, 80)
    expect(calls).toEqual(['on 61 100', 'off 61'])
  })
})

describe('BreathController.setConfig', () => {
  it('re-targets the breath CC without dropping held notes', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(62, 90)
    ctrl.setConfig({ ...WIND_BREATH_DEFAULTS, cc: 11 })
    expect(calls).toEqual(['on 62 100'])
    expect(ctrl.controlChange(2, 0)).toBe(false) // old CC no longer gates
    expect(calls).toEqual(['on 62 100'])
    expect(ctrl.controlChange(11, 0)).toBe(true) // new CC does
    expect(calls).toEqual(['on 62 100', 'off 62'])
  })

  it('disabling drops gated notes without starting them and restores gain 1', () => {
    const { ctrl, calls, out } = setup()
    ctrl.controlChange(2, 0) // armed, gate shut
    ctrl.noteOn(61, 40) // idle C#4, gated
    ctrl.setConfig(WIND_BREATH_DEFAULTS, false)
    expect(calls).toEqual([]) // no drone
    expect(out.setBreath).toHaveBeenLastCalledWith(1, 8, true)
    expect(ctrl.isActive).toBe(false)
    ctrl.noteOff(61) // the dropped key's release is harmless
    expect(calls).toEqual([])
    // Breath CCs are now ignored entirely: no gating, no gain writes.
    out.setBreath.mockClear()
    expect(ctrl.controlChange(2, 0)).toBe(false)
    expect(out.setBreath).not.toHaveBeenCalled()
    ctrl.noteOn(64, 55) // pass-through with device velocity
    expect(calls).toEqual(['on 64 55'])
  })

  it('disabling keeps notes already sounding through an open gate', () => {
    const { ctrl, calls, out } = setup()
    ctrl.controlChange(2, 80)
    ctrl.noteOn(62, 90)
    ctrl.setConfig(WIND_BREATH_DEFAULTS, false)
    expect(calls).toEqual(['on 62 100'])
    expect(out.setBreath).toHaveBeenLastCalledWith(1, 8, true)
    ctrl.controlChange(2, 0) // would have gated; now ignored
    expect(calls).toEqual(['on 62 100'])
    ctrl.noteOff(62)
    expect(calls).toEqual(['on 62 100', 'off 62'])
  })

  it('re-enabling arms again on the next breath CC', () => {
    const { ctrl, calls } = setup()
    ctrl.setConfig(WIND_BREATH_DEFAULTS, false)
    ctrl.setConfig(WIND_BREATH_DEFAULTS, true)
    ctrl.noteOn(60, 50)
    expect(calls).toEqual(['on 60 50']) // still pass-through until breath arrives
    ctrl.controlChange(2, 0)
    expect(calls).toEqual(['on 60 50', 'off 60'])
  })

  it('a curve change re-shapes the current breath level', () => {
    vi.useFakeTimers()
    try {
      const { ctrl, out, advance } = setup()
      ctrl.controlChange(2, 64)
      const expBefore = out.setBreath.mock.calls.at(-1)![0]
      advance(10)
      ctrl.setConfig({ ...WIND_BREATH_DEFAULTS, curve: 'logarithmic' })
      vi.runAllTimers()
      const after = out.setBreath.mock.calls.at(-1)![0]
      expect(after).toBeCloseTo(breathToGain(64, cfg({ curve: 'logarithmic' })))
      expect(after).toBeGreaterThan(expBefore)
    } finally {
      vi.useRealTimers()
    }
  })

  it('raising the gate above the current breath closes it', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 10)
    ctrl.noteOn(62, 90)
    ctrl.setConfig({ ...WIND_BREATH_DEFAULTS, gateThreshold: 20 })
    expect(calls).toEqual(['on 62 100', 'off 62'])
    ctrl.controlChange(2, 30)
    expect(calls).toEqual(['on 62 100', 'off 62', 'on 62 100'])
  })
})

describe('BreathController review fixes', () => {
  it('does not rewrite the gain while the gate stays shut (CC noise)', () => {
    vi.useFakeTimers()
    try {
      const { ctrl, out, advance } = setup()
      ctrl.controlChange(2, 0) // open → shut: one write
      out.setBreath.mockClear()
      for (const v of [1, 0, 1, 0]) {
        advance(10)
        ctrl.controlChange(2, v)
      }
      vi.runAllTimers()
      expect(out.setBreath).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-enabling restores the gate from the last breath seen', () => {
    const { ctrl, calls } = setup()
    ctrl.controlChange(2, 80)
    ctrl.setConfig(WIND_BREATH_DEFAULTS, false)
    ctrl.controlChange(2, 0) // tracked while disabled
    ctrl.noteOn(61, 30) // pass-through while disabled (idle C#4)
    expect(calls).toEqual(['on 61 30'])
    ctrl.setConfig(WIND_BREATH_DEFAULTS, true)
    expect(ctrl.isActive).toBe(true)
    expect(calls).toEqual(['on 61 30', 'off 61']) // gated immediately
    ctrl.controlChange(2, 90)
    expect(calls.at(-1)).toBe('on 61 100')
  })

  it('re-enabling with no breath ever seen stays pass-through', () => {
    const { ctrl, calls } = setup()
    ctrl.setConfig(WIND_BREATH_DEFAULTS, false)
    ctrl.setConfig(WIND_BREATH_DEFAULTS, true)
    expect(ctrl.isActive).toBe(false)
    ctrl.noteOn(60, 50)
    expect(calls).toEqual(['on 60 50'])
  })
})
