export type ChordType = 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7'

export type Accidentals = 'flat' | 'sharp'

export const CHORD_TYPES: readonly ChordType[] = ['maj', 'min', 'dim', 'aug', '7', 'maj7']

export const CHORD_INTERVALS: Record<ChordType, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
}

export function chordNotes(root: number, type: ChordType): number[] {
  return CHORD_INTERVALS[type].map((i) => root + i).filter((m) => m >= 0 && m <= 127)
}
