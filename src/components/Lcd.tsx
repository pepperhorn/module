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
    color: 'var(--color-lcd-dim)',
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
  const srcCounts =
    source && source.total > 0
      ? `${source.local}L · ${source.cache}C · ${source.cdn}N`
      : null

  return (
    <div
      className="lcd-bezel"
      style={{
        position: 'relative',
        padding: 8,
        borderRadius: 6,
        background: 'var(--lcd-bezel-bg)',
        boxShadow: 'var(--lcd-bezel-shadow)',
      }}
    >
      <span className="lcd-screw rack-screw" aria-hidden="true" style={{ position: 'absolute', top: 3, left: 3, ['--slot-rot' as string]: '20deg' }} />
      <span className="lcd-screw rack-screw" aria-hidden="true" style={{ position: 'absolute', top: 3, right: 3, ['--slot-rot' as string]: '115deg' }} />
      <span className="lcd-screw rack-screw" aria-hidden="true" style={{ position: 'absolute', bottom: 3, left: 3, ['--slot-rot' as string]: '70deg' }} />
      <span className="lcd-screw rack-screw" aria-hidden="true" style={{ position: 'absolute', bottom: 3, right: 3, ['--slot-rot' as string]: '150deg' }} />
      <div
        className="lcd-screen relative overflow-hidden p-4 font-mono text-lcd-text"
        style={{
          borderRadius: 3,
          background:
            'linear-gradient(180deg, #051B19 0%, #0A2B27 50%, #051B19 100%)',
          boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.6)',
          minHeight: 104,
        }}
      >
        <div
          className="lcd-scanlines pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(85,230,200,0.05) 0px, rgba(85,230,200,0.05) 1px, transparent 1px, transparent 3px)',
          }}
        />
        <div
          className="lcd-vignette pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
          }}
        />
        <div className="lcd-row-1 relative flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-widest text-lcd-dim">
          <span className="lcd-bank truncate">{bankLabel}</span>
          <span
            className="lcd-source-badge inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-lcd-dim"
            title={
              srcCounts ? `${srcStyle.title} · ${srcCounts}` : srcStyle.title
            }
          >
            <span
              className="lcd-source-dot inline-block rounded-full"
              style={{
                width: 5,
                height: 5,
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
        <div className="lcd-row-2 relative mt-2 flex items-baseline gap-3">
          <span className="lcd-num lcd-glow text-[22px] font-medium">{num}</span>
          <span className="lcd-name lcd-glow truncate text-[22px] font-medium uppercase tracking-wide">
            {loading ? 'LOADING…' : name}
          </span>
          <span className="lcd-cursor lcd-glow text-[22px] font-medium leading-none">
            ▮
          </span>
        </div>
        <div className="lcd-row-3 relative mt-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-lcd-dim">
          <span className="lcd-category">{category}</span>
          <span className="lcd-meta">
            OCT {octave} · VEL {pad(velocity, 3)}
          </span>
        </div>
      </div>
    </div>
  )
}
