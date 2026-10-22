import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build of src/embed/index.ts. No Tailwind (styles.css comes from
// scripts/build-css.mjs), no PWA and no vendored-sample plugins.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    target: 'es2020',
    minify: false,
    sourcemap: false,
    copyPublicDir: false,
    outDir: resolve(import.meta.dirname, 'dist'),
    lib: {
      entry: { index: resolve(import.meta.dirname, '../../src/embed/index.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'smplr', 'zustand', /^smplr\//, /^zustand\//],
    },
  },
})
