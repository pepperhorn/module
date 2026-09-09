import { create } from 'zustand'
import type { EffectId } from '../audio/effects'
import { defaultParams } from '../audio/effects'
import type { PatchSourceTag } from '../audio/AudioEngine'
import type { PatchManifest, UserPatch } from '../patches/types'
import { getCatalog, findPatch } from '../patches/catalog'

const FAVOURITES_KEY = 'module:favourites:v1'
const STATE_KEY = 'module:state:v1'
const DOWNLOADED_KEY = 'module:downloaded:v1'
const USER_PATCHES_KEY = 'module:user-patches:v1'
const DEBUG_KEY = 'module:debug:v1'
const UI_KEY = 'module:ui:v1'

interface PersistedSlice {
  currentPatchId: string
  octave: number
  velocity: number
  fxEnabled: Record<EffectId, boolean>
  fxParams: Record<EffectId, Record<string, number>>
}

function loadPersisted(): Partial<PersistedSlice> {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<PersistedSlice>
  } catch {
    return {}
  }
}

function loadFavourites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveFavourites(s: Set<string>): void {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...s]))
  } catch {
    // noop
  }
}

function loadDownloaded(): Set<string> {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDownloaded(s: Set<string>): void {
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify([...s]))
  } catch {
    // noop
  }
}

