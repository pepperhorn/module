import { useEffect, useState } from 'react'
import { useAuth } from '../state/useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'email' | 'otp'

export function AuthModal({ open, onClose }: AuthModalProps) {
  const {
    requestOtp,
    verifyOtp,
    isRequestingOtp,
    isVerifyingOtp,
    error,
    clearError,
    user,
  } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  // Reset whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep('email')
      setOtp('')
      clearError()
    }
  }, [open, clearError])

  // If we successfully signed in, close ourselves
  useEffect(() => {
    if (user && open) onClose()
  }, [user, open, onClose])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSendCode = async () => {
    const ok = await requestOtp(email)
    if (ok) setStep('otp')
  }

  const handleVerify = async () => {
    await verifyOtp(email, otp)
  }

  return (
    <div
      className="auth-modal fade-in fixed inset-0 z-[58] flex items-center justify-center bg-text/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="auth-modal-card pop-in flex w-[min(420px,calc(100vw-2rem))] flex-col gap-4 rounded-2xl bg-bg p-6 shadow-2xl"
        style={{ border: '1px solid var(--color-rack-edge)' }}
      >
        <div className="auth-modal-header flex items-baseline justify-between">
          <div className="font-display text-base font-semibold text-text">
            {step === 'email' ? 'Sign in' : 'Enter the code'}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-text/50">
            pepperhorn id
          </div>
        </div>

        <div className="auth-modal-blurb font-mono text-[10px] uppercase tracking-wider text-text/55">
          {step === 'email'
            ? 'Sign in with your email to sync user patches across devices.'
            : `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
        </div>

        {step === 'email' ? (
          <label className="auth-modal-field flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-text/40">
              email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSendCode()
                }
              }}
              className="auth-modal-input rounded-md px-3 py-2 font-display text-sm outline-none focus:ring-2 focus:ring-coral"
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--color-rack-edge)',
                color: 'var(--color-text)',
              }}
              autoFocus
              placeholder="you@example.com"
              maxLength={120}
              disabled={isRequestingOtp}
            />
          </label>
        ) : (
          <label className="auth-modal-field flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-text/40">
              code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleVerify()
                }
              }}
              className="auth-modal-input rounded-md px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-coral"
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--color-rack-edge)',
                color: 'var(--color-text)',
              }}
              autoFocus
              placeholder="000000"
              maxLength={6}
              disabled={isVerifyingOtp}
            />
          </label>
        )}

        {error && (
          <div
            className="auth-modal-error rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              color: '#C84A4A',
              border: '1px solid rgba(255, 107, 107, 0.4)',
            }}
          >
            {error}
          </div>
        )}

        <div className="auth-modal-actions flex items-center justify-between gap-2">
          {step === 'otp' ? (
            <button
              type="button"
              className="cell-hit rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wider text-text/60"
              onClick={() => {
                setStep('email')
                setOtp('')
                clearError()
              }}
            >
              ← email
            </button>
          ) : (
            <button
              type="button"
              className="cell-hit rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wider text-text/60"
              onClick={onClose}
            >
              cancel
            </button>
          )}
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider text-bg disabled:opacity-50"
            style={{
              background:
                'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
              boxShadow:
                'inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 10px rgba(255,107,107,0.3)',
            }}
            disabled={
              step === 'email' ? isRequestingOtp || !email : isVerifyingOtp || otp.length < 4
            }
            onClick={() => (step === 'email' ? void handleSendCode() : void handleVerify())}
          >
            {step === 'email'
              ? isRequestingOtp
                ? 'sending…'
                : 'send code'
              : isVerifyingOtp
                ? 'verifying…'
                : 'verify'}
          </button>
        </div>
      </div>
    </div>
  )
}
