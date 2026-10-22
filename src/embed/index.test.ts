vi.mock('../state/useTheme', () => {
  throw new Error('app-only module imported')
})
vi.mock('../state/useAuth', () => {
  throw new Error('app-only module imported')
})
vi.mock('../state/useUserPatchSync', () => {
  throw new Error('app-only module imported')
})
vi.mock('../pwa/warmVendored', () => {
  throw new Error('app-only module imported')
})
vi.mock('../input/useWakeLock', () => {
  throw new Error('app-only module imported')
})

import { describe, expect, it, vi } from 'vitest'

describe('embed entry', () => {
  it('exports exactly SoundModule and imports no app-only modules', async () => {
    const mod = await import('./index')
    expect(Object.keys(mod)).toEqual(['SoundModule'])
  })
})
