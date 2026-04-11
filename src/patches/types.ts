export type VelocityTag = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'default'

export type SampleEntry =
  | string
  | string[]
  | Partial<Record<VelocityTag, string | string[]>>

export type SoundfontKit = 'MusyngKite' | 'FluidR3_GM'

export type PatchSource =
  | { kind: 'soundfont'; instrument: string; kit?: SoundfontKit }
  | { kind: 'piano' }
  | { kind: 'electric-piano'; instrument: 'CP80' | 'PianetT' | 'WurlitzerEP200' | 'TX81Z' }
  | { kind: 'mallet'; instrument: string }
  | { kind: 'mellotron'; instrument: string }
  | { kind: 'smolken'; instrument: 'Arco' | 'Pizzicato' | 'Switched' }
  | { kind: 'sampler'; baseUrl: string; samples: Record<string, SampleEntry> }

export type Bank =
  | 'GM'
  | 'PNO'
  | 'EP'
  | 'MAL'
  | 'MEL'
  | 'BAS'
  | 'CST'
  | 'USR'

export interface PatchManifest {
  id: string
  name: string
  category: string
  bank: Bank
  color: PatchColor
  description?: string
  defaultOctave?: number
  source: PatchSource
}

export type PatchColor =
  | 'coral'
  | 'amber'
  | 'lime'
  | 'sky'
  | 'lavender'
  | 'peach'
  | 'mint'
  | 'rose'

export const BANK_LABELS: Record<Bank, string> = {
  USR: 'My Patches',
  GM: 'GM Soundfont',
  PNO: 'Grand Piano',
  EP: 'Electric Piano',
  MAL: 'Mallet',
  MEL: 'Mellotron',
  BAS: 'Bass',
  CST: 'Custom',
}

export const BANK_ORDER: Bank[] = ['USR', 'GM', 'PNO', 'EP', 'MAL', 'MEL', 'BAS', 'CST']

// A user-saved snapshot: a base patch + the FX chain state at save time.
// User patches are persisted in localStorage and merged into the picker
// catalog under the USR bank. They reuse the base patch's audio source so
// they share the engine's in-memory instrument cache.
export interface UserPatch {
  id: string
  name: string
  basePatchId: string
  color: PatchColor
  fxEnabled: Record<string, boolean>
  fxParams: Record<string, Record<string, number>>
  createdAt: number
}
