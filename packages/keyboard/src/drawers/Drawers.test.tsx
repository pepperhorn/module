import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getBuiltinPatches } from '../../../../src/patches/builtin'
import { BANK_LABELS, BANK_ORDER, type PatchManifest } from '../../../../src/patches/types'
import { Keyboard } from '../Keyboard'
import { memoryStorage } from '../Keyboard.testStorage'

const engine = vi.hoisted(() => ({
  loadedPatchId: null as string | null,
  loadPatch: vi.fn(async (patch: PatchManifest) => { engine.loadedPatchId = patch.id }),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  panic: vi.fn(),
  setBreath: vi.fn(),
  setEffectParam: vi.fn(),
  setEffectEnabled: vi.fn(),
  suspend: vi.fn(),
}))
vi.mock('../../../../src/audio/AudioEngine', () => ({ getEngine: () => engine }))

const prefsKey = 'pepperhorn-keyboard:prefs:v1'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const gear = () => button('Effects and settings')
const sounds = () => button(/♪/)
const drawer = (name: string) => screen.getByRole('region', { name })
const click = (el: HTMLElement) => fireEvent.click(el)
const change = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

function midiInput(id: string, name: string) {
  const input = Object.assign(new EventTarget(), { id, name, state: 'connected' })
  const send = (...bytes: number[]) => input.dispatchEvent(Object.assign(
    new Event('midimessage'), { data: Uint8Array.from(bytes) },
  ))
  return { input, send }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function unlock() {
  click(button('Enable audio'))
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
}

it('switches drawers exclusively and closes on Escape, outside click or the active trigger', () => {
  render(<><Keyboard /><button type="button">Host control</button></>)
  expect(screen.queryByRole('region')).toBeNull()
  click(sounds())
  expect(sounds().getAttribute('aria-expanded')).toBe('true')
  expect(drawer('Sounds')).toBeTruthy()
  click(gear())
  expect(screen.queryByRole('region', { name: 'Sounds' })).toBeNull()
  expect(drawer('Effects')).toBeTruthy()

  click(button('Settings'))
  expect(drawer('Settings')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Effects' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Octave shift' }), { key: 'Escape' })
  expect(screen.queryByRole('region')).toBeNull()
  expect(document.activeElement).toBe(gear())
  expect(engine.panic).not.toHaveBeenCalled()

  click(gear())
  click(gear())
  expect(screen.queryByRole('region')).toBeNull()
  click(sounds())
  click(sounds())
  expect(screen.queryByRole('region')).toBeNull()
  click(sounds())
  click(document.body)
  expect(screen.queryByRole('region')).toBeNull()

  click(sounds())
  const host = button('Host control')
  host.focus()
  expect(fireEvent.keyDown(host, { key: 'Escape' })).toBe(true)
  expect(document.activeElement).toBe(host)
  expect(screen.queryByRole('region')).toBeNull()
})

