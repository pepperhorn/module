import {
  getSoundfontNames,
  getElectricPianoNames,
  getMalletNames,
  getMellotronNames,
  getSmolkenNames,
} from 'smplr'
import type { PatchManifest, PatchColor } from './types'

interface CategoryHit {
  category: string
  color: PatchColor
}

function prettify(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bFx\b/g, 'FX')
    .replace(/\bGm\b/g, 'GM')
}

function categoriseGM(name: string): CategoryHit {
  const n = name.toLowerCase()
  if (/piano|harpsichord|clavinet|honkytonk|electric_piano|celesta|music_box/.test(n))
    return { category: 'Keys', color: 'amber' }
  if (/organ/.test(n)) return { category: 'Organ', color: 'lime' }
  if (/bass/.test(n)) return { category: 'Bass', color: 'coral' }
  if (/^lead_/.test(n)) return { category: 'Lead', color: 'rose' }
  if (/^pad_/.test(n)) return { category: 'Pad', color: 'lavender' }
  if (/^fx_|seashore|bird|telephone|helicopter|gunshot|applause|breath_noise|reverse_cymbal/.test(n))
    return { category: 'FX', color: 'sky' }
  if (/string|violin|viola|cello|contrabass|harp|pizzicato|tremolo/.test(n))
    return { category: 'Strings', color: 'mint' }
  if (/trumpet|trombone|tuba|french_horn|brass|sax|english_horn|baritone/.test(n))
    return { category: 'Brass', color: 'amber' }
  if (/flute|piccolo|recorder|pan_flute|whistle|ocarina|shakuhachi|bagpipe|blown_bottle|oboe|clarinet|bassoon|harmonica/.test(n))
    return { category: 'Wind', color: 'sky' }
  if (/guitar/.test(n)) return { category: 'Guitar', color: 'peach' }
  if (/marimba|xylophone|vibraphone|glockenspiel|tubular|kalimba|steel_drums|timpani|melodic_tom|taiko|woodblock|tinkle_bell|agogo/.test(n))
    return { category: 'Mallet', color: 'mint' }
  if (/sitar|koto|banjo|shamisen|shanai|accordion|tango|dulcimer|fiddle/.test(n))
    return { category: 'World', color: 'rose' }
  if (/choir|voice/.test(n)) return { category: 'Vocal', color: 'lavender' }
  if (/synth_drum|orchestra_hit|drum/.test(n)) return { category: 'Perc', color: 'coral' }
  return { category: 'Misc', color: 'sky' }
}

function buildSoundfontPatches(): PatchManifest[] {
  return getSoundfontNames().map((instrument) => {
    const { category, color } = categoriseGM(instrument)
    return {
      id: `gm/${instrument}`,
      name: prettify(instrument),
      category,
      bank: 'GM',
      color,
      defaultOctave: 4,
      source: { kind: 'soundfont', instrument, kit: 'MusyngKite' },
    } satisfies PatchManifest
  })
}

function buildPianoPatches(): PatchManifest[] {
  return [
    {
      id: 'pno/splendid-grand',
      name: 'Splendid Grand',
      category: 'Acoustic Piano',
      bank: 'PNO',
      color: 'amber',
      defaultOctave: 4,
      source: { kind: 'piano' },
    },
  ]
}

function buildElectricPianoPatches(): PatchManifest[] {
  const labels: Record<string, string> = {
    CP80: 'CP80 Stage',
    PianetT: 'Pianet T',
    WurlitzerEP200: 'Wurli EP200',
    TX81Z: 'TX81Z FM',
  }
  return getElectricPianoNames().map((instrument) => ({
    id: `ep/${instrument.toLowerCase()}`,
    name: labels[instrument] ?? instrument,
    category: 'Electric Piano',
    bank: 'EP',
    color: 'peach',
    defaultOctave: 4,
    source: {
      kind: 'electric-piano',
      instrument: instrument as 'CP80' | 'PianetT' | 'WurlitzerEP200' | 'TX81Z',
    },
  }))
}

function buildMalletPatches(): PatchManifest[] {
  return getMalletNames().map((instrument) => ({
    id: `mal/${instrument.toLowerCase().replace(/[^\w]+/g, '-')}`,
    name: instrument,
    category: 'Mallet',
    bank: 'MAL',
    color: 'mint',
    defaultOctave: 5,
    source: { kind: 'mallet', instrument },
  }))
}

function buildMellotronPatches(): PatchManifest[] {
  return getMellotronNames().map((instrument) => ({
    id: `mel/${instrument.toLowerCase().replace(/[^\w]+/g, '-')}`,
    name: prettify(instrument.toLowerCase().replace(/\+/g, ' & ')),
    category: 'Mellotron',
    bank: 'MEL',
    color: 'lavender',
    defaultOctave: 4,
    source: { kind: 'mellotron', instrument },
  }))
}

function buildSmolkenPatches(): PatchManifest[] {
  return getSmolkenNames().map((instrument) => ({
    id: `bas/smolken-${instrument.toLowerCase()}`,
    name: `Double Bass · ${instrument}`,
    category: 'Acoustic Bass',
    bank: 'BAS',
    color: 'coral',
    defaultOctave: 2,
    source: { kind: 'smolken', instrument: instrument as 'Arco' | 'Pizzicato' | 'Switched' },
  }))
}

export function getBuiltinPatches(): PatchManifest[] {
  return [
    ...buildPianoPatches(),
    ...buildElectricPianoPatches(),
    ...buildSoundfontPatches(),
    ...buildMalletPatches(),
    ...buildMellotronPatches(),
    ...buildSmolkenPatches(),
  ]
}
