import { useCallback, useEffect, useRef, useState } from 'react'

interface KnobProps {
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

function formatValue(
  value: number,
  step: number,
  unit: string | undefined,
  labels: string[] | undefined,
): string {
  if (labels) return labels[Math.round(value)] ?? String(value)
  return value.toFixed(step < 1 ? 2 : 0) + (unit ?? '')
}

/**
 * A skeuomorphic pot: coloured value arc, skirt collar and domed cap. Drag
 * up/down or scroll to turn (shift = fine), arrow keys step it, double-click
 * returns it to its default.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step,
  unit,
  color = 'var(--color-sky)',
  size = 48,
  labels,
  defaultValue,
  disabled = false,
  onChange,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [showValue, setShowValue] = useState(false)

  const range = max - min
  const fraction = range === 0 ? 0 : (value - min) / range
  const pct = fraction * 100
  const angle = -135 + fraction * 270

  // Layered geometry: colored arc (full), skirt collar (inset), domed cap (more
  // inset). Bands scale with the knob so small effect knobs stay legible.
  const skirtInset = Math.max(3, Math.round(size * 0.1))
  const capInset = Math.max(6, Math.round(size * 0.19))
  const capD = size - capInset * 2

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
      setShowValue(true)
    },
    [disabled, value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dy = drag.startY - e.clientY
      const sensitivity = e.shiftKey ? 0.0005 : 0.005
      commit(drag.startValue + dy * sensitivity * range)
    },
    [commit, range],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
    setShowValue(false)
  }, [])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.stopPropagation()
      onChange(defaultValue ?? min)
    },
    [disabled, defaultValue, min, onChange],
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const incr = e.shiftKey ? step : Math.max(step, range * 0.02)
      commit(value + dir * incr)
    },
    [disabled, step, range, value, commit],
  )

  // React registers `wheel` on its root container as a PASSIVE listener, so
  // preventDefault() inside an onWheel prop is silently ignored and turning a
  // knob also scrolls the pedalboard and the page. Only a listener we attach
  // ourselves, explicitly non-passive, can cancel the scroll.
  const wheelRef = useRef(onWheel)
  useEffect(() => {
    wheelRef.current = onWheel
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => wheelRef.current(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const readout = formatValue(value, step, unit, labels)
  const display = labels ? readout : showValue ? readout : label

  return (
    <div
      className="knob flex flex-col items-center gap-1 select-none"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={readout}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="knob-body relative touch-none"
        style={{ width: size, height: size, cursor: disabled ? 'default' : 'ns-resize' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
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
        {/* colored value arc on the outer rim (gap at the bottom) */}
        <div
          className="knob-arc absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from -135deg, ${color} 0%, ${color} ${pct * 0.75}%, var(--knob-track) ${pct * 0.75}%, var(--knob-track) 75%, transparent 75%)`,
          }}
        />
        {/* skirt collar — casts the knob's drop shadow */}
        <div
          className="knob-skirt absolute rounded-full"
          style={{
            inset: skirtInset,
            background: 'var(--knob-skirt-bg)',
            boxShadow: 'var(--knob-skirt-shadow)',
          }}
        />
        {/* domed cap + neutral pointer line */}
        <div
          className="knob-cap absolute rounded-full"
          style={{
            inset: capInset,
            background: 'var(--knob-bg)',
            boxShadow: 'var(--knob-shadow)',
          }}
        >
          <div
            className="knob-indicator absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              top: Math.round(capD * 0.11),
              width: Math.max(2, Math.round(size * 0.055)),
              height: Math.round(capD * 0.36),
              background: 'var(--knob-pointer)',
              transformOrigin: `50% ${capD / 2 - Math.round(capD * 0.11)}px`,
              transform: `translateX(-50%) rotate(${angle}deg)`,
            }}
          />
        </div>
      </div>
      <div
        className="knob-label legend"
        style={{ minHeight: 12 }}
      >
        {display}
      </div>
    </div>
  )
}
