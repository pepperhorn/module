import type { ReactNode } from 'react'
import { useDrawer } from './drawers/useDrawer'
import { CHORD_TYPES, type ChordType } from './theory'

interface TopBarProps {
  patchName: string
  isDrums: boolean
  mode: 'play' | 'chord'
  chord: ChordType
  showNames: boolean
  onMode(mode: 'play' | 'chord'): void
  onChord(chord: ChordType): void
  onNames(): void
  soundsDrawer(close: () => void): ReactNode
  effectsDrawer: ReactNode
  settingsDrawer: ReactNode
}

export function TopBar({
  patchName, isDrums, mode, chord, showNames, onMode, onChord, onNames,
  soundsDrawer, effectsDrawer, settingsDrawer,
}: TopBarProps) {
  const drawer = useDrawer()
  const gearOpen = drawer.active === 'effects' || drawer.active === 'settings'
  const panelName = drawer.active === 'sounds' ? 'Sounds' : drawer.active === 'effects' ? 'Effects' : 'Settings'
  return (
    <div className="kb-toolbar">
      <div className="kb-top-bar flex flex-wrap items-center">
        <button
          ref={drawer.sounds} className="kb-button kb-sounds-btn" type="button" title={patchName}
          aria-expanded={drawer.active === 'sounds'} aria-controls={drawer.panelId}
          onClick={() => drawer.toggle('sounds')}
        >
          ♪ {patchName} ▾
        </button>
        <div className="kb-mode-controls flex" role="group" aria-label="Playing mode">
          <button className="kb-button kb-mode-btn" type="button" aria-pressed={mode === 'play'} onClick={() => onMode('play')}>Play</button>
          <button
            className="kb-button kb-mode-btn" type="button" aria-pressed={mode === 'chord'} disabled={isDrums}
            title={isDrums ? 'Chord mode is unavailable for drums' : undefined} onClick={() => onMode('chord')}
          >Chord</button>
        </div>
        {mode === 'chord' && (
          <div className="kb-chord-controls flex flex-wrap" role="group" aria-label="Chord type">
            {CHORD_TYPES.map(type => (
              <button key={type} className="kb-button kb-chord-btn" type="button" aria-pressed={type === chord} onClick={() => onChord(type)}>
                {type}
              </button>
            ))}
          </div>
        )}
        <button className="kb-button kb-names-btn" type="button" aria-label="Note names" aria-pressed={showNames} onClick={onNames}>Aa</button>
        <button
          ref={drawer.gear} className="kb-button kb-settings-btn" type="button" aria-label="Effects and settings"
          aria-expanded={gearOpen} aria-controls={drawer.panelId} onClick={() => drawer.toggle('effects')}
        >⚙</button>
      </div>
      <div
        ref={drawer.panel} id={drawer.panelId} className="kb-drawer-slot" hidden={!drawer.active}
        role={drawer.active ? 'region' : undefined} aria-label={drawer.active ? panelName : undefined} tabIndex={-1}
      >
        {gearOpen && (
          <div className="kb-drawer-nav flex" role="group" aria-label="Effects and settings">
            <button className="kb-button kb-drawer-tab" type="button" aria-pressed={drawer.active === 'effects'} onClick={() => drawer.show('effects')}>Effects</button>
            <button className="kb-button kb-drawer-tab" type="button" aria-pressed={drawer.active === 'settings'} onClick={() => drawer.show('settings')}>Settings</button>
          </div>
        )}
        {drawer.active === 'sounds' && soundsDrawer(drawer.close)}
        {drawer.active === 'effects' && effectsDrawer}
        {drawer.active === 'settings' && settingsDrawer}
      </div>
    </div>
  )
}
