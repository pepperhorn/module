import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : 'playwright-core')
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '0.0.0.0', port: 5214, strictPort: true },
  optimizeDeps: { entries: ['e2e/smoke.html'], include: ['react/jsx-dev-runtime'] },
})
try {
  await server.listen()
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 } })
    const origin = 'http://localhost:5214'
    const errors = []
    const fetched = new Set()
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type())) errors.push(msg.text())
    })
    page.on('pageerror', error => errors.push(String(error)))
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
      if (/\/dist\/assets\/.+\.(ogg|m4a)$/.test(response.url()) && response.ok()) fetched.add(response.url())
    })
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue()
      errors.push(`external request: ${route.request().url()}`)
      return route.abort()
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined })
      window.startedSamples = 0
      const start = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.startedSamples++
        return start.apply(this, args)
      }
    })

    async function boot(patch) {
      await page.goto(`${origin}/e2e/smoke.html?patch=${patch}`)
      await page.getByRole('button', { name: 'Enable audio' }).click()
      await page.waitForFunction(() => !document.querySelector('.kb-loading, .kb-power-overlay, .kb-retry-btn'))
    }
    await boot('piano')
    assert.equal(await page.locator('.kb-top-bar').evaluate(el => getComputedStyle(el).display), 'flex')
    assert.equal(await page.locator('#outside').evaluate(el => getComputedStyle(el).display), 'block')
    assert.ok(await page.evaluate(async () => (await document.fonts.load('600 20px "Keyboard Poppins"')).length > 0))
    await page.keyboard.down('a')
    await page.waitForFunction(() => window.startedSamples === 3)
    assert.equal(await page.locator('.kb-chord-badge').count(), 3)
    await page.keyboard.up('a')
    assert.equal(await page.locator('.kb-chord-badge').count(), 0)
    const piano = [...fetched].filter(url => url.includes('/piano/')).length
    assert.ok(piano >= 15)

    await boot('drums')
    assert.equal(await page.locator('.kb-key').count(), 25)
    assert.equal(await page.getByRole('button', { name: 'Chord' }).isDisabled(), true)
    assert.equal(await page.locator('[data-midi="35"]').textContent(), 'Kick')
    await page.locator('[data-midi="37"]').click({ position: { x: 3, y: 10 } })
    await page.waitForFunction(() => window.startedSamples === 1)
    await page.locator('[data-midi="39"]').click({ position: { x: 3, y: 10 } })
    assert.equal(await page.evaluate(() => window.startedSamples), 1)
    const drums = [...fetched].filter(url => url.includes('/drums/')).length
    assert.ok(drums >= 10)
    assert.deepEqual(errors, [])
    console.log(`Chromium smoke OK (React 19, ${piano} piano files, ${drums} drum files, clean console)`)
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}
