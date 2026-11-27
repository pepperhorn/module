import { useCallback, useEffect, useRef, useState } from 'react'
import { getEngine, type AudioEngine } from '../../../../src/audio/AudioEngine'
import { configureSampleSource } from '../../../../src/audio/loggedStorage'
import type { ChainEffectId } from '../../../../src/audio/effects'
import { getBuiltinPatches } from '../../../../src/patches/builtin'
import type { PatchManifest } from '../../../../src/patches/types'
import { bundledPatches, DRUMS_ID, PIANO_ID } from '../patches/bundled'
import type { KeyboardPrefs } from '../useKeyboardPrefs'

const EFFECTS: readonly ChainEffectId[] = ['reverb', 'delay', 'chorus', 'distortion']

interface EngineOptions {
  defaultPatch?: string
  assetBaseUrl?: string
  prefs: KeyboardPrefs
  setPrefs(patch: Partial<KeyboardPrefs>): void
}

function applyPrefs(engine: AudioEngine, { volume, effects }: KeyboardPrefs) {
  engine.setBreath(volume, 8)
  for (const id of EFFECTS) {
    engine.setEffectParam(id, 'mix', effects[id]?.amount ?? 0)
    engine.setEffectEnabled(id, effects[id]?.on ?? false)
  }
}

export function useKeyboardEngine({ defaultPatch, assetBaseUrl, prefs, setPrefs }: EngineOptions) {
  const [catalog] = useState(() => [
    ...(assetBaseUrl === undefined ? bundledPatches() : bundledPatches(assetBaseUrl)),
    ...getBuiltinPatches(),
  ])
  const [patch, setPatch] = useState(() =>
    catalog.find(p => p.id === resolveId(defaultPatch)) ?? catalog[0],
  )
  const selected = useRef(patch)
  const engineRef = useRef<AudioEngine | null>(null)
  const unlocked = useRef(false)
  const loadVersion = useRef(0)
  const canPlay = useRef(false)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const [needsGesture, setNeedsGesture] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const load = useCallback(async (engine: AudioEngine, next: PatchManifest) => {
    const version = ++loadVersion.current
    canPlay.current = false
    engine.panic()
    setLoading(true)
    setLoadFailed(false)
    try {
      await engine.loadPatch(next)
      if (version !== loadVersion.current) return
      applyPrefs(engine, prefsRef.current)
      canPlay.current = engine.loadedPatchId === next.id
    } catch {
      // Leave playback disabled and let the user retry this patch.
    } finally {
      if (version === loadVersion.current) {
        setLoading(false)
        setLoadFailed(!canPlay.current)
      }
    }
  }, [])

  const selectPatch = useCallback((id: string) => {
    const next = catalog.find(p => p.id === resolveId(id))
    if (!next || (selected.current === next && (canPlay.current || loading))) return
    selected.current = next
    setPatch(next)
    if (unlocked.current && engineRef.current) void load(engineRef.current, next)
  }, [catalog, load, loading])

  const ensureAudio = useCallback(async () => {
    if (unlocked.current) return
    unlocked.current = true
    try {
      configureSampleSource({ mode: 'cdn' })
      const engine = getEngine({ quiet: true, consoleShim: false })
      engineRef.current = engine
      setNeedsGesture(false)
      await load(engine, selected.current)
    } catch {
      unlocked.current = false
      setNeedsGesture(true)
    }
  }, [load])

  useEffect(() => { if (canPlay.current && engineRef.current) applyPrefs(engineRef.current, prefs) }, [prefs])
  useEffect(() => () => {
    loadVersion.current++
    canPlay.current = false
    unlocked.current = false
    void engineRef.current?.suspend()
  }, [])

  const noteOn = useCallback((midi: number, velocity: number) => {
    if (canPlay.current) engineRef.current?.noteOn(midi, velocity)
  }, [])
  const noteOff = useCallback((midi: number) => engineRef.current?.noteOff(midi), [])
  const panic = useCallback(() => engineRef.current?.panic(), [])

  function setEffect(id: ChainEffectId, patch: Partial<KeyboardPrefs['effects'][string]>) {
    const current = prefsRef.current.effects[id] ?? { on: false, amount: 0 }
    setPrefs({ effects: { [id]: { ...current, ...patch } } })
  }

  return {
    catalog, patch, selectPatch, loading, loadFailed, needsGesture, ensureAudio, noteOn, noteOff, panic,
    setVolume: (volume: number) => setPrefs({ volume }),
    setEffectEnabled: (id: ChainEffectId, on: boolean) => setEffect(id, { on }),
    setEffectAmount: (id: ChainEffectId, amount: number) => setEffect(id, { amount }),
  }
}

function resolveId(id: string | undefined): string {
  if (!id || id === 'piano') return PIANO_ID
  return id === 'drums' ? DRUMS_ID : id
}
