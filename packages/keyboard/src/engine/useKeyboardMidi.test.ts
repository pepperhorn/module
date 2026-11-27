import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useKeyboardMidi } from './useKeyboardMidi'

function makeInput(id: string) {
  return Object.assign(new EventTarget(), { id, name: id, state: 'connected' })
}

function message(input: EventTarget, data: number[]) {
  input.dispatchEvent(Object.assign(new Event('midimessage'), { data: Uint8Array.from(data) }))
}

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'requestMIDIAccess')
})

it('routes selected device notes, velocity-zero offs, and disconnect releases', async () => {
  const first = makeInput('First')
  const second = makeInput('Second')
  const access = Object.assign(new EventTarget(), { inputs: new Map([[first.id, first], [second.id, second]]) })
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) })
  const press = vi.fn()
  const release = vi.fn()
  const setDeviceId = vi.fn()
  const { result, rerender } = renderHook(({ deviceId }) =>
    useKeyboardMidi({ press, release, deviceId, setDeviceId }), { initialProps: { deviceId: 'First' } },
  )
  await act(() => result.current.requestMidi())
  expect(result.current.devices).toEqual([{ id: 'First', name: 'First' }, { id: 'Second', name: 'Second' }])
  message(second, [0x90, 60, 99])
  message(first, [0x90, 60, 90])
  message(first, [0x90, 60, 0])
  expect(press.mock.calls).toEqual([[60, 90]])
  expect(release.mock.calls).toEqual([[60]])
  rerender({ deviceId: 'Second' })
  message(second, [0x91, 62, 65])
  act(() => {
    second.state = 'disconnected'
    access.dispatchEvent(new Event('statechange'))
  })
  expect(press.mock.calls.at(-1)).toEqual([62, 65])
  expect(release.mock.calls.at(-1)).toEqual([62])
})

it('degrades silently when permission is denied', async () => {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true, value: vi.fn().mockRejectedValue(new DOMException('Denied', 'SecurityError')),
  })
  const { result } = renderHook(() => useKeyboardMidi({
    press: vi.fn(), release: vi.fn(), deviceId: null, setDeviceId: vi.fn(),
  }))
  await act(() => result.current.requestMidi())
  expect(result.current.devices).toEqual([])
})
