import type { PatchManifest } from './types'
import { getBuiltinPatches } from './builtin'

const customModules = import.meta.glob<PatchManifest>(
  '../data/patches/*.json',
  { eager: true, import: 'default' },
)

function loadCustomPatches(): PatchManifest[] {
  const out: PatchManifest[] = []
  for (const [, manifest] of Object.entries(customModules)) {
    const m = manifest as PatchManifest
    if (!m || typeof m !== 'object') continue
    out.push({ ...m, bank: 'CST' })
  }
  return out
}

let _catalog: PatchManifest[] | null = null

export function getCatalog(): PatchManifest[] {
  if (_catalog) return _catalog
  _catalog = [...getBuiltinPatches(), ...loadCustomPatches()]
  return _catalog
}

export function findPatch(id: string): PatchManifest | undefined {
  return getCatalog().find((p) => p.id === id)
}
