// Breath control for wind controllers (Odisei Travel Sax 2 / Travel Clarinet,
// Akai EWI). Spec: docs/superpowers/specs/2026-09-18-breath-control-design.md
// (on main).
//
// Breath drives one global pre-FX gain stage (smplr has no per-voice gain),
// and gates note-ons so a wind controller only sounds while you blow — which
// also silences the Travel Sax's idle C#4 when nothing is fingered.

export type BreathCurve = 'linear' | 'exponential' | 'logarithmic'

export interface BreathConfig {
  /** CC number carrying breath. Odisei + EWI default to CC2. */
  cc: number
  /** Below this (0..127) the gate is shut. */
  gateThreshold: number
  /** Gain at the gate threshold. */
  floor: number
  /** Gain at full breath. */
  ceiling: number
  curve: BreathCurve
  /** setTargetAtTime time constant for continuous breath changes. */
  smoothingMs: number
  /** 'fixed' lets breath own loudness; the Odisei velocity is breath-derived. */
  velocityMode: 'fixed' | 'passthrough'
  fixedVelocity: number
}

export const WIND_BREATH_DEFAULTS: BreathConfig = {
  cc: 2,
  gateThreshold: 2,
  floor: 0,
  ceiling: 1,
  curve: 'exponential',
  smoothingMs: 8,
  velocityMode: 'fixed',
  fixedVelocity: 100,
}

/** Map a raw breath CC (0..127) to a 0..1 gain. Returns 0 when gated. */
export function breathToGain(cc: number, config: BreathConfig): number {
  const v = Math.min(127, Math.max(0, cc))
  if (v < config.gateThreshold) return 0
  const n = v / 127
  let shaped: number
  switch (config.curve) {
    case 'linear':
      shaped = n
      break
    case 'exponential':
      // Long quiet range, opens up at the top.
      shaped = n * n
      break
    case 'logarithmic':
      shaped = Math.log10(1 + 9 * n)
      break
  }
  return config.floor + (config.ceiling - config.floor) * shaped
}

export interface BreathOutputs {
  noteOn: (midi: number, velocity: number) => void
  noteOff: (midi: number) => void
  /** immediate = jump straight to level (gate opening, reset). */
  setBreath: (level: number, smoothingMs: number, immediate: boolean) => void
}

// Minimum spacing between continuous breath param writes. Wind controllers
// flood CC2; one write per ~5ms (a couple of render quanta) is plenty, and
// unlike per-animation-frame coalescing it never adds a frame of lag.
const WRITE_INTERVAL_MS = 5

/**
 * Note gate + breath router for one MIDI input stream.
 *
 * Inactive until the first breath CC arrives, so a plain keyboard never gets
 * gated. Once active, note-ons only sound while breath is above the gate
 * threshold; held keys resume when breath comes back.
 */
export class BreathController {
  private active = false
  private open = true
  private level = 1
  /** Keys the device currently holds down. */
  private held = new Map<number, number>()
  /** Notes we've actually started on the engine. */
  private sounding = new Set<number>()
  private lastWriteAt = -Infinity
  private pendingWrite: ReturnType<typeof setTimeout> | null = null
  /** Last raw breath value (0..127), so config changes can re-evaluate it. */
  private lastRaw = 0
  private enabled: boolean
  private config: BreathConfig
  private readonly outputs: BreathOutputs
  private readonly now: () => number

  constructor(
    outputs: BreathOutputs,
    config: BreathConfig = WIND_BREATH_DEFAULTS,
    now: () => number = () => performance.now(),
    enabled = true,
  ) {
    this.outputs = outputs
    this.config = config
    this.now = now
    this.enabled = enabled
  }

