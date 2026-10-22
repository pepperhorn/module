import { TouchKeyboard } from './TouchKeyboard'
import { useActiveNotes } from '../state/activeNotes'

/**
 * The on-screen keyboard wired to the live active-note set. Kept as its own
 * component so only the keyboard re-renders per note.
 */
export function LiveTouchKeyboard(props: {
  noteOn: (midi: number, vel: number) => void
  noteOff: (midi: number) => void
  fill?: boolean
  keyLabels?: boolean
  octaves?: number
}) {
  const activeNotes = useActiveNotes()
  return <TouchKeyboard {...props} activeNotes={activeNotes} />
}
