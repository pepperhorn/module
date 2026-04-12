import { useState } from 'react'
import { useAuth } from '../state/useAuth'
import { AuthModal } from './AuthModal'

export function UserMenu() {
  const { user, isLoading, logout } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="user-menu-loading flex items-center gap-2 rounded-full border border-rack-edge bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text/40">
        <span className="h-2 w-2 animate-pulse rounded-full bg-text/30" />
        ...
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          className="user-menu-signin cell-hit flex items-center gap-2 rounded-full border border-rack-edge bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text/60 hover:text-text"
          onClick={(e) => {
            e.stopPropagation()
            setAuthOpen(true)
          }}
          title="Sign in to sync user patches across devices"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'rgba(20,30,60,0.18)' }}
          />
          sign in
        </button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    )
  }

  const display =
    user.user_handle ??
    (user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.email)

  return (
    <div className="user-menu relative">
      <button
        type="button"
        className="user-menu-button cell-hit flex items-center gap-2 rounded-full border border-rack-edge bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text/70 hover:text-text"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((o) => !o)
        }}
        title={user.email}
      >
        <span
          className="user-menu-led h-2 w-2 rounded-full"
          style={{
            background: 'var(--color-lime)',
            boxShadow: '0 0 6px var(--color-lime)',
          }}
        />
        <span className="user-menu-name max-w-[120px] truncate">{display}</span>
      </button>
      {menuOpen && (
        <div
          className="user-menu-dropdown pop-in absolute right-0 top-full z-30 mt-1 flex flex-col gap-2 rounded-lg p-3 shadow-xl"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-rack-edge)',
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="user-menu-info flex flex-col gap-0.5">
            <div className="font-display text-xs font-medium text-text">
              {display}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-text/50">
              {user.email}
            </div>
          </div>
          <div
            className="user-menu-divider"
            style={{ borderTop: '1px solid var(--color-rack-edge)' }}
          />
          <button
            type="button"
            className="user-menu-signout cell-hit rounded-md px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider text-coral hover:bg-coral/10"
            onClick={() => {
              setMenuOpen(false)
              logout()
            }}
          >
            sign out
          </button>
        </div>
      )}
    </div>
  )
}
