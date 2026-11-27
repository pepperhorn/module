import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceUrl = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js'
const sourceHash = '00eebe0214c12ff8f32c47c2f7ac92ef352800e868ab0f883b80854486ac4ca6'
const output = fileURLToPath(new URL('../assets/piano/', import.meta.url))
const budget = 500_000
const formats = {
  ogg: ['-c:a', 'libvorbis', '-q:a', '3'],
  m4a: ['-c:a', 'aac', '-b:a', '96k'],
}
// Four-semitone spacing keeps the nearest sample within two semitones of each key in C2–C7.
const notes = [...[2, 3, 4, 5, 6].flatMap(octave => ['C', 'E', 'Ab'].map(pitch => pitch + octave)), 'C7']
const noteIndex = JSON.stringify(notes, null, 2) + '\n'

async function check(directory) {
  const files = await readdir(directory)
  const oversized = []
  for (const ext of Object.keys(formats)) {
    const actual = files.filter(file => file.endsWith('.' + ext))
    const expected = notes.map(note => note + '.' + ext)
    if (actual.length !== expected.length || expected.some(file => !actual.includes(file))) {
      throw new Error(`Expected exactly ${notes.length} .${ext} piano samples for C2–C7`)
    }

    const bytes = expected.reduce((total, file) => {
      const info = statSync(join(directory, file))
      if (!info.isFile() || info.size === 0) throw new Error(`Invalid piano sample: ${file}`)
      return total + info.size
    }, 0)
    console.log(`Piano .${ext}: ${expected.length} samples, ${bytes} bytes (budget ${budget})`)
    if (bytes > budget) oversized.push('.' + ext)
  }
  if (oversized.length) throw new Error(`Piano ${oversized.join(', ')} exceeds its per-format budget`)
  if (await readFile(join(directory, 'notes.json'), 'utf8') !== noteIndex) {
    throw new Error('Piano notes.json does not match the sample set')
  }
}

function runFfmpeg(args, input) {
  const result = spawnSync('ffmpeg', args, { input, stdio: ['pipe', 'ignore', 'inherit'] })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status ?? result.signal})`)
}

async function build() {
  runFfmpeg(['-version'])
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Could not download the piano soundfont: HTTP ${response.status}`)
  const soundfont = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(soundfont).digest('hex') !== sourceHash) {
    throw new Error('Piano soundfont checksum changed')
  }

  // Parse the note map without executing the downloaded script.
  const match = soundfont.toString('utf8').match(/MIDI\.Soundfont\.acoustic_grand_piano\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
  if (!match) throw new Error('Could not find the piano note map')
  const samples = JSON.parse(match[1].replace(/,\s*}$/, '}'))

  const temporary = await mkdtemp(join(tmpdir(), 'keyboard-piano-'))
  try {
    for (const note of notes) {
      const mp3 = samples[note]?.match(/^data:audio\/mp3;base64,([A-Za-z0-9+/=]+)$/)?.[1]
      if (!mp3) throw new Error(`Missing MP3 data for ${note}`)
      for (const [ext, codec] of Object.entries(formats)) {
        // Trim long tails with a short fade to fit both per-format budgets.
        runFfmpeg([
          '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-map_metadata', '-1',
          '-af', 'afade=t=out:st=2.25:d=0.15', '-t', '2.4', ...codec,
          '-fflags', '+bitexact', '-flags:a', '+bitexact', join(temporary, note + '.' + ext),
        ], Buffer.from(mp3, 'base64'))
      }
    }
    await writeFile(join(temporary, 'notes.json'), noteIndex)
    await check(temporary)
    if (existsSync(output)) {
      for (const file of await readdir(output)) {
        if (/^[A-G]b?\d+\.(ogg|m4a)$/.test(file) && !notes.includes(file.split('.')[0])) {
          await rm(join(output, file))
        }
      }
    }
    await cp(temporary, output, { recursive: true })
  } finally {
    await rm(temporary, { recursive: true })
  }
}

const args = process.argv.slice(2)
if (args.length === 0) await build()
else if (args.length === 1 && args[0] === '--check') await check(output)
else throw new Error('Usage: node packages/keyboard/scripts/build-piano.mjs [--check]')
