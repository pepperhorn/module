import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { PatchManifest } from '../../../src/patches/types'
import { Keyboard } from './Keyboard'
import { memoryStorage } from './Keyboard.testStorage'

const engine = vi.hoisted(() => ({
  loadedPatchId: null as string | null,
  loadPatch: vi.fn(async (patch: PatchManifest) => { engine.loadedPatchId = patch.id }),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  panic: vi.fn(),
  setBreath: vi.fn(),
  setEffectParam: vi.fn(),
  setEffectEnabled: vi.fn(),
  suspend: vi.fn(async () => {}),
}))
vi.mock('../../../src/audio/AudioEngine', () => ({ getEngine: () => engine }))

// T5 provides the patch picker. Drive the same selectPatch method it will call.
const driver = vi.hoisted(() => ({ selectPatch: (_id: string) => {} }))
vi.mock('./engine/useKeyboardEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('./engine/useKeyboardEngine')>()
  return {
    useKeyboardEngine(options: Parameters<typeof actual.useKeyboardEngine>[0]) {
      const audio = actual.useKeyboardEngine(options)
      driver.selectPatch = audio.selectPatch
      return audio
    },
  }
})

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('changes patch, plays a chord and changes keyboard settings without writing module keys', async () => {
  localStorage.setItem('pepperhorn-keyboard:prefs:v1', JSON.stringify({
    volume: 0.35, effects: { reverb: { on: true, amount: 0.2 } },
  }))
  const writes = vi.spyOn(localStorage, 'setItem')
  const { container } = render(<Keyboard defaultMode="chord" />)
  fireEvent.click(screen.getByRole('button', { name: 'Enable audio' }))
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(engine.setBreath).toHaveBeenCalledWith(0.35, 8)
  expect(engine.setEffectEnabled).toHaveBeenCalledWith('reverb', true)
  expect(engine.setEffectParam).toHaveBeenCalledWith('reverb', 'mix', 0.2)
  const root = screen.getByRole('group', { name: 'Keyboard' })
  fireEvent.keyDown(root, { key: 'a' })
  expect(engine.noteOn.mock.calls).toEqual([[48, 100], [52, 100], [55, 100]])
  expect(container.querySelectorAll('.kb-chord-badge')).toHaveLength(3)
  await act(async () => driver.selectPatch('drums'))
  expect(engine.loadedPatchId).toBe('kb/drums')
  expect(engine.noteOff.mock.calls).toEqual([[48], [52], [55]])
  expect(container.querySelectorAll('.kb-chord-badge')).toHaveLength(0)
  fireEvent.keyUp(root, { key: 'a' })
  expect(engine.noteOff).toHaveBeenCalledTimes(3)
  expect(container.querySelector('[data-midi="35"]')).not.toBeNull()

  await act(async () => driver.selectPatch('piano'))
  expect(container.querySelector('[data-midi="48"]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Chord' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Note names' }))
  fireEvent.keyDown(root, { key: 'x' })
  expect(container.querySelector('[data-midi="48"]')).toBeNull()
  expect(container.querySelector('[data-midi="60"]')?.textContent).toBe('C')
  expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(key => key?.startsWith('module:'))).toEqual([])
  expect(writes).toHaveBeenCalled()
  expect(writes.mock.calls.every(([key]) => key.startsWith('pepperhorn-keyboard:'))).toBe(true)
})
