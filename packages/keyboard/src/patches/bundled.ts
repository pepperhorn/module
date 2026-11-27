import type { PatchManifest, PatchSource } from '../../../../src/patches/types'
import drumKit from '../../assets/drums/kit.json'
import pianoNotes from '../../assets/piano/notes.json'
import { assetUrls } from './assetUrls.generated.js'
import { DRUM_MAP } from './drumMap'

export const PIANO_ID = 'kb/piano'
export const DRUMS_ID = 'kb/drums'

type SamplerSource = Extract<PatchSource, { kind: 'sampler' }>

const pitchClasses = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const drumFiles: Record<string, { file: string }> = drumKit.samples
const sampleUrls: Readonly<Record<string, () => string>> = assetUrls

const codecs: Readonly<Record<string, string>> = {
  ogg: 'audio/ogg; codecs="vorbis"',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
}

function pickFormat(formats: string[]): string {
  const audio = typeof Audio === 'undefined' ? undefined : new Audio()
  return formats.find(format => audio?.canPlayType(codecs[format])) ?? formats[0]
}

function sampler(
  id: string,
  dir: string,
  notes: Iterable<[string, string]>,
  formats: string[],
  assetBase?: URL | string,
): SamplerSource {
  if (assetBase !== undefined) {
    return {
      kind: 'sampler',
      baseUrl: assetBase.toString().replace(/\/?$/, '/') + dir + '/',
      samples: Object.fromEntries(notes),
      formats,
    }
  }
  const format = pickFormat(formats)
  return {
    kind: 'sampler',
    // Absolute sample URLs bypass baseUrl, which still keys the engine cache.
    baseUrl: id + '/' + format,
    samples: Object.fromEntries(Array.from(notes, ([note, file]) => [
      note, sampleUrls[dir + '/' + file.replace(/\.[^.]+$/, '.' + format)](),
    ])),
  }
}

export function bundledPatches(assetBase: URL | string): PatchManifest[]
export function bundledPatches(): PatchManifest[]
export function bundledPatches(assetBase?: URL | string): PatchManifest[] {
  const piano = sampler(PIANO_ID, 'piano', pianoNotes.map(note => [note, note + '.ogg']), ['ogg', 'm4a'], assetBase)
  const drumNotes = DRUM_MAP.map(({ midi, sample }): [string, string] => [
    pitchClasses[midi % 12] + (Math.floor(midi / 12) - 1), drumFiles[sample].file,
  ])
  const drums = sampler(DRUMS_ID, 'drums', drumNotes, drumKit.formats, assetBase)
  return [
    { id: PIANO_ID, name: 'Piano', category: 'Piano', bank: 'PNO', color: 'amber', source: piano },
    { id: DRUMS_ID, name: 'Drums', category: 'Drums', bank: 'CST', color: 'coral', source: { ...drums, exactOnly: true, oneShot: true } },
  ]
}
