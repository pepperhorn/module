#!/usr/bin/env node
// Vendor smplr CDN samples into /public/smplr-samples/.
//
// Usage:
//   node scripts/vendor-samples.mjs <preset>...
//
// Presets:
//   ep:cp80              ElectricPiano CP80 (SFZ + samples)
//   ep:pianett           ElectricPiano PianetT
//   ep:wurli             ElectricPiano WurlitzerEP200
//   ep:tx81z             ElectricPiano TX81Z (VCSL)
//   ep:all               All four electric pianos
//   piano:splendid       Splendid Grand Piano (large)
//   gm:<instrument>      One Soundfont instrument (e.g. gm:acoustic_grand_piano)
//   gm:keys              All GM keyboard family (acoustic, electric, organ, harpsichord)
//   gm:bass              All GM bass instruments
//   gm:all               All 128 GM instruments (~250MB)
//   smolken:arco         Smolken double bass (Arco mode)
//
// Files are saved under /public/smplr-samples/<host>/<original-path>.
// The local-first storage in src/audio/loggedStorage.ts auto-reads from there.

import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const VENDOR_DIR = resolve(ROOT, 'public/smplr-samples')

const HOST_DIRS = {
  'smpldsnds.github.io': 'smpldsnds',
  'gleitz.github.io': 'gleitz',
  'goldst.dev': 'goldst',
}

