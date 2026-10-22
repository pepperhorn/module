import { vi } from 'vitest'
import type { LoadOutcome, LoadProgress } from '../audio/AudioEngine'

/** A stand-in for AudioEngine covering every member useSoundEngine touches. */
export function makeFakeEngine() {
  return {
    loadedPatchId: null as string | null,
    context: { state: 'running' as AudioContextState },
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    loadPatch: vi.fn(() => Promise.resolve()),
    previewPatch: vi.fn(() => Promise.resolve({ ok: true, offlineReady: false })),
    preloadPatch: vi.fn(() => Promise.resolve({ ok: true, failed: [] as string[] })),
    stopPreview: vi.fn(),
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    setBreath: vi.fn(),
    liftBreath: vi.fn(),
    setEffectEnabled: vi.fn(),
    setEffectParam: vi.fn(),
    setEffectOrder: vi.fn(),
    latencyInfo: vi.fn(() => ({ baseLatencyMs: 0, outputLatencyMs: null as number | null })),
    onLoading: undefined as ((id: string | null) => void) | undefined,
    onLoaded: undefined as ((id: string, outcome: LoadOutcome) => void) | undefined,
    onError: undefined as ((id: string, err: unknown) => void) | undefined,
    onProgress: undefined as ((id: string, progress: LoadProgress) => void) | undefined,
    onPreviewChange: undefined as ((id: string | null) => void) | undefined,
  }
}

export type FakeEngine = ReturnType<typeof makeFakeEngine>
