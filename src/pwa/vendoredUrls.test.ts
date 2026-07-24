import { describe, it, expect } from 'vitest'
import { toVendoredUrls } from './vendoredUrls'

describe('toVendoredUrls', () => {
  const publicDir = '/repo/public'

  it('maps absolute paths to rooted /smplr-samples URLs', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/gleitz/piano/C4.ogg',
    ])
    expect(urls).toEqual(['/smplr-samples/gleitz/piano/C4.ogg'])
  })

  it('URL-encodes special characters in filenames', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/smpldsnds/cp80/samples/027-D#1-F.ogg',
    ])
    expect(urls).toEqual([
      '/smplr-samples/smpldsnds/cp80/samples/027-D%231-F.ogg',
    ])
  })

  it('ignores files outside smplr-samples', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/favicon.svg',
      '/repo/public/smplr-samples/x/y.m4a',
    ])
    expect(urls).toEqual(['/smplr-samples/x/y.m4a'])
  })

  it('normalizes Windows separators', () => {
    const urls = toVendoredUrls('C:\\repo\\public', [
      'C:\\repo\\public\\smplr-samples\\a\\b.wav',
    ])
    expect(urls).toEqual(['/smplr-samples/a/b.wav'])
  })
})
