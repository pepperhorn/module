import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest'

class FakeAudioContext {
  state = 'suspended'
  sampleRate = 48000
  baseLatency = 0
  decodeAudioData = vi.fn()
  suspend = vi.fn(async () => {})
  resume = vi.fn(async () => {})
}

describe('AudioEngine options', () => {
  const originalWarn = console.warn
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })
  afterEach(() => {
    console.warn = originalWarn
    vi.unstubAllGlobals()
  })

  it('leaves console.warn alone when consoleShim is false', async () => {
    const before = console.warn
    const { AudioEngine } = await import('./AudioEngine')
    new AudioEngine({ consoleShim: false })
    expect(console.warn).toBe(before)
  })
  it('installs the console shim by default', async () => {
    const before = console.warn
    const { AudioEngine } = await import('./AudioEngine')
    new AudioEngine()
    expect(console.warn).not.toBe(before)
    console.warn = before
  })
  it('getEngine applies options only on first creation', async () => {
    const before = console.warn
    const { getEngine } = await import('./AudioEngine')
    const a = getEngine({ consoleShim: false })
    expect(getEngine()).toBe(a)
    expect(console.warn).toBe(before)
  })
  it('logs to the console by default', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { AudioEngine } = await import('./AudioEngine')
    new AudioEngine({ consoleShim: false })
    expect(spy).toHaveBeenCalledWith('[engine] ctor', expect.anything())
    spy.mockRestore()
  })
  it('a quiet engine does not log to the console', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { AudioEngine } = await import('./AudioEngine')
    new AudioEngine({ consoleShim: false, quiet: true })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('a quiet engine logs while debug mode is on', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { useStore } = await import('../state/useStore')
    useStore.setState({ debugMode: true })
    const { AudioEngine } = await import('./AudioEngine')
    new AudioEngine({ consoleShim: false, quiet: true })
    expect(spy).toHaveBeenCalledWith('[engine] ctor', expect.anything())
    useStore.setState({ debugMode: false })
    spy.mockRestore()
  })
  it('suspend() suspends the context', async () => {
    const { AudioEngine } = await import('./AudioEngine')
    const e = new AudioEngine({ consoleShim: false })
    await e.suspend()
    expect((e.context as unknown as { suspend: Mock }).suspend).toHaveBeenCalledOnce()
  })
})
