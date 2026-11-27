import { CHORD_TYPES, type ChordType } from './theory'

type DrawerName = 'sounds' | 'effects' | 'settings'

interface TopBarProps {
  patchName: string
  isDrums: boolean
  mode: 'play' | 'chord'
  chord: ChordType
  showNames: boolean
  onMode(mode: 'play' | 'chord'): void
  onChord(chord: ChordType): void
  onNames(): void
  onOpenDrawer(name: DrawerName): void
}

export function TopBar({ patchName, isDrums, mode, chord, showNames, onMode, onChord, onNames, onOpenDrawer }: TopBarProps) {
  return (
    <div className="kb-toolbar">
      <div className="kb-top-bar flex flex-wrap items-center gap-2">
        <button className="kb-button kb-sounds-btn" type="button" onClick={() => onOpenDrawer('sounds')}>
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
        <button className="kb-button kb-settings-btn" type="button" aria-label="Effects and settings" onClick={() => onOpenDrawer('effects')}>⚙</button>
      </div>
      <div className="kb-drawer-slot" />
    </div>
  )
}
