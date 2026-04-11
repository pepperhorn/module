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
  onChange,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [showValue, setShowValue] = useState(false)

  const range = max - min
  const pct = ((value - min) / range) * 100
  const angle = -135 + ((value - min) / range) * 270

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
    onChange(min)
  }, [min, onChange])

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
    showValue || dragRef.current
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
        <div
          className="knob-ring absolute inset-0 rounded-full"
          style={
            {
              '--knob-pct': `${pct * 0.75}%`,
              background: `conic-gradient(from -135deg, ${color} 0%, ${color} ${pct * 0.75}%, rgba(20, 30, 60, 0.08) ${pct * 0.75}%, rgba(20, 30, 60, 0.08) 75%, transparent 75%)`,
            } as React.CSSProperties
          }
        />
        <div
          className="knob-cap absolute rounded-full"
          style={{
            inset: 4,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E8EBEF 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(20,30,60,0.08), 0 1px 2px rgba(20,30,60,0.15)',
          }}
        >
          <div
            className="knob-indicator absolute left-1/2 top-1 h-2 w-[2px] -translate-x-1/2 rounded-full"
            style={{
              background: color,
              transformOrigin: `50% ${size / 2 - 4}px`,
              transform: `translateX(-50%) rotate(${angle}deg)`,
            }}
          />
        </div>
      </div>
      <div
        className="knob-label font-mono text-[9px] uppercase tracking-wide text-text/60"
        style={{ minHeight: 12 }}
      >
        {display}
      </div>
    </div>
  )
}
