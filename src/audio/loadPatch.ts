import {
  Soundfont,
  SplendidGrandPiano,
  ElectricPiano,
  Mallet,
  Mellotron,
  Smolken,
} from 'smplr'
import type { PatchManifest } from '../patches/types'
import { CustomSampler } from './customSampler'

export interface LoadProgress {
  loaded: number
  total: number
}

export interface LoadedInstrument {
  start(event: { note: number | string; velocity?: number }): () => void
  stop(target?: number | string): void
  disconnect(): void
  load: Promise<unknown>
}

interface InstantiateOptions {
  context: AudioContext
  destination: AudioNode
  patch: PatchManifest
  onLoadProgress?: (progress: LoadProgress) => void
  storage?: { fetch: (url: string) => Promise<Response> }
}

export function instantiatePatch(opts: InstantiateOptions): LoadedInstrument {
  const { context, destination, patch, onLoadProgress, storage } = opts
  const src = patch.source
  // smplr's Storage type wraps fetch() — Response satisfies its StorageResponse shape
  const smplrStorage = storage as never
  switch (src.kind) {
    case 'piano':
      return new SplendidGrandPiano(context, {
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'soundfont':
      return new Soundfont(context, {
        instrument: src.instrument,
        kit: src.kit ?? 'MusyngKite',
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'electric-piano':
      return new ElectricPiano(context, {
        instrument: src.instrument,
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'mallet':
      return new Mallet(context, {
        instrument: src.instrument,
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'mellotron':
      return new Mellotron(context, {
        instrument: src.instrument,
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'smolken':
      return new Smolken(context, {
        instrument: src.instrument,
        destination,
        onLoadProgress,
        storage: smplrStorage,
      }) as unknown as LoadedInstrument
    case 'sampler':
      return new CustomSampler(context, {
        source: src,
        destination,
        onLoadProgress,
      }) as unknown as LoadedInstrument
  }
}
