import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { sampleFiles } from '../scripts/generate-asset-urls.mjs'

const pkg = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const root = mkdtempSync(join(tmpdir(), 'keyboard-host-'))
const base = '/keyboard-host/'
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')

try {
  const pack = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root], {
    cwd: pkg, encoding: 'utf8',
  }))
  const installed = join(root, 'node_modules/@pepperhorn/keyboard')
  mkdirSync(installed, { recursive: true })
  execFileSync('tar', ['-xzf', join(root, pack[0].filename), '--strip-components=1', '-C', installed])
  const dependencies = ['react', 'react-dom', 'smplr', 'zustand', 'scheduler']
  for (const name of dependencies) {
    symlinkSync(dirname(require.resolve(`${name}/package.json`)), join(root, 'node_modules', name), 'dir')
  }

  writeFileSync(join(root, 'index.html'), '<!doctype html><div id="app"></div><script type="module" src="/main.js"></script>')
  writeFileSync(join(root, 'main.js'), `
    import { createElement } from 'react'
    import { createRoot } from 'react-dom/client'
    import { Keyboard } from '@pepperhorn/keyboard'
    import '@pepperhorn/keyboard/styles.css'
    createRoot(document.getElementById('app')).render(createElement(Keyboard))
  `)
  await build({ root, base, configFile: false, mode: 'production', logLevel: 'warn' })

  const assets = join(root, 'dist/assets')
  const files = readdirSync(assets)
  const js = files.filter(file => file.endsWith('.js')).map(file => readFileSync(join(assets, file), 'utf8')).join('\n')
  const urlLiterals = new Set([...js.matchAll(/\bnew URL\(\s*([`"'])([^`"']+)\1/g)].map(match => match[2]))
  const samples = files.filter(file => /\.(ogg|m4a)$/.test(file))
  const emitted = new Map(samples.map(file => [hash(join(assets, file)), file]))
  assert.equal(samples.length, sampleFiles.length, 'wrong number of emitted audio files')
  for (const sample of sampleFiles) {
    const file = emitted.get(hash(join(installed, 'dist/assets', sample)))
    assert.ok(file, `host did not emit ${sample}`)
    assert.ok(urlLiterals.has(`${base}assets/${file}`), `missing rewritten JS URL for ${sample}`)
  }
  console.log(`Vite production host OK (${samples.length} packed piano and drum files, both codecs, all JS URLs resolved)`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
