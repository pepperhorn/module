import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Keyboard } from './Keyboard'

const storageKey = 'pepperhorn-keyboard:prefs:v1'

beforeEach(() => vi.stubGlobal('localStorage', window.localStorage))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
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
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({
    volume: 0.35, showNames: true, accidentals: 'flat', effects: {}, midiDeviceId: null,
  })
})

it('mounts when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
  render(<Keyboard />)
  fireEvent.click(screen.getByRole('button', { name: 'Note names' }))
  expect(screen.getByRole('button', { name: 'Note names' }).getAttribute('aria-pressed')).toBe('true')
})

it('mounts with defaults after corrupt JSON', () => {
  localStorage.setItem(storageKey, '{invalid')
  const { container } = render(<Keyboard />)
  expect(container.querySelectorAll('.kb-key-name')).toHaveLength(0)
})
