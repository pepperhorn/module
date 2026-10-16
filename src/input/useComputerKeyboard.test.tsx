import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { useComputerKeyboard } from './useComputerKeyboard'

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