function localPathFor(url) {
  const u = new URL(url)
  const dir = HOST_DIRS[u.host]
  if (!dir) return null
  return resolve(VENDOR_DIR, dir, u.pathname.replace(/^\//, ''))
}

async function fileExists(path) {
  try {
    const s = await stat(path)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

let downloaded = 0
let skipped = 0
let failed = 0
const failedUrls = []

async function downloadOne(url, { binary = true, force = false } = {}) {
  const local = localPathFor(url)
  if (!local) {
    console.warn(`  ✗ no host mapping: ${url}`)
    failed += 1
    failedUrls.push(url)
    return null
  }
  if (!force && (await fileExists(local))) {
    skipped += 1
    return null
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ✗ ${res.status} ${url}`)
      failed += 1
      failedUrls.push(`${res.status} ${url}`)
      return null
    }
    await mkdir(dirname(local), { recursive: true })
    if (binary) {
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(local, buf)
    } else {
      const text = await res.text()
      await writeFile(local, text, 'utf8')
    }
    downloaded += 1
    return local
  } catch (err) {
    console.warn(`  ✗ THREW ${url} — ${err.message}`)
    failed += 1
    failedUrls.push(`THREW ${url}`)
    return null
  }
}

async function downloadMany(urls, opts) {
  // Limit concurrency so we don't get rate-limited
  const CONC = 8
  let i = 0
  const workers = Array.from({ length: CONC }, async () => {
    while (i < urls.length) {
      const idx = i++
      await downloadOne(urls[idx], opts)
      if ((downloaded + skipped + failed) % 25 === 0) {
        process.stdout.write(
          `\r    progress: ${downloaded} new · ${skipped} cached · ${failed} failed`,
        )
      }
    }
  })
  await Promise.all(workers)
  process.stdout.write('\n')
}

// ─── SFZ parsing ───────────────────────────────────────────────────────────

function parseSfzSamples(sfzText) {
  const resolved = resolveDefines(sfzText)
  const samples = []
  // Sample paths can contain spaces (e.g. "TX81Z/FM Piano/FMPiano_C0_vl1.wav").
  // Capture from `sample=` until (a) next opcode `key=` on the same line,
  // (b) a `<section>` marker, or (c) end of line.
  const re = /\bsample=(.+?)(?=(?:\s+[a-zA-Z_]+=)|\s*<|\r?\n|$)/g
  let m
  while ((m = re.exec(resolved)) !== null) {
    samples.push(m[1].trim())
  }
  return samples
}

function resolveDefines(sfz) {
  const defines = {}
  const lines = sfz.split('\n')
  const out = []
  for (const line of lines) {
    const match = line.trim().match(/^#define\s+(\$\w+)\s+(.+)$/)
    if (match) {
      defines[match[1]] = match[2].trim()
    } else {
      out.push(line)
    }
  }
  let result = out.join('\n')
  for (const [k, v] of Object.entries(defines)) {
    result = result.split(k).join(v)
  }
  return result
}

// ─── Smplr instrument source URL builders ──────────────────────────────────

const GS_BASE = 'https://smpldsnds.github.io/sfzinstruments-greg-sullivan-e-pianos'
const VCSL_BASE = 'https://smpldsnds.github.io/sgossner-vcsl'
const SPLENDID_BASE = 'https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano'
const SMOLKEN_BASE = 'https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass'
const MELLOTRON_BASE = 'https://smpldsnds.github.io/archiveorg-mellotron'
const SOUNDFONT_BASE = 'https://gleitz.github.io/midi-js-soundfonts'

const ELECTRIC_PIANOS = {
  'ep:cp80': {
    sfzUrl: `${GS_BASE}/cp80/CP80.sfz`,
    baseUrl: `${GS_BASE}/cp80`,
    samplesPrefix: 'samples',
  },
  'ep:pianett': {
    sfzUrl: `${GS_BASE}/planet-t/Pianet T.sfz`,
    baseUrl: `${GS_BASE}/planet-t`,
    samplesPrefix: 'samples',
  },
  'ep:wurli': {
    sfzUrl: `${GS_BASE}/wurlitzer-ep200/Wurlitzer EP200.sfz`,
    baseUrl: `${GS_BASE}/wurlitzer-ep200`,
    samplesPrefix: 'samples',
  },
  'ep:tx81z': {
    sfzUrl: `${VCSL_BASE}/Electrophones/TX81Z - FM Piano.sfz`,
    baseUrl: `${VCSL_BASE}/Electrophones`,
    samplesPrefix: '',
  },
}

async function vendorSfzInstrument(label, { sfzUrl, baseUrl, samplesPrefix }) {
  console.log(`\n[${label}] SFZ ${sfzUrl}`)
  await downloadOne(sfzUrl, { binary: false })
  const localSfz = localPathFor(sfzUrl)
  let sfzText
  try {
    const fs = await import('node:fs/promises')
    sfzText = await fs.readFile(localSfz, 'utf8')
  } catch {
    console.warn(`  ✗ could not read SFZ at ${localSfz}, skipping samples`)
    return
  }
  const sampleNames = parseSfzSamples(sfzText)
  console.log(`  ${sampleNames.length} sample regions in SFZ`)

  // smplr's `pathFromSampleName` strips the extension and prepends "samples/" (gsPath)
  // or just strips the extension (vcslPath). Then appends the format extension (ogg).
  const sampleUrls = []
  const seen = new Set()
  for (const raw of sampleNames) {
    const stripped = raw.replace(/\.\w+$/, '')
    const base = samplesPrefix ? `${samplesPrefix}/${stripped}` : stripped
    for (const ext of ['ogg', 'm4a']) {
      const url = `${baseUrl}/${base}.${ext}`.replace(/ /g, '%20').replace(/#/g, '%23')
      if (seen.has(url)) continue
      seen.add(url)
      sampleUrls.push(url)
    }
  }
  console.log(`  ${sampleUrls.length} candidate sample URLs (ogg+m4a)`)
  await downloadMany(sampleUrls, { binary: true })
}

const SOUNDFONT_INSTRUMENTS = [
  'accordion', 'acoustic_bass', 'acoustic_grand_piano', 'acoustic_guitar_nylon',
  'acoustic_guitar_steel', 'agogo', 'alto_sax', 'applause', 'bagpipe', 'banjo',
  'baritone_sax', 'bassoon', 'bird_tweet', 'blown_bottle', 'brass_section',
  'breath_noise', 'bright_acoustic_piano', 'celesta', 'cello', 'choir_aahs',
  'church_organ', 'clarinet', 'clavinet', 'contrabass', 'distortion_guitar',
  'drawbar_organ', 'dulcimer', 'electric_bass_finger', 'electric_bass_pick',
  'electric_grand_piano', 'electric_guitar_clean', 'electric_guitar_jazz',
  'electric_guitar_muted', 'electric_piano_1', 'electric_piano_2',
  'english_horn', 'fiddle', 'flute', 'french_horn', 'fretless_bass',
  'fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere',
  'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi',
  'glockenspiel', 'guitar_fret_noise', 'guitar_harmonics', 'gunshot',
  'harmonica', 'harpsichord', 'helicopter', 'honkytonk_piano', 'kalimba',
  'koto', 'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff',
  'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead',
  'marimba', 'melodic_tom', 'music_box', 'muted_trumpet', 'oboe', 'ocarina',
  'orchestra_hit', 'orchestral_harp', 'overdriven_guitar', 'pad_1_new_age',
  'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir', 'pad_5_bowed', 'pad_6_metallic',
  'pad_7_halo', 'pad_8_sweep', 'pan_flute', 'percussive_organ', 'piccolo',
  'pizzicato_strings', 'recorder', 'reed_organ', 'reverse_cymbal', 'rock_organ',
  'seashore', 'shakuhachi', 'shamisen', 'shanai', 'sitar', 'slap_bass_1',
  'slap_bass_2', 'soprano_sax', 'steel_drums', 'string_ensemble_1',
  'string_ensemble_2', 'synth_bass_1', 'synth_bass_2', 'synth_brass_1',
  'synth_brass_2', 'synth_choir', 'synth_drum', 'synth_strings_1',
  'synth_strings_2', 'taiko_drum', 'tango_accordion', 'telephone_ring',
  'tenor_sax', 'timpani', 'tinkle_bell', 'tremolo_strings', 'trombone',
  'trumpet', 'tuba', 'tubular_bells', 'vibraphone', 'viola', 'violin',
  'voice_oohs', 'whistle', 'woodblock', 'xylophone',
]

const GM_GROUPS = {
  'gm:keys': [
    'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano',
    'honkytonk_piano', 'electric_piano_1', 'electric_piano_2', 'harpsichord',
    'clavinet', 'celesta', 'music_box', 'drawbar_organ', 'percussive_organ',
    'rock_organ', 'church_organ', 'reed_organ', 'accordion', 'tango_accordion',
  ],
  'gm:bass': [
    'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick',
    'fretless_bass', 'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2',
  ],
  'gm:strings': [
    'violin', 'viola', 'cello', 'contrabass', 'tremolo_strings',
    'pizzicato_strings', 'orchestral_harp', 'string_ensemble_1',
    'string_ensemble_2', 'synth_strings_1', 'synth_strings_2',
  ],
  'gm:brass': [
    'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn',
    'brass_section', 'synth_brass_1', 'synth_brass_2',
    'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
  ],
  'gm:guitar': [
    'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz',
    'electric_guitar_clean', 'electric_guitar_muted', 'overdriven_guitar',
    'distortion_guitar', 'guitar_harmonics',
  ],
}

async function vendorSoundfont(instrument, kit = 'MusyngKite') {
  const url = `${SOUNDFONT_BASE}/${kit}/${instrument}-ogg.js`
  console.log(`\n[gm:${instrument}] ${url}`)
  await downloadOne(url, { binary: false })
}

async function vendorSplendidGrand() {
  console.log('\n[piano:splendid] enumerating samples from smplr LAYERS export')
  const { LAYERS } = await import('smplr')
  const sampleUrls = new Set()
  for (const layer of LAYERS) {
    for (const [, sampleName] of layer.samples) {
      // splendid-grand uses .ogg extension on a CDN with structure /samples/<name>.ogg
      for (const ext of ['ogg', 'm4a']) {
        sampleUrls.add(`${SPLENDID_BASE}/samples/${sampleName}.${ext}`)
      }
    }
  }
  console.log(`  ${sampleUrls.size} candidate sample URLs`)
  await downloadMany([...sampleUrls], { binary: true })
}

async function vendorSmolken(mode = 'Arco') {
  // Smolken uses an SFZ + many samples. Pull the SFZ first.
  const sfzUrl = `${SMOLKEN_BASE}/Smolken DoubleBass ${mode}.sfz`
  console.log(`\n[smolken:${mode}] SFZ ${sfzUrl}`)
  await downloadOne(sfzUrl, { binary: false })
  const localSfz = localPathFor(sfzUrl)
  try {
    const fs = await import('node:fs/promises')
    const sfz = await fs.readFile(localSfz, 'utf8')
    const samples = parseSfzSamples(sfz)
    console.log(`  ${samples.length} sample regions in SFZ`)
    const seen = new Set()
    const urls = []
    for (const raw of samples) {
      const stripped = raw.replace(/\.\w+$/, '')
      for (const ext of ['ogg', 'm4a']) {
        const url = `${SMOLKEN_BASE}/${stripped}.${ext}`
          .replace(/ /g, '%20')
          .replace(/#/g, '%23')
        if (seen.has(url)) continue
        seen.add(url)
        urls.push(url)
      }
    }
    await downloadMany(urls, { binary: true })
  } catch (err) {
    console.warn(`  ✗ smolken SFZ failed: ${err.message}`)
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: node scripts/vendor-samples.mjs <preset>...')
    console.error('Try: ep:cp80 ep:all gm:keys gm:acoustic_grand_piano piano:splendid')
    process.exit(1)
  }

  const expanded = []
  for (const arg of args) {
    if (arg === 'ep:all') {
      expanded.push('ep:cp80', 'ep:pianett', 'ep:wurli', 'ep:tx81z')
    } else if (arg === 'gm:all') {
      for (const i of SOUNDFONT_INSTRUMENTS) expanded.push(`gm:${i}`)
    } else if (GM_GROUPS[arg]) {
      for (const i of GM_GROUPS[arg]) expanded.push(`gm:${i}`)
    } else {
      expanded.push(arg)
    }
  }

  console.log(`Vendoring ${expanded.length} preset(s) → ${VENDOR_DIR}`)

  for (const preset of expanded) {
    if (preset.startsWith('ep:')) {
      const def = ELECTRIC_PIANOS[preset]
      if (!def) {
        console.warn(`unknown EP preset: ${preset}`)
        continue
      }
      await vendorSfzInstrument(preset, def)
    } else if (preset.startsWith('gm:')) {
      const instrument = preset.slice(3)
      if (!SOUNDFONT_INSTRUMENTS.includes(instrument)) {
        console.warn(`unknown GM instrument: ${instrument}`)
        continue
      }
      await vendorSoundfont(instrument)
    } else if (preset === 'piano:splendid') {
      await vendorSplendidGrand()
    } else if (preset.startsWith('smolken:')) {
      await vendorSmolken(preset.slice('smolken:'.length))
    } else {
      console.warn(`unknown preset: ${preset}`)
    }
  }

  console.log('\n────────────────────────────────────────')
  console.log(`Done.  ${downloaded} downloaded · ${skipped} cached · ${failed} failed`)
  if (failedUrls.length > 0) {
    console.log('\nFailed URLs:')
    for (const u of failedUrls.slice(0, 30)) console.log(`  ${u}`)
    if (failedUrls.length > 30) console.log(`  ...and ${failedUrls.length - 30} more`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
