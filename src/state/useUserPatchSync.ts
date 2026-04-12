// Sync the local userPatches store ↔ apps.pepperhorn.com app_user_saves.
//
// On login:
//   1. Pull all app_user_saves rows for this user where app_slug='module', kind='patch'.
//   2. Merge with local. Conflict resolution = newer createdAt wins.
//      - Backend-only rows are added to local.
//      - Local-only rows are pushed to backend.
//      - Differing rows: keep the one with the larger createdAt.
//
// On every save / delete (while logged in):
//   - Debounced 1.2s push of the entire local userPatches list as a diff against
//     a snapshot of what we last sent.
//
// On logout:
//   - Stop syncing. Local store is untouched (offline-first).
//
// All requests use the session token as a Directus bearer token.

import { useEffect, useRef } from 'react'
import { useStore } from './useStore'
import { useAuth, APP_SLUG, PH_BASE } from './useAuth'
import type { UserPatch } from '../patches/types'

const ITEMS_URL = `${PH_BASE}/items/app_user_saves`
const KIND = 'patch'
const PUSH_DEBOUNCE_MS = 1200

interface BackendSaveRow {
  id: string
  app_user: string
  app_slug: string
  kind: string
  external_id: string
  name: string
  payload: UserPatch
  date_created?: string
  date_updated?: string
  status?: 'published' | 'archived'
}

