import type { PatchManifest } from '../patches/types'
import { BANK_LABELS } from '../patches/types'
import type { PatchSourceTag } from '../audio/AudioEngine'
import { useStore } from '../state/useStore'

interface PatchStripProps {
  patch: PatchManifest | undefined
  index: number
  total: number
  loading: boolean
  source: PatchSourceTag | null
  onStep: (delta: number) => void
  onBrowse: () => void
  onExitKeyboardMode: () => void
}

const SOURCE_COLORS: Record<PatchSourceTag['tier'], string> = {
  local: 'var(--color-lime)',
  cache: 'var(--color-sky)',
  cdn: 'var(--color-amber)',
  mixed: 'var(--color-lavender)',
  unknown: 'rgba(91, 192, 235, 0.4)',
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
  onExitKeyboardMode,
}: PatchStripProps) {
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const shiftOctave = useStore((s) => s.shiftOctave)
  const tier = source?.tier ?? 'unknown'

  return (
    <header
      className="patch-strip flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: 'linear-gradient(180deg, #0F1024 0%, #161A33 100%)',
        border: '1px solid rgba(91,192,235,0.28)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.55)',
        color: 'var(--color-lcd-text)',
      }}
    >
      <div className="patch-strip-readout order-1 flex w-full min-w-0 flex-col sm:order-none sm:w-auto sm:flex-1">
        <div className="patch-strip-name lcd-glow truncate font-mono text-base font-medium uppercase tracking-wide">
          {loading ? 'LOADING…' : (patch?.name ?? '— — —')}
        </div>
        <div className="patch-strip-meta flex items-center gap-2 truncate font-mono text-[9px] uppercase tracking-widest text-lcd-dim">
          <span className="truncate">
            {patch ? BANK_LABELS[patch.bank] : ''}
            {patch?.category ? ` · ${patch.category}` : ''}
          </span>
          <span className="shrink-0 tabular-nums">
            {index + 1}/{total}
          </span>
          <span
            className="patch-strip-source shrink-0 rounded px-1.5 py-0.5 text-[8px]"
            style={{
              color: SOURCE_COLORS[tier],
              border: `1px solid ${SOURCE_COLORS[tier]}`,
            }}
          >
            {SOURCE_LABELS[tier]}
          </span>
        </div>
      </div>

      <div className="patch-strip-controls order-2 flex w-full flex-wrap items-center justify-between gap-2 sm:order-none sm:w-auto sm:justify-start">
        <button
          type="button"
          aria-label="Previous patch"
          className="patch-strip-step cell-hit rounded-md px-2.5 py-1.5 font-mono text-[11px]"
          style={{ background: 'rgba(91,192,235,0.12)', color: 'var(--color-lcd-text)' }}
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
          className="patch-strip-step cell-hit rounded-md px-2.5 py-1.5 font-mono text-[11px]"
          style={{ background: 'rgba(91,192,235,0.12)', color: 'var(--color-lcd-text)' }}
          onClick={(e) => {
            e.stopPropagation()
            onStep(1)
          }}
        >
          ▶
        </button>

        <div className="patch-strip-octave flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-lcd-dim">
          <button
            type="button"
            aria-label="Octave down"
            className="cell-hit rounded-md px-2 py-1.5"
            style={{ background: 'rgba(91,192,235,0.12)', color: 'var(--color-lcd-text)' }}
            onClick={(e) => {
              e.stopPropagation()
              shiftOctave(-1)
            }}
          >
            −
          </button>
          <span className="tabular-nums">OCT {octave}</span>
          <button
            type="button"
            aria-label="Octave up"
            className="cell-hit rounded-md px-2 py-1.5"
            style={{ background: 'rgba(91,192,235,0.12)', color: 'var(--color-lcd-text)' }}
            onClick={(e) => {
              e.stopPropagation()
              shiftOctave(1)
            }}
          >
            +
          </button>
          <span className="tabular-nums">VEL {velocity}</span>
        </div>

        <button
          type="button"
          className="patch-strip-browse cell-hit rounded-md px-3 py-1.5 font-display text-[11px] font-medium uppercase tracking-widest text-bg"
          style={{
            background: 'linear-gradient(180deg, var(--color-sky) 0%, #4AA8D2 100%)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onBrowse()
          }}
        >
          Library
        </button>

        <button
          type="button"
          title="Back to the full rack"
          className="patch-strip-exit cell-hit rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest"
          style={{
            background: 'rgba(91,192,235,0.12)',
            color: 'var(--color-lcd-text)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onExitKeyboardMode()
          }}
        >
          ⌸ Rack
        </button>
      </div>
    </header>
  )
}
