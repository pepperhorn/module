import { useStore } from '../state/useStore'

/**
 * Surfaced when a patch load fails. Before this existed a failed load left the
 * LCD showing a patch that was never actually loaded, with no clue why the keys
 * were silent — the single most confusing failure mode of the loader.
 */
export function LoadErrorToast({
  onRetry,
  inline = false,
}: {
  onRetry: (id: string) => void
  /**
   * Sit in the layout instead of floating. Keyboard mode fills the viewport and
   * ends in the touch controls, so a floating toast would cover panic and the
   * octave buttons no matter which edge it was pinned to.
   */
  inline?: boolean
}) {
  const loadError = useStore((s) => s.loadError)
  const setLoadError = useStore((s) => s.setLoadError)
  const online = useStore((s) => s.online)

  if (!loadError) return null

  return (
    <div
      className={`load-error-toast pop-in flex items-center gap-3 rounded-lg px-4 py-3 ${
        inline
          ? 'w-full shrink-0'
          : 'fixed bottom-4 left-1/2 z-[70] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2'
      }`}
      role="alert"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid color-mix(in srgb, var(--color-coral) 55%, var(--card-border))',
        boxShadow: 'var(--card-shadow), 0 0 20px rgba(255,107,107,0.15)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        aria-hidden="true"
        className="load-error-toast-led led-on h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ color: 'var(--color-coral)', background: 'var(--color-coral)' }}
      />
      <div className="load-error-toast-text flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="load-error-toast-title legend-strong" style={{ color: 'var(--ink-coral)' }}>
          couldn’t load {loadError.name}
        </span>
        <span className="load-error-toast-detail legend">
          {online ? 'samples unavailable — still on the previous patch' : 'offline — this patch is not cached'}
        </span>
      </div>
      <button
        type="button"
        className="load-error-toast-retry hw-btn hw-btn-accent shrink-0 px-2.5 py-1"
        style={{ ['--hw-accent' as string]: 'var(--color-coral)' }}
        onClick={() => onRetry(loadError.id)}
      >
        <span className="load-error-toast-retry-label legend" style={{ color: 'var(--ink-coral)' }}>
          retry
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        className="load-error-toast-dismiss hw-btn legend shrink-0 px-2 py-1"
        onClick={() => setLoadError(null)}
      >
        ✕
      </button>
    </div>
  )
}
