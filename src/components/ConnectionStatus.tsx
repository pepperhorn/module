import { useOnlineStatus } from '../input/useOnlineStatus'
import { useStore } from '../state/useStore'

// Soft connection + built-ins-download indicator for the Rack status row.
export function ConnectionStatus() {
  const online = useOnlineStatus()
  const warm = useStore((s) => s.warmProgress)

  return (
    <div className="connection-status flex items-center gap-2">
      {warm && (
        <span className="connection-warm font-mono text-[10px] uppercase tracking-widest text-text/40">
          downloading built-ins {warm.done}/{warm.total}
        </span>
      )}
      <span
        className="connection-dot inline-block h-2.5 w-2.5 rounded-full"
        title={online ? 'Online' : 'Offline — cached content only'}
        aria-label={online ? 'Online' : 'Offline'}
        style={{
          background: online ? 'var(--color-lime)' : 'rgba(20,30,60,0.35)',
          boxShadow: online ? '0 0 8px rgba(181, 232, 83, 0.6)' : 'none',
        }}
      />
    </div>
  )
}
