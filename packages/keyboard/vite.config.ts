import { relative, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { assetUrlsModule, sampleFiles } from './scripts/generate-asset-urls.mjs'

const repo = resolve(import.meta.dirname, '../..')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'keyboard-dist-inventory',
      generateBundle(_, bundle) {
        const modules = Object.values(bundle).flatMap(entry =>
          entry.type === 'chunk' ? Object.keys(entry.modules).map(id => relative(repo, id)) : [],
        )
        // Leave the literal URLs for the consuming host to process.
        this.emitFile({ type: 'asset', fileName: 'patches/assetUrls.generated.js', source: assetUrlsModule('../assets/') })
        this.emitFile({ type: 'asset', fileName: 'inventory.json', source: JSON.stringify({
          modules: [...new Set(modules)].sort(), assets: sampleFiles.map(file => 'assets/' + file),
        }, null, 2) })
      },
    },
  ],
  publicDir: false,
  build: {
    target: 'es2020',
    minify: false,
    copyPublicDir: false,
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: { index: resolve(import.meta.dirname, 'src/index.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['./assetUrls.generated.js', /^react(?:-dom)?(?:\/|$)/, /^smplr(?:\/|$)/, /^zustand(?:\/|$)/],
    },
  },
})
