// PepperHorn auth — passwordless OTP via apps.pepperhorn.com
//
// Flow:
//  1. requestOtp(email)            → POST FLOW_REQUEST_OTP { email, app_slug }
//  2. verifyOtp(email, code)       → POST FLOW_VERIFY_OTP  { email, otp_code, app_slug }
//                                    response → { success, token, user, is_new_user }
//  3. on mount, if a token is in localStorage, POST FLOW_VERIFY_SESSION
//                                    response → { valid, user }
//
// The token is stored as `module:session-token` and used as a Directus access
// token for all subsequent /items/* calls (Bearer auth).
//
// Per the architecture doc, app_users is shared across apps. Each app gets its
// own session token (no SSO across apps yet) — that's enforced server-side by
// the app_slug parameter on the flows.

import { useCallback, useEffect, useRef, useState } from 'react'

export const APP_SLUG = 'module'
export const PH_BASE = 'https://apps.pepperhorn.com'

const FLOW_REQUEST_OTP = '40f96a57-1ab0-4031-a7f5-9a32ec877d15'
const FLOW_VERIFY_OTP = '65da02e3-4742-4c5a-8bc5-3bb114fb6557'
const FLOW_VERIFY_SESSION = '11dd60ca-fc66-4396-9461-858b7bbf2df8'

const SESSION_TOKEN_KEY = 'module:session-token'

export interface AppUser {
  id: string
  email: string
  user_handle?: string
  first_name?: string | null
  last_name?: string | null
}

interface AuthState {
  user: AppUser | null
  token: string | null
  isLoading: boolean
  isVerifyingOtp: boolean
  isRequestingOtp: boolean
  isNewUser: boolean
  error: string | null
}

interface AuthApi extends AuthState {
  requestOtp: (email: string) => Promise<boolean>
  verifyOtp: (email: string, code: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token)
    else localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // noop
  }
}

async function postFlow<T = unknown>(
  flowId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${PH_BASE}/flows/trigger/${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`flow ${flowId} ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

// Module-scoped singleton so every component sees the same auth state without
// needing a Provider tree. Components subscribe via the useAuth hook below.
interface Listener {
  (state: AuthState): void
}
const listeners = new Set<Listener>()
let state: AuthState = {
  user: null,
  token: getStoredToken(),
  isLoading: true,
  isVerifyingOtp: false,
  isRequestingOtp: false,
  isNewUser: false,
  error: null,
}
function setState(patch: Partial<AuthState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

let bootstrapped = false
async function bootstrap(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true
  const token = getStoredToken()
  if (!token) {
    setState({ isLoading: false })
    return
  }
  try {
    const result = await postFlow<{ valid: boolean; user?: AppUser }>(
      FLOW_VERIFY_SESSION,
      { token, app_slug: APP_SLUG },
    )
    if (result.valid && result.user) {
      setState({ user: result.user, token, isLoading: false })
    } else {
      setStoredToken(null)
      setState({ user: null, token: null, isLoading: false })
    }
  } catch (err) {
    // Network failure on boot — keep the token, treat as offline.
    // On next save attempt we'll retry; for now act as logged-out.
    console.warn('[auth] verify-session failed', err)
    setState({
      user: null,
      isLoading: false,
      error: 'offline',
    })
  }
}

export function useAuth(): AuthApi {
  const [snap, setSnap] = useState<AuthState>(state)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    const fn: Listener = (s) => {
      if (mountedRef.current) setSnap(s)
    }
    listeners.add(fn)
    void bootstrap()
    return () => {
      mountedRef.current = false
      listeners.delete(fn)
    }
  }, [])

  const requestOtp = useCallback(async (email: string): Promise<boolean> => {
    if (!email.trim()) {
      setState({ error: 'enter an email' })
      return false
    }
    setState({ isRequestingOtp: true, error: null })
    try {
      await postFlow(FLOW_REQUEST_OTP, {
        email: email.trim(),
        app_slug: APP_SLUG,
      })
      setState({ isRequestingOtp: false })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState({ isRequestingOtp: false, error: msg })
      return false
    }
  }, [])

  const verifyOtp = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      const trimmed = code.trim()
      if (trimmed.length < 4) {
        setState({ error: 'enter the code' })
        return false
      }
      setState({ isVerifyingOtp: true, error: null })
      try {
        const result = await postFlow<{
          success: boolean
          token?: string
          user?: AppUser
          is_new_user?: boolean
          message?: string
        }>(FLOW_VERIFY_OTP, {
          email: email.trim(),
          otp_code: trimmed,
          app_slug: APP_SLUG,
        })
        if (!result.success || !result.token || !result.user) {
          setState({
            isVerifyingOtp: false,
            error: result.message ?? 'invalid code',
          })
          return false
        }
        setStoredToken(result.token)
        setState({
          user: result.user,
          token: result.token,
          isLoading: false,
          isVerifyingOtp: false,
          isNewUser: !!result.is_new_user,
          error: null,
        })
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setState({ isVerifyingOtp: false, error: msg })
        return false
      }
    },
    [],
  )

  const logout = useCallback(() => {
    setStoredToken(null)
    setState({
      user: null,
      token: null,
      isNewUser: false,
      error: null,
    })
  }, [])

  const clearError = useCallback(() => {
    if (state.error !== null) setState({ error: null })
  }, [])

  return { ...snap, requestOtp, verifyOtp, logout, clearError }
}

/** Read the current auth state without subscribing — for non-React callsites. */
export function getAuthSnapshot(): AuthState {
  return state
}
