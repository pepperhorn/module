import { useMemo } from 'react'
import { useStore } from './useStore'
import { findPatch } from '../patches/catalog'
import type { PatchManifest, UserPatch } from '../patches/types'

/**
 * Present a user-saved preset as a normal patch manifest so the LCD, the
 * picker, prev/next and the loading overlay can all treat it like any other
 * entry. It reuses the base patch's audio source, which is what lets the
 * engine's instrument cache serve both from one load.
 *
 * Returns null when the base patch no longer exists (e.g. a preset synced from
 * a build that had a patch this one does not).
 */
export function toUserManifest(user: UserPatch): PatchManifest | null {
  const base = findPatch(user.basePatchId)
  if (!base) return null
  return {
    id: user.id,
    name: user.name,
    category: base.name,
    bank: 'USR',
    color: user.color,
    defaultOctave: base.defaultOctave,
    source: base.source,
  }
}

/**
 * The built-in catalog with user presets merged in as USR-bank entries.
 *
 * Every consumer must use this rather than the raw `catalog`: looking a
 * selected id up in the raw catalog silently misses user presets, which is how
 * picking one from the library used to do nothing at all.
 */
export function useFullCatalog(): PatchManifest[] {
  const catalog = useStore((s) => s.catalog)
  const userPatches = useStore((s) => s.userPatches)
  return useMemo(() => {
    const userManifests: PatchManifest[] = []
    for (const user of userPatches) {
      const manifest = toUserManifest(user)
      if (manifest) userManifests.push(manifest)
    }
    return [...userManifests, ...catalog]
  }, [catalog, userPatches])
}
