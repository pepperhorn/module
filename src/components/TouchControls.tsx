import type { ReactNode } from 'react'
import { useStore } from '../state/useStore'

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
      className="touch-controls rack-panel grid shrink-0 grid-cols-2 gap-2 rounded-xl p-2 sm:flex sm:flex-wrap sm:items-center"
    >
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
        className="touch-controls-panic"
        accent="coral"
      >
        ✖ PANIC
      </TouchButton>

      {onToggleKeyboardMode && (
        <TouchButton
            label={keyboardMode ? 'Back to the full rack' : 'Give the keyboard the whole screen'}
          onClick={onToggleKeyboardMode}
          className="touch-controls-mode sm:ml-auto"
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
      <span
        className="touch-controls-readout min-w-0 flex-1 text-center font-mono text-[11px] uppercase tracking-widest tabular-nums"
        style={{ color: 'var(--color-text)' }}
      >
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
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // The tap target is 44px square — below that, thumbs miss on a phone.
      className={`touch-controls-btn cell-hit flex h-11 min-w-11 items-center justify-center rounded-lg px-3 font-mono text-sm uppercase tracking-widest ${className}`}
      style={{
        color: accent ? 'var(--color-bg)' : 'var(--color-text)',
        background: accent
          ? `linear-gradient(180deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 82%, #000000) 100%)`
          : 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
        border: accent ? '1px solid transparent' : '1px solid var(--color-rack-edge)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(20,30,60,0.1)',
        opacity: disabled ? 0.35 : 1,
        // Stops the double-tap-to-zoom delay swallowing rapid taps.
        touchAction: 'manipulation',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
