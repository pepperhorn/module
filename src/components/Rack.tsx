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
      <div className="rack-frame flex w-full max-w-6xl items-stretch justify-center gap-2">
        {/* Left rack ear — desktop only, decorative */}
        <div
          className="rack-ear hidden w-7 shrink-0 flex-col items-center justify-between py-4 lg:flex"
          aria-hidden="true"
        >
          <div className="rack-screw" style={{ ['--slot-rot' as string]: '18deg' }} />
          <div className="rack-screw" style={{ ['--slot-rot' as string]: '-24deg' }} />
        </div>

        <div
          className="rack-chassis relative w-full min-w-0 max-w-6xl flex-1 rounded-[10px]"
          style={{
            background:
              'linear-gradient(180deg, #F2F4F7 0%, #E9ECF1 100%)',
            border: '1px solid #D4D9E0',
            boxShadow:
              '0 10px 30px rgba(20, 30, 60, 0.10), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}
        >
          <div className="rack-screw absolute left-3 top-3" style={{ ['--slot-rot' as string]: '20deg' }} />
          <div className="rack-screw absolute right-3 top-3" style={{ ['--slot-rot' as string]: '65deg' }} />
          <div className="rack-screw absolute bottom-3 left-3" style={{ ['--slot-rot' as string]: '-15deg' }} />
          <div className="rack-screw absolute bottom-3 right-3" style={{ ['--slot-rot' as string]: '40deg' }} />

          <div
            className="rack-brand-strip flex items-center justify-between px-6 pt-4 pb-3 sm:px-10"
            style={{
              borderBottom: '1px solid var(--color-hairline)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.7)',
            }}
          >
          <button
            type="button"
            className="rack-brand flex items-center gap-3 cursor-default select-none"
            onClick={(e) => {
              e.stopPropagation()
              onBrandTap()
            }}
            title={debugMode ? 'debug mode on (5 taps to toggle)' : undefined}
            aria-label="MODULE"
          >
            <span
              className="rack-power flex items-center gap-1.5"
              style={{
                border: '1px solid var(--color-hairline)',
                borderRadius: '4px',
                padding: '3px 6px',
              }}
            >
              <span
                className="rack-brand-mark inline-block h-2.5 w-2.5 rounded-sm"
                style={{
                  background: debugMode
                    ? 'linear-gradient(180deg, var(--color-lime) 0%, #8BC332 100%)'
                    : 'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                  boxShadow: debugMode
                    ? '0 0 8px rgba(181, 232, 83, 0.6)'
                    : '0 0 8px rgba(255, 107, 107, 0.5)',
                }}
              />
              <span className="rack-power-label legend">POWER</span>
            </span>
            <span className="rack-brand-name font-display text-xl font-semibold tracking-widest text-text">
              MODULE
            </span>
            <span className="rack-brand-tag legend hidden sm:inline">
              64-PATCH SAMPLER MODULE · MDL-1080{debugMode ? ' · DEBUG' : ''}
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

        {/* Right rack ear — desktop only, decorative */}
        <div
          className="rack-ear hidden w-7 shrink-0 flex-col items-center justify-between py-4 lg:flex"
          aria-hidden="true"
        >
          <div className="rack-screw" style={{ ['--slot-rot' as string]: '-18deg' }} />
          <div className="rack-screw" style={{ ['--slot-rot' as string]: '28deg' }} />
        </div>
      </div>
    </div>
  )
}
