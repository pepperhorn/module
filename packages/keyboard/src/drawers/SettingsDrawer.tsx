import type { Accidentals } from '../theory'

interface SettingsDrawerProps {
  volume: number
  onVolume(volume: number): void
  shift: number
  onShift(shift: number): void
  isDrums: boolean
  accidentals: Accidentals
  onAccidentals(accidentals: Accidentals): void
  devices: readonly { id: string; name: string }[]
  deviceId: string | null
  onDevice(id: string | null): void
  requestMidi(): Promise<void>
}

const OCTAVES = [-2, -1, 0, 1, 2]

export function SettingsDrawer({
  volume, onVolume, shift, onShift, isDrums, accidentals, onAccidentals,
  devices, deviceId, onDevice, requestMidi,
}: SettingsDrawerProps) {
  const disconnected = deviceId !== null && !devices.some(device => device.id === deviceId)
  const midiSupported = typeof navigator.requestMIDIAccess === 'function'
  const percent = `${Math.round(volume * 100)}%`

  return (
    <div className="kb-drawer-settings">
      <label className="kb-setting">
        <span className="kb-drawer-label">Volume</span>
        <span className="kb-volume">
          <input
            className="kb-range kb-volume-range" type="range" min="0" max="1" step="0.01"
            value={volume} aria-valuetext={percent} onChange={event => onVolume(event.currentTarget.valueAsNumber)}
          />
          <span className="kb-volume-value" aria-hidden="true">{percent}</span>
        </span>
      </label>
      <label className="kb-setting">
        <span className="kb-drawer-label">Octave shift</span>
        <select
          className="kb-select kb-octave-select" value={shift} disabled={isDrums}
          title={isDrums ? 'Drums use a fixed octave range' : undefined}
          onChange={event => onShift(Number(event.currentTarget.value))}
        >
          {OCTAVES.map(octave => <option className="kb-option" key={octave} value={octave}>{octave > 0 ? '+' : ''}{octave}</option>)}
        </select>
      </label>
      <label className="kb-setting">
        <span className="kb-drawer-label">Accidentals</span>
        <select
          className="kb-select kb-accidentals-select" value={accidentals}
          onChange={event => onAccidentals(event.currentTarget.value === 'sharp' ? 'sharp' : 'flat')}
        >
          <option className="kb-option" value="flat">Flats (♭)</option>
          <option className="kb-option" value="sharp">Sharps (♯)</option>
        </select>
      </label>
      <div className="kb-midi-setting">
        <label className="kb-setting">
          <span className="kb-drawer-label">MIDI input</span>
          <select
            className="kb-select kb-midi-select" value={deviceId ?? ''} disabled={!midiSupported}
            onChange={event => onDevice(event.currentTarget.value || null)}
          >
            <option className="kb-option" value="">All inputs</option>
            {disconnected && <option className="kb-option" value={deviceId}>Saved input unavailable</option>}
            {devices.map(device => <option className="kb-option" key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </label>
        {!midiSupported && <p className="kb-midi-hint">Web MIDI is unavailable in this browser.</p>}
        {midiSupported && devices.length === 0 && (
          <button className="kb-button kb-midi-request" type="button" onClick={() => void requestMidi()}>
            Check for MIDI devices
          </button>
        )}
      </div>
    </div>
  )
}
