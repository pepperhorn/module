import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        // Precache the app shell ONLY. Audio (ogg/m4a/wav) is intentionally
        // excluded so the 26 MB of vendored samples never bloat the install.
        globPatterns: ['**/*.{js,css,html,svg,woff2,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
})
