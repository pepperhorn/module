import { useStore } from '../state/useStore'
import { useFullCatalog } from '../state/useFullCatalog'

export function LoadingOverlay() {
  const loadingPatchId = useStore((s) => s.loadingPatchId)
  const loadingProgress = useStore((s) => s.loadingProgress)
  // User presets live outside the raw catalog, so resolve against the merged
  // one — otherwise loading a saved patch showed its raw id.
  const catalog = useFullCatalog()

  if (!loadingPatchId) return null

  const patch = catalog.find((p) => p.id === loadingPatchId)
  const name = patch?.name ?? loadingPatchId
  const bank = patch?.bank ?? ''
  const category = patch?.category ?? ''

  const pct =
    loadingProgress && loadingProgress.total > 0
      ? Math.min(1, loadingProgress.loaded / loadingProgress.total)
      : null

  return (
    <div
      className="loading-overlay fade-in fixed inset-0 z-[60] flex items-center justify-center bg-text/55 backdrop-blur-sm"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="loading-card pop-in flex w-[min(420px,calc(100vw-2rem))] flex-col gap-5 rounded-2xl px-6 py-6"
        style={{
          background: 'linear-gradient(180deg, #0F1024 0%, #161A33 100%)',
          border: '1px solid rgba(91, 192, 235, 0.35)',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.45), 0 0 32px rgba(91,192,235,0.15)',
          color: '#5BC0EB',
        }}
      >
        <div className="loading-card-header flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-lcd-dim">
          <span>loading patch</span>
          <span>{bank}</span>
        </div>

        <div className="loading-card-name lcd-glow truncate font-mono text-2xl font-medium uppercase tracking-wide">
          {name}
        </div>

        <div className="loading-card-spinner flex items-center gap-3">
          <Spinner />
          <div className="flex-1">
            <div className="loading-card-cat font-mono text-[10px] uppercase tracking-wider text-lcd-dim">
              {category || 'fetching samples'}
            </div>
            <div className="loading-card-detail font-mono text-[10px] uppercase tracking-wider text-lcd-dim/80">
              {loadingProgress
                ? `${loadingProgress.loaded} / ${loadingProgress.total} samples`
                : 'connecting…'}
            </div>
          </div>
        </div>

        <div
          className="loading-card-bar relative h-1.5 overflow-hidden rounded-full"
          style={{
            background: 'rgba(91, 192, 235, 0.12)',
          }}
        >
          {pct !== null ? (
            <div
              className="loading-card-bar-fill absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.max(2, pct * 100)}%`,
                background:
                  'linear-gradient(90deg, rgba(91,192,235,0.6) 0%, #5BC0EB 100%)',
                boxShadow: '0 0 8px rgba(91,192,235,0.7)',
                transition: 'width 0.18s ease-out',
              }}
            />
          ) : (
            <div
              className="loading-card-bar-pulse absolute inset-y-0 rounded-full"
              style={{
                width: '40%',
                background:
                  'linear-gradient(90deg, transparent 0%, #5BC0EB 50%, transparent 100%)',
                animation: 'loadingBarSlide 1.4s ease-in-out infinite',
              }}
            />
          )}
        </div>

        <div className="loading-card-hint font-mono text-[9px] uppercase tracking-widest text-lcd-dim/60">
          first load fetches samples over the network · subsequent loads use the cache
        </div>
      </div>
      <style>{`
        @keyframes loadingBarSlide {
          0%   { left: -45%; }
          100% { left: 105%; }
        }
        @keyframes spinnerSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Spinner() {
  return (
    <div
      className="loading-spinner relative h-9 w-9"
      style={{
        animation: 'spinnerSpin 1.1s linear infinite',
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: '2px solid rgba(91, 192, 235, 0.18)',
          borderTopColor: '#5BC0EB',
          borderRightColor: 'rgba(91, 192, 235, 0.6)',
          boxShadow: '0 0 12px rgba(91, 192, 235, 0.35)',
        }}
      />
    </div>
  )
}
