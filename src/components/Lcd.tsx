import type { PatchManifest } from '../patches/types'
import { BANK_LABELS } from '../patches/types'
import type { PatchSourceTag } from '../audio/AudioEngine'

interface LcdProps {
  patch: PatchManifest | undefined
  index: number
  total: number
  octave: number
  velocity: number
  loading: boolean
  source?: PatchSourceTag | null
}

const SOURCE_STYLES: Record<
  PatchSourceTag['tier'],
  { label: string; color: string; glow: string; title: string }
> = {
  local: {
    label: 'LOCAL',
    color: 'var(--color-lime)',
    glow: 'rgba(181, 232, 83, 0.55)',
    title: 'Vendored — served from /smplr-samples in this build',
  },
  cache: {
    label: 'CACHE',
    color: 'var(--color-sky)',
    glow: 'rgba(91, 192, 235, 0.55)',
    title: 'Persistent browser cache from a previous load (offline-ready)',
  },
  cdn: {
    label: 'CDN',
    color: 'var(--color-amber)',
    glow: 'rgba(255, 184, 77, 0.55)',
    title: 'Live CDN fetch — slower, network-dependent',
  },
  mixed: {
    label: 'MIX',
    color: 'var(--color-lavender)',
    glow: 'rgba(181, 156, 217, 0.55)',
    title: 'Mixed sources — some samples local, some from cache or CDN',
  },
  unknown: {
    label: '— —',
    color: 'rgba(91, 192, 235, 0.4)',
    glow: 'transparent',
    title: 'No load yet',
  },
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0')
}

export function Lcd({
  patch,
  index,
  total,
  octave,
  velocity,
  loading,
  source,
}: LcdProps) {
  const num = pad(index + 1, 3)
  const totalNum = pad(total, 3)
  const name = patch?.name ?? '— — —'
  const bankLabel = patch ? BANK_LABELS[patch.bank] : ''
  const category = patch?.category ?? ''
  const srcStyle = SOURCE_STYLES[source?.tier ?? 'unknown']
  const srcCounts = source && source.total > 0
    ? `${source.local}L · ${source.cache}C · ${source.cdn}N`
    : null

  return (
    <div
      className="lcd-screen relative overflow-hidden rounded-md p-4 font-mono text-lcd-text"
      style={{
        background:
          'linear-gradient(180deg, #0F1024 0%, #161A33 50%, #0F1024 100%)',
        boxShadow:
          'inset 0 0 24px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(91,192,235,0.05), 0 2px 6px rgba(20,30,60,0.18)',
        minHeight: 120,
      }}
    >
      <div
        className="lcd-scanlines pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(91,192,235,0.06) 0px, rgba(91,192,235,0.06) 1px, transparent 1px, transparent 3px)',
        }}
      />
      <div className="lcd-row-1 flex items-baseline justify-between gap-2 text-xs uppercase tracking-widest text-lcd-dim">
        <span className="lcd-bank truncate">{bankLabel}</span>
        <span
          className="lcd-source-badge inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] tracking-widest"
          title={
            srcCounts ? `${srcStyle.title} · ${srcCounts}` : srcStyle.title
          }
          style={{
            color: srcStyle.color,
            border: `1px solid ${srcStyle.color}`,
            background: `color-mix(in srgb, ${srcStyle.color} 12%, transparent)`,
            boxShadow:
              srcStyle.glow !== 'transparent'
                ? `0 0 6px ${srcStyle.glow}, inset 0 0 4px ${srcStyle.glow}`
                : 'none',
          }}
        >
          <span
            className="lcd-source-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: srcStyle.color,
              boxShadow:
                srcStyle.glow !== 'transparent'
                  ? `0 0 4px ${srcStyle.color}`
                  : 'none',
            }}
          />
          {srcStyle.label}
        </span>
        <span className="lcd-counter">
          {num} / {totalNum}
        </span>
      </div>
      <div className="lcd-row-2 mt-2 flex items-baseline gap-3">
        <span className="lcd-num lcd-glow text-2xl font-medium">{num}</span>
        <span className="lcd-name lcd-glow truncate text-2xl font-medium uppercase tracking-wide">
          {loading ? 'LOADING…' : name}
        </span>
      </div>
      <div className="lcd-row-3 mt-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-lcd-dim">
        <span className="lcd-category">{category}</span>
        <span className="lcd-meta">
          OCT {octave} · VEL {pad(velocity, 3)}
        </span>
      </div>
    </div>
  )
}
