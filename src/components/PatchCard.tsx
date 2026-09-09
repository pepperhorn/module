import type { PatchManifest, PatchColor } from '../patches/types'

interface PatchCardProps {
  patch: PatchManifest
  active: boolean
  favourited: boolean
  downloaded: boolean
  downloading: boolean
  /** True when we're offline AND this patch isn't cached locally. */
  unavailableOffline?: boolean
  /** This card's audition is loading or playing. */
  previewing?: boolean
  onSelect: (id: string) => void
  onPreview: (id: string) => void
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
  unavailableOffline = false,
  previewing = false,
  onSelect,
  onPreview,
  onToggleFavourite,
  onDownload,
}: PatchCardProps) {
  const hex = COLOR_TO_HEX[patch.color] ?? COLOR_TO_HEX.sky
  // A div rather than a button: the card holds its own buttons (preview,
  // favourite, download) and a button may not contain another button.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(patch.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(patch.id)
        }
      }}
      aria-disabled={unavailableOffline}
      className={`patch-card cell-hit group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg p-3 text-left ${
        active ? 'patch-card-active ring-2 ring-coral' : ''
      } ${unavailableOffline ? 'patch-card-offline' : ''}`}
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)',
        border: '1px solid var(--color-rack-edge)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(20,30,60,0.06)',
        opacity: unavailableOffline ? 0.42 : 1,
        filter: unavailableOffline ? 'grayscale(0.6)' : 'none',
      }}
    >
      <div
        className="patch-card-swatch relative flex h-12 w-full items-center justify-center rounded-md"
        style={{
          background: `linear-gradient(135deg, ${hex} 0%, ${hex}cc 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 12px ${hex}33`,
        }}
      >
        <PreviewButton
          previewing={previewing}
          unavailableOffline={unavailableOffline}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (!unavailableOffline) onPreview(patch.id)
          }}
        />
      </div>
      <div className="patch-card-meta flex flex-1 flex-col gap-1">
        <div className="patch-card-title font-display text-sm font-medium text-text">
          {patch.name}
        </div>
        <div className="patch-card-cat font-mono text-[10px] uppercase tracking-wider text-text/50">
          {patch.category} · {patch.bank}
          {unavailableOffline && (
            <span className="ml-1 text-text/60"> · offline</span>
          )}
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
      <DownloadButton
        downloaded={downloaded}
        downloading={downloading}
        unavailableOffline={unavailableOffline}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (!downloaded && !downloading && !unavailableOffline) {
            onDownload(patch.id)
          }
        }}
      />
    </div>
  )
}

function PreviewButton({
  previewing,
  unavailableOffline,
  onClick,
}: {
  previewing: boolean
  unavailableOffline: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const label = unavailableOffline
    ? 'Offline — connect to preview'
    : previewing
      ? 'Stop preview'
      : 'Preview — plays a C–G run'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={unavailableOffline}
      onClick={onClick}
      className="patch-card-preview cell-hit flex h-8 w-8 items-center justify-center rounded-full"
      style={{
        color: 'rgba(20,30,60,0.75)',
        background: previewing
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: previewing
          ? '0 0 0 3px rgba(255,255,255,0.45)'
          : '0 1px 2px rgba(20,30,60,0.18)',
      }}
    >
      {previewing ? <StopIcon /> : <PlayIcon />}
    </button>
  )
}

function DownloadButton({
  downloaded,
  downloading,
  unavailableOffline,
  onClick,
}: {
  downloaded: boolean
  downloading: boolean
  unavailableOffline: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const label = downloaded
    ? 'Cached for offline'
    : downloading
      ? 'Downloading…'
      : unavailableOffline
        ? 'Offline — connect to download'
        : 'Download for offline'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={downloading || downloaded || unavailableOffline}
      onClick={onClick}
      className="patch-card-dl absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full"
      style={{
        color: downloaded
          ? 'var(--color-bg)'
          : downloading
            ? '#5BC0EB'
            : unavailableOffline
              ? 'rgba(20,30,60,0.35)'
              : '#FFFFFF',
        background: downloaded
          ? 'var(--color-lime)'
          : downloading
            ? 'rgba(91,192,235,0.15)'
            : unavailableOffline
              ? 'rgba(255,255,255,0.7)'
              : 'linear-gradient(180deg, #5BC0EB 0%, #4AA8D2 100%)',
        border: downloaded || (!downloading && !unavailableOffline)
          ? 'none'
          : '1px solid var(--color-rack-edge)',
        boxShadow: downloaded
          ? '0 0 8px rgba(181,232,83,0.5)'
          : downloading
            ? 'none'
            : unavailableOffline
              ? 'none'
              : '0 0 8px rgba(91,192,235,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)',
      }}
    >
      {downloaded ? <CheckIcon /> : downloading ? <SpinnerIcon /> : <DownloadIcon />}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 3.2l8 4.8-8 4.8z" fill="currentColor" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2v7.5m0 0l-3-3m3 3l3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
