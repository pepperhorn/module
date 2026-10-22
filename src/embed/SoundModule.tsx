import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useSoundEngine } from '../state/useSoundEngine'
import { useStore } from '../state/useStore'
import { useComputerKeyboard } from '../input/useComputerKeyboard'
import { PatchStrip } from '../components/PatchStrip'
import { MidiStatus } from '../components/MidiStatus'
import { LoadErrorToast } from '../components/LoadErrorToast'
import { LiveTouchKeyboard } from '../components/LiveTouchKeyboard'
import { PowerOnOverlay } from '../components/PowerOnOverlay'
import { PatchPicker } from '../components/PatchPicker'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { MidiPanel } from '../components/MidiPanel'
import { configureEmbed } from './catalog'

export interface SoundModuleProps {
  /** Base URL that serves /patches/**. becreative passes "". Omitted → CST patches hidden. */
  assetBaseUrl?: string
  /** Applied to the component root only. Default 'dark'. */
  theme?: 'dark' | 'light'
  /** On-screen piano octaves. Default 2 (25 keys). */
  octaves?: number
  className?: string
}

/**
 * The embeddable sound module: patch strip, status row and a labelled
 * on-screen piano, with every overlay drawn inside its own root. The computer
 * keyboard plays only while focus is inside the module; MIDI and breath play
 * regardless.
 */
export function SoundModule({ assetBaseUrl, theme, octaves, className }: SoundModuleProps) {
  // Before any load: nothing fetches until the power-on gesture.
  useLayoutEffect(() => {
    configureEmbed({ assetBaseUrl })
  }, [assetBaseUrl])

  const s = useSoundEngine({
    trackOffline: false,
    engineOptions: { consoleShim: false, quiet: true },
    suspendOnUnmount: true,
  })
  const currentSource = useStore((st) => st.currentSource)
  const octave = useStore((st) => st.octave)
  const velocity = useStore((st) => st.velocity)
  const pickerOpen = useStore((st) => st.pickerOpen)
  const setPickerOpen = useStore((st) => st.setPickerOpen)

  // The app installs these once in hydrateAppState(); the embed owns them for
  // its lifetime so LoadErrorToast's offline wording stays accurate.
  useEffect(() => {
    const { setOnline } = useStore.getState()
    setOnline(navigator.onLine)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const rootRef = useRef<HTMLDivElement>(null)
  const { armed } = useComputerKeyboard(
    { noteOn: s.uiNoteOn, noteOff: s.noteOff, panic: s.panic },
    { target: rootRef },
  )

  // Closing the picker removes the focused card and drops focus to <body>,
  // which would silence the computer keyboard; take focus back.
  const wasPickerOpen = useRef(false)
  useEffect(() => {
    const closed = wasPickerOpen.current && !pickerOpen
    wasPickerOpen.current = pickerOpen
    const root = rootRef.current
    if (closed && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true })
  }, [pickerOpen])

  const { ensureAudio } = s
  const openPicker = useCallback(() => {
    void ensureAudio()
    setPickerOpen(true)
  }, [ensureAudio, setPickerOpen])

  return (
    <div
      ref={rootRef}
      className={`sound-module sm-root relative isolate w-full min-h-[420px] overflow-hidden rounded-lg ${className ?? ''}`}
      data-theme={theme ?? 'dark'}
      tabIndex={0}
      onPointerDownCapture={() => {
        // The piano's pointerdown calls preventDefault(), which stops focus
        // moving; focus the root ourselves so pressing it arms the keys.
        const root = rootRef.current
        if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true })
      }}
      onClick={() => {
        if (s.needsGesture) void s.ensureAudio()
      }}
    >
      <div className="sm-body flex flex-col gap-3 p-3" style={{ background: 'var(--face-bg)' }}>
        <PatchStrip
          patch={s.displayPatch}
          index={s.displayIndex < 0 ? 0 : s.displayIndex}
          total={s.fullCatalog.length}
          loading={s.isLoading}
          source={currentSource}
          onStep={s.handleStep}
          onBrowse={openPicker}
        />

        <div className="sm-status-row flex flex-wrap items-center gap-2">
          <span className="sm-readout legend">
            OCT {octave} · VEL {velocity}
          </span>
          <MidiStatus />
          <span
            className="sm-keys-indicator legend rounded-full px-2 py-0.5"
            data-armed={armed}
            title="Click the module to play it with your computer keyboard"
          >
            {armed ? '⌨ keys on' : '⌨ keys off'}
          </span>
        </div>

        <LoadErrorToast inline onRetry={s.selectPatchId} />

        <LiveTouchKeyboard
          noteOn={s.uiNoteOn}
          noteOff={s.noteOff}
          keyLabels
          octaves={octaves ?? 2}
        />
      </div>

      {s.needsGesture && <PowerOnOverlay contained onPowerOn={() => void s.ensureAudio()} />}
      <PatchPicker
        contained
        offlineFeatures={false}
        onSelect={s.selectPatchId}
        onPreview={s.previewPatchById}
      />
      <LoadingOverlay contained />
      <MidiPanel contained getLatency={s.getLatency} />
    </div>
  )
}
