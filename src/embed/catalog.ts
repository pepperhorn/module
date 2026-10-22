import type { PatchManifest } from '../patches/types'
import { getCatalog } from '../patches/catalog'
import { configureSampleSource } from '../audio/loggedStorage'
import { setPersistScope, useStore } from '../state/useStore'

const DEFAULT_PATCH_ID = 'ep/wurlitzerep200'

export function joinAssetUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}

export function embedCatalog(
  catalog: PatchManifest[],
  assetBaseUrl: string | undefined,
): PatchManifest[] {
  if (assetBaseUrl === undefined) return catalog.filter((p) => p.bank !== 'CST')
  return catalog.map((p) =>
    p.source.kind === 'sampler'
      ? { ...p, source: { ...p.source, baseUrl: joinAssetUrl(assetBaseUrl, p.source.baseUrl) } }
      : p,
  )
}

export function configureEmbed(opts: { assetBaseUrl?: string }): void {
  configureSampleSource({ mode: 'cdn' })
  setPersistScope('embed')
  const catalog = embedCatalog(getCatalog(), opts.assetBaseUrl)
  const current = useStore.getState().currentPatchId
  const currentPatchId = catalog.some((p) => p.id === current)
    ? current
    : (catalog.find((p) => p.id === DEFAULT_PATCH_ID)?.id ?? catalog[0].id)
  useStore.setState({ catalog, currentPatchId })
}
