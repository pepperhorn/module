vi.mock('../audio/AudioEngine', () => ({
  getEngine: (opts?: EngineOptions) => {
    engineOptions = opts
    return fake
  },
}))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeFakeEngine, type FakeEngine } from '../test/fakeEngine'
import type { EngineOptions, PatchSourceTag } from '../audio/AudioEngine'
import { getCatalog } from '../patches/catalog'
import { clearActiveNotes } from '../state/activeNotes'
import { setPersistScope, useStore } from '../state/useStore'
import { SoundModule } from './SoundModule'

let fake: FakeEngine
let engineOptions: EngineOptions | undefined

const tag: PatchSourceTag = { tier: 'cdn', local: 0, cache: 0, cdn: 1, total: 1 }

function rootOf(container: HTMLElement): HTMLElement {
  return container.querySelector('.sound-module') as HTMLElement
}

beforeEach(() => {
  fake = makeFakeEngine()
  clearActiveNotes()
  useStore.setState({
    catalog: getCatalog(),
    currentPatchId: 'ep/wurlitzerep200',
    pendingPatchId: null,
    loadingPatchId: null,
    loadError: null,
    pickerOpen: false,
    midiPanelOpen: false,
    octave: 4,
    velocity: 100,
  })
})

afterEach(() => {
  cleanup()
  setPersistScope('app')
  vi.restoreAllMocks()
})

describe('SoundModule', () => {
  it('renders a themed, focusable root and leaves <html> alone', () => {
    const { container } = render(<SoundModule theme="light" className="host-x" />)
    const root = rootOf(container)
    expect(root.dataset.theme).toBe('light')
    expect(root.tabIndex).toBe(0)
    expect(root.className).toContain('host-x')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('creates a quiet engine without the console shim', () => {
    render(<SoundModule />)
    expect(engineOptions).toMatchObject({ consoleShim: false, quiet: true })
  })

  it('defaults to the dark theme', () => {
    const root = rootOf(render(<SoundModule />).container)
    expect(root.dataset.theme).toBe('dark')
  })

  it('keys play only while the module has focus', () => {
    const root = rootOf(render(<SoundModule />).container)
    expect(root.querySelector('.sm-keys-indicator')!.textContent).toMatch(/keys off/i)
    fireEvent.keyDown(document.body, { key: 'a' })
    expect(fake.noteOn).not.toHaveBeenCalled()
    act(() => root.focus())
    fireEvent.keyDown(root, { key: 'a' })
    expect(fake.noteOn).toHaveBeenCalled()
    expect(root.querySelector('.sm-keys-indicator')!.textContent).toMatch(/keys on/i)
  })

  it('refocuses the root when the picker closes and focus was lost', () => {
    const root = rootOf(render(<SoundModule />).container)
    act(() => root.focus())
    act(() => useStore.setState({ pickerOpen: true }))
    const card = root.querySelector('.patch-card') as HTMLElement
    act(() => card.focus())
    expect(document.activeElement).toBe(card)
    act(() => useStore.setState({ pickerOpen: false }))
    expect(root.contains(document.activeElement)).toBe(true)
    expect(root.querySelector('.sm-keys-indicator')!.textContent).toMatch(/keys on/i)
  })

  it('pressing the on-screen piano arms the keyboard', () => {
    const root = rootOf(render(<SoundModule />).container)
    expect(root.contains(document.activeElement)).toBe(false)
    // jsdom has no hit testing; land the press on a real key so the piano's
    // handler runs its preventDefault() path, as it does in a browser.
    const key = root.querySelector<HTMLElement>('[data-midi]')!
    document.elementFromPoint = () => key
    try {
      fireEvent.pointerDown(root.querySelector('.touch-keyboard-body')!, { pointerId: 1 })
    } finally {
      delete (document as { elementFromPoint?: unknown }).elementFromPoint
    }
    expect(root.contains(document.activeElement)).toBe(true)
    expect(fake.noteOn).toHaveBeenCalled()
  })

  it('focus loss does not call the global panic (MIDI/breath keep playing)', () => {
    const root = rootOf(render(<SoundModule />).container)
    act(() => root.focus())
    fireEvent.keyDown(root, { key: 'a' })
    fireEvent.focusOut(root, { relatedTarget: document.body })
    expect(fake.noteOff).toHaveBeenCalledWith(60)
    expect(fake.panic).not.toHaveBeenCalled()
  })

  it('labels 18 piano keys', () => {
    const root = rootOf(render(<SoundModule />).container)
    expect(root.querySelectorAll('.touch-key-label')).toHaveLength(18)
  })

  it('draws the picker and MIDI panel inside the root', () => {
    const root = rootOf(render(<SoundModule />).container)
    act(() => useStore.setState({ pickerOpen: true, midiPanelOpen: true }))
    expect(root.querySelector('.patch-picker')).not.toBeNull()
    expect(root.querySelector('.midi-panel-scrim')).not.toBeNull()
    expect(root.querySelector('.patch-card-dl')).toBeNull()
  })

  it('hides CST patches without assetBaseUrl', () => {
    expect(useStore.getState().catalog.some((p) => p.bank === 'CST')).toBe(true)
    render(<SoundModule />)
    expect(useStore.getState().catalog.some((p) => p.bank === 'CST')).toBe(false)
  })

  it('keeps CST patches when assetBaseUrl is given', () => {
    render(<SoundModule assetBaseUrl="" />)
    expect(useStore.getState().catalog.some((p) => p.bank === 'CST')).toBe(true)
  })

  it('a click powers on while the gesture is pending', () => {
    const root = rootOf(render(<SoundModule />).container)
    expect(root.querySelector('.gesture-overlay')).not.toBeNull()
    fireEvent.click(root)
    expect(fake.resume).toHaveBeenCalled()
    expect(root.querySelector('.gesture-overlay')).toBeNull()
  })

  it('unmount panics and suspends the engine', () => {
    const { unmount } = render(<SoundModule />)
    unmount()
    expect(fake.panic).toHaveBeenCalled()
    expect(fake.suspend).toHaveBeenCalledOnce()
  })

  it('never touches app-only storage keys', async () => {
    const keysTouched: string[] = []
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      keysTouched.push(k)
      return getItem.call(this, k)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      keysTouched.push(k)
      setItem.call(this, k, v)
    })

    const root = rootOf(render(<SoundModule />).container)
    // Power on, play, and finish a clean load of the selected patch.
    await act(async () => {
      fireEvent.click(root)
    })
    act(() => root.focus())
    fireEvent.keyDown(root, { key: 'a' })
    fireEvent.keyUp(root, { key: 'a' })
    act(() => fake.onLoaded!('ep/wurlitzerep200', { source: tag, offlineReady: true }))
    fireEvent.keyDown(root, { key: 'x' })

    expect(fake.loadPatch).toHaveBeenCalled()
    for (const k of ['module:downloaded:v1', 'module:user-patches:v1', 'module:debug:v1'])
      expect(keysTouched).not.toContain(k)
  })
})
