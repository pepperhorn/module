// MIDI / breath profile: device presets, normalise-on-load persistence and the
// Learn gesture detector. Spec: docs/superpowers/specs/2026-09-18-breath-control-design.md
// (Data model, Device presets, Persistence).

import { WIND_BREATH_DEFAULTS, type BreathConfig, type BreathCurve } from './breath'

export const MIDI_PROFILE_KEY = 'module:midi-map:v1'
/** Set once MIDI access has been granted, so the next visit can reconnect silently. */
export const MIDI_ENABLED_KEY = 'module:midi-enabled:v1'

export type MidiPresetId = 'travel-sax-2' | 'travel-clarinet' | 'ewi-usb' | 'keyboard'

export interface MidiProfile {
  /** The preset last applied. Tweaks keep it; the UI shows "modified". */
  preset: MidiPresetId
  breath: BreathConfig
  /** Breath gating on/off. Off = every input is plain pass-through. */
  enabled: boolean
}

export interface MidiPreset {
  id: MidiPresetId
  label: string
  short: string
  breath: BreathConfig
  enabled: boolean
}

const WIND: BreathConfig = { ...WIND_BREATH_DEFAULTS, cc: 2, gateThreshold: 2, curve: 'exponential', velocityMode: 'fixed' }

export const MIDI_PRESETS: Record<MidiPresetId, MidiPreset> = {
  'travel-sax-2': { id: 'travel-sax-2', label: 'Travel Sax 2', short: 'T-SAX 2', breath: { ...WIND }, enabled: true },
  'travel-clarinet': { id: 'travel-clarinet', label: 'Travel Clarinet', short: 'T-CLAR', breath: { ...WIND }, enabled: true },
  'ewi-usb': { id: 'ewi-usb', label: 'Akai EWI USB', short: 'EWI USB', breath: { ...WIND }, enabled: true },
  keyboard: {
    id: 'keyboard',
    label: 'MIDI keyboard',
    short: 'KEYBOARD',
    breath: { ...WIND, velocityMode: 'passthrough' },
    enabled: false,
  },
}

export const MIDI_PRESET_ORDER: MidiPresetId[] = ['travel-sax-2', 'travel-clarinet', 'ewi-usb', 'keyboard']

/**
 * Travel Sax 2 by default. Breath only arms once a breath CC actually arrives,
 * so a plain keyboard still plays straight through under this preset.
 */
export const DEFAULT_MIDI_PRESET: MidiPresetId = 'travel-sax-2'

/** The Breath Channel choices the Odisei apps offer. Learn can set any CC. */
export const BREATH_CC_CHOICES = [2, 7, 11] as const

export const BREATH_LIMITS = {
  gateThreshold: { min: 0, max: 127 },
  floor: { min: 0, max: 1 },
  ceiling: { min: 0, max: 1 },
  smoothingMs: { min: 1, max: 60 },
  fixedVelocity: { min: 1, max: 127 },
} as const

const CURVES: BreathCurve[] = ['linear', 'exponential', 'logarithmic']

export function presetProfile(id: MidiPresetId): MidiProfile {
  const p = MIDI_PRESETS[id]
  return { preset: id, breath: { ...p.breath }, enabled: p.enabled }
}

function isPresetId(v: unknown): v is MidiPresetId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MIDI_PRESETS, v)
}

function num(v: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  const c = Math.min(max, Math.max(min, v))
  return integer ? Math.round(c) : c
}

/**
 * Coerce anything (stored JSON, a hand-edited payload, a future version) into a
 * valid profile. Numbers are clamped; an unknown curve / CC / velocity mode
 * falls back to the profile's preset value. Never throws.
 */
