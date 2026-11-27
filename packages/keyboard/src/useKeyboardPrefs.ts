import { useMemo, useRef, useState } from 'react'
import type { Accidentals } from './theory'

export interface KeyboardPrefs {
  volume: number
  accidentals: Accidentals
  showNames: boolean
  effects: Record<string, { on: boolean; amount: number }>
  midiDeviceId: string | null
}

const STORAGE_KEY = 'pepperhorn-keyboard:prefs:v1'

function safePrefs(input: unknown): Partial<KeyboardPrefs> {
  if (!input || typeof input !== 'object') return {}
  const { volume, accidentals, showNames, effects, midiDeviceId } = input as Partial<KeyboardPrefs>
  const prefs: Partial<KeyboardPrefs> = {}
  if (typeof volume === 'number' && Number.isFinite(volume)) prefs.volume = Math.min(1, Math.max(0, volume))
  if (accidentals === 'flat' || accidentals === 'sharp') prefs.accidentals = accidentals
  if (typeof showNames === 'boolean') prefs.showNames = showNames
  if (typeof midiDeviceId === 'string' || midiDeviceId === null) prefs.midiDeviceId = midiDeviceId
  if (effects && typeof effects === 'object') {
    prefs.effects = Object.fromEntries(Object.entries(effects).filter(([, effect]) =>
      effect && typeof effect.on === 'boolean' && Number.isFinite(effect.amount) &&
      effect.amount >= 0 && effect.amount <= 1,
    ))
  }
  return prefs
}

function readPrefs(): Partial<KeyboardPrefs> {
  try {
    return safePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

export function useKeyboardPrefs(defaults: Partial<KeyboardPrefs>): [KeyboardPrefs, (patch: Partial<KeyboardPrefs>) => void] {
  const [initial] = useState<KeyboardPrefs>(() => ({
    volume: 1, accidentals: 'flat', showNames: false, effects: {}, midiDeviceId: null,
    ...safePrefs(defaults),
  }))
  const [saved, setSaved] = useState(readPrefs)
  const latest = useRef(saved)
  const prefs = useMemo(() => ({
    ...initial, ...saved, effects: { ...initial.effects, ...saved.effects },
  }), [initial, saved])

  return [prefs, patch => {
    const changes = safePrefs(patch)
    const previous = latest.current
    const current = { ...initial, ...previous, effects: { ...initial.effects, ...previous.effects } }
    for (const key of ['volume', 'accidentals', 'showNames', 'midiDeviceId'] as const) {
      if (changes[key] === current[key]) delete changes[key]
    }
    if (changes.effects) {
      const changedEffects = Object.entries(changes.effects).filter(([id, effect]) => {
        const before = current.effects[id]
        return effect.on !== before?.on || effect.amount !== before.amount
      })
      if (changedEffects.length) changes.effects = Object.fromEntries(changedEffects)
      else delete changes.effects
    }
    if (!Object.keys(changes).length) return
    const next = { ...previous, ...changes }
    if (changes.effects) next.effects = { ...previous.effects, ...changes.effects }
    latest.current = next
    setSaved(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // The controls still work in memory when storage is unavailable.
    }
  }]
}
