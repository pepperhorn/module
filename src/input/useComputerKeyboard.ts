import { useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from '../state/useStore'

export const KEY_TO_SEMITONE: Readonly<Record<string, number>> = {
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

const SEMITONE_TO_KEY: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(KEY_TO_SEMITONE).map(([key, semitone]) => [semitone, key]),
)

/** The computer key that plays semitone `n` (0..17), upper-cased; null outside that range. */
export function keyLabelForSemitone(n: number): string | null {
  const key = SEMITONE_TO_KEY[n]
  return key === undefined ? null : key.toUpperCase()
}

interface KeyboardCallbacks {
  noteOn: (midi: number, velocity: number) => void
  noteOff: (midi: number) => void
  panic: () => void
}

export interface ComputerKeyboardOptions {
  /** Focus-scoped mode: listen on this element only; keys play only while focus is inside it. */
  target?: RefObject<HTMLElement | null>
}

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

/** A modal dialog (MIDI sheet, save dialog...) owns the keyboard while open. */
export function isModalOpen(scope?: ParentNode | null): boolean {
  if (scope) return scope.querySelector('[aria-modal="true"]') !== null
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null
}

export function useComputerKeyboard(
  callbacks: KeyboardCallbacks,
  options?: ComputerKeyboardOptions,
): { armed: boolean } {
  // key -> MIDI note sounded at press time, so keyup releases the right pitch
  // even if the octave changed mid-hold.
  const heldRef = useRef<Map<string, number>>(new Map())
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const targetRef = options?.target
  const scoped = targetRef !== undefined
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const scope = targetRef?.current ?? null
    if (targetRef && !scope) return
    const events: HTMLElement | Window = scope ?? window

    const onKeyDown = (e: Event) => {
      const ev = e as KeyboardEvent
      if (ev.repeat) return
      if (isTextTarget(ev.target)) return
      // Escape there closes the dialog; it must not also panic held notes.
      if (isModalOpen(scope)) return
      const key = ev.key
      if (key === 'Escape') {
        cbRef.current.panic()
        heldRef.current.clear()
        return
      }
      const lower = key.length === 1 ? key.toLowerCase() : key
      const state = useStore.getState()
      if (lower === 'z') {
        state.shiftOctave(-1)
        return
      }
      if (lower === 'x') {
        state.shiftOctave(1)
        return
      }
      if (lower === 'c') {
        state.shiftVelocity(-12)
        return
      }
      if (lower === 'v') {
        state.shiftVelocity(12)
        return
      }
      const semitone = KEY_TO_SEMITONE[lower]
      if (semitone == null) return
      if (heldRef.current.has(lower)) return
      const midi = state.octave * 12 + 12 + semitone
      heldRef.current.set(lower, midi)
      cbRef.current.noteOn(midi, state.velocity)
      ev.preventDefault()
    }
    const onKeyUp = (e: Event) => {
      const ev = e as KeyboardEvent
      if (isTextTarget(ev.target)) return
      const lower = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
      const midi = heldRef.current.get(lower)
      if (midi === undefined) return
      heldRef.current.delete(lower)
      cbRef.current.noteOff(midi)
    }
    /** Release only the notes this hook is holding. */
    const releaseHeld = () => {
      for (const midi of heldRef.current.values()) cbRef.current.noteOff(midi)
      heldRef.current.clear()
    }
    const onWindowBlur = () => {
      if (scope) {
        releaseHeld()
      } else {
        heldRef.current.clear()
        cbRef.current.panic()
      }
    }
    const onFocusIn = () => setFocused(true)
    const onFocusOut = (e: Event) => {
      const next = (e as FocusEvent).relatedTarget as Node | null
      if (next && scope?.contains(next)) return
      setFocused(false)
      releaseHeld()
    }

    events.addEventListener('keydown', onKeyDown)
    events.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    if (scope) {
      scope.addEventListener('focusin', onFocusIn)
      scope.addEventListener('focusout', onFocusOut)
      setFocused(scope.contains(document.activeElement))
    }
    return () => {
      events.removeEventListener('keydown', onKeyDown)
      events.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      if (scope) {
        scope.removeEventListener('focusin', onFocusIn)
        scope.removeEventListener('focusout', onFocusOut)
      }
    }
  }, [targetRef])

  return { armed: scoped ? focused : true }
}
