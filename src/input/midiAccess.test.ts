import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Node's experimental global localStorage shadows jsdom's here; use a Map.
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}
vi.stubGlobal('localStorage', memoryStorage())

type Nav = Navigator & { requestMIDIAccess?: unknown; permissions?: unknown }
const nav = navigator as Nav

function fakeAccess(): MIDIAccess {
  return { inputs: new Map(), addEventListener() {}, removeEventListener() {} } as unknown as MIDIAccess
}

async function load(opts: { permission: PermissionState | 'throw' | 'none'; flag: boolean }) {
  vi.resetModules()
  localStorage.clear()
  if (opts.flag) localStorage.setItem('module:midi-enabled:v1', '1')
  const request = vi.fn(() => Promise.resolve(fakeAccess()))
  Object.defineProperty(nav, 'requestMIDIAccess', { value: request, configurable: true })
  const permissions =
    opts.permission === 'none'
      ? undefined
      : {
          query: vi.fn(() =>
            opts.permission === 'throw'
              ? Promise.reject(new TypeError('midi not a PermissionName'))
              : Promise.resolve({ state: opts.permission, onchange: null }),
          ),
        }
  Object.defineProperty(nav, 'permissions', { value: permissions, configurable: true })
  const mod = await import('./midiAccess')
  const { useStore } = await import('../state/useStore')
  return { mod, useStore, request }
}

describe('autoRequestMidi', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    delete (nav as { requestMIDIAccess?: unknown }).requestMIDIAccess
    delete (nav as { permissions?: unknown }).permissions
  })

  it('requests when permission is already granted', async () => {
    const { mod, request, useStore } = await load({ permission: 'granted', flag: false })
    await mod.autoRequestMidi()
    expect(request).toHaveBeenCalledOnce()
    expect(useStore.getState().midiStatus).toBe('granted')
  })

  it("does NOT request on 'prompt' even if the flag is set", async () => {
    const { mod, request, useStore } = await load({ permission: 'prompt', flag: true })
    await mod.autoRequestMidi()
    expect(request).not.toHaveBeenCalled()
    expect(useStore.getState().midiStatus).toBe('idle')
  })

  it("reflects 'denied' without prompting", async () => {
    const { mod, request, useStore } = await load({ permission: 'denied', flag: true })
    await mod.autoRequestMidi()
    expect(request).not.toHaveBeenCalled()
    expect(useStore.getState().midiStatus).toBe('denied')
  })

  it('falls back to the flag only when the Permissions API cannot answer', async () => {
    const a = await load({ permission: 'throw', flag: true })
    await a.mod.autoRequestMidi()
    expect(a.request).toHaveBeenCalledOnce()
    const b = await load({ permission: 'none', flag: false })
    await b.mod.autoRequestMidi()
    expect(b.request).not.toHaveBeenCalled()
  })
})

describe('requestMidi with access already held', () => {
  it('sets status back to granted and re-notifies listeners', async () => {
    const { mod, useStore, request } = await load({ permission: 'none', flag: false })
    await mod.requestMidi()
    const seen = vi.fn()
    mod.onMidiAccess(seen)
    expect(seen).toHaveBeenCalledTimes(1)
    useStore.getState().setMidiStatus('denied') // stale
    await mod.requestMidi()
    expect(request).toHaveBeenCalledOnce()
    expect(useStore.getState().midiStatus).toBe('granted')
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
