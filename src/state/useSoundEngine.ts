import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEngine, type AudioEngine, type EngineOptions } from '../audio/AudioEngine'
import { useStore } from './useStore'
import { useFullCatalog } from './useFullCatalog'
import { addActiveNote, clearActiveNotes, removeActiveNote } from './activeNotes'
import { useWebMidi } from '../input/useWebMidi'
import type { Bank, PatchManifest } from '../patches/types'
import type { EffectId as EngineEffectId } from '../audio/effects'
import { normalizeFxOrder } from '../audio/effects'

export type LatencyInfo = ReturnType<AudioEngine['latencyInfo']>

export interface SoundEngineOptions {
  /** Default true. When false, loads never mark patches as cached for offline (embed). */
  trackOffline?: boolean
  /** Forwarded to getEngine(); only takes effect when it creates the engine. */
  engineOptions?: EngineOptions
  /**
   * Default false. When true, unmount silences and suspends the engine, and a
   * re-run after power-on resumes it.
   */
  suspendOnUnmount?: boolean
}

export interface SoundEngineApi {
  engine: AudioEngine
  fullCatalog: PatchManifest[]
  displayPatch: PatchManifest | undefined
  displayIndex: number
  isLoading: boolean
  activeBank: Bank
  currentBankPatches: PatchManifest[]
  needsGesture: boolean
  ensureAudio(): Promise<void>
  selectPatch(p: PatchManifest): void
  selectPatchId(id: string): void
  previewPatchById(id: string): void
  downloadPatchById(id: string): void
  handleStep(delta: number): void
  handleBankSelect(bank: Bank): void
  noteOn(midi: number, vel: number): void
  noteOff(midi: number): void
  uiNoteOn(midi: number, vel: number): void
  panic(): void
  getLatency(): LatencyInfo
}

/**
 * The engine, patch selection and note wiring shared by the standalone app and
 * the embed. Owns the load callbacks, the power-on gesture and MIDI input.
 */
