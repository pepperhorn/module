import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TouchKeyboard } from './TouchKeyboard'
import { useStore } from '../state/useStore'

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

describe('TouchKeyboard computer-key labels', () => {
  const label = (c: HTMLElement, midi: number) =>
    c.querySelector(`[data-midi="${midi}"] .touch-key-label`)?.textContent ?? null

  it('labels the playable keys with their computer-keyboard letters', () => {
    useStore.setState({ octave: 4 })
    const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} keyLabels />)
    expect(label(container, 60)).toBe('A')
    expect(label(container, 61)).toBe('W')
    expect(label(container, 76)).toBe(';')
    expect(label(container, 77)).toBe("'")
    expect(label(container, 78)).toBeNull()
    expect(container.querySelectorAll('.touch-key-label')).toHaveLength(18)
  })

  it('labels follow the octave', () => {
    useStore.setState({ octave: 3 })
    const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} keyLabels />)
    expect(label(container, 48)).toBe('A')
    expect(label(container, 60)).toBe('K')
  })

  it('shows no labels by default', () => {
    const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} />)
    expect(container.querySelectorAll('.touch-key-label')).toHaveLength(0)
  })
})
