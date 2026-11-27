import { useEffect, useRef, type RefObject } from 'react'
import { isModalOpen, KEY_TO_SEMITONE } from '../../../../src/input/useComputerKeyboard'

interface KeysOptions {
  target: RefObject<HTMLElement | null>
  start: number
  press(midi: number, velocity: number): boolean | void
  release(midi: number): void
  shiftOctave(delta: number): void
  panic(): void
}

export function useKeyboardKeys(options: KeysOptions) {
  const { target } = options
  const latest = useRef(options)
  latest.current = options
  useEffect(() => {
    const root = target.current
    if (!root) return
    const held = new Map<string, number>()
    const releaseHeld = () => {
      for (const midi of held.values()) latest.current.release(midi)
      held.clear()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]') || isModalOpen(root)) return
      const { start, press, shiftOctave, panic } = latest.current
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        releaseHeld()
        panic()
        return
      }
      if (key === 'z' || key === 'x') {
        shiftOctave(key === 'z' ? -1 : 1)
        event.preventDefault()
        return
      }
      const semitone = KEY_TO_SEMITONE[key]
      if (!Number.isInteger(semitone) || held.has(key)) return
      const midi = start + semitone
      if (press(midi, 100) !== false) held.set(key, midi)
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const midi = held.get(key)
      if (midi === undefined) return
      held.delete(key)
      latest.current.release(midi)
    }
    const onFocusOut = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) releaseHeld()
    }
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('keyup', onKeyUp)
    root.addEventListener('focusout', onFocusOut)
    window.addEventListener('blur', releaseHeld)
    return () => {
      releaseHeld()
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('keyup', onKeyUp)
      root.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('blur', releaseHeld)
    }
  }, [target])
}
