import { useStore } from '../state/useStore'

/**
 * Surfaced when a patch load fails. Before this existed a failed load left the
 * LCD showing a patch that was never actually loaded, with no clue why the keys
 * were silent — the single most confusing failure mode of the loader.
 */
export function LoadErrorToast({ onRetry }: { onRetry: (id: string) => void }) {
  const loadError = useStore((s) => s.loadError)
  const setLoadError = useStore((s) => s.setLoadError)
  const online = useStore((s) => s.online)

  if (!loadError) return null

  return (
    <div
      className="load-error-toast pop-in fixed bottom-4 left-1/2 z-[70] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3"
      role="alert"
      style={{
        background: 'linear-gradient(180deg, #2A1220 0%, #1C0F1A 100%)',
        border: '1px solid rgba(255,107,107,0.45)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35), 0 0 20px rgba(255,107,107,0.15)',
        color: '#FFD9D9',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: '#FF6B6B', boxShadow: '0 0 8px rgba(255,107,107,0.8)' }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-widest">
          couldn’t load {loadError.name}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">
          {online ? 'samples unavailable — still on the previous patch' : 'offline — this patch is not cached'}
        </span>
      </div>
      <button
        type="button"
        className="cell-hit shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
        style={{ background: 'rgba(255,107,107,0.18)', color: '#FFD9D9' }}
        onClick={() => onRetry(loadError.id)}
      >
        retry
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        className="cell-hit shrink-0 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest opacity-60"
        onClick={() => setLoadError(null)}
      >
        ✕
      </button>
    </div>
  )
}