function loadUserPatches(): UserPatch[] {
  try {
    const raw = localStorage.getItem(USER_PATCHES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as UserPatch[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveUserPatchesToStorage(patches: UserPatch[]): void {
  try {
    localStorage.setItem(USER_PATCHES_KEY, JSON.stringify(patches))
  } catch {
    // noop
  }
}

function generateUserPatchId(): string {
  return `usr/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface PersistedUi {
  keyboardMode: boolean
  fxVisible: boolean
}

function loadUi(): PersistedUi {
  const fallback: PersistedUi = { keyboardMode: false, fxVisible: true }
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedUi>
    return {
      keyboardMode: parsed.keyboardMode ?? fallback.keyboardMode,
      fxVisible: parsed.fxVisible ?? fallback.fxVisible,
    }
  } catch {
    return fallback
  }
}

function saveUi(ui: PersistedUi): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui))
  } catch {
    // noop
  }
}

function loadDebug(): boolean {
  // 1. URL param ?debug=1 forces debug ON and persists
  // 2. ?debug=0 forces OFF and persists
  // 3. Otherwise read the persisted localStorage value
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('debug')) {
        const v = params.get('debug') === '1'
        localStorage.setItem(DEBUG_KEY, v ? '1' : '0')
        return v
      }
    }
    return localStorage.getItem(DEBUG_KEY) === '1'
  } catch {
    return false
  }
}

function saveDebug(v: boolean): void {
  try {
    localStorage.setItem(DEBUG_KEY, v ? '1' : '0')
  } catch {
    // noop
  }
}

interface State {
  catalog: PatchManifest[]
  currentPatchId: string
  /**
   * The patch the user last asked for. Set the instant a selection happens and
   * cleared when the engine either commits it (currentPatchId) or fails, so the
   * display never claims a patch that is not actually loaded.
   */
  pendingPatchId: string | null
  loadError: { id: string; name: string } | null
  loadingPatchId: string | null
  loadingProgress: { loaded: number; total: number } | null
  currentSource: PatchSourceTag | null
  octave: number
  velocity: number
  fxEnabled: Record<EffectId, boolean>
  fxParams: Record<EffectId, Record<string, number>>
  favourites: Set<string>
  downloaded: Set<string>
  downloadingPatchId: string | null
  warmProgress: { done: number; total: number } | null
  userPatches: UserPatch[]
  saveDialogOpen: boolean
  pickerOpen: boolean
  midiConnected: boolean
  midiActivity: boolean
  debugMode: boolean
  online: boolean
  keyboardMode: boolean
  fxVisible: boolean
  previewPatchId: string | null
  setPickerOpen: (open: boolean) => void
  setPendingPatchId: (id: string | null) => void
  setLoadError: (e: { id: string; name: string } | null) => void
  setKeyboardMode: (v: boolean) => void
  toggleKeyboardMode: () => void
  setFxVisible: (v: boolean) => void
  toggleFxVisible: () => void
  setPreviewPatchId: (id: string | null) => void
  setLoadingPatchId: (id: string | null) => void
  setLoadingProgress: (p: { loaded: number; total: number } | null) => void
  setCurrentSource: (s: PatchSourceTag | null) => void
  setCurrentPatchId: (id: string) => void
  markDownloaded: (id: string) => void
  unmarkDownloaded: (id: string) => void
  setDownloadingPatchId: (id: string | null) => void
  setWarmProgress: (p: { done: number; total: number } | null) => void
  setOctave: (n: number) => void
  shiftOctave: (delta: number) => void
  setVelocity: (n: number) => void
  shiftVelocity: (delta: number) => void
  toggleFxEnabled: (id: EffectId) => void
  setFxParam: (id: EffectId, paramId: string, value: number) => void
  toggleFavourite: (id: string) => void
  setMidiConnected: (b: boolean) => void
  flashMidiActivity: () => void
  setSaveDialogOpen: (open: boolean) => void
  saveCurrentAsUserPatch: (name: string) => string | null
  deleteUserPatch: (id: string) => void
  setDebugMode: (v: boolean) => void
  toggleDebugMode: () => void
  setOnline: (v: boolean) => void
}

const persisted = loadPersisted()
const catalog = getCatalog()
const initialId =
  (persisted.currentPatchId && findPatch(persisted.currentPatchId)?.id) ??
  catalog.find((p) => p.id === 'ep/wurlitzerep200')?.id ??
  catalog[0].id
const initialUi = loadUi()
const initialFxEnabled: Record<EffectId, boolean> = {
  distortion: persisted.fxEnabled?.distortion ?? false,
  doubler1: persisted.fxEnabled?.doubler1 ?? false,
  doubler2: persisted.fxEnabled?.doubler2 ?? false,
  chorus: persisted.fxEnabled?.chorus ?? false,
  delay: persisted.fxEnabled?.delay ?? false,
  reverb: persisted.fxEnabled?.reverb ?? true,
}
const initialFxParams = persisted.fxParams ?? defaultParams()
// Default reverb mix to a noticeable value if no persisted state
if (!persisted.fxParams) initialFxParams.reverb.mix = 0.25

function persist(state: State) {
  const slice: PersistedSlice = {
    currentPatchId: state.currentPatchId,
    octave: state.octave,
    velocity: state.velocity,
    fxEnabled: state.fxEnabled,
    fxParams: state.fxParams,
  }
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(slice))
  } catch {
    // noop
  }
}

export const useStore = create<State>((set, get) => ({
  catalog,
  currentPatchId: initialId,
  pendingPatchId: null,
  loadError: null,
  loadingPatchId: null,
  loadingProgress: null,
  currentSource: null,
  octave: persisted.octave ?? 4,
  velocity: persisted.velocity ?? 100,
  fxEnabled: initialFxEnabled,
  fxParams: initialFxParams,
  favourites: loadFavourites(),
  downloaded: loadDownloaded(),
  downloadingPatchId: null,
  warmProgress: null,
  userPatches: loadUserPatches(),
  saveDialogOpen: false,
  pickerOpen: false,
  midiConnected: false,
  midiActivity: false,
  debugMode: loadDebug(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  keyboardMode: initialUi.keyboardMode,
  fxVisible: initialUi.fxVisible,
  previewPatchId: null,
  setPickerOpen: (open) => set({ pickerOpen: open }),
  setPendingPatchId: (id) => set({ pendingPatchId: id }),
  setLoadError: (e) => set({ loadError: e }),
  setKeyboardMode: (v) => {
    set({ keyboardMode: v })
    saveUi({ keyboardMode: v, fxVisible: get().fxVisible })
  },
  toggleKeyboardMode: () => {
    const next = !get().keyboardMode
    set({ keyboardMode: next })
    saveUi({ keyboardMode: next, fxVisible: get().fxVisible })
  },
  setFxVisible: (v) => {
    set({ fxVisible: v })
    saveUi({ keyboardMode: get().keyboardMode, fxVisible: v })
  },
  toggleFxVisible: () => {
    const next = !get().fxVisible
    set({ fxVisible: next })
    saveUi({ keyboardMode: get().keyboardMode, fxVisible: next })
  },
  setPreviewPatchId: (id) => set({ previewPatchId: id }),
  setLoadingPatchId: (id) => set({ loadingPatchId: id }),
  setLoadingProgress: (p) => set({ loadingProgress: p }),
  setCurrentSource: (s) => set({ currentSource: s }),
  setCurrentPatchId: (id) => {
    set({ currentPatchId: id })
    persist(get())
  },
  setOctave: (n) => {
    const clamped = Math.max(0, Math.min(8, n))
    set({ octave: clamped })
    persist(get())
  },
  shiftOctave: (delta) => {
    const next = Math.max(0, Math.min(8, get().octave + delta))
    set({ octave: next })
    persist(get())
  },
  setVelocity: (n) => {
    const clamped = Math.max(1, Math.min(127, n))
    set({ velocity: clamped })
    persist(get())
  },
  shiftVelocity: (delta) => {
    const next = Math.max(1, Math.min(127, get().velocity + delta))
    set({ velocity: next })
    persist(get())
  },
  toggleFxEnabled: (id) => {
    const enabled = { ...get().fxEnabled, [id]: !get().fxEnabled[id] }
    set({ fxEnabled: enabled })
    persist(get())
  },
  setFxParam: (id, paramId, value) => {
    const params = {
      ...get().fxParams,
      [id]: { ...get().fxParams[id], [paramId]: value },
    }
    set({ fxParams: params })
    persist(get())
  },
  toggleFavourite: (id) => {
    const fav = new Set(get().favourites)
    if (fav.has(id)) fav.delete(id)
    else fav.add(id)
    set({ favourites: fav })
    saveFavourites(fav)
  },
  markDownloaded: (id) => {
    const next = new Set(get().downloaded)
    if (next.has(id)) return
    next.add(id)
    set({ downloaded: next })
    saveDownloaded(next)
  },
  unmarkDownloaded: (id) => {
    const next = new Set(get().downloaded)
    if (!next.has(id)) return
    next.delete(id)
    set({ downloaded: next })
    saveDownloaded(next)
  },
  setDownloadingPatchId: (id) => set({ downloadingPatchId: id }),
  setWarmProgress: (p) => set({ warmProgress: p }),
  setMidiConnected: (b) => set({ midiConnected: b }),
  flashMidiActivity: (() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return () => {
      set({ midiActivity: true })
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => set({ midiActivity: false }), 80)
    }
  })(),
  setSaveDialogOpen: (open) => set({ saveDialogOpen: open }),
  saveCurrentAsUserPatch: (name) => {
    const state = get()
    // Resolve the BASE patch id. If the user is currently on a USR patch,
    // walk through to its underlying base patch so the new save points at
    // the real audio source, not another USR id.
    const currentUser = state.userPatches.find((u) => u.id === state.currentPatchId)
    const basePatchId = currentUser?.basePatchId ?? state.currentPatchId
    const basePatch = findPatch(basePatchId)
    if (!basePatch) return null
    const trimmed = name.trim() || `${basePatch.name} patch`
    const userPatch: UserPatch = {
      id: generateUserPatchId(),
      name: trimmed,
      basePatchId,
      color: basePatch.color,
      fxEnabled: { ...state.fxEnabled },
      fxParams: Object.fromEntries(
        Object.entries(state.fxParams).map(([k, v]) => [k, { ...v }]),
      ),
      createdAt: Date.now(),
    }
    const next = [userPatch, ...state.userPatches]
    set({ userPatches: next })
    saveUserPatchesToStorage(next)
    return userPatch.id
  },
  deleteUserPatch: (id) => {
    const next = get().userPatches.filter((u) => u.id !== id)
    set({ userPatches: next })
    saveUserPatchesToStorage(next)
  },
  setDebugMode: (v) => {
    set({ debugMode: v })
    saveDebug(v)
  },
  toggleDebugMode: () => {
    const next = !get().debugMode
    set({ debugMode: next })
    saveDebug(next)
  },
  setOnline: (v) => set({ online: v }),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useStore.getState().setOnline(true))
  window.addEventListener('offline', () => useStore.getState().setOnline(false))
}
