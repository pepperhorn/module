import { useStore, type MidiAccessStatus } from '../state/useStore'

const LABEL: Record<MidiAccessStatus, string> = {
  unsupported: 'N/A',
  idle: 'OFF',
  pending: '…',
  denied: 'BLOCKED',
  error: 'ERR',
  granted: '—',
}

/** MIDI status pill; tapping it opens the MIDI / breath controls sheet. */
export function MidiStatus({ className = 'min-h-9' }: { className?: string } = {}) {
  const connected = useStore((s) => s.midiConnected)
  const activity = useStore((s) => s.midiActivity)
  const status = useStore((s) => s.midiStatus)
  const setPanelOpen = useStore((s) => s.setMidiPanelOpen)
  const panelOpen = useStore((s) => s.midiPanelOpen)
  const problem = status === 'denied' || status === 'error'
  const label = connected ? 'ON' : LABEL[status]
  const title = connected
    ? 'MIDI input connected — open MIDI settings'
    : status === 'denied'
      ? 'MIDI blocked — open MIDI settings to fix'
      : 'Open MIDI settings'
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={panelOpen}
      className={`midi-status hw-pill legend flex ${className} items-center gap-2 rounded-full border border-[var(--pill-border)] bg-[var(--pill-bg)] px-3 py-1`}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        setPanelOpen(true)
      }}
    >
      <span
        className={`midi-status-led h-2 w-2 rounded-full ${connected && !activity ? 'led-on' : ''}`}
        style={{
          background: activity
            ? 'var(--color-sky)'
            : connected
              ? 'var(--color-lime)'
              : problem
                ? 'var(--color-coral)'
                : 'rgba(20,30,60,0.18)',
          color: activity ? 'var(--color-sky)' : 'var(--color-lime)',
          boxShadow: activity
            ? '0 0 8px var(--color-sky), 0 0 16px var(--color-sky)'
            : connected
              ? '0 0 6px 1px var(--color-lime)'
              : problem
                ? '0 0 6px var(--color-coral)'
                : 'inset 0 1px 1px rgba(20,30,60,0.18)',
          transition: 'all 0.05s ease-out',
        }}
      />
      MIDI {label}
    </button>
  )
}
