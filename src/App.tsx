import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Rack } from './components/Rack'
import { Lcd } from './components/Lcd'
import { ButtonBank } from './components/ButtonBank'
import { EffectsRow } from './components/EffectsRow'
import { PatchPicker } from './components/PatchPicker'
import { PatchStrip } from './components/PatchStrip'
import { KeyboardHud } from './components/KeyboardHud'
import { TouchKeyboard } from './components/TouchKeyboard'
import { DebugPanel } from './components/DebugPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { LoadErrorToast } from './components/LoadErrorToast'
import { SaveDialog } from './components/SaveDialog'
import { OutputPicker } from './components/OutputPicker'
import { useUserPatchSync } from './state/useUserPatchSync'
import { useStore } from './state/useStore'
import { useFullCatalog } from './state/useFullCatalog'
import { useComputerKeyboard } from './input/useComputerKeyboard'
import { useWebMidi } from './input/useWebMidi'
import { useWakeLock } from './input/useWakeLock'
import { getEngine } from './audio/AudioEngine'
import type { Bank, PatchManifest } from './patches/types'
import type { EffectId as EngineEffectId } from './audio/effects'

export default function App() {
  // Mount the patch sync hook so it pulls/merges on login and pushes on save.
  // Logged-out users see no behaviour change — local store works as before.
  useUserPatchSync()

  const engine = useMemo(() => getEngine(), [])
  const currentPatchId = useStore((s) => s.currentPatchId)
  const pendingPatchId = useStore((s) => s.pendingPatchId)
  const setCurrentPatchId = useStore((s) => s.setCurrentPatchId)
  const setPendingPatchId = useStore((s) => s.setPendingPatchId)
  const setLoadError = useStore((s) => s.setLoadError)
  const setLoadingPatchId = useStore((s) => s.setLoadingPatchId)
  const setLoadingProgress = useStore((s) => s.setLoadingProgress)
  const setCurrentSource = useStore((s) => s.setCurrentSource)
  const loadingPatchId = useStore((s) => s.loadingPatchId)
  const currentSource = useStore((s) => s.currentSource)
  const markDownloaded = useStore((s) => s.markDownloaded)
  const unmarkDownloaded = useStore((s) => s.unmarkDownloaded)
  const setPreviewPatchId = useStore((s) => s.setPreviewPatchId)
  const setDownloadingPatchId = useStore((s) => s.setDownloadingPatchId)
  const downloadingPatchId = useStore((s) => s.downloadingPatchId)
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const pickerOpen = useStore((s) => s.pickerOpen)
  const setPickerOpen = useStore((s) => s.setPickerOpen)
  const setSaveDialogOpen = useStore((s) => s.setSaveDialogOpen)
  const userPatches = useStore((s) => s.userPatches)
  const setFxParam = useStore((s) => s.setFxParam)
  const setFxEnabled = useStore((s) => s.toggleFxEnabled)
  const debugMode = useStore((s) => s.debugMode)
  const keyboardMode = useStore((s) => s.keyboardMode)
  const setKeyboardMode = useStore((s) => s.setKeyboardMode)

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
   * A user preset shares its base patch's samples, so caching either one makes
   * both playable offline. Mark them together or the picker greys out presets
   * whose audio is right there in the cache.
   */
  const markOfflineReady = useCallback(
    (id: string, ready: boolean) => {
      const apply = ready ? markDownloaded : unmarkDownloaded
      apply(id)
      const user = useStore.getState().userPatches.find((u) => u.id === id)
      if (user) apply(user.basePatchId)
    },
    [markDownloaded, unmarkDownloaded],
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
      setPendingPatchId(null)
      setLoadError(null)
      setCurrentSource(outcome.source)
      // A clean active load fills the persistent caches, so the patch is now
      // genuinely available offline. A load with missing samples is not, and
      // marking it would lie to the picker's offline greyout.
      markOfflineReady(id, outcome.offlineReady)
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
    },
    [engine, userPatches, setFxEnabled, setFxParam],
  )

  /** Resume the AudioContext and push the stored FX state into the chain. */
  const ensureAudio = useCallback(async () => {
    if (!needsGesture) return
    setNeedsGesture(false)
    await engine.resume()
    const { fxEnabled, fxParams } = useStore.getState()
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
        if (result.offlineReady) markOfflineReady(id, true)
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
          if (result.ok && result.failed.length === 0) markOfflineReady(id, true)
        })
        .finally(() => setDownloadingPatchId(null))
    },
    [engine, ensureAudio, downloadingPatchId, setDownloadingPatchId, markOfflineReady],
  )

  // Closing the library should not leave an audition ringing.
  useEffect(() => {
    if (!pickerOpen) engine.stopPreview()
  }, [pickerOpen, engine])

  // Computer keyboard input
  const noteOn = useCallback(
    (midi: number, vel: number) => engine.noteOn(midi, vel),
    [engine],
  )
  const noteOff = useCallback((midi: number) => engine.noteOff(midi), [engine])
  const panic = useCallback(() => engine.panic(), [engine])
  useComputerKeyboard({ noteOn, noteOff, panic })
  useWebMidi(useMemo(() => ({ noteOn, noteOff }), [noteOn, noteOff]))
  const wakeLock = useWakeLock()

  // Browse hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === '/') {
        e.preventDefault()
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setPickerOpen])

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

  const openPicker = useCallback(() => {
    void ensureAudio()
    setPickerOpen(true)
  }, [ensureAudio, setPickerOpen])

  const overlays = (
    <>
      {needsGesture && (
        <div
          className="gesture-overlay fade-in fixed inset-0 z-40 flex items-center justify-center bg-text/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation()
            void ensureAudio()
          }}
        >
          <div
            className="gesture-card pop-in flex flex-col items-center gap-3 rounded-2xl bg-bg px-8 py-6 text-center shadow-2xl"
            style={{ border: '1px solid var(--color-rack-edge)' }}
          >
            <span
              className="gesture-mark inline-block h-3 w-3 rounded-sm"
              style={{
                background: 'var(--color-coral)',
                boxShadow: '0 0 12px rgba(255,107,107,0.6)',
              }}
            />
            <div className="gesture-title font-display text-lg font-semibold text-text">
              tap to power on
            </div>
            <div className="gesture-sub max-w-xs font-mono text-[10px] uppercase tracking-wider text-text/50">
              browser audio needs a user gesture · click anywhere
            </div>
          </div>
        </div>
      )}

      <PatchPicker
        onSelect={selectPatchId}
        onPreview={previewPatchById}
        onDownload={downloadPatchById}
      />

      <LoadingOverlay />

      <LoadErrorToast onRetry={selectPatchId} />

      <SaveDialog />

      {debugMode && <DebugPanel />}
    </>
  )

  if (keyboardMode) {
    return (
      <div
        className="app app-keyboard-mode flex h-[100dvh] flex-col gap-2 p-2 sm:p-3"
        onClick={() => {
          if (needsGesture) void ensureAudio()
        }}
      >
        <PatchStrip
          patch={displayPatch}
          index={displayIndex < 0 ? 0 : displayIndex}
          total={fullCatalog.length}
          loading={isLoading}
          source={currentSource}
          onStep={handleStep}
          onBrowse={openPicker}
          onExitKeyboardMode={() => setKeyboardMode(false)}
        />

        <EffectsRow collapsible />

        <div className="app-keyboard-stage min-h-0 flex-1">
          <TouchKeyboard noteOn={noteOn} noteOff={noteOff} fill />
        </div>

        {overlays}
      </div>
    )
  }

  return (
    <div
      className="app min-h-screen"
      onClick={() => {
        if (needsGesture) void ensureAudio()
      }}
    >
      <Rack>
        <div className="rack-row-1 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="rack-bank rack-panel rounded-xl p-4">
            <ButtonBank active={activeBank} onSelect={handleBankSelect} />
            <div className="rack-bank-hint mt-3 font-mono text-[9px] uppercase tracking-widest text-text/40">
              {currentBankPatches.length} patches in bank
            </div>
            <div className="rack-bank-spacer h-2" />
            <button
              type="button"
              className="rack-bank-browse cell-hit w-full rounded-md font-display text-xs font-medium uppercase tracking-widest text-bg"
              style={{
                padding: '8px 0',
                background:
                  'linear-gradient(180deg, var(--color-sky) 0%, #4AA8D2 100%)',
                boxShadow:
                  'inset 0 -2px 0 rgba(0,0,0,0.18), 0 0 12px rgba(91,192,235,0.35)',
              }}
              onClick={(e) => {
                e.stopPropagation()
                openPicker()
              }}
            >
              BROWSE LIBRARY
            </button>
            <div className="rack-bank-save-spacer h-2" />
            <button
              type="button"
              className="rack-bank-save cell-hit w-full rounded-md font-display text-xs font-medium uppercase tracking-widest text-bg"
              style={{
                padding: '8px 0',
                background:
                  'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                boxShadow:
                  'inset 0 -2px 0 rgba(0,0,0,0.18), 0 0 12px rgba(255,107,107,0.35)',
              }}
              onClick={(e) => {
                e.stopPropagation()
                void ensureAudio()
                setSaveDialogOpen(true)
              }}
            >
              ★ SAVE PATCH
            </button>
            <div className="rack-bank-kb-spacer h-2" />
            <button
              type="button"
              title="Give the keyboard the whole screen"
              className="rack-bank-keyboard cell-hit w-full rounded-md font-display text-xs font-medium uppercase tracking-widest"
              style={{
                padding: '8px 0',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
                border: '1px solid var(--color-rack-edge)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
              onClick={(e) => {
                e.stopPropagation()
                void ensureAudio()
                setKeyboardMode(true)
              }}
            >
              ⌨ KEYBOARD MODE
            </button>
          </div>

          <div className="rack-display rack-panel rounded-xl p-4">
            <Lcd
              patch={displayPatch}
              index={displayIndex < 0 ? 0 : displayIndex}
              total={fullCatalog.length}
              octave={octave}
              velocity={velocity}
              loading={isLoading}
              source={currentSource}
            />
            <div className="rack-display-controls mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-text/50">
              <button
                type="button"
                className="rack-display-step cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStep(-1)
                }}
              >
                ◀ PREV
              </button>
              {debugMode && (
                <>
                  <button
                    type="button"
                    className="rack-display-test cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      void ensureAudio()
                      engine.testTone()
                    }}
                  >
                    TEST ♪
                  </button>
                  <button
                    type="button"
                    className="rack-display-test cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      void ensureAudio()
                      engine.testCurrentNote()
                    }}
                  >
                    C4 ▸
                  </button>
                  <button
                    type="button"
                    className="rack-display-test cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      void ensureAudio()
                      void engine.testRawBuffer()
                    }}
                  >
                    RAW
                  </button>
                  <button
                    type="button"
                    className="rack-display-test cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      void ensureAudio()
                      void engine.testScale()
                    }}
                  >
                    SCALE
                  </button>
                  <button
                    type="button"
                    className="rack-display-test cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      void ensureAudio()
                      if (displayPatch) void engine.purgeAndReload(displayPatch)
                    }}
                  >
                    PURGE
                  </button>
                </>
              )}
              <OutputPicker />
              {wakeLock.supported && (
                <button
                  type="button"
                  aria-pressed={wakeLock.enabled}
                  title={
                    wakeLock.enabled
                      ? 'Screen stay-on: on'
                      : 'Keep the screen awake while playing'
                  }
                  className="rack-display-wake cell-hit rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest"
                  style={{
                    background: wakeLock.enabled ? 'var(--color-lime)' : '#FFFFFF',
                    color: wakeLock.enabled ? 'var(--color-bg)' : 'var(--color-text)',
                    border: wakeLock.enabled
                      ? '1px solid transparent'
                      : '1px solid var(--color-rack-edge)',
                    boxShadow: wakeLock.enabled
                      ? '0 0 10px rgba(181,232,83,0.5)'
                      : 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    void ensureAudio()
                    void wakeLock.toggle()
                  }}
                >
                  ☀ STAY ON
                </button>
              )}
              <button
                type="button"
                className="rack-display-step cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStep(1)
                }}
              >
                NEXT ▶
              </button>
            </div>
          </div>
        </div>

        <div className="rack-row-2 mt-4">
          <EffectsRow />
        </div>

        <div className="rack-row-3 mt-4">
          <TouchKeyboard noteOn={noteOn} noteOff={noteOff} />
        </div>

        <div className="rack-row-4 mt-3">
          <KeyboardHud />
        </div>
      </Rack>

      {overlays}
    </div>
  )
}
