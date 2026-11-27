import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Keyboard } from './Keyboard'
import { memoryStorage } from './Keyboard.testStorage'
import { useKeyboardPrefs } from './useKeyboardPrefs'

const storageKey = 'pepperhorn-keyboard:prefs:v1'

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('renders the default piano and two octaves', () => {
  const { container } = render(<Keyboard />)
  expect(container.querySelector('.kb-root')).not.toBeNull()
  expect(container.querySelectorAll('[data-midi]')).toHaveLength(25)
  expect(screen.getByRole('button', { name: /piano/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-pressed')).toBe('true')
})

it('takes patch, mode and chord from the page again on remount', () => {
  const first = render(<Keyboard defaultMode="chord" defaultChord="min" defaultPatch="drums" />)
  expect((screen.getByRole('button', { name: 'Chord' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('group', { name: 'Chord type' })).toBeNull()
  first.unmount()
  localStorage.setItem(storageKey, JSON.stringify({ patch: 'drums', mode: 'play', chord: '7', showNames: true, volume: 0.35 }))
  const { container } = render(<Keyboard defaultMode="chord" defaultChord="min" showNoteNames={false} />)
  expect(screen.getByRole('button', { name: /piano/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'min' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'aug' }))
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  expect(container.querySelectorAll('.kb-key-name')).toHaveLength(25)
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ volume: 0.35, showNames: true })
})

it('persists only choices the user changes, not page defaults', () => {
  const writes = vi.spyOn(localStorage, 'setItem')
  const first = render(<Keyboard showNoteNames accidentals="sharp" />)
  expect(first.container.querySelector('[data-midi="49"]')?.textContent).toBe('C♯')
  expect(writes).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Note names' }))
  expect(writes.mock.calls).toEqual([[storageKey, JSON.stringify({ showNames: false })]])
  first.unmount()

  const second = render(<Keyboard showNoteNames accidentals="flat" />)
  expect(screen.getByRole('button', { name: 'Note names' }).getAttribute('aria-pressed')).toBe('false')
  expect(second.container.querySelector('[data-midi="49"]')?.getAttribute('aria-label')).toBe('D♭')
  expect(writes).toHaveBeenCalledTimes(1)
})

it('ignores setter calls that repeat an initial value', () => {
  const writes = vi.spyOn(localStorage, 'setItem')
  const { result } = renderHook(() => useKeyboardPrefs({
    accidentals: 'sharp', effects: { reverb: { on: false, amount: 0.25 } },
  }))
  act(() => result.current[1]({ accidentals: 'sharp', effects: { reverb: { on: false, amount: 0.25 } } }))
  expect(writes).not.toHaveBeenCalled()
  act(() => result.current[1]({ accidentals: 'sharp', volume: 0.5 }))
  expect(writes.mock.calls).toEqual([[storageKey, JSON.stringify({ volume: 0.5 })]])
})

it('mounts when localStorage throws', () => {
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('storage blocked') })
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
  render(<Keyboard />)
  fireEvent.click(screen.getByRole('button', { name: 'Note names' }))
  expect(screen.getByRole('button', { name: 'Note names' }).getAttribute('aria-pressed')).toBe('true')
})

it('mounts with defaults after corrupt JSON', () => {
  localStorage.setItem(storageKey, '{invalid')
  const { container } = render(<Keyboard />)
  expect(container.querySelectorAll('.kb-key-name')).toHaveLength(0)
})