interface SyncState {
  // Maps a UserPatch.id (the client-stable id) → backend row id (Directus uuid)
  externalToRow: Map<string, string>
  // Snapshot of last-pushed payload by external id, for diffing
  lastPushedById: Map<string, UserPatch>
  loggedInUserId: string | null
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function fetchBackendPatches(
  token: string,
  userId: string,
): Promise<BackendSaveRow[]> {
  const params = new URLSearchParams()
  params.set('filter[app_user][_eq]', userId)
  params.set('filter[app_slug][_eq]', APP_SLUG)
  params.set('filter[kind][_eq]', KIND)
  params.set('filter[status][_eq]', 'published')
  params.set('limit', '500')
  params.set(
    'fields',
    'id,external_id,name,payload,date_created,date_updated,status',
  )
  const res = await fetch(`${ITEMS_URL}?${params.toString()}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) {
    throw new Error(`fetch saves ${res.status}`)
  }
  const json = (await res.json()) as { data: BackendSaveRow[] }
  return json.data ?? []
}

async function createSave(
  token: string,
  userId: string,
  patch: UserPatch,
): Promise<BackendSaveRow | null> {
  const body = {
    app_user: userId,
    app_slug: APP_SLUG,
    kind: KIND,
    external_id: patch.id,
    name: patch.name,
    payload: patch,
    status: 'published',
  }
  const res = await fetch(ITEMS_URL, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.warn('[sync] create failed', res.status, await safeText(res))
    return null
  }
  const json = (await res.json()) as { data: BackendSaveRow }
  return json.data ?? null
}

async function updateSave(
  token: string,
  rowId: string,
  patch: UserPatch,
): Promise<boolean> {
  const body = {
    name: patch.name,
    payload: patch,
  }
  const res = await fetch(`${ITEMS_URL}/${rowId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.warn('[sync] update failed', res.status, await safeText(res))
    return false
  }
  return true
}

async function deleteSave(token: string, rowId: string): Promise<boolean> {
  const res = await fetch(`${ITEMS_URL}/${rowId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) {
    console.warn('[sync] delete failed', res.status, await safeText(res))
    return false
  }
  return true
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200)
  } catch {
    return ''
  }
}

function patchesEqual(a: UserPatch, b: UserPatch): boolean {
  // Cheap structural compare via JSON serialization. Fields are small and the
  // shape is fixed (no Date objects, no Maps).
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Mounted once at the top of the app. Watches the auth + userPatches state and
 * keeps the backend in sync. Also performs the initial pull-merge on login.
 */
export function useUserPatchSync(): void {
  const auth = useAuth()
  const userPatches = useStore((s) => s.userPatches)
  const setUserPatches = useUserPatchesSetter()
  const sync = useRef<SyncState>({
    externalToRow: new Map(),
    lastPushedById: new Map(),
    loggedInUserId: null,
  })
  const pushTimerRef = useRef<number | null>(null)

  // ─── Initial pull-merge whenever a user appears ─────────────────────────
  useEffect(() => {
    if (!auth.user || !auth.token) {
      // Logged out — reset sync bookkeeping but leave local store alone.
      sync.current.externalToRow.clear()
      sync.current.lastPushedById.clear()
      sync.current.loggedInUserId = null
      return
    }
    if (sync.current.loggedInUserId === auth.user.id) {
      // Already initialized for this user.
      return
    }
    sync.current.loggedInUserId = auth.user.id
    const token = auth.token
    const userId = auth.user.id

    void (async () => {
      try {
        const remoteRows = await fetchBackendPatches(token, userId)
        const remoteByExternalId = new Map<string, BackendSaveRow>()
        for (const row of remoteRows) {
          remoteByExternalId.set(row.external_id, row)
          sync.current.externalToRow.set(row.external_id, row.id)
        }

        const localList = useStore.getState().userPatches
        const localByExternalId = new Map<string, UserPatch>()
        for (const p of localList) localByExternalId.set(p.id, p)

        const merged: UserPatch[] = []
        const toCreate: UserPatch[] = []
        const toUpdate: Array<{ row: BackendSaveRow; patch: UserPatch }> = []

        // Walk local first to preserve sort order
        for (const local of localList) {
          const remote = remoteByExternalId.get(local.id)
          if (!remote) {
            // Local-only — push to backend
            merged.push(local)
            toCreate.push(local)
          } else {
            // Both sides have it — keep newer
            const remotePatch = remote.payload
            const localNewer = local.createdAt >= (remotePatch.createdAt ?? 0)
            const winner = localNewer ? local : remotePatch
            merged.push(winner)
            if (localNewer && !patchesEqual(local, remotePatch)) {
              toUpdate.push({ row: remote, patch: local })
            }
            sync.current.lastPushedById.set(winner.id, winner)
            remoteByExternalId.delete(local.id)
          }
        }
        // Anything left in remoteByExternalId is backend-only — add to local
        for (const row of remoteByExternalId.values()) {
          merged.push(row.payload)
          sync.current.lastPushedById.set(row.payload.id, row.payload)
        }

        // Sort newest first to match the local create order
        merged.sort((a, b) => b.createdAt - a.createdAt)

        // Apply merged list to the store. Bypass sync's debounce since we know
        // every entry is now reflected backend-side (or about to be).
        setUserPatches(merged)

        // Fire pending creates / updates
        for (const patch of toCreate) {
          const row = await createSave(token, userId, patch)
          if (row) {
            sync.current.externalToRow.set(patch.id, row.id)
            sync.current.lastPushedById.set(patch.id, patch)
          }
        }
        for (const { row, patch } of toUpdate) {
          const ok = await updateSave(token, row.id, patch)
          if (ok) sync.current.lastPushedById.set(patch.id, patch)
        }
        console.log('[sync] initial merge complete', {
          merged: merged.length,
          created: toCreate.length,
          updated: toUpdate.length,
        })
      } catch (err) {
        console.warn('[sync] initial merge failed', err)
      }
    })()
  }, [auth.user, auth.token, setUserPatches])

  // ─── Debounced push when local userPatches change ───────────────────────
  useEffect(() => {
    if (!auth.user || !auth.token) return
    if (sync.current.loggedInUserId !== auth.user.id) return // initial merge still pending

    if (pushTimerRef.current != null) {
      window.clearTimeout(pushTimerRef.current)
    }
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null
      void diffAndPush(auth.token!, auth.user!.id, sync.current, userPatches)
    }, PUSH_DEBOUNCE_MS)

    return () => {
      if (pushTimerRef.current != null) {
        window.clearTimeout(pushTimerRef.current)
        pushTimerRef.current = null
      }
    }
  }, [userPatches, auth.user, auth.token])
}

async function diffAndPush(
  token: string,
  userId: string,
  sync: SyncState,
  current: UserPatch[],
): Promise<void> {
  const currentById = new Map<string, UserPatch>()
  for (const p of current) currentById.set(p.id, p)

  // Detect creates and updates
  for (const patch of current) {
    const last = sync.lastPushedById.get(patch.id)
    if (!last) {
      // New patch — create
      const row = await createSave(token, userId, patch)
      if (row) {
        sync.externalToRow.set(patch.id, row.id)
        sync.lastPushedById.set(patch.id, patch)
      }
    } else if (!patchesEqual(last, patch)) {
      const rowId = sync.externalToRow.get(patch.id)
      if (rowId) {
        const ok = await updateSave(token, rowId, patch)
        if (ok) sync.lastPushedById.set(patch.id, patch)
      }
    }
  }
  // Detect deletes
  for (const externalId of [...sync.lastPushedById.keys()]) {
    if (!currentById.has(externalId)) {
      const rowId = sync.externalToRow.get(externalId)
      if (rowId) {
        const ok = await deleteSave(token, rowId)
        if (ok) {
          sync.externalToRow.delete(externalId)
          sync.lastPushedById.delete(externalId)
        }
      }
    }
  }
}

// Helper to set the entire userPatches array atomically and persist.
// Avoids the need to expose a public setter that bypasses save/delete actions.
function useUserPatchesSetter(): (next: UserPatch[]) => void {
  return (next: UserPatch[]) => {
    useStore.setState((state) => {
      // Persist via the same localStorage key used by the store
      try {
        localStorage.setItem('module:user-patches:v1', JSON.stringify(next))
      } catch {
        // noop
      }
      return { ...state, userPatches: next }
    })
  }
}
