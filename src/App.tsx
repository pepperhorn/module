import { useCallback, useEffect, useMemo, useState } from 'react'
import { Rack } from './components/Rack'
import { Lcd } from './components/Lcd'
import { ValueDial } from './components/ValueDial'
import { ButtonBank } from './components/ButtonBank'
import { EffectsRow } from './components/EffectsRow'
import { PatchPicker } from './components/PatchPicker'
import { KeyboardHud } from './components/KeyboardHud'
import { TouchKeyboard } from './components/TouchKeyboard'
import { DebugPanel } from './components/DebugPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { SaveDialog } from './components/SaveDialog'
import { useUserPatchSync } from './state/useUserPatchSync'
import { useStore } from './state/useStore'
import { useComputerKeyboard } from './input/useComputerKeyboard'
import { useWebMidi } from './input/useWebMidi'
import { getEngine } from './audio/AudioEngine'
import { findPatch } from './patches/catalog'
import type { Bank, PatchManifest } from './patches/types'
import type { EffectId as EngineEffectId } from './audio/effects'

export default function App() {
  // Mount the patch sync hook so it pulls/merges on login and pushes on save.
  // Logged-out users see no behaviour change — local store works as before.
  useUserPatchSync()

  const engine = useMemo(() => getEngine(), [])
  const catalog = useStore((s) => s.catalog)
  const currentPatchId = useStore((s) => s.currentPatchId)
  const setCurrentPatchId = useStore((s) => s.setCurrentPatchId)
  const setLoadingPatchId = useStore((s) => s.setLoadingPatchId)
  const setLoadingProgress = useStore((s) => s.setLoadingProgress)
  const setCurrentSource = useStore((s) => s.setCurrentSource)
  const loadingPatchId = useStore((s) => s.loadingPatchId)
  const currentSource = useStore((s) => s.currentSource)
  const markDownloaded = useStore((s) => s.markDownloaded)
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const setPickerOpen = useStore((s) => s.setPickerOpen)
  const setSaveDialogOpen = useStore((s) => s.setSaveDialogOpen)
  const userPatches = useStore((s) => s.userPatches)
  const setFxParam = useStore((s) => s.setFxParam)
  const setFxEnabled = useStore((s) => s.toggleFxEnabled)
  const debugMode = useStore((s) => s.debugMode)

  const [activeBank, setActiveBank] = useState<Bank>('PNO')
  const [needsGesture, setNeedsGesture] = useState(true)

  // Build a synthetic catalog that includes user patches as USR-bank entries
  // so the rest of the app (LCD, prev/next, bank scroll) can treat them like
  // normal patches.
  const fullCatalog = useMemo<PatchManifest[]>(() => {
    const userManifests: PatchManifest[] = []
    for (const u of userPatches) {
      const base = findPatch(u.basePatchId)
      if (!base) continue
      userManifests.push({
        id: u.id,
        name: u.name,
        category: base.name,
        bank: 'USR',
        color: u.color,
        defaultOctave: base.defaultOctave,
        source: base.source,
      })
    }
    return [...userManifests, ...catalog]
  }, [catalog, userPatches])

  const currentPatch = useMemo(
    () => fullCatalog.find((p) => p.id === currentPatchId),
    [fullCatalog, currentPatchId],
  )

  const currentIndex = useMemo(
    () => fullCatalog.findIndex((p) => p.id === currentPatchId),
    [fullCatalog, currentPatchId],
  )

  const currentBankPatches = useMemo(
    () => fullCatalog.filter((p) => p.bank === activeBank),
    [fullCatalog, activeBank],
  )

  // Sync activeBank to current patch's bank when patch changes externally
  useEffect(() => {
    if (currentPatch && currentPatch.bank !== activeBank) {
      setActiveBank(currentPatch.bank)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatch?.id])

  // Wire engine load callbacks → store
  useEffect(() => {
    engine.onLoading = (id) => {
      setLoadingPatchId(id)
      if (id === null) setLoadingProgress(null)
      else setLoadingProgress({ loaded: 0, total: 0 })
    }
    engine.onLoaded = (id, source) => {
      setLoadingPatchId(null)
      setLoadingProgress(null)
      setCurrentPatchId(id)
      setCurrentSource(source)
      // A successful active load fully populates the persistent cache
      // for that patch, so it's effectively "downloaded for offline".
      markDownloaded(id)
    }
    engine.onProgress = (_id, progress) => {
      setLoadingProgress(progress)
    }
    return () => {
      engine.onLoading = undefined
      engine.onLoaded = undefined
      engine.onProgress = undefined
    }
  }, [engine, setLoadingPatchId, setLoadingProgress, setCurrentSource, setCurrentPatchId, markDownloaded])

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

  const loadPatch = useCallback(
    (patch: PatchManifest) => {
      void engine.loadPatch(patch).then(() => {
        // After the engine has loaded the underlying source, restore the
        // user-saved FX snapshot if this is a USR patch.
        if (patch.bank === 'USR') {
          applyUserPatchFx(patch.id)
          // Override the engine's setCurrentPatchId(base.id) call from onLoaded
          // so the LCD shows the user patch identity, not the underlying base.
          setCurrentPatchId(patch.id)
        }
      })
    },
    [engine, applyUserPatchFx, setCurrentPatchId],
  )

  // Initial load once user gestures (engine.resume needs user gesture)
  const onFirstGesture = useCallback(async () => {
    setNeedsGesture(false)
    await engine.resume()
    if (currentPatch) {
      void engine.loadPatch(currentPatch)
    }
    // Apply current FX state to engine
    const { fxEnabled, fxParams } = useStore.getState()
    for (const [id, on] of Object.entries(fxEnabled)) {
      engine.setEffectEnabled(id as never, on)
    }
    for (const [id, params] of Object.entries(fxParams)) {
      for (const [pid, val] of Object.entries(params)) {
        engine.setEffectParam(id as never, pid, val)
      }
    }
  }, [engine, currentPatch])

  // Computer keyboard input
  const noteOn = useCallback(
    (midi: number, vel: number) => engine.noteOn(midi, vel),
    [engine],
  )
  const noteOff = useCallback((midi: number) => engine.noteOff(midi), [engine])
  const panic = useCallback(() => engine.panic(), [engine])
  useComputerKeyboard({ noteOn, noteOff, panic })
  useWebMidi(useMemo(() => ({ noteOn, noteOff }), [noteOn, noteOff]))

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
      const list = currentBankPatches.length > 0 ? currentBankPatches : catalog
      if (list.length === 0) return
      const idx = list.findIndex((p) => p.id === currentPatchId)
      const cur = idx === -1 ? 0 : idx
      const next = (cur + delta + list.length * 10) % list.length
      const patch = list[next]
      setCurrentPatchId(patch.id)
      loadPatch(patch)
    },
    [currentBankPatches, catalog, currentPatchId, loadPatch, setCurrentPatchId],
  )

  const handleBankSelect = useCallback(
    (bank: Bank) => {
      setActiveBank(bank)
      const first = catalog.find((p) => p.bank === bank)
      if (first) {
        setCurrentPatchId(first.id)
        loadPatch(first)
      }
    },
    [catalog, loadPatch, setCurrentPatchId],
  )

  return (
    <div
      className="app min-h-screen"
      onClick={() => {
        if (needsGesture) void onFirstGesture()
      }}
    >
      <Rack>
        <div className="rack-row-1 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
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
                if (needsGesture) void onFirstGesture()
                setPickerOpen(true)
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
                if (needsGesture) void onFirstGesture()
                setSaveDialogOpen(true)
              }}
            >
              ★ SAVE PATCH
            </button>
          </div>

          <div className="rack-display rack-panel rounded-xl p-4">
            <Lcd
              patch={currentPatch}
              index={currentIndex < 0 ? 0 : currentIndex}
              total={fullCatalog.length}
              octave={octave}
              velocity={velocity}
              loading={loadingPatchId !== null}
              source={currentSource}
            />
            <div className="rack-display-controls mt-3 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-text/50">
              <button
                type="button"
                className="rack-display-step cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                onClick={(e) => {
                  e.stopPropagation()
                  if (needsGesture) void onFirstGesture()
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
                      if (needsGesture) void onFirstGesture()
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
                      if (needsGesture) void onFirstGesture()
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
                      if (needsGesture) void onFirstGesture()
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
                      if (needsGesture) void onFirstGesture()
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
                      if (needsGesture) void onFirstGesture()
                      if (currentPatch) void engine.purgeAndReload(currentPatch)
                    }}
                  >
                    PURGE
                  </button>
                </>
              )}
              <button
                type="button"
                className="rack-display-step cell-hit rounded-md border border-rack-edge bg-white px-3 py-1.5 hover:text-text"
                onClick={(e) => {
                  e.stopPropagation()
                  if (needsGesture) void onFirstGesture()
                  handleStep(1)
                }}
              >
                NEXT ▶
              </button>
            </div>
          </div>

          <div className="rack-dial rack-panel flex flex-col items-center justify-center rounded-xl p-4">
            <ValueDial
              onStep={(delta) => {
                if (needsGesture) void onFirstGesture()
                handleStep(delta)
              }}
            />
            <div className="rack-dial-help mt-2 font-mono text-[9px] uppercase tracking-widest text-text/40">
              drag · scroll
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

      {needsGesture && (
        <div
          className="gesture-overlay fade-in fixed inset-0 z-40 flex items-center justify-center bg-text/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation()
            void onFirstGesture()
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
        onSelect={(id) => {
          const patch = catalog.find((p) => p.id === id)
          if (patch) {
            setCurrentPatchId(id)
            loadPatch(patch)
          }
        }}
      />

      <LoadingOverlay />

      <SaveDialog />

      {debugMode && <DebugPanel />}
    </div>
  )
}
