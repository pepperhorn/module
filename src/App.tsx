import { useCallback, useEffect, useState } from 'react'
import { Rack } from './components/Rack'
import { Lcd } from './components/Lcd'
import { ButtonBank } from './components/ButtonBank'
import { EffectsRow } from './components/EffectsRow'
import { PatchPicker } from './components/PatchPicker'
import { PatchStrip } from './components/PatchStrip'
import { KeyboardHud } from './components/KeyboardHud'
import { LiveTouchKeyboard } from './components/LiveTouchKeyboard'
import { PowerOnOverlay } from './components/PowerOnOverlay'
import { TouchControls } from './components/TouchControls'
import { DebugPanel } from './components/DebugPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { LoadErrorToast } from './components/LoadErrorToast'
import { SaveDialog } from './components/SaveDialog'
import { MidiPanel } from './components/MidiPanel'
import { OutputPicker } from './components/OutputPicker'
import { useUserPatchSync } from './state/useUserPatchSync'
import { useStore } from './state/useStore'
import { useSoundEngine } from './state/useSoundEngine'
import { useComputerKeyboard } from './input/useComputerKeyboard'
import { useWakeLock } from './input/useWakeLock'

export default function App() {
  // Mount the patch sync hook so it pulls/merges on login and pushes on save.
  // Logged-out users see no behaviour change — local store works as before.
  useUserPatchSync()

  const s = useSoundEngine()
  const currentSource = useStore((st) => st.currentSource)
  const octave = useStore((st) => st.octave)
  const velocity = useStore((st) => st.velocity)
  const setPickerOpen = useStore((st) => st.setPickerOpen)
  const setSaveDialogOpen = useStore((st) => st.setSaveDialogOpen)
  const debugMode = useStore((st) => st.debugMode)
  const keyboardMode = useStore((st) => st.keyboardMode)
  const setKeyboardMode = useStore((st) => st.setKeyboardMode)

  // On-screen keyboard is hidden by default on mobile (revealed via a toggle);
  // always shown on desktop (lg+) where screen space isn't scarce.
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useComputerKeyboard({ noteOn: s.uiNoteOn, noteOff: s.noteOff, panic: s.panic })
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

  const openPicker = useCallback(() => {
    void s.ensureAudio()
    setPickerOpen(true)
  }, [s.ensureAudio, setPickerOpen])

  const overlays = (
    <>
      {s.needsGesture && <PowerOnOverlay onPowerOn={() => void s.ensureAudio()} />}

      <PatchPicker
        onSelect={s.selectPatchId}
        onPreview={s.previewPatchById}
        onDownload={s.downloadPatchById}
      />

      <LoadingOverlay />

      {/* Keyboard mode renders its own inline copy in the column. */}
      {!keyboardMode && <LoadErrorToast onRetry={s.selectPatchId} />}

      <SaveDialog />

      <MidiPanel getLatency={s.getLatency} />

      {debugMode && <DebugPanel />}
    </>
  )

  if (keyboardMode) {
    return (
      <div
        className="app app-keyboard-mode flex h-[100dvh] flex-col gap-3 overflow-hidden p-2 pt-3 sm:p-3 sm:pt-4"
        // Keyboard mode drops the rack chassis but keeps its brushed faceplate,
        // so the screened group legends knock out against the right metal.
        style={{ background: 'var(--face-bg)' }}
        onClick={() => {
          if (s.needsGesture) void s.ensureAudio()
        }}
      >
        <PatchStrip
          patch={s.displayPatch}
          index={s.displayIndex < 0 ? 0 : s.displayIndex}
          total={s.fullCatalog.length}
          loading={s.isLoading}
          source={currentSource}
          onStep={s.handleStep}
          onBrowse={openPicker}
        />

        <LoadErrorToast onRetry={s.selectPatchId} inline />

        <EffectsRow collapsible />

        <div className="app-keyboard-stage min-h-0 flex-1">
          <LiveTouchKeyboard noteOn={s.uiNoteOn} noteOff={s.noteOff} fill />
        </div>

        <TouchControls
          onPanic={s.panic}
          onToggleKeyboardMode={() => setKeyboardMode(false)}
          keyboardMode
        />

        {overlays}
      </div>
    )
  }

  return (
    <div
      className="app min-h-screen"
      onClick={() => {
        if (s.needsGesture) void s.ensureAudio()
      }}
    >
      <Rack>
        <div className="rack-row-1 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
          <div className="rack-bank rack-panel rounded-lg p-3">
            <span className="rack-bank-title group-legend legend">BANK / SELECT</span>
            <ButtonBank active={s.activeBank} onSelect={s.handleBankSelect} />
            <div className="rack-bank-hint legend-strong mt-3">
              {s.currentBankPatches.length} patches in bank
            </div>
            <div className="rack-bank-spacer h-2" />
            <button
              type="button"
              className="rack-bank-browse hw-btn hw-btn-accent flex w-full items-center justify-center gap-2"
              style={{ padding: '8px 0', ['--hw-accent' as string]: 'var(--color-sky)' }}
              onClick={(e) => {
                e.stopPropagation()
                openPicker()
              }}
            >
              <span
                aria-hidden="true"
                className="rack-bank-browse-led hw-btn-led"
                style={{
                  background: 'var(--color-sky)',
                  boxShadow: '0 0 5px rgba(91,192,235,0.8)',
                }}
              />
              <span className="rack-bank-browse-label legend" style={{ color: 'var(--ink-sky)' }}>
                BROWSE LIBRARY
              </span>
            </button>
            <div className="rack-bank-save-spacer h-2" />
            <button
              type="button"
              className="rack-bank-save hw-btn hw-btn-accent flex w-full items-center justify-center gap-2"
              style={{ padding: '8px 0', ['--hw-accent' as string]: 'var(--color-coral)' }}
              onClick={(e) => {
                e.stopPropagation()
                void s.ensureAudio()
                setSaveDialogOpen(true)
              }}
            >
              <span
                aria-hidden="true"
                className="rack-bank-save-led hw-btn-led"
                style={{
                  background: 'var(--color-coral)',
                  boxShadow: '0 0 5px rgba(255,107,107,0.8)',
                }}
              />
              <span className="rack-bank-save-label legend" style={{ color: 'var(--ink-coral)' }}>
                SAVE PATCH
              </span>
            </button>
            <div className="rack-bank-kb-spacer h-2" />
            <button
              type="button"
              title="Give the keyboard the whole screen"
              className="rack-bank-keyboard hw-btn hw-btn-accent flex w-full items-center justify-center gap-2"
              style={{ padding: '8px 0', ['--hw-accent' as string]: 'var(--color-lavender)' }}
              onClick={(e) => {
                e.stopPropagation()
                void s.ensureAudio()
                setKeyboardMode(true)
              }}
            >
              <span
                aria-hidden="true"
                className="rack-bank-keyboard-led hw-btn-led"
                style={{
                  background: 'var(--color-lavender)',
                  boxShadow: '0 0 5px rgba(181,156,217,0.8)',
                }}
              />
              <span className="rack-bank-keyboard-label legend" style={{ color: 'var(--ink-lavender)' }}>
                KEYBOARD MODE
              </span>
            </button>
          </div>

          <div className="rack-display rack-panel rounded-lg p-4">
            <span className="rack-display-title group-legend legend">DISPLAY</span>
            <Lcd
              patch={s.displayPatch}
              index={s.displayIndex < 0 ? 0 : s.displayIndex}
              total={s.fullCatalog.length}
              octave={octave}
              velocity={velocity}
              loading={s.isLoading}
              source={currentSource}
            />
            <div className="rack-display-controls legend mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="rack-display-step hw-btn legend px-3 py-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  s.handleStep(-1)
                }}
              >
                ◀ PREV
              </button>
              {debugMode && (
                <>
                  <button
                    type="button"
                    className="rack-display-test hw-btn legend px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      void s.ensureAudio()
                      s.engine.testTone()
                    }}
                  >
                    TEST ♪
                  </button>
                  <button
                    type="button"
                    className="rack-display-test hw-btn legend px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      void s.ensureAudio()
                      s.engine.testCurrentNote()
                    }}
                  >
                    C4 ▸
                  </button>
                  <button
                    type="button"
                    className="rack-display-test hw-btn legend px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      void s.ensureAudio()
                      void s.engine.testRawBuffer()
                    }}
                  >
                    RAW
                  </button>
                  <button
                    type="button"
                    className="rack-display-test hw-btn legend px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      void s.ensureAudio()
                      void s.engine.testScale()
                    }}
                  >
                    SCALE
                  </button>
                  <button
                    type="button"
                    className="rack-display-test hw-btn legend px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      void s.ensureAudio()
                      if (s.displayPatch) void s.engine.purgeAndReload(s.displayPatch)
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
                  className="rack-display-wake hw-btn flex items-center gap-1.5 px-3 py-1.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    void s.ensureAudio()
                    void wakeLock.toggle()
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="rack-display-wake-led hw-btn-led"
                    style={
                      wakeLock.enabled
                        ? {
                            background: 'var(--color-lime)',
                            boxShadow: '0 0 5px rgba(181,232,83,0.8)',
                          }
                        : {}
                    }
                  />
                  <span
                    className={`rack-display-wake-label ${
                      wakeLock.enabled ? 'legend-strong' : 'legend'
                    }`}
                  >
                    STAY ON
                  </span>
                </button>
              )}
              <button
                type="button"
                className="rack-display-step hw-btn legend px-3 py-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  s.handleStep(1)
                }}
              >
                NEXT ▶
              </button>
            </div>
          </div>
        </div>

        <div className="rack-row-2 mt-2.5">
          <EffectsRow />
        </div>

        <div className="rack-row-touch mt-2.5">
          <TouchControls
            onPanic={s.panic}
            onToggleKeyboardMode={() => {
              void s.ensureAudio()
              setKeyboardMode(true)
            }}
          />
        </div>

        <div className="rack-row-3 mt-2.5">
          <button
            type="button"
            onClick={() => setKeyboardOpen((v) => !v)}
            aria-expanded={keyboardOpen}
            className="rack-keyboard-toggle hw-btn legend-strong flex w-full items-center justify-center gap-2 py-2.5 lg:hidden"
          >
            {keyboardOpen ? 'Hide keyboard ▾' : 'Show keyboard ▸'}
          </button>
          <div className={`rack-keyboard-drawer ${keyboardOpen ? 'mt-2.5 block' : 'hidden'} lg:mt-0 lg:block`}>
            <LiveTouchKeyboard noteOn={s.uiNoteOn} noteOff={s.noteOff} />
          </div>
        </div>

        <div className="rack-row-4 mt-2.5">
          <KeyboardHud />
        </div>
      </Rack>

      {overlays}
    </div>
  )
}
