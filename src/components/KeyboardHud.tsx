import { useStore } from '../state/useStore'

export function KeyboardHud() {
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const midiConnected = useStore((s) => s.midiConnected)
  const midiActivity = useStore((s) => s.midiActivity)

  return (
    <footer
      className="keyboard-hud flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2"
      style={{
        background: 'linear-gradient(180deg, #F4F6F9 0%, #E8EBEF 100%)',
        border: '1px solid var(--color-rack-edge)',
      }}
    >
      <div className="keyboard-hud-keys flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-text/60">
        <span className="keyboard-hud-row">
          <kbd className="hud-kbd">A</kbd>
          <kbd className="hud-kbd">S</kbd>
          <kbd className="hud-kbd">D</kbd>
          <kbd className="hud-kbd">F</kbd>
          <kbd className="hud-kbd">G</kbd>
          <kbd className="hud-kbd">H</kbd>
          <kbd className="hud-kbd">J</kbd>
          <kbd className="hud-kbd">K</kbd>
        </span>
        <span className="keyboard-hud-sep text-text/30">·</span>
        <span className="keyboard-hud-mod">
          <kbd className="hud-kbd">Z</kbd>
          <kbd className="hud-kbd">X</kbd> oct {octave}
        </span>
        <span className="keyboard-hud-sep text-text/30">·</span>
        <span className="keyboard-hud-mod">
          <kbd className="hud-kbd">C</kbd>
          <kbd className="hud-kbd">V</kbd> vel {velocity}
        </span>
        <span className="keyboard-hud-sep text-text/30">·</span>
        <span>
          <kbd className="hud-kbd">/</kbd> browse · <kbd className="hud-kbd">esc</kbd> panic
        </span>
      </div>
      <div
        className="midi-status flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider"
        style={{ color: midiConnected ? '#5BC0EB' : 'rgba(20,30,60,0.4)' }}
      >
        <span
          className="midi-status-dot inline-block h-2 w-2 rounded-full"
          style={{
            background: midiActivity ? '#5BC0EB' : midiConnected ? '#B5E853' : 'rgba(20,30,60,0.18)',
            boxShadow: midiActivity
              ? '0 0 8px #5BC0EB, 0 0 16px #5BC0EB'
              : midiConnected ? '0 0 6px #B5E853' : 'none',
            transition: 'all 0.05s ease-out',
          }}
        />
        MIDI {midiConnected ? 'connected' : 'none'}
      </div>
      <style>{`
        .hud-kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          padding: 1px 4px;
          margin-right: 2px;
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--color-text);
          background: #FFFFFF;
          border: 1px solid var(--color-rack-edge);
          border-bottom-width: 2px;
          border-radius: 3px;
        }
      `}</style>
    </footer>
  )
}
