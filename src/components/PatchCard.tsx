import type { PatchManifest, PatchColor } from '../patches/types'

interface PatchCardProps {
  patch: PatchManifest
  active: boolean
  favourited: boolean
  downloaded: boolean
  downloading: boolean
  onSelect: (id: string) => void
  onToggleFavourite: (id: string) => void
  onDownload: (id: string) => void
}

const COLOR_TO_HEX: Record<PatchColor, string> = {
  coral: '#FF6B6B',
  amber: '#FFB84D',
  lime: '#B5E853',
  sky: '#5BC0EB',
  lavender: '#B59CD9',
  peach: '#FFB5A7',
  mint: '#96E6B3',
  rose: '#FFA5B8',
}

export function PatchCard({
  patch,
  active,
  favourited,
  downloaded,
  downloading,
  onSelect,
  onToggleFavourite,
  onDownload,
}: PatchCardProps) {
  const hex = COLOR_TO_HEX[patch.color] ?? COLOR_TO_HEX.sky
  return (
    <button
      type="button"
      onClick={() => onSelect(patch.id)}
      className={`patch-card cell-hit group relative flex flex-col gap-2 overflow-hidden rounded-lg p-3 text-left ${
        active ? 'patch-card-active ring-2 ring-coral' : ''
      }`}
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)',
        border: '1px solid var(--color-rack-edge)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(20,30,60,0.06)',
      }}
    >
      <div
        className="patch-card-swatch h-12 w-full rounded-md"
        style={{
          background: `linear-gradient(135deg, ${hex} 0%, ${hex}cc 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 12px ${hex}33`,
        }}
      />
      <div className="patch-card-meta flex flex-1 flex-col gap-1">
        <div className="patch-card-title font-display text-sm font-medium text-text">
          {patch.name}
        </div>
        <div className="patch-card-cat font-mono text-[10px] uppercase tracking-wider text-text/50">
          {patch.category} · {patch.bank}
        </div>
      </div>
      <button
        type="button"
        aria-label={favourited ? 'Unfavourite' : 'Favourite'}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggleFavourite(patch.id)
        }}
        className="patch-card-fav absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-base leading-none"
        style={{
          color: favourited ? '#FF6B6B' : 'rgba(20,30,60,0.25)',
          background: favourited ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.6)',
        }}
      >
        {favourited ? '♥' : '♡'}
      </button>
      <button
        type="button"
        aria-label={
          downloaded
            ? 'Cached for offline'
            : downloading
              ? 'Downloading'
              : 'Download for offline'
        }
        title={
          downloaded
            ? 'Cached for offline'
            : downloading
              ? 'Downloading…'
              : 'Download for offline'
        }
        disabled={downloading || downloaded}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (!downloaded && !downloading) onDownload(patch.id)
        }}
        className="patch-card-dl absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] leading-none"
        style={{
          color: downloaded
            ? 'var(--color-bg)'
            : downloading
              ? '#5BC0EB'
              : 'rgba(20,30,60,0.4)',
          background: downloaded
            ? 'var(--color-lime)'
            : downloading
              ? 'rgba(91,192,235,0.18)'
              : 'rgba(255,255,255,0.7)',
          border: downloaded ? 'none' : '1px solid var(--color-rack-edge)',
          boxShadow: downloaded
            ? '0 0 8px rgba(181,232,83,0.45)'
            : 'none',
        }}
      >
        {downloaded ? '✓' : downloading ? '…' : '↓'}
      </button>
    </button>
  )
}
