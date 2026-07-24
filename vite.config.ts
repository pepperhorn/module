import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { vendoredSamplesPlugin } from './plugins/vendoredSamplesPlugin.mjs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vendoredSamplesPlugin(),
    VitePWA({
      // Prompt-style updates: a live audio instrument must never reload itself
      // mid-performance. main.tsx registers manually and shows a Reload toast.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MODULE',
        short_name: 'MODULE',
        description: 'Browser-based JV-style sound module',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        theme_color: '#FAFBFC',
        background_color: '#0F1024',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        // Precache the app shell ONLY. Audio + patches are excluded so the
        // 26 MB of vendored samples never bloat the install; they are handled
        // by the runtime CacheFirst route below (+ the idle warm loop) and by
        // loggedStorage.ts's own Cache API cascade.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,ico}'],
        globIgnores: ['**/smplr-samples/**', '**/patches/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/smplr-samples\//, /^\/patches\//],
        // Raise from the default 2 MiB so our font + JS chunks precache cleanly.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Same-origin vendored samples: cache on first fetch, serve from
            // cache forever after. This is what the idle warm loop populates.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/smplr-samples/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'module-vendored-v1',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cross-origin CDN sample hosts are owned entirely by
            // loggedStorage.ts (module-cdn-v1). The SW must NOT cache them.
            urlPattern: ({ url }) =>
              url.host === 'smpldsnds.github.io' ||
              url.host === 'gleitz.github.io' ||
              url.host === 'goldst.dev',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
})
