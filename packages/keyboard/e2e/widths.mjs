import assert from 'node:assert/strict'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : 'playwright-core')
const output = process.env.KEYBOARD_WIDTH_SCREENSHOTS ?? await mkdtemp(join(tmpdir(), 'keyboard-widths-'))
await mkdir(output, { recursive: true })
const origin = 'http://localhost:5215'
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '0.0.0.0', port: 5215, strictPort: true },
  optimizeDeps: { entries: ['e2e/widths.html'], include: ['react/jsx-dev-runtime'] },
})

async function checkWidth(page, keyboard, width, state) {
  const sizes = await page.evaluate(() => {
    const root = document.querySelector('.kb-root')
    const drawer = root.querySelector('.kb-drawer-sounds')
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      keyboard: root.clientWidth,
      keyboardContents: root.scrollWidth,
      drawer: drawer?.clientWidth,
      drawerContents: drawer?.scrollWidth,
    }
  })
  assert.equal(sizes.viewport, width)
  assert.equal(sizes.keyboard, width)
  assert.equal(sizes.document, width, `${state}: page overflows`)
  assert.equal(sizes.keyboardContents, width, `${state}: keyboard overflows`)
  assert.equal(sizes.drawerContents, sizes.drawer, `${state}: catalog overflows`)
  if (state !== 'closed') await keyboard.screenshot({ path: join(output, `${width}-${state}.png`) })
}

async function checkControls(controls, width) {
  for (const control of await controls.all()) {
    // Trial clicks check the hit target, including after a vertical scroll.
    await control.click({ trial: true })
    const box = await control.boundingBox()
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 0.5, 'control is clipped')
  }
}

try {
  await server.listen()
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined })
  try {
    for (const width of [360, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } })
      const errors = []
      page.on('pageerror', error => errors.push(String(error)))
      page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) errors.push(message.text())
      })
      await page.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort())
      await page.addInitScript(() => {
        const input = Object.assign(new EventTarget(), {
          id: 'fixture-input', name: 'Example MIDI keyboard', state: 'connected',
        })
        const access = Object.assign(new EventTarget(), { inputs: new Map([[input.id, input]]) })
        Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => access })
        window.note = velocity => input.dispatchEvent(Object.assign(new Event('midimessage'), {
          data: Uint8Array.of(0x90, 48, velocity),
        }))
        window.startedSamples = 0
        const start = AudioBufferSourceNode.prototype.start
        AudioBufferSourceNode.prototype.start = function (...args) {
          window.startedSamples++
          return start.apply(this, args)
        }
      })

      await page.goto(`${origin}/e2e/widths.html`)
      const keyboard = page.getByRole('group', { name: 'Keyboard', exact: true })
      await keyboard.getByRole('button', { name: 'Enable audio' }).click()
      await page.waitForFunction(() => !document.querySelector('.kb-loading, .kb-power-overlay, .kb-retry-btn'))
      await page.evaluate(() => document.fonts.ready)
      const bar = keyboard.locator('.kb-top-bar')
      assert.equal(await bar.getByRole('button').count(), 11, 'all chord-mode bar controls are present')
      await checkControls(bar.getByRole('button'), width)
      await checkWidth(page, keyboard, width, 'closed')

      const soundsTrigger = bar.getByRole('button', { name: /♪/ })
      await soundsTrigger.click()
      const sounds = keyboard.getByRole('region', { name: 'Sounds' })
      assert.deepEqual(await sounds.getByRole('button').allTextContents().then(names => names.slice(0, 2)), ['Piano', 'Drums'])
      for (const group of await sounds.getByRole('group').all()) {
        const patches = group.getByRole('button')
        await checkControls(patches.first().or(patches.last()), width)
      }
      await sounds.locator('.kb-drawer-sounds').evaluate(el => { el.scrollTop = 0 })
      await checkWidth(page, keyboard, width, 'sounds')
      await sounds.getByRole('button', { name: 'Drums', exact: true }).click()
      assert.equal(await sounds.count(), 0)
      assert.match(await soundsTrigger.innerText(), /Drums/)
      await soundsTrigger.click()
      await sounds.getByRole('button', { name: 'Piano', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('.kb-loading, .kb-retry-btn'))

      const gear = bar.getByRole('button', { name: 'Effects and settings' })
      await gear.click()
      const effects = keyboard.getByRole('region', { name: 'Effects' })
      await checkControls(effects.getByRole('button').or(effects.getByRole('slider')), width)
      await effects.getByRole('button', { name: 'Reverb' }).click()
      const reverb = effects.getByRole('slider', { name: 'Reverb amount' })
      await reverb.press('Home')
      for (let i = 0; i < 3; i++) await reverb.press('PageUp')
      assert.equal(await reverb.getAttribute('aria-valuetext'), '30%')
      await checkWidth(page, keyboard, width, 'effects')

      await effects.getByRole('button', { name: 'Settings' }).click()
      const settings = keyboard.getByRole('region', { name: 'Settings' })
      await checkControls(settings.getByRole('button').or(settings.getByRole('slider')).or(settings.getByRole('combobox')), width)
      await settings.getByRole('combobox', { name: 'MIDI input' }).selectOption('fixture-input')
      await checkWidth(page, keyboard, width, 'settings')
      await page.keyboard.press('Escape')
      assert.equal(await settings.count(), 0)
      assert.equal(await gear.getAttribute('aria-expanded'), 'false')
      await page.evaluate(() => window.note(96))
      await page.waitForFunction(() => window.startedSamples === 3)
      assert.equal(await keyboard.locator('.kb-chord-badge').count(), 3)
      await page.evaluate(() => window.note(0))
      assert.equal(await keyboard.locator('.kb-chord-badge').count(), 0)
      await soundsTrigger.click()
      await page.locator('#outside').click()
      assert.equal(await sounds.count(), 0)
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`${width}px: no horizontal scroll, bar and all drawers reachable, simulated MIDI plays a chord`)
    }
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}
console.log(`Width screenshots: ${output}`)
