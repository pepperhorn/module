import { useCallback, useRef, useState } from 'react'

interface PedalKnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  color?: string
  size?: number
  /** Discrete position names (e.g. doubler intervals) shown instead of a number. */
  labels?: string[]
  defaultValue?: number
  disabled?: boolean
  onChange: (value: number) => void
}

/** Degrees of sweep, centred on 12 o'clock — the usual pot travel on a pedal. */
const SWEEP = 270
const START_ANGLE = -135
const TICK_COUNT = 11

function formatValue(
  value: number,
  step: number,
  unit: string | undefined,
  labels: string[] | undefined,
): string {
  if (labels) return labels[Math.round(value)] ?? String(value)
  const decimals = step < 0.1 ? 2 : step < 1 ? 2 : 0
  return value.toFixed(decimals) + (unit ?? '')
}

/**
 * A hardware-style pot: knurled cap, painted pointer, tick marks around the
 * sweep and the value printed on the chassis below. Drag up/down or scroll to
 * turn; shift for fine adjustment; double-click returns it to its default.
 */
export function PedalKnob({
  label,
  value,
  min,
  max,
  step,
  unit,
  color = 'var(--color-sky)',
  size = 54,
  labels,
  defaultValue,
  disabled = false,
  onChange,
}: PedalKnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const range = max - min
  const fraction = range === 0 ? 0 : (value - min) / range
  const angle = START_ANGLE + fraction * SWEEP

  const commit = useCallback(
    (next: number) => {
      const snapped = Math.max(min, Math.min(max, Math.round(next / step) * step))
      // Rounding to `step` can leave float noise (0.30000000000000004); compare
      // on the rendered precision so a no-op drag does not spam the engine.
      if (Math.abs(snapped - value) >= step / 2) onChange(snapped)
    },
    [min, max, step, value, onChange],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // noop
      }
      dragRef.current = { startY: e.clientY, startValue: value }
      setDragging(true)
    },
    [disabled, value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dy = drag.startY - e.clientY
      const sensitivity = e.shiftKey ? 0.0008 : 0.006
      commit(drag.startValue + dy * sensitivity * range)
    },
    [commit, range],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    setDragging(false)
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      const increment = e.shiftKey ? step : Math.max(step, range * 0.02)
      commit(value + direction * increment)
    },
    [disabled, step, range, value, commit],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.stopPropagation()
      onChange(defaultValue ?? min)
    },
    [disabled, defaultValue, min, onChange],
  )

  const readout = formatValue(value, step, unit, labels)

  return (
    <div
      className="pedal-knob flex select-none flex-col items-center gap-1"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={readout}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="pedal-knob-body relative touch-none"
        style={{
          width: size,
          height: size,
          cursor: disabled ? 'default' : 'ns-resize',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault()
            commit(value + step)
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault()
            commit(value - step)
          }
        }}
      >
        {/* Tick marks silk-screened around the sweep */}
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const tickAngle = START_ANGLE + (i / (TICK_COUNT - 1)) * SWEEP
          const lit = i / (TICK_COUNT - 1) <= fraction + 0.001
          return (
            <span
              key={i}
              aria-hidden="true"
              className="pedal-knob-tick absolute left-1/2 top-0 rounded-full"
              style={{
                width: 1.5,
                height: i === 0 || i === TICK_COUNT - 1 ? 5 : 3.5,
                background: lit ? color : 'rgba(20,30,60,0.22)',
                boxShadow: lit ? `0 0 4px ${color}` : 'none',
                transformOrigin: `50% ${size / 2}px`,
                transform: `translateX(-50%) rotate(${tickAngle}deg)`,
              }}
            />
          )
        })}
        {/* Knurled cap */}
        <div
          className="pedal-knob-cap absolute rounded-full"
          style={{
            inset: 7,
            background:
              'radial-gradient(circle at 34% 26%, #FFFFFF 0%, #E4E8EE 52%, #C2C8D2 100%)',
            border: '1px solid rgba(20,30,60,0.18)',
            boxShadow: dragging
              ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 0 10px ${color}66, 0 1px 3px rgba(20,30,60,0.28)`
              : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(20,30,60,0.24)',
            transform: `rotate(${angle}deg)`,
          }}
        >
          <span
            aria-hidden="true"
            className="pedal-knob-pointer absolute left-1/2 rounded-full"
            style={{
              top: 3,
              width: 2.5,
              height: size * 0.3,
              marginLeft: -1.25,
              background: color,
              boxShadow: `0 0 5px ${color}`,
            }}
          />
        </div>
      </div>
      <div className="pedal-knob-label font-mono text-[9px] uppercase tracking-widest text-text/55">
        {label}
      </div>
      <div
        className="pedal-knob-value font-mono text-[9px] tabular-nums tracking-wider"
        style={{ color: dragging ? color : 'rgba(20,30,60,0.45)' }}
      >
        {readout}
      </div>
    </div>
  )
}
