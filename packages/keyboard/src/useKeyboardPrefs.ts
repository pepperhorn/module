import { useEffect, useState } from 'react'
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
  const [prefs, setPrefs] = useState<KeyboardPrefs>(() => ({
    volume: 1, accidentals: 'flat', showNames: false, effects: {}, midiDeviceId: null,
    ...safePrefs(defaults), ...readPrefs(),
  }))
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // The controls still work in memory when storage is unavailable.
    }
  }, [prefs])
  return [prefs, patch => setPrefs(current => {
    const next = safePrefs(patch)
    const effects = next.effects ? { ...current.effects, ...next.effects } : current.effects
    return { ...current, ...next, effects }
  })]
}
