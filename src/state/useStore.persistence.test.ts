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

describe('useStore persistence and hydration', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('importing the store reads none of the app-only keys, even with ?debug=1', async () => {
    window.history.replaceState({}, '', '/?debug=1')
    const getItem = vi.spyOn(localStorage, 'getItem')
    const m = await import('./useStore')
    const read = getItem.mock.calls.map((c) => c[0])
    expect(read).not.toContain('module:downloaded:v1')
    expect(read).not.toContain('module:user-patches:v1')
    expect(read).not.toContain('module:debug:v1')
    expect(m.useStore.getState().debugMode).toBe(false)
    expect(localStorage.getItem('module:debug:v1')).toBeNull()
  })

  it('importing the store installs no online/offline listeners', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    await import('./useStore')
    expect(add.mock.calls.map((c) => c[0])).not.toContain('online')
    expect(add.mock.calls.map((c) => c[0])).not.toContain('offline')
  })

  it('hydrateAppState restores downloaded, user patches, debug and listeners', async () => {
    localStorage.setItem('module:downloaded:v1', JSON.stringify(['ep/x']))
    localStorage.setItem(
      'module:user-patches:v1',
      JSON.stringify([
        { id: 'usr/a', name: 'A', basePatchId: 'ep/wurlitzerep200', color: 'sky', fxEnabled: {}, fxParams: {}, createdAt: 1 },
      ]),
    )
    window.history.replaceState({}, '', '/?debug=1')
    const add = vi.spyOn(window, 'addEventListener')
    const m = await import('./useStore')
    m.hydrateAppState()
    const s = m.useStore.getState()
    expect(s.downloaded.has('ep/x')).toBe(true)
    expect(s.userPatches).toHaveLength(1)
    expect(s.debugMode).toBe(true)
    expect(add.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['online', 'offline']))
  })

  it('embed scope persists only patch, octave and velocity', async () => {
    const m = await import('./useStore')
    m.setPersistScope('embed')
    m.useStore.getState().setOctave(5)
    expect(Object.keys(JSON.parse(localStorage.getItem('module:state:v1')!)).sort()).toEqual([
      'currentPatchId',
      'octave',
      'velocity',
    ])
  })

  it('app scope still persists the fx state', async () => {
    const m = await import('./useStore')
    m.useStore.getState().setOctave(5)
    expect(JSON.parse(localStorage.getItem('module:state:v1')!)).toHaveProperty('fxEnabled')
  })
})
