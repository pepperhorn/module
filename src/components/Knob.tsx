import { useCallback, useRef, useState } from 'react'

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  color?: string
  size?: number
  labels?: string[]
  defaultValue?: number
  onChange: (value: number) => void
}

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
  onChange,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [showValue, setShowValue] = useState(false)

  const range = max - min
  const pct = ((value - min) / range) * 100
  const angle = -135 + ((value - min) / range) * 270

  // Layered geometry: colored arc (full), skirt collar (inset), domed cap (more
  // inset). Bands scale with the knob so small effect knobs stay legible.
  const skirtInset = Math.max(3, Math.round(size * 0.1))
  const capInset = Math.max(6, Math.round(size * 0.19))
  const capD = size - capInset * 2

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragRef.current = { startY: e.clientY, startValue: value }
      setShowValue(true)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const fineMode = e.shiftKey
      const sensitivity = fineMode ? 0.0005 : 0.005
      const delta = dy * sensitivity * range
      let next = dragRef.current.startValue + delta
      next = Math.round(next / step) * step
      next = Math.max(min, Math.min(max, next))
      if (next !== value) onChange(next)
    },
    [value, range, step, min, max, onChange],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
    setShowValue(false)
  }, [])

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue ?? min)
  }, [defaultValue, min, onChange])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const fineMode = e.shiftKey
      const incr = fineMode ? step : Math.max(step, range * 0.02)
      let next = value + dir * incr
      next = Math.round(next / step) * step
      next = Math.max(min, Math.min(max, next))
      if (next !== value) onChange(next)
    },
    [value, step, range, min, max, onChange],
  )

  const display =
    labels
      ? labels[Math.round(value)] ?? label
      : showValue || dragRef.current
        ? value.toFixed(step < 0.1 ? 2 : step < 1 ? 2 : 0) + (unit ?? '')
        : label

  return (
    <div className="knob flex flex-col items-center gap-1 select-none">
      <div
        ref={ref}
        className="knob-body relative cursor-ns-resize touch-none"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
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
