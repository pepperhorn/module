import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // Samples are huge and handled by our own Cache API cascade — don't let
      // Workbox try to precache or intercept them. The SW only covers the
      // app shell (HTML, JS, CSS, fonts, favicon).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        globIgnores: ['smplr-samples/**', 'patches/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/smplr-samples\//, /^\/patches\//],
        // Raise from the default 2 MiB so our font + JS chunks precache cleanly.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'MODULE',
        short_name: 'MODULE',
        description: 'Browser-based JV-style sound module',
        theme_color: '#FAFBFC',
        background_color: '#0F1024',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
})
