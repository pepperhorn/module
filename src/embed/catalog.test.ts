import { afterEach, describe, expect, it } from 'vitest'
import { getCatalog, findPatch } from '../patches/catalog'
import { configureSampleSource, getSampleSourceMode } from '../audio/loggedStorage'
import { setPersistScope, useStore } from '../state/useStore'
import { configureEmbed, embedCatalog, joinAssetUrl } from './catalog'

afterEach(() => {
  configureSampleSource({ mode: 'app' })
  setPersistScope('app')
  useStore.setState({ catalog: getCatalog() })
})

describe('joinAssetUrl', () => {
  it.each([
    ['', '/patches/a/', '/patches/a/'],
    ['https://x.test', '/patches/a/', 'https://x.test/patches/a/'],
    ['https://x.test/', '/patches/a/', 'https://x.test/patches/a/'],
  ])('joins %j + %j', (base, path, expected) => {
    expect(joinAssetUrl(base, path)).toBe(expected)
  })
})

describe('embedCatalog', () => {
  it('hides CST patches when assetBaseUrl is undefined', () => {
    const all = getCatalog()
    const out = embedCatalog(all, undefined)
    expect(out.some((p) => p.bank === 'CST')).toBe(false)
    expect(out).toHaveLength(all.filter((p) => p.bank !== 'CST').length)
  })
  it('keeps same-origin paths for assetBaseUrl ""', () => {
    const sine = embedCatalog(getCatalog(), '').find((p) => p.id === 'custom/sine-key')!
    expect(sine.source).toMatchObject({ kind: 'sampler', baseUrl: '/patches/sine-key/' })
  })
  it.each(['https://cdn.example.com', 'https://cdn.example.com/'])('resolves against %s', (base) => {
    const sine = embedCatalog(getCatalog(), base).find((p) => p.id === 'custom/sine-key')!
    expect((sine.source as { baseUrl: string }).baseUrl).toBe('https://cdn.example.com/patches/sine-key/')
  })
  it('does not mutate the source catalog', () => {
    embedCatalog(getCatalog(), 'https://x.test')
    expect((findPatch('custom/sine-key')!.source as { baseUrl: string }).baseUrl).toBe('/patches/sine-key/')
  })
})

describe('configureEmbed', () => {
  it('falls back from a hidden persisted CST patch to the default', () => {
    useStore.setState({ currentPatchId: 'custom/sine-key' })
    configureEmbed({})
    expect(useStore.getState().currentPatchId).toBe('ep/wurlitzerep200')
    expect(getSampleSourceMode()).toBe('cdn')
  })
})
