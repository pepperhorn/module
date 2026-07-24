import { describe, it, expect } from 'vitest'
import { toVendoredUrls } from './vendoredUrls'

describe('toVendoredUrls', () => {
  const publicDir = '/repo/public'

  it('maps absolute paths to rooted /smplr-samples URLs verbatim', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/gleitz/piano/C4.ogg',
    ])
    expect(urls).toEqual(['/smplr-samples/gleitz/piano/C4.ogg'])
  })

  it('passes already-encoded disk names through unchanged (%23, %20)', () => {
    // The vendor script stores the CDN url pathname verbatim, so filenames
    // literally contain %23 / %20. loggedStorage requests that same string at
    // runtime, so the warm-loop URL must match it byte-for-byte (no re-encoding).
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/smpldsnds/cp80/samples/027-D%231-F.ogg',
      '/repo/public/smplr-samples/smpldsnds/vcsl/Electrophones/FM%20Piano/A1.m4a',
    ])
    expect(urls).toEqual([
      '/smplr-samples/smpldsnds/cp80/samples/027-D%231-F.ogg',
      '/smplr-samples/smpldsnds/vcsl/Electrophones/FM%20Piano/A1.m4a',
    ])
  })

  it('includes non-audio definition files (.sfz, .js)', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/smpldsnds/cp80/CP80.sfz',
      '/repo/public/smplr-samples/gleitz/MusyngKite/acoustic_grand_piano-ogg.js',
    ])
    expect(urls).toEqual([
      '/smplr-samples/smpldsnds/cp80/CP80.sfz',
      '/smplr-samples/gleitz/MusyngKite/acoustic_grand_piano-ogg.js',
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
