vi.mock('../audio/AudioEngine', () => ({ getEngine: () => fake }))

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { makeFakeEngine, type FakeEngine } from '../test/fakeEngine'
import type { PatchSourceTag } from '../audio/AudioEngine'
import { useSoundEngine } from './useSoundEngine'
import { useStore } from './useStore'

let fake: FakeEngine

const tag: PatchSourceTag = { tier: 'cdn', local: 0, cache: 0, cdn: 1, total: 1 }

beforeEach(() => {
  fake = makeFakeEngine()
  useStore.setState({ downloaded: new Set<string>() })
})

afterEach(cleanup)

describe('useSoundEngine', () => {
  it('uiNoteOn lifts breath before playing', () => {
    const { result } = renderHook(() => useSoundEngine())
    act(() => result.current.uiNoteOn(60, 100))
    expect(fake.liftBreath.mock.invocationCallOrder[0]).toBeLessThan(
      fake.noteOn.mock.invocationCallOrder[0],
    )
    expect(fake.noteOn).toHaveBeenCalledWith(60, 100)
  })

  it('trackOffline false never marks a clean load downloaded', () => {
    renderHook(() => useSoundEngine({ trackOffline: false }))
    act(() => fake.onLoaded!('ep/wurlitzerep200', { source: tag, offlineReady: true }))
    expect(useStore.getState().downloaded.has('ep/wurlitzerep200')).toBe(false)
  })

  it('default trackOffline marks it', () => {
    renderHook(() => useSoundEngine())
    act(() => fake.onLoaded!('ep/wurlitzerep200', { source: tag, offlineReady: true }))
    expect(useStore.getState().downloaded.has('ep/wurlitzerep200')).toBe(true)
  })

  it('suspendOnUnmount: unmount panics and suspends', () => {
    const { unmount } = renderHook(() => useSoundEngine({ suspendOnUnmount: true }))
    unmount()
    expect(fake.panic).toHaveBeenCalled()
    expect(fake.suspend).toHaveBeenCalledOnce()
  })

  it('suspendOnUnmount: mount adopts a patch that finished loading while unmounted', () => {
    useStore.setState({ currentPatchId: 'ep/wurlitzerep200', pendingPatchId: 'piano/splendid' })
    fake.loadedPatchId = 'piano/splendid'
    renderHook(() => useSoundEngine({ suspendOnUnmount: true }))
    expect(useStore.getState().currentPatchId).toBe('piano/splendid')
    expect(useStore.getState().pendingPatchId).toBeNull()
  })

  it('without suspendOnUnmount, mount and unmount leave load markers alone', () => {
    useStore.setState({ loadingPatchId: 'ep/wurlitzerep200', pendingPatchId: 'ep/wurlitzerep200' })
    const { unmount } = renderHook(() => useSoundEngine())
    unmount()
    expect(useStore.getState().loadingPatchId).toBe('ep/wurlitzerep200')
    expect(useStore.getState().pendingPatchId).toBe('ep/wurlitzerep200')
    useStore.setState({ loadingPatchId: null, pendingPatchId: null })
  })

  it('without suspendOnUnmount, unmount leaves the engine running', () => {
    const { unmount } = renderHook(() => useSoundEngine())
    unmount()
    expect(fake.suspend).not.toHaveBeenCalled()
  })

  it('StrictMode remount after power-on resumes the engine', async () => {
    const { result } = renderHook(() => useSoundEngine({ suspendOnUnmount: true }), {
      wrapper: StrictMode,
    })
    await act(() => result.current.ensureAudio())
    // StrictMode replays effects on mount; after power-on the re-run must resume
    expect(fake.resume.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(result.current.needsGesture).toBe(false)
  })

  it('suspend effect re-running after power-on resumes, before power-on does not', async () => {
    const { result, rerender } = renderHook(
      ({ suspend }) => useSoundEngine({ suspendOnUnmount: suspend }),
      { initialProps: { suspend: true } },
    )
    expect(fake.resume).not.toHaveBeenCalled()
    await act(() => result.current.ensureAudio())
    expect(fake.resume).toHaveBeenCalledTimes(1)
    rerender({ suspend: false })
    expect(fake.suspend).toHaveBeenCalledTimes(1)
    rerender({ suspend: true })
    expect(fake.resume).toHaveBeenCalledTimes(2)
  })
})
