/**
 * The "tap to power on" scrim browsers need before audio can start. `contained`
 * pins it to the nearest positioned ancestor instead of the viewport (embed).
 */
export function PowerOnOverlay({
  onPowerOn,
  contained = false,
}: {
  onPowerOn: () => void
  contained?: boolean
}) {
  return (
    <div
      className={`gesture-overlay fade-in ${contained ? 'absolute' : 'fixed'} inset-0 z-40 flex items-center justify-center backdrop-blur-sm`}
      style={{ background: 'var(--scrim)' }}
      onClick={(e) => {
        e.stopPropagation()
        onPowerOn()
      }}
    >
      <div
        className="gesture-card pop-in flex flex-col items-center gap-3 rounded-2xl px-8 py-6 text-center"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <span
          className="gesture-mark inline-block h-3 w-3 rounded-sm"
          style={{
            background: 'var(--color-coral)',
            boxShadow: '0 0 12px rgba(255,107,107,0.6)',
          }}
        />
        <div className="gesture-title font-display text-lg font-semibold text-text">
          tap to power on
        </div>
        <div className="gesture-sub legend max-w-xs">
          browser audio needs a user gesture · click anywhere
        </div>
      </div>
    </div>
  )
}
