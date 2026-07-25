import { useRef, type ReactNode } from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { MidiStatus } from './MidiStatus'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
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
          'radial-gradient(ellipse at 50% 0%, #303a4c 0%, #1c2230 55%, #12151d 100%)',
      }}
    >
      <div className="rack-frame flex w-full max-w-6xl items-stretch justify-center gap-2 sm:gap-3">
        {/* Left rack rail — desktop only, decorative */}
        <RackRail />

        <div
          className="rack-chassis relative w-full min-w-0 max-w-6xl flex-1 rounded-[10px]"
          style={{
            background: 'var(--face-bg)',
            border: '1px solid var(--face-border)',
            boxShadow: 'var(--face-shadow)',
          }}
        >
          <div
            className="rack-brand-strip flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-3 sm:px-10"
            style={{
              borderBottom: '1px solid var(--brand-border)',
              boxShadow: '0 1px 0 var(--brand-hi)',
            }}
          >
          <button
            type="button"
            className="rack-brand flex min-w-0 items-center gap-3 cursor-default select-none"
            onClick={(e) => {
              e.stopPropagation()
              onBrandTap()
            }}
            title={debugMode ? 'debug mode on (5 taps to toggle)' : undefined}
            aria-label="The Module"
          >
            <span
              className="rack-power flex shrink-0 items-center gap-1.5"
              style={{
                border: '1px solid var(--power-border)',
                borderRadius: '4px',
                padding: '3px 6px',
                boxShadow: 'var(--power-shadow)',
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
            <span
              className="rack-brand-name text-xl tracking-widest text-text"
              style={{ fontFamily: 'var(--font-brand)' }}
            >
              The Module
            </span>
            <span className="rack-brand-tag legend hidden sm:inline">
              64-PATCH SAMPLER MODULE · MDL-1080{debugMode ? ' · DEBUG' : ''}
            </span>
          </button>
          <div className="rack-brand-status flex shrink-0 items-center gap-2">
            <ConnectionStatus />
            <MidiStatus />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

          <div className="rack-body p-4 sm:p-6">{children}</div>
        </div>

        {/* Right rack rail — desktop only, decorative */}
        <RackRail />
      </div>
    </div>
  )
}

/**
 * A 19"/EIA-style mounting rail with a full-height column of rack holes grouped
 * three-per-unit across 4U, matching a studio rack. Desktop only, decorative.
 */
function RackRail() {
  const units = [0, 1, 2, 3] // 4U
  return (
    <div
      className="rack-rail hidden w-6 shrink-0 flex-col items-center justify-around py-3 lg:flex"
      aria-hidden="true"
    >
      {units.map((u) => (
        <div key={u} className="rack-rail-unit flex flex-col items-center gap-2.5">
          {[0, 1, 2].map((h) => (
            <span key={h} className="rack-hole" />
          ))}
        </div>
      ))}
    </div>
  )
}
