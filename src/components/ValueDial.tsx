import { useCallback, useRef, useState } from 'react'

interface ValueDialProps {
  onStep: (delta: number) => void
}

export function ValueDial({ onStep }: ValueDialProps) {
  const dragRef = useRef<{ startY: number; accum: number } | null>(null)
  const [angle, setAngle] = useState(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, accum: 0 }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const stepPx = 12
      const steps = Math.trunc(dy / stepPx)
      if (steps !== dragRef.current.accum) {
        const delta = steps - dragRef.current.accum
        dragRef.current.accum = steps
        onStep(delta)
        setAngle((a) => a + delta * 18)
      }
    },
    [onStep],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      onStep(dir)
      setAngle((a) => a + dir * 18)
    },
    [onStep],
  )

  return (
    <div className="value-dial flex flex-col items-center gap-2 select-none">
      <div
        className="value-dial-body relative h-32 w-32 cursor-ns-resize touch-none rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #FAFBFC 0%, #E0E4EB 60%, #B8BFCC 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -3px 6px rgba(20,30,60,0.18), 0 3px 12px rgba(20,30,60,0.18)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="value-dial-marker absolute left-1/2 top-2 h-6 w-[3px] -translate-x-1/2 rounded-full"
          style={{
            background: 'var(--color-coral)',
            transformOrigin: '50% 62px',
            transform: `translateX(-50%) rotate(${angle}deg)`,
            boxShadow: '0 0 8px rgba(255, 107, 107, 0.6)',
          }}
        />
        <div
          className="value-dial-cap absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: '#1A1A2E' }}
        />
      </div>
      <div className="value-dial-label font-mono text-[9px] uppercase tracking-widest text-text/50">
        VALUE
      </div>
    </div>
  )
}
