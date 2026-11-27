import type { PatchManifest } from '../../../../src/patches/types'
import drumKit from '../../assets/drums/kit.json'
import pianoNotes from '../../assets/piano/notes.json'
import { DRUM_MAP } from './drumMap'

export const PIANO_ID = 'kb/piano'
export const DRUMS_ID = 'kb/drums'

// T1 adds these optional fields to the shared sampler source in a separate PR.
type BundledSamplerSource = Extract<PatchManifest['source'], { kind: 'sampler' }> & {
  formats: string[]
  exactOnly?: boolean
  oneShot?: boolean
}

const pitchClasses = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const drumFiles: Record<string, { file: string }> = drumKit.samples

export function bundledPatches(assetBase: URL | string): PatchManifest[] {
  const base = assetBase.toString().replace(/\/?$/, '/')
  const pianoSource: BundledSamplerSource = {
    kind: 'sampler',
    baseUrl: base + 'piano/',
    samples: Object.fromEntries(pianoNotes.map(note => [note, note + '.ogg'])),
    formats: ['ogg', 'm4a'],
  }
  const drumSource: BundledSamplerSource = {
    kind: 'sampler',
    baseUrl: base + 'drums/',
    samples: Object.fromEntries(DRUM_MAP.map(({ midi, sample }) => {
      const note = pitchClasses[midi % 12] + (Math.floor(midi / 12) - 1)
      return [note, drumFiles[sample].file]
    })),
    formats: ['ogg'],
    exactOnly: true,
    oneShot: true,
  }

  return [
    { id: PIANO_ID, name: 'Piano', category: 'Piano', bank: 'PNO', color: 'amber', source: pianoSource },
    { id: DRUMS_ID, name: 'Drums', category: 'Drums', bank: 'CST', color: 'coral', source: drumSource },
  ]
}
