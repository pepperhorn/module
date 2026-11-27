import { relative, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { bundledPatches } from './src/patches/bundled'

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
        const assets = bundledPatches('assets/').flatMap(({ source }) =>
          source.kind === 'sampler'
            ? Object.values(source.samples).flatMap(file =>
                source.formats?.map(format => source.baseUrl + file.replace(/\.[^.]+$/, '.' + format)) ??
                [source.baseUrl + file],
              )
            : [],
        )
        this.emitFile({ type: 'asset', fileName: 'inventory.json', source: JSON.stringify({
          modules: [...new Set(modules)].sort(), assets: [...new Set(assets)].sort(),
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
      external: [/^react(?:-dom)?(?:\/|$)/, /^smplr(?:\/|$)/, /^zustand(?:\/|$)/],
    },
  },
})
