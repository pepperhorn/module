import type { PatchManifest } from '../patches/types'
import { BANK_LABELS } from '../patches/types'
import type { PatchSourceTag } from '../audio/AudioEngine'

interface PatchStripProps {
  patch: PatchManifest | undefined
  index: number
  total: number
  loading: boolean
  source: PatchSourceTag | null
  onStep: (delta: number) => void
  onBrowse: () => void
}

const SOURCE_COLORS: Record<PatchSourceTag['tier'], string> = {
  local: 'var(--color-lime)',
  cache: 'var(--color-sky)',
  cdn: 'var(--color-amber)',
  mixed: 'var(--color-lavender)',
  unknown: 'var(--color-lcd-dim)',
}

const SOURCE_LABELS: Record<PatchSourceTag['tier'], string> = {
  local: 'LOCAL',
  cache: 'CACHE',
  cdn: 'CDN',
  mixed: 'MIX',
  unknown: '— —',
}

/**
 * The library readout for keyboard mode: everything you need to know about the
 * loaded patch in one thin bar, so the rest of the screen belongs to the keys.
 */
export function PatchStrip({
  patch,
  index,
  total,
  loading,
  source,
  onStep,
  onBrowse,
}: PatchStripProps) {
  const tier = source?.tier ?? 'unknown'

  return (
    <header className="patch-strip rack-panel flex shrink-0 flex-wrap items-center gap-2 rounded-lg p-2">
      <div
        className="patch-strip-bezel order-1 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
        style={{
          padding: 5,
          borderRadius: 6,
          background: 'var(--lcd-bezel-bg)',
          boxShadow: 'var(--lcd-bezel-shadow)',
        }}
      >
        <div
          className="patch-strip-readout relative flex min-w-0 flex-col overflow-hidden px-3 py-1.5 font-mono text-lcd-text"
          style={{
            borderRadius: 3,
            background: 'linear-gradient(180deg, #051B19 0%, #0A2B27 50%, #051B19 100%)',
            boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div className="patch-strip-name lcd-glow truncate text-base font-medium uppercase tracking-wide">
            {loading ? 'LOADING…' : (patch?.name ?? '— — —')}
          </div>
          <div className="patch-strip-meta flex items-center gap-2 truncate text-[9px] uppercase tracking-widest text-lcd-dim">
            <span className="patch-strip-bank truncate">
              {patch ? BANK_LABELS[patch.bank] : ''}
              {patch?.category ? ` · ${patch.category}` : ''}
            </span>
            <span className="patch-strip-counter shrink-0 tabular-nums">
              {index + 1}/{total}
            </span>
            <span className="patch-strip-source inline-flex shrink-0 items-center gap-1">
              <span
                aria-hidden="true"
                className="patch-strip-source-dot inline-block rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: SOURCE_COLORS[tier],
                  boxShadow: tier === 'unknown' ? 'none' : `0 0 4px ${SOURCE_COLORS[tier]}`,
                }}
              />
              {SOURCE_LABELS[tier]}
            </span>
          </div>
        </div>
      </div>

      <div className="patch-strip-controls order-2 flex w-full flex-wrap items-center justify-between gap-2 sm:order-none sm:w-auto sm:justify-start">
        <button
          type="button"
          aria-label="Previous patch"
          className="patch-strip-step hw-btn legend-strong flex h-11 min-w-11 items-center justify-center"
          style={{ touchAction: 'manipulation' }}
          onClick={(e) => {
            e.stopPropagation()
            onStep(-1)
          }}
        >
          ◀
        </button>

        <button
          type="button"
          aria-label="Next patch"
          className="patch-strip-step hw-btn legend-strong flex h-11 min-w-11 items-center justify-center"
          style={{ touchAction: 'manipulation' }}
          onClick={(e) => {
            e.stopPropagation()
            onStep(1)
          }}
        >
          ▶
        </button>

        <button
          type="button"
          className="patch-strip-browse hw-btn hw-btn-accent flex h-11 items-center gap-2 px-4"
          style={{ ['--hw-accent' as string]: 'var(--color-sky)', touchAction: 'manipulation' }}
          onClick={(e) => {
            e.stopPropagation()
            onBrowse()
          }}
        >
          <span
            aria-hidden="true"
            className="patch-strip-browse-led hw-btn-led"
            style={{ background: 'var(--color-sky)', boxShadow: '0 0 5px rgba(91,192,235,0.8)' }}
          />
          <span className="patch-strip-browse-label legend" style={{ color: 'var(--ink-sky)' }}>
            Library
          </span>
        </button>
      </div>
    </header>
  )
}
