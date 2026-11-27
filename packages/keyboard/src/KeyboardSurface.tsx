import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { DRUM_RANGE, drumPadFor } from './patches/drumMap'
import { pitchName, type Accidentals } from './theory'
import type { LitKey } from './useChordPlayer'

interface KeyboardSurfaceProps {
  low: number
  high: number
  showNames: boolean
  accidentals: Accidentals
  isDrums?: boolean
  lit: ReadonlyMap<number, LitKey>
  badges?: ReadonlySet<number>
  press(midi: number, velocity: number): boolean | void
  release(midi: number): void
}

const BLACK = new Set([1, 3, 6, 8, 10])

export function KeyboardSurface({
  low, high, showNames, accidentals, isDrums = false, lit, badges, press, release,
}: KeyboardSurfaceProps) {
  const start = isDrums ? DRUM_RANGE.low : low
  const end = isDrums ? DRUM_RANGE.high : high
  const keys = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  const whites = keys.filter(midi => !BLACK.has(midi % 12))
  const whiteWidth = 100 / whites.length
  const blackWidth = whiteWidth * 0.64
  const held = useRef(new Map<number, number>())
  useEffect(() => {
    const pointers = held.current
    return () => {
      for (const midi of pointers.values()) release(midi)
      pointers.clear()
    }
  }, [start, end, release])

  function releasePointer(pointerId: number) {
    const midi = held.current.get(pointerId)
    if (midi === undefined) return
    held.current.delete(pointerId)
    release(midi)
  }

  function move(event: PointerEvent<HTMLDivElement>, target: Element | null) {
    const key = target?.closest<HTMLElement>('[data-midi]')
    const midi = key && event.currentTarget.contains(key) && !key.classList.contains('kb-key-dim')
      ? Number(key.dataset.midi) : null
    if (held.current.get(event.pointerId) === midi) return
    releasePointer(event.pointerId)
    if (midi !== null && press(midi, 100) !== false) held.current.set(event.pointerId, midi)
  }

  function drawKey(midi: number) {
    const black = BLACK.has(midi % 12)
    const left = black
      ? Math.min(100 - blackWidth, Math.max(0, (whites.indexOf(midi - 1) + 1) * whiteWidth - blackWidth / 2))
      : whites.indexOf(midi) * whiteWidth
    const style = { left: `${left}%`, width: `${black ? blackWidth : whiteWidth}%` }
    const tone = lit.get(midi)
    const badge = tone && (badges?.has(midi) ?? true)
    const drum = isDrums ? drumPadFor(midi) : undefined
    const dim = isDrums && !drum
    const name = drum?.short ?? (isDrums ? '' : pitchName(midi, accidentals))
    return (
      <div
        key={midi}
        data-midi={midi}
        className={`kb-key absolute select-none ${black ? 'kb-key-black' : 'kb-key-white'}${dim ? ' kb-key-dim' : ''}${tone?.root ? ' kb-key-pressed' : ''}${tone && !tone.root ? ' kb-key-tone' : ''}`}
        style={{ ...style, '--kb-note-color': tone?.color } as CSSProperties}
        aria-label={drum?.label ?? (name || 'Unmapped drum key')}
        aria-disabled={dim || undefined}
      >
        {(badge || (showNames && name)) && (
          <svg className={`kb-key-name pointer-events-none ${badge ? 'kb-chord-badge' : 'kb-key-name-muted'}`} viewBox={isDrums ? '0 0 96 32' : '0 0 40 32'} aria-hidden="true">
            <text className="kb-note-text" x={isDrums ? 48 : 20} y="16">{badge && !isDrums ? tone.name : name}</text>
          </svg>
        )}
      </div>
    )
  }

  return (
    <div
      className="kb-surface relative w-full overflow-hidden"
      aria-label={isDrums ? 'Drum keys' : 'Piano keys'}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        move(event, event.target as Element)
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          move(event, document.elementFromPoint(event.clientX, event.clientY))
        }
      }}
      onPointerUp={event => releasePointer(event.pointerId)}
      onPointerCancel={event => releasePointer(event.pointerId)}
      onLostPointerCapture={event => releasePointer(event.pointerId)}
    >
      {keys.map(drawKey)}
    </div>
  )
}
