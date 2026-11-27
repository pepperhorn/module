import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { KeyboardSurface } from './KeyboardSurface'
import { DRUM_MAP } from './patches/drumMap'

afterEach(cleanup)

const props = { low: 48, high: 72, showNames: true, lit: new Map(), press: vi.fn(), release: vi.fn() }
const key = (container: HTMLElement, midi: number) => container.querySelector(`[data-midi="${midi}"]`)

it('names every key without octaves and follows the accidental preference', () => {
  const { container, rerender } = render(<KeyboardSurface {...props} accidentals="flat" />)
  expect(container.querySelectorAll('.kb-key-name')).toHaveLength(25)
  expect(key(container, 49)?.textContent).toBe('D♭')
  expect(key(container, 48)?.textContent).toBe('C')
  rerender(<KeyboardSurface {...props} accidentals="sharp" />)
  expect(key(container, 49)?.textContent).toBe('C♯')
})

it('shows the entire drum range, names mapped pads and dims unmapped keys', () => {
  const { container } = render(<KeyboardSurface {...props} accidentals="flat" isDrums />)
  expect(container.querySelectorAll('[data-midi]')).toHaveLength(25)
  expect(key(container, 35)).not.toBeNull()
  expect(key(container, 59)).not.toBeNull()
  for (const { midi, short } of DRUM_MAP) expect(key(container, midi)?.textContent).toBe(short)
  expect(key(container, 39)?.classList.contains('kb-key-dim')).toBe(true)
})

it('renders visible chord badges only', () => {
  const lit = new Map([
    [69, { name: 'A', color: '#88a7f8', root: true }],
    [73, { name: 'C♯', color: '#f58841', root: false }],
    [76, { name: 'E', color: '#fff56d', root: false }],
  ])
  const { container, rerender } = render(<KeyboardSurface {...props} high={72} lit={lit} accidentals="flat" showNames={false} />)
  expect(container.querySelectorAll('.kb-chord-badge')).toHaveLength(1)
  expect(key(container, 69)?.textContent).toBe('A')
  expect(key(container, 73)).toBeNull()
  rerender(<KeyboardSurface {...props} high={76} lit={lit} accidentals="flat" showNames={false} />)
  expect(key(container, 73)?.textContent).toBe('C♯')
  expect((key(container, 73) as HTMLElement).style.getPropertyValue('--kb-note-color')).toBe('#f58841')
})
