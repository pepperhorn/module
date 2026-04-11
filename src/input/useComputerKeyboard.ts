import { useEffect, useRef } from 'react'
import { useStore } from '../state/useStore'

const KEY_TO_SEMITONE: Record<string, number> = {
  // lower row (white + sharps), starting at C
  a: 0, // C
  w: 1, // C#
  s: 2, // D
  e: 3, // D#
  d: 4, // E
  f: 5, // F
  t: 6, // F#
  g: 7, // G
  y: 8, // G#
  h: 9, // A
  u: 10, // A#
  j: 11, // B
  k: 12, // C+1
  o: 13, // C#+1
  l: 14, // D+1
  p: 15, // D#+1
  ';': 16, // E+1
  "'": 17, // F+1
}

interface KeyboardCallbacks {
  noteOn: (midi: number, velocity: number) => void
  noteOff: (midi: number) => void
  panic: () => void
}

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export function useComputerKeyboard(callbacks: KeyboardCallbacks): void {
  const heldRef = useRef<Set<string>>(new Set())
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (isTextTarget(e.target)) return
      const key = e.key
      if (key === 'Escape') {
        cbRef.current.panic()
        heldRef.current.clear()
        return
      }
      const lower = key.length === 1 ? key.toLowerCase() : key
      const state = useStore.getState()
      if (lower === 'z') {
        useStore.getState().shiftOctave(-1)
        return
      }
      if (lower === 'x') {
        useStore.getState().shiftOctave(1)
        return
      }
      if (lower === 'c') {
        useStore.getState().shiftVelocity(-12)
        return
      }
      if (lower === 'v') {
        useStore.getState().shiftVelocity(12)
        return
      }
      const semitone = KEY_TO_SEMITONE[lower]
      if (semitone == null) return
      if (heldRef.current.has(lower)) return
      heldRef.current.add(lower)
      const midi = state.octave * 12 + 12 + semitone
      cbRef.current.noteOn(midi, state.velocity)
      e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return
      const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const semitone = KEY_TO_SEMITONE[lower]
      if (semitone == null) return
      if (!heldRef.current.has(lower)) return
      heldRef.current.delete(lower)
      const state = useStore.getState()
      const midi = state.octave * 12 + 12 + semitone
      cbRef.current.noteOff(midi)
    }
    const onBlur = () => {
      heldRef.current.clear()
      cbRef.current.panic()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
