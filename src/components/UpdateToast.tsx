interface UpdateToastProps {
  onReload: () => void
  onDismiss: () => void
}

// Non-intrusive "new version" prompt. Never reloads on its own — the user taps
// Reload when they're ready (important for a live instrument mid-performance).
export function UpdateToast({ onReload, onDismiss }: UpdateToastProps) {
  return (
    <div
      className="update-toast fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(92%,26rem)] items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg"
      role="status"
      style={{ background: '#1A1A2E', color: '#FAFBFC' }}
    >
      <span className="update-toast-label font-display text-sm">
        New version available
      </span>
      <div className="update-toast-actions flex items-center gap-2">
        <button
          className="update-toast-reload rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: 'var(--color-lime)', color: '#0F1024' }}
          onClick={onReload}
        >
          Reload
        </button>
        <button
          className="update-toast-dismiss rounded-full px-3 py-1.5 text-sm"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#FAFBFC' }}
          onClick={onDismiss}
        >
          Later
        </button>
      </div>
    </div>
  )
}
