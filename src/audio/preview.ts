// The audition a library card plays. Kept free of AudioContext so the timing
// can be unit-tested directly.
import type { PatchManifest } from '../patches/types'

export interface PreviewEvent {
  notes: number[]
  /** Milliseconds after the audition starts. */
  at: number
  /** Milliseconds to hold before releasing. */
  hold: number
}

const STEP_MS = 165
/** C–D–E–F–G, as semitone offsets from the root. */
const RUN = [0, 2, 4, 5, 7]
const RUN_HOLD_MS = 420
const CHORD_GAP_MS = 90
const CHORD_HOLD_MS = 1100

/** A C–G run followed by a C major triad. */
export function previewSequence(rootMidi: number): PreviewEvent[] {
  const events: PreviewEvent[] = RUN.map((semitone, i) => ({
    notes: [rootMidi + semitone],
    at: i * STEP_MS,
    hold: RUN_HOLD_MS,
  }))
  events.push({
    notes: [rootMidi, rootMidi + 4, rootMidi + 7],
    at: RUN.length * STEP_MS + CHORD_GAP_MS,
    hold: CHORD_HOLD_MS,
  })
  return events
}

export function previewDurationMs(events: PreviewEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.at + e.hold), 0)
}

/**
 * C in the patch's own preferred octave, clamped to a range every sample set
 * can reach — a bass patch auditioned at C4 would be out of its sampled range.
 */
export function previewRootMidi(patch: Pick<PatchManifest, 'defaultOctave'>): number {
  const octave = patch.defaultOctave ?? 4
  return Math.max(24, Math.min(96, (octave + 1) * 12))
}
