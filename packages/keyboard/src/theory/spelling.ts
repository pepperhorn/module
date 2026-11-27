import { CHORD_INTERVALS, type Accidentals, type ChordType } from './chords'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]

const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

// Letter steps above the root's letter, by interval in semitones.
const LETTER_STEPS: Record<number, number> = {
  0: 0,
  3: 2,
  4: 2,
  6: 4,
  7: 4,
  8: 4,
  10: 6,
  11: 6,
}

export function pitchName(midi: number, acc: Accidentals): string {
  const pc = ((midi % 12) + 12) % 12
  return (acc === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pc]
}

export function spellChord(root: number, type: ChordType, acc: Accidentals): string[] {
  const rootLetter = LETTERS.indexOf(pitchName(root, acc)[0] as (typeof LETTERS)[number])
  const names: string[] = []
  for (const interval of CHORD_INTERVALS[type]) {
    const tone = root + interval
    if (tone < 0 || tone > 127) continue
    if (interval === 0) {
      names.push(pitchName(root, acc))
      continue
    }
    const letter = (rootLetter + LETTER_STEPS[interval]) % 7
    let diff = (tone - LETTER_PC[letter]) % 12
    if (diff > 6) diff -= 12
    if (diff < -6) diff += 12
    if (diff === 0) names.push(LETTERS[letter])
    else if (diff === 1) names.push(`${LETTERS[letter]}♯`)
    else if (diff === -1) names.push(`${LETTERS[letter]}♭`)
    else names.push(pitchName(tone, acc))
  }
  return names
}
