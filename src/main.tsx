import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import vendoredUrls from 'virtual:vendored-samples'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App'
import { UpdateToast } from './components/UpdateToast'
import { warmVendored } from './pwa/warmVendored'
import { useStore } from './state/useStore'

function Root() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [reload, setReload] = useState<(() => void) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setReload(() => () => updateSW(true))
        setNeedRefresh(true)
      },
      onOfflineReady() {
        // First install cached the shell — the app can now cold-launch offline.
        // Kept silent by design; the warm loop handles built-in samples next.
      },
    })

    // After first paint, warm the vendored samples on idle so built-ins become
    // offline-ready without blocking startup or competing with audio loads.
    const setWarmProgress = useStore.getState().setWarmProgress
    const start = () => {
      if (!navigator.onLine) return
      void warmVendored({
        urls: vendoredUrls,
        onProgress: (done, total) =>
          setWarmProgress(done >= total ? null : { done, total }),
      })
    }
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number
      }
    ).requestIdleCallback
    if (idle) idle(start)
    else window.setTimeout(start, 2000)
  }, [])

  return (
    <>
      <App />
      {needRefresh && reload && (
        <UpdateToast onReload={reload} onDismiss={() => setNeedRefresh(false)} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