export function normalizeMidiProfile(raw: unknown): MidiProfile {
  try {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const preset = isPresetId(obj.preset) ? obj.preset : DEFAULT_MIDI_PRESET
    const base = MIDI_PRESETS[preset]
    const b = (obj.breath && typeof obj.breath === 'object' ? obj.breath : {}) as Record<string, unknown>
    const d = base.breath
    const L = BREATH_LIMITS

    // Channel-mode messages (120..127) are never breath.
    const cc =
      typeof b.cc === 'number' && Number.isInteger(b.cc) && b.cc >= 0 && b.cc <= 119 ? b.cc : d.cc
    const curve = CURVES.includes(b.curve as BreathCurve) ? (b.curve as BreathCurve) : d.curve
    const velocityMode =
      b.velocityMode === 'fixed' || b.velocityMode === 'passthrough' ? b.velocityMode : d.velocityMode

    const ceiling = num(b.ceiling, d.ceiling, L.ceiling.min, L.ceiling.max)
    const floor = Math.min(ceiling, num(b.floor, d.floor, L.floor.min, L.floor.max))

    return {
      preset,
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : base.enabled,
      breath: {
        cc,
        gateThreshold: num(b.gateThreshold, d.gateThreshold, L.gateThreshold.min, L.gateThreshold.max, true),
        floor,
        ceiling,
        curve,
        smoothingMs: num(b.smoothingMs, d.smoothingMs, L.smoothingMs.min, L.smoothingMs.max),
        velocityMode,
        fixedVelocity: num(b.fixedVelocity, d.fixedVelocity, L.fixedVelocity.min, L.fixedVelocity.max, true),
      },
    }
  } catch {
    return presetProfile(DEFAULT_MIDI_PRESET)
  }
}

/** True when the profile still equals its preset (nothing tweaked). */
export function profileMatchesPreset(p: MidiProfile): boolean {
  const ref = MIDI_PRESETS[p.preset]
  if (ref.enabled !== p.enabled) return false
  return (Object.keys(ref.breath) as (keyof BreathConfig)[]).every((k) => ref.breath[k] === p.breath[k])
}

export function loadMidiProfile(): MidiProfile {
  try {
    const raw = localStorage.getItem(MIDI_PROFILE_KEY)
    if (!raw) return presetProfile(DEFAULT_MIDI_PRESET)
    return normalizeMidiProfile(JSON.parse(raw))
  } catch {
    return presetProfile(DEFAULT_MIDI_PRESET)
  }
}

export function saveMidiProfile(p: MidiProfile): void {
  try {
    localStorage.setItem(MIDI_PROFILE_KEY, JSON.stringify(p))
  } catch {
    // noop
  }
}

export function loadMidiEnabledFlag(): boolean {
  try {
    return localStorage.getItem(MIDI_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveMidiEnabledFlag(v: boolean): void {
  try {
    if (v) localStorage.setItem(MIDI_ENABLED_KEY, '1')
    else localStorage.removeItem(MIDI_ENABLED_KEY)
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// Learn: the next CC that *moves across a range* (a blow) becomes the breath CC.
// A switch (sustain pedal, 0 → 127 in one message) or a static knob nudge must
// not win, so we require both a wide span and several distinct messages.

export interface LearnTrack {
  min: number
  max: number
  count: number
}

export type LearnState = Map<string, LearnTrack>

export const LEARN_MIN_SPAN = 40
export const LEARN_MIN_MESSAGES = 6

/**
 * Feed one CC message into the learn tracker. Returns the CC number once some
 * (input, cc) pair has swept at least `minSpan` values over at least
 * `minMessages` messages, else null. Mutates `state` only.
 */
export function observeLearn(
  state: LearnState,
  inputId: string,
  cc: number,
  value: number,
  minSpan = LEARN_MIN_SPAN,
  minMessages = LEARN_MIN_MESSAGES,
): number | null {
  if (cc < 0 || cc > 119) return null
  const key = `${inputId}:${cc}`
  const t = state.get(key)
  if (!t) {
    state.set(key, { min: value, max: value, count: 1 })
    return null
  }
  t.min = Math.min(t.min, value)
  t.max = Math.max(t.max, value)
  t.count++
  return t.max - t.min >= minSpan && t.count >= minMessages ? cc : null
}
