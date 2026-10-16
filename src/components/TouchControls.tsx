import type { ReactNode } from 'react'
import { useStore } from '../state/useStore'
import { MidiStatus } from './MidiStatus'

/** Matches the computer-keyboard shortcuts: Z/X shift by an octave, C/V by 12. */
const OCTAVE_STEP = 1
const VELOCITY_STEP = 12

const OCTAVE_MIN = 0
const OCTAVE_MAX = 8
const VELOCITY_MIN = 1
const VELOCITY_MAX = 127

interface TouchControlsProps {
  onPanic: () => void
  /** Omitted where the caller already offers its own mode switch. */
  onToggleKeyboardMode?: () => void
  keyboardMode?: boolean
}

/**
 * Octave, velocity and panic as real buttons.
 *
 * Every one of these was previously keyboard-only (Z/X, C/V, Escape) or a bare
 * readout, which left a phone or tablet with no way to leave the two octaves it
 * happened to start on, no way to change velocity at all, and no way to kill a
 * stuck note.
 */
export function TouchControls({
  onPanic,
  onToggleKeyboardMode,
  keyboardMode = false,
}: TouchControlsProps) {
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const shiftOctave = useStore((s) => s.shiftOctave)
  const shiftVelocity = useStore((s) => s.shiftVelocity)

  return (
    <div
      // Four controls never fit one phone row, so lay them out deliberately —
      // two per row — rather than letting flex-wrap strand one on its own line.
      className="touch-controls rack-panel grid shrink-0 grid-cols-2 gap-2 rounded-lg p-3 sm:flex sm:flex-wrap sm:items-center"
    >
      <span className="touch-controls-title group-legend legend">PERFORM</span>
      <Stepper
        label="OCT"
        value={octave}
        decLabel="Octave down"
        incLabel="Octave up"
        canDecrease={octave > OCTAVE_MIN}
        canIncrease={octave < OCTAVE_MAX}
        onDecrease={() => shiftOctave(-OCTAVE_STEP)}
        onIncrease={() => shiftOctave(OCTAVE_STEP)}
      />

      <Stepper
        label="VEL"
        value={velocity}
        decLabel="Velocity down"
        incLabel="Velocity up"
        canDecrease={velocity > VELOCITY_MIN}
        canIncrease={velocity < VELOCITY_MAX}
        onDecrease={() => shiftVelocity(-VELOCITY_STEP)}
        onIncrease={() => shiftVelocity(VELOCITY_STEP)}
      />

      <TouchButton
        label="Panic — stop all notes"
        onClick={onPanic}
        className={`touch-controls-panic ${keyboardMode ? 'col-span-2 sm:col-span-1' : ''}`}
        accent="coral"
      >
        ✖ PANIC
      </TouchButton>

      {/* Keyboard mode hides the rack header, so the MIDI pill lives here. */}
      {keyboardMode && (
        <MidiStatus className="touch-controls-midi h-11 min-w-11 justify-center sm:ml-auto" />
      )}

      {onToggleKeyboardMode && (
        <TouchButton
          label={keyboardMode ? 'Back to the full rack' : 'Give the keyboard the whole screen'}
          onClick={onToggleKeyboardMode}
          className={`touch-controls-mode ${keyboardMode ? '' : 'sm:ml-auto'}`}
          accent="sky"
        >
          {keyboardMode ? '⌸ RACK' : '⌨ KEYS'}
        </TouchButton>
      )}
    </div>
  )
}

function Stepper({
  label,
  value,
  decLabel,
  incLabel,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string
  value: number
  decLabel: string
  incLabel: string
  canDecrease: boolean
  canIncrease: boolean
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="touch-controls-stepper flex items-center justify-between gap-1">
      <TouchButton label={decLabel} onClick={onDecrease} disabled={!canDecrease}>
        −
      </TouchButton>
      <span className="touch-controls-readout legend-strong min-w-0 flex-1 text-center tabular-nums">
        {label} {value}
      </span>
      <TouchButton label={incLabel} onClick={onIncrease} disabled={!canIncrease}>
        +
      </TouchButton>
    </div>
  )
}

function TouchButton({
  children,
  label,
  onClick,
  disabled = false,
  className = '',
  accent,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  accent?: 'coral' | 'sky'
}) {
  const accentColor = accent === 'coral' ? 'var(--color-coral)' : 'var(--color-sky)'
  const accentInk = accent === 'coral' ? 'var(--ink-coral)' : 'var(--ink-sky)'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // The tap target is 44px square — below that, thumbs miss on a phone.
      className={`touch-controls-btn hw-btn ${
        accent ? 'hw-btn-accent' : ''
      } flex h-11 min-w-11 items-center justify-center gap-2 px-3 ${className}`}
      style={{
        ...(accent ? { ['--hw-accent' as string]: accentColor } : {}),
        opacity: disabled ? 0.35 : 1,
        // Stops the double-tap-to-zoom delay swallowing rapid taps.
        touchAction: 'manipulation',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {accent && (
        <span
          aria-hidden="true"
          className="touch-controls-btn-led hw-btn-led"
          style={{ background: accentColor, boxShadow: `0 0 5px ${accentColor}` }}
        />
      )}
      <span
        className="touch-controls-btn-label legend-strong"
        style={accent ? { color: accentInk } : undefined}
      >
        {children}
      </span>
    </button>
  )
}
