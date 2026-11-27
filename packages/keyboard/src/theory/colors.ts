const CRF_COLORS = [
  '#f86e6e', // C
  '#f58841', // C♯/D♭
  '#ffbc57', // D
  '#b8a334', // D♯/E♭
  '#fff56d', // E
  '#b3f888', // F
  '#93d154', // F♯/G♭
  '#6bc6a0', // G
  '#7ee8df', // G♯/A♭
  '#88a7f8', // A
  '#cc97e8', // A♯/B♭
  '#e277b1', // B
] as const

export function noteColor(midi: number): string {
  return CRF_COLORS[((midi % 12) + 12) % 12]
}
