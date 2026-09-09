import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/useStore'

interface TouchKeyboardProps {
  noteOn: (midi: number, velocity: number) => void
  noteOff: (midi: number) => void
  octaves?: number
  /**
   * Stretch to fill the parent instead of using the fixed rack height. Used by
   * keyboard mode, where the keys take the lion's share of the viewport.
   */
  fill?: boolean
}

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]

interface KeySpec {
  midi: number
  type: 'white' | 'black'
  whiteIndex: number
  label: string
}

function buildKeys(startMidi: number, octaves: number): KeySpec[] {
  const out: KeySpec[] = []
  let whiteIndex = 0
  const totalSemitones = octaves * 12 + 1
  for (let i = 0; i < totalSemitones; i++) {
    const midi = startMidi + i
    const semitone = ((midi % 12) + 12) % 12
    const isWhite = WHITE_OFFSETS.includes(semitone)
    out.push({
      midi,
      type: isWhite ? 'white' : 'black',
      whiteIndex: isWhite ? whiteIndex : -1,
      label: midiToShort(midi),
    })
    if (isWhite) whiteIndex++
  }
  return out
}

function midiToShort(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const oct = Math.floor(midi / 12) - 1
  return `${names[((midi % 12) + 12) % 12]}${oct}`
}

function midiFromTarget(target: EventTarget | null): number | null {
  let el = target as HTMLElement | null
  while (el) {
    const m = el.dataset?.midi
    if (m != null) {
      const n = Number(m)
      return Number.isFinite(n) ? n : null
    }
    el = el.parentElement
  }
  return null
}

function midiFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)
  return midiFromTarget(el)
}

export function TouchKeyboard({
  noteOn,
  noteOff,
  octaves = 2,
  fill = false,
}: TouchKeyboardProps) {
  const octave = useStore((s) => s.octave)
  const velocity = useStore((s) => s.velocity)
  const startMidi = (octave + 1) * 12

  const keys = useMemo(() => buildKeys(startMidi, octaves), [startMidi, octaves])
  const whiteKeys = useMemo(() => keys.filter((k) => k.type === 'white'), [keys])
  const blackKeys = useMemo(() => keys.filter((k) => k.type === 'black'), [keys])
  const whiteKeyWidth = 100 / whiteKeys.length

  const heldRef = useRef<Map<number, number>>(new Map())
  const [pressed, setPressed] = useState<Set<number>>(new Set())

  const press = useCallback(
    (pointerId: number, midi: number) => {
      const prev = heldRef.current.get(pointerId)
      if (prev === midi) return
      if (prev != null) {
        noteOff(prev)
      }
      heldRef.current.set(pointerId, midi)
      noteOn(midi, velocity)
      setPressed((p) => {
        const next = new Set(p)
        if (prev != null) {
          let stillHeld = false
          for (const v of heldRef.current.values()) {
            if (v === prev) {
              stillHeld = true
              break
            }
          }
          if (!stillHeld) next.delete(prev)
        }
        next.add(midi)
        return next
      })
    },
    [noteOn, noteOff, velocity],
  )

  const release = useCallback(
    (pointerId: number) => {
      const midi = heldRef.current.get(pointerId)
      if (midi == null) return
      heldRef.current.delete(pointerId)
      noteOff(midi)
      setPressed((p) => {
        let stillHeld = false
        for (const v of heldRef.current.values()) {
          if (v === midi) {
            stillHeld = true
            break
          }
        }
        if (stillHeld) return p
        const next = new Set(p)
        next.delete(midi)
        return next
      })
    },
    [noteOff],
  )

  // Release any held notes if octave changes mid-hold
  useEffect(() => {
    return () => {
      for (const midi of heldRef.current.values()) noteOff(midi)
      heldRef.current.clear()
      setPressed(new Set())
    }
  }, [octave, noteOff])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const midi = midiFromPoint(e.clientX, e.clientY)
      if (midi == null) return
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // noop
      }
      press(e.pointerId, midi)
    },
    [press],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!heldRef.current.has(e.pointerId)) return
      const midi = midiFromPoint(e.clientX, e.clientY)
      if (midi == null) {
        // moved off any key — release this finger
        release(e.pointerId)
        return
      }
      press(e.pointerId, midi)
    },
    [press, release],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      release(e.pointerId)
    },
    [release],
  )

  return (
    <div
      className={`touch-keyboard rack-panel rounded-xl p-3 ${
        fill ? 'flex h-full min-h-0 flex-col' : ''
      }`}
    >
      <div className="touch-keyboard-header mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-text/40">
        <span>
          TOUCH · OCT {octave}–{octave + octaves}
        </span>
        <span>tap or slide · vel {velocity}</span>
      </div>
      <div
        className={`touch-keyboard-body relative select-none overflow-hidden rounded-md ${
          fill ? 'min-h-0 flex-1' : 'h-28'
        }`}
        style={{
          background: 'linear-gradient(180deg, #1A1A2E 0%, #2E2E4F 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
          touchAction: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {whiteKeys.map((k) => {
          const isPressed = pressed.has(k.midi)
          return (
            <div
              key={`w-${k.midi}`}
              data-midi={k.midi}
              className={`touch-key touch-key-white absolute bottom-0 top-0 flex flex-col items-center justify-end pb-2 font-mono text-[9px] uppercase ${
                isPressed ? 'touch-key-pressed' : ''
              }`}
              style={{
                left: `${k.whiteIndex * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                background: isPressed
                  ? 'linear-gradient(180deg, var(--color-sky) 0%, #4AA8D2 100%)'
                  : 'linear-gradient(180deg, #FFFFFF 0%, #F0F2F5 100%)',
                borderRight: '1px solid rgba(20,30,60,0.15)',
                borderBottom: isPressed
                  ? '4px solid #2A6E92'
                  : '4px solid color-mix(in srgb, var(--color-sky) 30%, #B8BFCC)',
                color: isPressed ? 'rgba(255,255,255,0.85)' : 'rgba(20,30,60,0.4)',
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              {k.midi % 12 === 0 ? k.label : ''}
            </div>
          )
        })}
        {blackKeys.map((k) => {
          const whiteBelow = whiteKeys.findIndex((w) => w.midi === k.midi - 1)
          if (whiteBelow < 0 || whiteBelow >= whiteKeys.length - 1) return null
          const left = (whiteBelow + 1) * whiteKeyWidth - whiteKeyWidth * 0.32
          const isPressed = pressed.has(k.midi)
          return (
            <div
              key={`b-${k.midi}`}
              data-midi={k.midi}
              className={`touch-key touch-key-black absolute top-0 z-10 ${
                isPressed ? 'touch-key-pressed' : ''
              }`}
              style={{
                left: `${left}%`,
                width: `${whiteKeyWidth * 0.64}%`,
                height: '62%',
                background: isPressed
                  ? 'linear-gradient(180deg, var(--color-coral) 0%, #C84A4A 100%)'
                  : 'linear-gradient(180deg, #1A1A2E 0%, #2E2E4F 100%)',
                borderRadius: '0 0 4px 4px',
                boxShadow: isPressed
                  ? 'inset 0 -3px 0 rgba(0,0,0,0.4), 0 0 12px rgba(255,107,107,0.5)'
                  : 'inset 0 -3px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.4)',
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
