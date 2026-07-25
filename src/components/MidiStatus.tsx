import { useStore } from '../state/useStore'

export function MidiStatus() {
  const connected = useStore((s) => s.midiConnected)
  const activity = useStore((s) => s.midiActivity)
  return (
    <div
      className="midi-status legend flex items-center gap-2 rounded-full border border-[var(--pill-border)] bg-[var(--pill-bg)] px-3 py-1"
      title={connected ? 'MIDI input connected' : 'No MIDI input'}
    >
      <span
        className={`midi-status-led h-2 w-2 rounded-full ${connected && !activity ? 'led-on' : ''}`}
        style={{
          background: activity ? 'var(--color-sky)' : connected ? 'var(--color-lime)' : 'rgba(20,30,60,0.18)',
          color: activity ? 'var(--color-sky)' : 'var(--color-lime)',
          boxShadow: activity
            ? '0 0 8px var(--color-sky), 0 0 16px var(--color-sky)'
            : connected
              ? '0 0 6px 1px var(--color-lime)'
              : 'inset 0 1px 1px rgba(20,30,60,0.18)',
          transition: 'all 0.05s ease-out',
        }}
      />
      MIDI {connected ? 'ON' : '—'}
    </div>
  )
}
