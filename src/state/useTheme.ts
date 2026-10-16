import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** localStorage key for the theme. index.html's pre-paint script mirrors it. */
export const STORAGE_KEY = 'module-theme'
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Apply the saved theme to <html data-theme> (default dark). Called before
 * React renders so a stale SW-cached index.html without the pre-paint script
 * still honours the choice.
 */
export function applyStoredTheme(): void {
  let theme: Theme = 'dark'
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'light') theme = 'light'
  } catch {
    // storage unavailable — keep default
  }
  if (document.documentElement.getAttribute('data-theme') !== theme) {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

/** Apply a theme: flips the <html data-theme> attribute (which reskins every
 *  material via CSS variables) and persists the choice. */
export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage unavailable (private mode) — theme still applies for this session
  }
  listeners.forEach((l) => l())
}

export function toggleTheme(): void {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}

/** Subscribe a component to the active theme. The attribute is the source of
 *  truth (set pre-paint by the inline script in index.html). */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    currentTheme,
    () => 'dark',
  )
}