it('pins the bundled patches, groups the built-in catalog, and closes while a streamed patch loads', async () => {
  render(<Keyboard />)
  await unlock()
  click(sounds())
  const list = within(drawer('Sounds'))
  expect(list.getAllByRole('button').slice(0, 2).map(el => el.textContent)).toEqual(['Piano', 'Drums'])
  const catalog = getBuiltinPatches()
  for (const bank of BANK_ORDER) {
    const patches = catalog.filter(patch => patch.bank === bank)
    if (!patches.length) continue
    const group = within(list.getByRole('group', { name: BANK_LABELS[bank] }))
    expect(group.getAllByRole('button').map(el => el.textContent)).toEqual(patches.map(patch => patch.name))
  }
  click(list.getByRole('button', { name: 'Drums' }))
  expect(screen.queryByRole('region')).toBeNull()
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(engine.loadedPatchId).toBe('kb/drums')
  click(sounds())
  const streamed = catalog[0]
  let finish!: () => void
  engine.loadPatch.mockImplementationOnce(patch => new Promise<void>(resolve => {
    finish = () => { engine.loadedPatchId = patch.id; resolve() }
  }))
  click(within(drawer('Sounds')).getByRole('button', { name: streamed.name }))
  expect(screen.queryByRole('region')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe(`Loading ${streamed.name}…`)
  finish()
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
})

it('keeps Effects open when the player presses a key and closes it on an outside pointerdown', async () => {
  const { container } = render(<Keyboard />)
  await unlock()
  click(gear())
  const key = container.querySelector<HTMLElement>('[data-midi="48"]')!
  fireEvent.pointerDown(key, { pointerId: 1, pointerType: 'touch' })
  expect(drawer('Effects')).toBeTruthy()
  click(key)
  expect(drawer('Effects')).toBeTruthy()
  fireEvent.pointerDown(document.body, { pointerId: 2, pointerType: 'touch' })
  expect(screen.queryByRole('region', { name: 'Effects' })).toBeNull()
})

it.each([
  { id: 'reverb', label: 'Reverb', amount: 0.32, adjustFirst: false },
  { id: 'delay', label: 'Delay', amount: 0.35, adjustFirst: true },
])('$label gets an audible mix on the first action and saves it in one write', async ({ id, label, amount, adjustFirst }) => {
  const writes = vi.spyOn(localStorage, 'setItem')
  const slider = () => screen.getByRole('slider', { name: `${label} amount` })
  const keyboard = render(<Keyboard />)
  await unlock()
  click(gear())
  expect(button(label).getAttribute('aria-pressed')).toBe('false')
  if (adjustFirst) change(slider(), String(amount))
  else click(button(label))
  expect(engine.setEffectEnabled).toHaveBeenCalledWith(id, true)
  expect(engine.setEffectParam).toHaveBeenCalledWith(id, 'mix', amount)
  expect(writes.mock.calls).toEqual([[prefsKey, JSON.stringify({ effects: { [id]: { on: true, amount } } })]])

  keyboard.unmount()
  vi.clearAllMocks()
  render(<Keyboard />)
  await unlock()
  click(gear())
  expect(button(label).getAttribute('aria-pressed')).toBe('true')
  expect(engine.setEffectEnabled).toHaveBeenCalledWith(id, true)
  expect(engine.setEffectParam).toHaveBeenCalledWith(id, 'mix', amount)
  expect(writes).not.toHaveBeenCalled()
})

it('keeps the enabled state when an effect amount is set to zero', async () => {
  localStorage.setItem(prefsKey, JSON.stringify({
    effects: { reverb: { on: false, amount: 0.32 }, delay: { on: true, amount: 0.35 } },
  }))
  render(<Keyboard />)
  await unlock()
  click(gear())
  change(screen.getByRole('slider', { name: 'Reverb amount' }), '0')
  change(screen.getByRole('slider', { name: 'Delay amount' }), '0')
  expect(JSON.parse(localStorage.getItem(prefsKey)!).effects).toEqual({
    reverb: { on: false, amount: 0 }, delay: { on: true, amount: 0 },
  })
})

it('applies drawer changes to the engine and keys and preserves sound-module storage', async () => {
  localStorage.setItem('module:state:v1', 'host settings')
  const writes = vi.spyOn(localStorage, 'setItem')
  const { container } = render(<Keyboard showNoteNames />)
  await unlock()
  expect(writes).not.toHaveBeenCalled()

  click(gear())
  const effects = within(screen.getByRole('group', { name: 'Effect controls' }))
  expect(effects.getAllByRole('slider').map(el => el.getAttribute('aria-label'))).toEqual([
    'Reverb amount', 'Delay amount', 'Chorus amount', 'Distortion amount',
  ])
  expect(effects.getAllByRole('button').map(el => el.textContent)).toEqual([
    'Reverb', 'Delay', 'Chorus', 'Distortion',
  ])
  click(effects.getByRole('button', { name: 'Reverb' }))
  expect(engine.setEffectEnabled).toHaveBeenCalledWith('reverb', true)
  change(effects.getByRole('slider', { name: 'Reverb amount' }), '0.45')
  expect(engine.setEffectParam).toHaveBeenCalledWith('reverb', 'mix', 0.45)

  click(button('Settings'))
  change(screen.getByRole('slider', { name: 'Volume' }), '0.35')
  expect(engine.setBreath).toHaveBeenLastCalledWith(0.35, 8)
  expect(container.querySelector('[data-midi="49"]')?.textContent).toBe('D♭')
  change(screen.getByRole('combobox', { name: 'Accidentals' }), 'sharp')
  expect(container.querySelector('[data-midi="49"]')?.textContent).toBe('C♯')
  const octave = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Octave shift' })
  expect([...octave.options].map(option => option.value)).toEqual(['-2', '-1', '0', '1', '2'])
  change(octave, '2')
  const root = screen.getByRole('group', { name: 'Keyboard' })
  fireEvent.keyDown(root, { key: 'x' })
  expect(octave.value).toBe('2')
  expect(container.querySelector('[data-midi="72"]')).not.toBeNull()
  change(octave, '-2')
  fireEvent.keyDown(root, { key: 'z' })
  expect(octave.value).toBe('-2')
  expect(container.querySelector('[data-midi="24"]')).not.toBeNull()

  expect(JSON.parse(localStorage.getItem(prefsKey)!)).toEqual({
    effects: { reverb: { on: true, amount: 0.45 } }, volume: 0.35, accidentals: 'sharp',
  })
  expect(localStorage.getItem('module:state:v1')).toBe('host settings')
  expect(writes.mock.calls.every(([key]) => key.startsWith('pepperhorn-keyboard:'))).toBe(true)
})

it('selects and remembers a MIDI input and routes MIDI and computer keys in both modes', async () => {
  const first = midiInput('first', 'First controller')
  const second = midiInput('second', 'Second controller')
  const access = Object.assign(new EventTarget(), { inputs: new Map([
    [first.input.id, first.input], [second.input.id, second.input],
  ]) })
  vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn(async () => access) })
  const keyboard = render(<Keyboard />)
  await unlock()
  click(gear())
  click(button('Settings'))
  const midi = screen.getByRole<HTMLSelectElement>('combobox', { name: 'MIDI input' })
  await waitFor(() => expect(midi.options).toHaveLength(3))
  change(midi, 'second')
  expect(JSON.parse(localStorage.getItem(prefsKey)!)).toEqual({ midiDeviceId: 'second' })
  click(button('Effects'))

  first.send(0x90, 48, 80)
  expect(engine.noteOn).not.toHaveBeenCalled()
  second.send(0x90, 48, 80)
  second.send(0x80, 48, 0)
  const root = screen.getByRole('group', { name: 'Keyboard' })
  fireEvent.keyDown(root, { key: 'a' })
  fireEvent.keyUp(root, { key: 'a' })
  expect(engine.noteOn.mock.calls).toEqual([[48, 80], [48, 100]])
  expect(engine.noteOff.mock.calls).toEqual([[48], [48]])
  expect(drawer('Effects')).toBeTruthy()

  click(button('Chord'))
  engine.noteOn.mockClear()
  engine.noteOff.mockClear()
  second.send(0x90, 48, 80)
  second.send(0x90, 48, 0)
  fireEvent.keyDown(root, { key: 'a' })
  fireEvent.keyUp(root, { key: 'a' })
  expect(engine.noteOn.mock.calls).toEqual([[48, 80], [52, 80], [55, 80], [48, 100], [52, 100], [55, 100]])
  expect(engine.noteOff.mock.calls).toEqual([[48], [52], [55], [48], [52], [55]])

  keyboard.unmount()
  render(<Keyboard />)
  await unlock()
  click(gear())
  click(button('Settings'))
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'MIDI input' }).value).toBe('second')
  expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))).toEqual([prefsKey])
})
