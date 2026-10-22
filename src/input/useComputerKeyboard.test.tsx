import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { keyLabelForSemitone, useComputerKeyboard } from './useComputerKeyboard'
import { useStore } from '../state/useStore'

afterEach(cleanup)

describe('useComputerKeyboard with a modal open', () => {
  it('Escape panics normally', () => {
    const panic = vi.fn()
    renderHook(() => useComputerKeyboard({ noteOn: vi.fn(), noteOff: vi.fn(), panic }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(panic).toHaveBeenCalledOnce()
  })

  it('ignores Escape and note keys while an aria-modal dialog is open', () => {
    const panic = vi.fn()
    const noteOn = vi.fn()
    render(<div role="dialog" aria-modal="true" />)
    renderHook(() => useComputerKeyboard({ noteOn, noteOff: vi.fn(), panic }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'a' })
    expect(panic).not.toHaveBeenCalled()
    expect(noteOn).not.toHaveBeenCalled()
  })
})

describe('keyLabelForSemitone', () => {
  it('maps semitones to upper-cased letters', () => {
    expect(keyLabelForSemitone(0)).toBe('A')
    expect(keyLabelForSemitone(1)).toBe('W')
    expect(keyLabelForSemitone(16)).toBe(';')
    expect(keyLabelForSemitone(17)).toBe("'")
    expect(keyLabelForSemitone(18)).toBeNull()
    expect(keyLabelForSemitone(-1)).toBeNull()
  })
})

describe('useComputerKeyboard focus-scoped mode', () => {
  const noteOn = vi.fn()
  const noteOff = vi.fn()
  const panic = vi.fn()
  let armed = false

  function Harness({ withModal = false }: { withModal?: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    armed = useComputerKeyboard({ noteOn, noteOff, panic }, { target: ref }).armed
    return (
      <>
        <div data-testid="root" tabIndex={0} ref={ref}>
          <input data-testid="inner" />
          {withModal && <div role="dialog" aria-modal="true" />}
        </div>
        <input data-testid="outside" />
      </>
    )
  }

  beforeEach(() => {
    noteOn.mockReset()
    noteOff.mockReset()
    panic.mockReset()
    useStore.setState({ octave: 4, velocity: 100 })
  })

  const els = () => ({
    root: screen.getByTestId('root'),
    inner: screen.getByTestId('inner'),
    outside: screen.getByTestId('outside'),
  })

  it('keys typed outside the root do nothing', () => {
    render(<Harness />)
    const { outside } = els()
    outside.focus()
    fireEvent.keyDown(outside, { key: 'a' })
    expect(noteOn).not.toHaveBeenCalled()
  })

  it('plays while the root has focus', () => {
    render(<Harness />)
    const { root } = els()
    root.focus()
    fireEvent.keyDown(root, { key: 'a' })
    expect(noteOn).toHaveBeenCalledWith(60, 100)
  })

  it('text input inside the root does not play', () => {
    render(<Harness />)
    const { inner } = els()
    inner.focus()
    fireEvent.keyDown(inner, { key: 'a' })
    expect(noteOn).not.toHaveBeenCalled()
  })

  it('focus leaving releases only keyboard-held notes, without panic', () => {
    render(<Harness />)
    const { root, outside } = els()
    root.focus()
    fireEvent.keyDown(root, { key: 'a' })
    fireEvent.keyDown(root, { key: 'w' })
    fireEvent.focusOut(root, { relatedTarget: outside })
    expect(noteOff.mock.calls.map((c) => c[0]).sort()).toEqual([60, 61])
    expect(panic).not.toHaveBeenCalled()
  })

  it('a host-page aria-modal does not disable the keys', () => {
    render(<div role="dialog" aria-modal="true" />)
    render(<Harness />)
    const { root } = els()
    root.focus()
    fireEvent.keyDown(root, { key: 'a' })
    expect(noteOn).toHaveBeenCalled()
  })

  it('an aria-modal inside the root does disable them', () => {
    render(<Harness withModal />)
    const { root } = els()
    root.focus()
    fireEvent.keyDown(root, { key: 'a' })
    expect(noteOn).not.toHaveBeenCalled()
  })

  it('armed follows focus', () => {
    render(<Harness />)
    const { root } = els()
    expect(armed).toBe(false)
    act(() => root.focus())
    expect(armed).toBe(true)
  })
})

describe('useComputerKeyboard held notes', () => {
  beforeEach(() => useStore.setState({ octave: 4, velocity: 100 }))

  it('releases the pitch that sounded after an octave shift mid-hold', () => {
    const noteOff = vi.fn()
    renderHook(() => useComputerKeyboard({ noteOn: vi.fn(), noteOff, panic: vi.fn() }))
    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: 'x' })
    fireEvent.keyUp(window, { key: 'a' })
    expect(noteOff).toHaveBeenCalledWith(60)
  })
})
