// Renders the app icons from public/favicon.svg into public/icons/.
// Run: node scripts/gen-icons.mjs
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'public', 'favicon.svg'))
const outDir = join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

const BG = '#0F1024' // app boot background, used behind the maskable safe area

async function render(size, name, { maskable = false } = {}) {
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: maskable ? BG : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  // For maskable, inset the glyph to ~80% so it survives platform masking.
  const glyph = maskable ? Math.round(size * 0.8) : size
  const resized = await sharp(svg).resize(glyph, glyph).png().toBuffer()
  const offset = Math.round((size - glyph) / 2)
  await canvas
    .composite([{ input: resized, top: offset, left: offset }])
    .png()
    .toFile(join(outDir, name))
  console.log('wrote', name)
}

await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-512-maskable.png', { maskable: true })