export function useSoundEngine(options: SoundEngineOptions = {}): SoundEngineApi {
  const { trackOffline = true, engineOptions, suspendOnUnmount = false } = options

  // Options apply on the engine's first creation only, so read them once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engine = useMemo(() => getEngine(engineOptions), [])
  const currentPatchId = useStore((s) => s.currentPatchId)
  const pendingPatchId = useStore((s) => s.pendingPatchId)
  const setCurrentPatchId = useStore((s) => s.setCurrentPatchId)
  const setPendingPatchId = useStore((s) => s.setPendingPatchId)
  const setLoadError = useStore((s) => s.setLoadError)
  const setLoadingPatchId = useStore((s) => s.setLoadingPatchId)
  const setLoadingProgress = useStore((s) => s.setLoadingProgress)
  const setCurrentSource = useStore((s) => s.setCurrentSource)
  const loadingPatchId = useStore((s) => s.loadingPatchId)
  const markDownloaded = useStore((s) => s.markDownloaded)
  const setPreviewPatchId = useStore((s) => s.setPreviewPatchId)
  const setDownloadingPatchId = useStore((s) => s.setDownloadingPatchId)
  const downloadingPatchId = useStore((s) => s.downloadingPatchId)
  const pickerOpen = useStore((s) => s.pickerOpen)
  const userPatches = useStore((s) => s.userPatches)
  const setFxParam = useStore((s) => s.setFxParam)
  const setFxEnabled = useStore((s) => s.toggleFxEnabled)
  const setFxOrder = useStore((s) => s.setFxOrder)

  const [activeBank, setActiveBank] = useState<Bank>('PNO')
  const [needsGesture, setNeedsGesture] = useState(true)

  // The catalog with user presets merged in. Every id lookup goes through this;
  // using the raw catalog is what used to make USR patches unselectable.
  const fullCatalog = useFullCatalog()
  const catalogRef = useRef(fullCatalog)
  catalogRef.current = fullCatalog

  // What the LCD shows: the patch the user asked for while it loads, falling
  // back to the one actually loaded. A failed load clears the pending id, so
  // the display drops back to the patch that is really playing.
  const displayPatchId = pendingPatchId ?? currentPatchId
  const displayPatch = useMemo(
    () => fullCatalog.find((p) => p.id === displayPatchId),
    [fullCatalog, displayPatchId],
  )
  const displayIndex = useMemo(
    () => fullCatalog.findIndex((p) => p.id === displayPatchId),
    [fullCatalog, displayPatchId],
  )
  const isLoading = loadingPatchId !== null || pendingPatchId !== null

  const currentBankPatches = useMemo(
    () => fullCatalog.filter((p) => p.bank === activeBank),
    [fullCatalog, activeBank],
  )

  // Sync activeBank to the displayed patch's bank when it changes externally
  useEffect(() => {
    if (displayPatch && displayPatch.bank !== activeBank) {
      setActiveBank(displayPatch.bank)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPatch?.id])

  /**
   * Record that a patch's samples are now cached.
   *
   * Only ever adds. Revoking on a load that came back short would throw away a
   * download the user deliberately performed because of one flaky request, and
   * a cache hit reports the flag from the patch's original load, not from any
   * fresh evidence.
   *
   * A user preset shares its base patch's samples, so caching either one makes
   * both playable offline — mark them together, or the picker greys out
   * presets whose audio is right there in the cache.
   */
  const markOfflineReady = useCallback(
    (id: string) => {
      // The embed doesn't own the app's offline bookkeeping.
      if (!trackOffline) return
      markDownloaded(id)
      const user = useStore.getState().userPatches.find((u) => u.id === id)
      if (user) markDownloaded(user.basePatchId)
    },
    [markDownloaded, trackOffline],
  )

  // Wire engine load callbacks → store
  useEffect(() => {
    engine.onLoading = (id) => {
      setLoadingPatchId(id)
      if (id === null) setLoadingProgress(null)
      else setLoadingProgress({ loaded: 0, total: 0 })
    }
    engine.onLoaded = (id, outcome) => {
      setLoadingPatchId(null)
      setLoadingProgress(null)
      setCurrentPatchId(id)
      setCurrentSource(outcome.source)
      // Clear the request marker only for the patch that was actually asked
      // for. An earlier selection finishing late (a cache hit resolves almost
      // instantly) must not retire a newer request still in flight, or that
      // one's failure would arrive with nothing left to report it against.
      if (useStore.getState().pendingPatchId === id) {
        setPendingPatchId(null)
        setLoadError(null)
      }
      // A clean active load fills the persistent caches, so the patch is now
      // genuinely available offline. A load with missing samples is not, and
      // marking it would lie to the picker's offline greyout.
      if (outcome.offlineReady) markOfflineReady(id)
    }
    engine.onError = (id) => {
      // Ignore a failure for anything but the patch we are still waiting on.
      if (useStore.getState().pendingPatchId !== id) return
      setLoadingPatchId(null)
      setLoadingProgress(null)
      setPendingPatchId(null)
      const patch = catalogRef.current.find((p) => p.id === id)
      setLoadError({ id, name: patch?.name ?? id })
    }
    engine.onProgress = (_id, progress) => {
      setLoadingProgress(progress)
    }
    engine.onPreviewChange = (id) => {
      setPreviewPatchId(id)
    }
    return () => {
      engine.onLoading = undefined
      engine.onLoaded = undefined
      engine.onError = undefined
      engine.onProgress = undefined
      engine.onPreviewChange = undefined
    }
  }, [
    engine,
    setLoadingPatchId,
    setLoadingProgress,
    setCurrentSource,
    setCurrentPatchId,
    setPendingPatchId,
    setLoadError,
    setPreviewPatchId,
    markOfflineReady,
  ])

  const applyUserPatchFx = useCallback(
    (userPatchId: string) => {
      const u = userPatches.find((p) => p.id === userPatchId)
      if (!u) return
      const store = useStore.getState()
      // Apply each effect's enabled state and params to BOTH the store
      // (so the UI knobs reflect it) and the live engine chain.
      for (const [fxId, on] of Object.entries(u.fxEnabled)) {
        if (store.fxEnabled[fxId as EngineEffectId] !== on) {
          setFxEnabled(fxId as EngineEffectId)
        }
        engine.setEffectEnabled(fxId as EngineEffectId, on)
      }
      for (const [fxId, params] of Object.entries(u.fxParams)) {
        for (const [paramId, value] of Object.entries(params)) {
          setFxParam(fxId as EngineEffectId, paramId, value)
          engine.setEffectParam(fxId as EngineEffectId, paramId, value)
        }
      }
      // Presets saved before ordering existed carry no order; normalize gives
      // them the default rather than leaving the chain on the previous patch's.
      const order = normalizeFxOrder(u.fxOrder)
      setFxOrder(order)
      engine.setEffectOrder(order)
    },
    [engine, userPatches, setFxEnabled, setFxParam, setFxOrder],
  )

  /** Resume the AudioContext and push the stored FX state into the chain. */
  const ensureAudio = useCallback(async () => {
    if (!needsGesture) return
    setNeedsGesture(false)
    await engine.resume()
    const { fxEnabled, fxParams, fxOrder } = useStore.getState()
    // Order first: the chain is built fresh on resume, so it starts on the
    // default wiring until the stored order is applied.
    engine.setEffectOrder(fxOrder)
    for (const [id, on] of Object.entries(fxEnabled)) {
      engine.setEffectEnabled(id as EngineEffectId, on)
    }
    for (const [id, params] of Object.entries(fxParams)) {
      for (const [pid, val] of Object.entries(params)) {
        engine.setEffectParam(id as EngineEffectId, pid, val)
      }
    }
  }, [engine, needsGesture])

  /**
   * The one way a patch becomes current. It records the request up front so the
   * UI can show it loading, and lets the engine's callbacks decide whether it
   * ever becomes the loaded patch — nothing here assumes the load will succeed.
   */
  const selectPatch = useCallback(
    (patch: PatchManifest) => {
      void ensureAudio()
      engine.stopPreview()
      setLoadError(null)
      setPendingPatchId(patch.id)
      void engine.loadPatch(patch).then(() => {
        // Only restore the preset's FX if this load is the one that won; a
        // superseded or failed load must not stamp its knobs over the chain.
        if (engine.loadedPatchId !== patch.id) return
        if (patch.bank === 'USR') applyUserPatchFx(patch.id)
      })
    },
    [engine, ensureAudio, applyUserPatchFx, setLoadError, setPendingPatchId],
  )

  const selectPatchId = useCallback(
    (id: string) => {
      const patch = fullCatalog.find((p) => p.id === id)
      if (patch) selectPatch(patch)
    },
    [fullCatalog, selectPatch],
  )

  // First load, once the browser has let us start audio.
  useEffect(() => {
    if (needsGesture) return
    if (engine.loadedPatchId || useStore.getState().pendingPatchId) return
    const patch = catalogRef.current.find(
      (p) => p.id === useStore.getState().currentPatchId,
    )
    if (patch) selectPatch(patch)
  }, [needsGesture, engine, selectPatch])

  const previewPatchById = useCallback(
    (id: string) => {
      const patch = catalogRef.current.find((p) => p.id === id)
      if (!patch) return
      // Tapping the button of a playing audition stops it.
      if (useStore.getState().previewPatchId === id) {
        engine.stopPreview()
        return
      }
      void ensureAudio()
      void engine.previewPatch(patch).then((result) => {
        // The audition fetches the same samples a real load would, so a clean
        // one leaves the patch cached for offline exactly like playing it does.
        if (result.offlineReady) markOfflineReady(id)
      })
    },
    [engine, ensureAudio, markOfflineReady],
  )

  const downloadPatchById = useCallback(
    (id: string) => {
      if (downloadingPatchId) return
      const patch = catalogRef.current.find((p) => p.id === id)
      if (!patch) return
      setDownloadingPatchId(id)
      void ensureAudio()
      void engine
        .preloadPatch(patch)
        .then((result) => {
          if (result.ok && result.failed.length === 0) markOfflineReady(id)
        })
        .finally(() => setDownloadingPatchId(null))
    },
    [engine, ensureAudio, downloadingPatchId, setDownloadingPatchId, markOfflineReady],
  )

  // Closing the library should not leave an audition ringing.
  useEffect(() => {
    if (!pickerOpen) engine.stopPreview()
  }, [pickerOpen, engine])

  // Note handlers shared by every input source. Audio is triggered first;
  // the on-screen keyboard highlight goes through the activeNotes store so
  // only the keyboard re-renders per note (see state/activeNotes.ts).
  const noteOn = useCallback(
    (midi: number, vel: number) => {
      engine.noteOn(midi, vel)
      addActiveNote(midi)
    },
    [engine],
  )
  const noteOff = useCallback(
    (midi: number) => {
      engine.noteOff(midi)
      removeActiveNote(midi)
    },
    [engine],
  )
  const setBreath = useCallback(
    (level: number, smoothingMs: number, immediate: boolean) =>
      engine.setBreath(level, smoothingMs, immediate),
    [engine],
  )
  const midiPanic = useWebMidi(
    useMemo(() => ({ noteOn, noteOff, setBreath }), [noteOn, noteOff, setBreath]),
  )
  const panic = useCallback(() => {
    midiPanic()
    engine.panic()
    clearActiveNotes()
  }, [engine, midiPanic])
  // On-screen and computer-keyboard notes aren't breath-controlled: lift the
  // shared breath gain so an idle wind controller doesn't leave them silent.
  const uiNoteOn = useCallback(
    (midi: number, vel: number) => {
      engine.liftBreath()
      noteOn(midi, vel)
    },
    [engine, noteOn],
  )
  const getLatency = useCallback(() => engine.latencyInfo(), [engine])

  const handleStep = useCallback(
    (delta: number) => {
      const list = currentBankPatches.length > 0 ? currentBankPatches : fullCatalog
      if (list.length === 0) return
      // Step from what's on screen, not from what finished loading, so holding
      // NEXT keeps advancing while a slow patch is still fetching.
      const idx = list.findIndex((p) => p.id === displayPatchId)
      const cur = idx === -1 ? 0 : idx
      const next = (((cur + delta) % list.length) + list.length) % list.length
      selectPatch(list[next])
    },
    [currentBankPatches, fullCatalog, displayPatchId, selectPatch],
  )

  const handleBankSelect = useCallback(
    (bank: Bank) => {
      setActiveBank(bank)
      const first = fullCatalog.find((p) => p.bank === bank)
      if (first) selectPatch(first)
    },
    [fullCatalog, selectPatch],
  )

  // Embedded instances come and go with the host page: silence and suspend on
  // unmount, and resume when the effect re-runs after power-on (StrictMode).
  const panicRef = useRef(panic)
  panicRef.current = panic
  const needsGestureRef = useRef(needsGesture)
  needsGestureRef.current = needsGesture
  useEffect(() => {
    if (!suspendOnUnmount) return
    if (!needsGestureRef.current) void engine.resume()
    return () => {
      panicRef.current()
      void engine.suspend()
    }
  }, [engine, suspendOnUnmount])

  return {
    engine,
    fullCatalog,
    displayPatch,
    displayIndex,
    isLoading,
    activeBank,
    currentBankPatches,
    needsGesture,
    ensureAudio,
    selectPatch,
    selectPatchId,
    previewPatchById,
    downloadPatchById,
    handleStep,
    handleBankSelect,
    noteOn,
    noteOff,
    uiNoteOn,
    panic,
    getLatency,
  }
}
