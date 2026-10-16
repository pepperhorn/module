import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TouchKeyboard } from './TouchKeyboard'

afterEach(cleanup)

const noop = () => {}

describe('TouchKeyboard active-note highlight', () => {
  it('highlights a key whose midi is in the activeNotes prop', () => {
    // Discover a real rendered key first (independent of the default octave).
    const probe = render(
      <TouchKeyboard noteOn={noop} noteOff={noop} activeNotes={new Set()} />,
    )
    const first = probe.container.querySelector('[data-midi]') as HTMLElement
    const midi = Number(first.dataset.midi)
    cleanup()

    const { container } = render(
      <TouchKeyboard noteOn={noop} noteOff={noop} activeNotes={new Set([midi])} />,
    )
    const key = container.querySelector(`[data-midi="${midi}"]`)
    expect(key?.className).toContain('touch-key-pressed')
  })

  it('does not highlight keys absent from activeNotes', () => {
    const { container } = render(
      <TouchKeyboard noteOn={noop} noteOff={noop} activeNotes={new Set()} />,
    )
    const key = container.querySelector('[data-midi]')
    expect(key?.className).not.toContain('touch-key-pressed')
  })
})
