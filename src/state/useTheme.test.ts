import { describe, expect, it, vi } from 'vitest'
import { applyStoredTheme, STORAGE_KEY } from './useTheme'

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

describe('applyStoredTheme', () => {
  it('applies the stored theme, defaulting to dark', () => {
    localStorage.removeItem(STORAGE_KEY)
    document.documentElement.setAttribute('data-theme', 'light')
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    localStorage.setItem(STORAGE_KEY, 'light')
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    localStorage.removeItem(STORAGE_KEY)
  })
})
