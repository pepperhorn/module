import { useCallback, useEffect, useRef, useState } from 'react'

// Screen Wake Lock API — keep the display on while the user is playing.
// Supported in Chromium, Safari 16.4+, Firefox 126+. The sentinel is lost
// whenever the tab is hidden, so we re-acquire on visibilitychange while
// the user-facing toggle is "on".

interface WakeLockSentinel extends EventTarget {
  released: boolean
  type: 'screen'
  release(): Promise<void>
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>
  }
}

function isSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return 'wakeLock' in navigator && !!(navigator as NavigatorWithWakeLock).wakeLock
}

export interface WakeLockApi {
  supported: boolean
  /** User intent: the toggle is "on". The sentinel may still be dropped by the browser. */
  enabled: boolean
  /** True when we currently hold an active sentinel. */
  active: boolean
  enable: () => Promise<void>
  disable: () => Promise<void>
  toggle: () => Promise<void>
}

export function useWakeLock(): WakeLockApi {
  const [supported] = useState<boolean>(isSupported)
  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = useCallback(async (): Promise<void> => {
    if (!isSupported()) return
    if (sentinelRef.current && !sentinelRef.current.released) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }
    try {
      const nav = navigator as NavigatorWithWakeLock
      const sentinel = await nav.wakeLock!.request('screen')
      sentinelRef.current = sentinel
      setActive(true)
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null
          setActive(false)
        }
      })
    } catch (err) {
      // User denied, not allowed (e.g. low battery), or hidden tab.
      console.warn('[wake-lock] request failed', err)
      setActive(false)
    }
  }, [])

  const release = useCallback(async (): Promise<void> => {
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    setActive(false)
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release()
      } catch {
        // noop
      }
    }
  }, [])

  const enable = useCallback(async () => {
    setEnabled(true)
    await acquire()
  }, [acquire])

  const disable = useCallback(async () => {
    setEnabled(false)
    await release()
  }, [release])

  const toggle = useCallback(async () => {
    if (enabled) await disable()
    else await enable()
  }, [enabled, enable, disable])

  // Re-acquire whenever the tab becomes visible again and the user still wants it on.
  useEffect(() => {
    if (!supported) return
    const onVis = () => {
      if (!enabled) return
      if (document.visibilityState === 'visible') {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [supported, enabled, acquire])

  // Release on unmount
  useEffect(() => {
    return () => {
      void release()
    }
  }, [release])

  return { supported, enabled, active, enable, disable, toggle }
}
