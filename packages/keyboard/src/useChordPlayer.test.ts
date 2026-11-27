import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Accidentals, ChordType } from './theory'
import { useChordPlayer } from './useChordPlayer'

function setup(chord: ChordType = 'maj', isDrums = false, accidentals: Accidentals = 'flat') {
  const noteOn = vi.fn()
  const noteOff = vi.fn()
  const hook = renderHook(
    ({ chord, isDrums }) => useChordPlayer({ mode: 'chord', chord, isDrums, accidentals, noteOn, noteOff }),
    { initialProps: { chord, isDrums } },
  )
  return { ...hook, noteOn, noteOff }
}

describe('useChordPlayer', () => {
  it('plays, labels and releases a major chord at the input velocity', () => {
    const { result, noteOn, noteOff } = setup()
    act(() => result.current.press(60, 92))
    expect(noteOn.mock.calls).toEqual([[60, 92], [64, 92], [67, 92]])
    expect([...result.current.lit]).toEqual([
      [60, { name: 'C', color: '#f86e6e', root: true }],
      [64, { name: 'E', color: '#fff56d', root: false }],
      [67, { name: 'G', color: '#6bc6a0', root: false }],
    ])
    act(() => result.current.release(60))
    expect(noteOff.mock.calls).toEqual([[60], [64], [67]])
  })

  it('releases the voices it started even if chord type changed while held', () => {
    const { result, rerender, noteOn, noteOff } = setup()
    act(() => result.current.press(60, 90))
    rerender({ chord: 'min', isDrums: false })
    act(() => result.current.press(57, 100))
    expect(noteOn.mock.calls).toEqual([[60, 90], [64, 90], [67, 90], [57, 100]])
    act(() => result.current.release(60))
    expect(noteOff.mock.calls).toEqual([[67]])
    act(() => result.current.release(57))
    expect(noteOff.mock.calls).toEqual([[67], [57], [60], [64]])
  })

  it('keeps a root sounding while a second input still holds it', () => {
    const { result, noteOn, noteOff } = setup()
    act(() => {
      result.current.press(60, 90)
      result.current.press(60, 100)
      result.current.release(60)
    })
    expect(noteOn).toHaveBeenCalledTimes(3)
    expect(noteOff).not.toHaveBeenCalled()
    act(() => result.current.release(60))
    expect(noteOff.mock.calls).toEqual([[60], [64], [67]])
  })

  it.each([
    ['sharp', ['C♯', 'E♯', 'G♯']],
    ['flat', ['D♭', 'F', 'A♭']],
  ] satisfies [Accidentals, string[]][])('spells a black-key major chord with %s accidentals', (accidentals, names) => {
    const { result } = setup('maj', false, accidentals)
    act(() => result.current.press(61, 100))
    expect([...result.current.lit.values()].map(tone => tone.name)).toEqual(names)
  })

  it('ignores chords and silent pads on drums', () => {
    const { result, noteOn } = setup('maj', true)
    act(() => {
      result.current.press(39, 100)
      result.current.press(38, 90)
    })
    expect(noteOn.mock.calls).toEqual([[38, 90]])
  })
})