  get isActive(): boolean {
    return this.active
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Apply a new breath config at runtime without dropping held notes.
   *
   * - Disabling while active drops held-but-gated keys without starting them
   *   (no idle-note drone), keeps notes already sounding, returns the shared
   *   gain to 1, and makes this input pure pass-through from then on.
   * - Any other change re-evaluates the last breath value under the new config,
   *   so a gate/curve/floor tweak is heard immediately. A CC change just
   *   re-targets which controller is listened to; the gate keeps its state until
   *   the new CC speaks.
   */
  setConfig(config: BreathConfig, enabled = true): void {
    const wasEnabled = this.enabled
    this.config = config
    this.enabled = enabled
    if (!enabled) {
      if (wasEnabled && this.active) {
        if (this.pendingWrite) clearTimeout(this.pendingWrite)
        this.pendingWrite = null
        // Drop held-but-gated keys WITHOUT starting them: starting them would
        // drone the Travel Sax's idle C#4 the moment breath is switched off.
        for (const midi of [...this.held.keys()]) {
          if (!this.sounding.has(midi)) this.held.delete(midi)
        }
        // Notes can only be sounding with the gate shut transiently; release
        // them if so. Notes sounding through an open gate keep playing.
        if (!this.open) {
          for (const midi of this.sounding) this.outputs.noteOff(midi)
          this.sounding.clear()
        }
        this.active = false
        this.open = true
        this.level = 1
        this.outputs.setBreath(1, config.smoothingMs, true)
      }
      return
    }
    if (this.active) this.breath(this.lastRaw)
  }

  noteOn(midi: number, velocity: number): void {
    this.held.set(midi, velocity)
    if (this.active && !this.open) return
    this.start(midi, velocity)
  }

  noteOff(midi: number): void {
    this.held.delete(midi)
    if (this.sounding.delete(midi)) this.outputs.noteOff(midi)
  }

  /** Feed a Control Change. Returns true if it was the breath CC. */
  controlChange(cc: number, value: number): boolean {
    if (!this.enabled || cc !== this.config.cc) return false
    this.breath(value)
    return true
  }

  breath(value: number): void {
    if (!this.enabled) return
    this.lastRaw = value
    this.active = true
    const wasOpen = this.open
    this.open = value >= this.config.gateThreshold
    this.level = breathToGain(value, this.config)

    if (this.open && !wasOpen) {
      // Gate opening: set the gain before starting notes so the attack isn't
      // softened by smoothing up from silence.
      this.writeNow(true)
      for (const [midi, vel] of this.held) {
        if (!this.sounding.has(midi)) this.start(midi, vel)
      }
      return
    }
    if (!this.open && wasOpen) {
      for (const midi of this.sounding) this.outputs.noteOff(midi)
      this.sounding.clear()
      this.writeNow(false)
      return
    }
    this.writeThrottled()
  }

  /** Panic: release and forget every note, keep the gate state. */
  releaseAll(): void {
    for (const midi of this.sounding) this.outputs.noteOff(midi)
    this.sounding.clear()
    this.held.clear()
  }

  /** Breath source gone (device unplugged): release everything, un-gate. */
  reset(): void {
    for (const midi of this.sounding) this.outputs.noteOff(midi)
    this.sounding.clear()
    this.held.clear()
    if (this.pendingWrite) clearTimeout(this.pendingWrite)
    this.pendingWrite = null
    const wasActive = this.active
    this.active = false
    this.open = true
    this.level = 1
    if (wasActive) this.outputs.setBreath(1, this.config.smoothingMs, true)
  }

  private start(midi: number, velocity: number): void {
    // The breath gain is shared, so a non-breath input on another port lifts
    // it back to full rather than playing into a wind controller's silence.
    if (!this.active) this.outputs.setBreath(1, this.config.smoothingMs, true)
    const vel =
      this.active && this.config.velocityMode === 'fixed' ? this.config.fixedVelocity : velocity
    this.sounding.add(midi)
    this.outputs.noteOn(midi, vel)
  }

  private writeNow(immediate: boolean): void {
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite)
      this.pendingWrite = null
    }
    this.lastWriteAt = this.now()
    this.outputs.setBreath(this.level, this.config.smoothingMs, immediate)
  }

  private writeThrottled(): void {
    const wait = WRITE_INTERVAL_MS - (this.now() - this.lastWriteAt)
    if (wait <= 0) {
      this.writeNow(false)
      return
    }
    // Latest value wins: the timer reads this.level when it fires.
    if (!this.pendingWrite) {
      this.pendingWrite = setTimeout(() => {
        this.pendingWrite = null
        this.writeNow(false)
      }, wait)
    }
  }
}
