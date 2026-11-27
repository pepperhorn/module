import { useLayoutEffect, useRef, useState } from 'react'
import { EffectsDrawer } from './drawers/EffectsDrawer'
import { SettingsDrawer } from './drawers/SettingsDrawer'
import { SoundsDrawer } from './drawers/SoundsDrawer'
import { useKeyboardEngine } from './engine/useKeyboardEngine'
import { useKeyboardKeys } from './engine/useKeyboardKeys'
import { useKeyboardMidi } from './engine/useKeyboardMidi'
import { KeyboardSurface } from './KeyboardSurface'
import { DRUMS_ID } from './patches/bundled'
import { DRUM_RANGE } from './patches/drumMap'
import type { ChordType } from './theory'
import { TopBar } from './TopBar'
import { useChordPlayer } from './useChordPlayer'
import { useKeyboardPrefs } from './useKeyboardPrefs'

export interface KeyboardProps {
  defaultPatch?: 'piano' | 'drums' | string
  defaultMode?: 'play' | 'chord'
  defaultChord?: 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7'
  showNoteNames?: boolean
  accidentals?: 'flat' | 'sharp'
  octaves?: number
  startOctave?: number
  assetBaseUrl?: string
  className?: string
}

function clampInteger(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback
}

export function Keyboard({
  defaultPatch, defaultMode = 'play', defaultChord = 'maj', showNoteNames, accidentals,
  octaves, startOctave = 3, assetBaseUrl, className,
}: KeyboardProps) {
  const root = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState(defaultMode)
  const [chord, setChord] = useState<ChordType>(defaultChord)
  const [shift, setShift] = useState(0)
  const [autoOctaves, setAutoOctaves] = useState(2)
  const [prefs, setPrefs] = useKeyboardPrefs({ accidentals, showNames: showNoteNames })
  const audio = useKeyboardEngine({ defaultPatch, assetBaseUrl, prefs, setPrefs })
  const isDrums = audio.patch.id === DRUMS_ID
  const effectiveMode = isDrums ? 'play' : mode
  const visibleOctaves = octaves === undefined ? autoOctaves : clampInteger(octaves, 1, 10, 2)
  const low = clampInteger(startOctave + shift, -1, 9 - visibleOctaves, 3) * 12 + 12
  const high = low + visibleOctaves * 12
  const player = useChordPlayer({
    mode: effectiveMode, chord, accidentals: prefs.accidentals, isDrums, noteOn: audio.noteOn, noteOff: audio.noteOff,
  })
  const { releaseAll } = player

  useLayoutEffect(() => { releaseAll() }, [audio.patch.id, releaseAll])
  useLayoutEffect(() => {
    if (octaves !== undefined || typeof ResizeObserver === 'undefined' || !root.current) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      setAutoOctaves(width >= 940 ? 4 : width >= 640 ? 3 : 2)
    })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [octaves])

  const press = (midi: number, velocity: number) => {
    if (audio.needsGesture || audio.loading || audio.loadFailed) return false
    return player.press(midi, velocity)
  }
  function panic() {
    releaseAll()
    audio.panic()
  }

  useKeyboardKeys({
    target: root, start: isDrums ? DRUM_RANGE.low : low, press, release: player.release, panic,
    shiftOctave: delta => {
      if (!isDrums) setShift(current => Math.min(2, Math.max(-2, current + delta)))
    },
  })
  const midi = useKeyboardMidi({
    press, release: player.release, deviceId: prefs.midiDeviceId, setDeviceId: midiDeviceId => setPrefs({ midiDeviceId }),
  })

  return (
    <div
      ref={root} className={`keyboard-module kb-root relative w-full ${className ?? ''}`}
      tabIndex={0} role="group" aria-label="Keyboard"
      onPointerDownCapture={event => {
        if ((event.target as Element).closest('.kb-surface')) root.current?.focus({ preventScroll: true })
      }}
    >
      <TopBar
        patchName={audio.patch.name} isDrums={isDrums} mode={effectiveMode} chord={chord}
        showNames={prefs.showNames} onMode={setMode} onChord={setChord}
        onNames={() => setPrefs({ showNames: !prefs.showNames })}
        soundsDrawer={close => (
          <SoundsDrawer catalog={audio.catalog} selectedId={audio.patch.id} onSelect={id => {
            audio.selectPatch(id)
            close()
          }} />
        )}
        effectsDrawer={(
          <EffectsDrawer effects={prefs.effects} onEnabled={audio.setEffectEnabled} onAmount={audio.setEffectAmount} />
        )}
        settingsDrawer={(
          <SettingsDrawer
            volume={prefs.volume} onVolume={audio.setVolume} shift={shift} isDrums={isDrums}
            onShift={value => setShift(clampInteger(value, -2, 2, 0))}
            accidentals={prefs.accidentals} onAccidentals={value => setPrefs({ accidentals: value })}
            devices={midi.devices} deviceId={midi.deviceId} onDevice={midi.setDeviceId} requestMidi={midi.requestMidi}
          />
        )}
      />
      <div className="kb-playing-area">
        <KeyboardSurface
          low={low} high={high} showNames={prefs.showNames} accidentals={prefs.accidentals}
          isDrums={isDrums} lit={player.lit} badges={player.badges} press={press} release={player.release}
        />
        {audio.needsGesture && (
          <div className="kb-power-overlay flex items-center justify-center">
            <button className="kb-button kb-power-btn" type="button" onClick={() => {
              root.current?.focus({ preventScroll: true })
              void audio.ensureAudio()
              void midi.requestMidi()
            }}>Enable audio</button>
          </div>
        )}
        {audio.loading && <div className="kb-loading absolute" role="status">Loading {audio.patch.name}…</div>}
        {audio.loadFailed && !audio.needsGesture && (
          <button className="kb-button kb-retry-btn absolute" type="button" onClick={() => audio.selectPatch(audio.patch.id)}>Retry {audio.patch.name}</button>
        )}
      </div>
    </div>
  )
}
