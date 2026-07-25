import { useTheme, toggleTheme } from '../state/useTheme'

/** Header light/dark switch. A sun in dark mode (tap to brighten), a moon in
 *  light mode (tap to darken). Styled as a status pill to match MIDI/SIGN IN. */
export function ThemeToggle() {
  const theme = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle cell-hit flex items-center justify-center rounded-full"
      style={{
        width: 30,
        height: 26,
        background: 'var(--pill-bg)',
        border: '1px solid var(--pill-border)',
        color: 'var(--color-legend)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        toggleTheme()
      }}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="21.5" y2="12" />
            <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
            <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
            <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
            <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
          </g>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  )
}
