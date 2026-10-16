import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EffectPedal } from './EffectPedal'
import { EFFECT_DEFS } from '../audio/effects'

afterEach(cleanup)

const def = EFFECT_DEFS.find((d) => d.id === 'reverb')!

describe('EffectPedal keyboard reorder', () => {
  it('grip handles arrows and Home/End', () => {
    const onMove = vi.fn()
    render(
      <EffectPedal
        def={def}
        enabled
        params={{}}
        onToggle={() => {}}
        onParamChange={() => {}}
        onDragStart={() => {}}
        onMove={onMove}
        position={{ index: 2, total: 4 }}
      />,
    )
    const grip = screen.getByRole('button', { name: /reorder reverb, position 2 of 4/i })
    expect(grip.getAttribute('aria-describedby')).toBeTruthy()
    fireEvent.keyDown(grip, { key: 'ArrowRight' })
    fireEvent.keyDown(grip, { key: 'ArrowLeft' })
    fireEvent.keyDown(grip, { key: 'Home' })
    fireEvent.keyDown(grip, { key: 'End' })
    fireEvent.keyDown(grip, { key: 'a' })
    expect(onMove.mock.calls).toEqual([[1], [-1], ['start'], ['end']])
  })
})
