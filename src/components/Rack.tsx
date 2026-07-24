import { useRef, type ReactNode } from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { MidiStatus } from './MidiStatus'
import { UserMenu } from './UserMenu'
import { useStore } from '../state/useStore'

interface RackProps {
  children: ReactNode
}

const TAP_WINDOW_MS = 1500
const TAPS_TO_TOGGLE = 5

export function Rack({ children }: RackProps) {
  const debugMode = useStore((s) => s.debugMode)
  const toggleDebugMode = useStore((s) => s.toggleDebugMode)
  const tapsRef = useRef<number[]>([])

  const onBrandTap = () => {
    const now = Date.now()
    const fresh = tapsRef.current.filter((t) => now - t < TAP_WINDOW_MS)
    fresh.push(now)
    tapsRef.current = fresh
    if (fresh.length >= TAPS_TO_TOGGLE) {
      tapsRef.current = []
      toggleDebugMode()
    }
  }

  return (
    <div
      className="rack-outer flex min-h-full items-start justify-center p-3 sm:p-6"
      style={{
        background:
          'radial-gradient(ellipse at top, #FAFBFC 0%, #EDF0F4 100%)',
      }}
    >
      <div
        className="rack-chassis relative w-full max-w-6xl rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg, #F4F6F9 0%, #E8EBEF 100%)',
          border: '1px solid var(--color-rack-edge)',
          boxShadow:
            '0 8px 32px rgba(20, 30, 60, 0.12), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(20,30,60,0.05)',
        }}
      >
        <div className="rack-screw absolute left-3 top-3 rack-screw" />
        <div className="rack-screw absolute right-3 top-3 rack-screw" />
        <div className="rack-screw absolute bottom-3 left-3 rack-screw" />
        <div className="rack-screw absolute bottom-3 right-3 rack-screw" />

        <div className="rack-brand-strip flex items-center justify-between px-6 pt-4 pb-2 sm:px-10">
          <button
            type="button"
            className="rack-brand flex items-baseline gap-2 cursor-default select-none"
            onClick={(e) => {
              e.stopPropagation()
              onBrandTap()
            }}
            title={debugMode ? 'debug mode on (5 taps to toggle)' : undefined}
            aria-label="MODULE"
          >
            <span
              className="rack-brand-mark inline-block h-3 w-3 rounded-sm"
              style={{
                background: debugMode
                  ? 'linear-gradient(180deg, var(--color-lime) 0%, #8BC332 100%)'
                  : 'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                boxShadow: debugMode
                  ? '0 0 8px rgba(181, 232, 83, 0.6)'
                  : '0 0 8px rgba(255, 107, 107, 0.5)',
              }}
            />
            <span className="rack-brand-name font-display text-xl font-semibold tracking-widest text-text">
              MODULE
            </span>
            <span className="rack-brand-tag font-mono text-[10px] uppercase tracking-widest text-text/40">
              JV · smplr{debugMode ? ' · debug' : ''}
            </span>
          </button>
          <div className="rack-brand-status flex items-center gap-2">
            <ConnectionStatus />
            <MidiStatus />
            <UserMenu />
          </div>
        </div>

        <div className="rack-body p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
