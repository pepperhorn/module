// Vite plugin: exposes `virtual:vendored-samples` — a string[] of every
// vendored sample URL under public/smplr-samples. Read from disk at config
// time so it never drifts from what's actually shipped. `public/` files are
// not in the module graph, so import.meta.glob cannot see them; we walk fs.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { toVendoredUrls } from '../src/pwa/vendoredUrls.ts'

const VIRTUAL_ID = 'virtual:vendored-samples'
const RESOLVED_ID = '\0' + VIRTUAL_ID

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ogg|m4a|wav|sfz|js)$/i.test(entry)) out.push(full)
  }
  return out
}

export function vendoredSamplesPlugin() {
  return {
    name: 'vendored-samples-manifest',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const publicDir = join(process.cwd(), 'public')
      let urls = []
      try {
        urls = toVendoredUrls(publicDir, walk(join(publicDir, 'smplr-samples')))
      } catch {
        urls = []
      }
      return `export default ${JSON.stringify(urls)}`
    },
  }
}
