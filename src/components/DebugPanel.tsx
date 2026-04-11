import { useEffect, useRef, useState } from 'react'
import { subscribeEngineLog } from '../audio/AudioEngine'

interface LogLine {
  id: number
  text: string
  ts: number
}

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<LogLine[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    return subscribeEngineLog((text) => {
      idRef.current += 1
      const next: LogLine = { id: idRef.current, text, ts: Date.now() }
      setLines((prev) => {
        const arr = [...prev, next]
        if (arr.length > 200) arr.splice(0, arr.length - 200)
        return arr
      })
    })
  }, [])

  return (
    <div
      className="debug-panel fixed right-2 z-40 sm:right-3 sm:w-96"
      style={{
        top: 8,
        width: open ? 'calc(100vw - 1rem)' : 'auto',
        maxWidth: 384,
        pointerEvents: 'none',
      }}
    >
      <div
        className="debug-panel-card overflow-hidden rounded-lg"
        style={{
          background: 'rgba(15, 16, 36, 0.92)',
          border: '1px solid rgba(91, 192, 235, 0.3)',
          color: '#5BC0EB',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          pointerEvents: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <button
          type="button"
          className="debug-panel-toggle flex w-full items-center justify-between px-3 py-1.5 uppercase tracking-widest"
          onClick={() => setOpen((o) => !o)}
          style={{
            background: 'rgba(91, 192, 235, 0.08)',
            color: '#5BC0EB',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
          }}
        >
          <span>engine log · {lines.length}</span>
          <span>{open ? '−' : '+'}</span>
        </button>
        {open && (
          <div
            className="debug-panel-body scroll-clean max-h-44 overflow-y-auto px-3 py-2"
            style={{ lineHeight: 1.5 }}
          >
            {lines.length === 0 ? (
              <div style={{ opacity: 0.5 }}>(no events yet)</div>
            ) : (
              lines.map((l) => (
                <div key={l.id} className="debug-panel-line">
                  <span style={{ opacity: 0.4 }}>
                    {new Date(l.ts).toLocaleTimeString().slice(3)}{' '}
                  </span>
                  <span>{l.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
