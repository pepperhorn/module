import { useMemo, useRef, useState } from 'react'
import { EFFECT_DEFS, type EffectId } from '../audio/effects'
import { EffectPedal } from './EffectPedal'
import { useStore } from '../state/useStore'
import { getEngine } from '../audio/AudioEngine'

// Effects that actually live in the audio graph (doublers are note-level, so
// their position is cosmetic). Used for the chain-map legend.
const AUDIO_FX: EffectId[] = ['distortion', 'chorus', 'delay', 'reverb']

export function EffectsRow() {
  const fxEnabled = useStore((s) => s.fxEnabled)
  const fxParams = useStore((s) => s.fxParams)
  const fxOrder = useStore((s) => s.fxOrder)
  const toggleFxEnabled = useStore((s) => s.toggleFxEnabled)
  const setFxParam = useStore((s) => s.setFxParam)
  const setFxOrder = useStore((s) => s.setFxOrder)

  const defsById = useMemo(
    () => Object.fromEntries(EFFECT_DEFS.map((d) => [d.id, d])),
    [],
  )
  const ordered = fxOrder.map((id) => defsById[id]).filter(Boolean)

  const [dragId, setDragId] = useState<EffectId | null>(null)
  const dragIdRef = useRef<EffectId | null>(null)

  // Begin a drag from a pedal's grip. Listeners are attached synchronously here
  // (not via an effect keyed on state) so an immediate move is never missed.
  // The pointer reorders live as it moves over other pedals; on release we
  // commit the new order to the audio graph.
  const onDragStart = (id: EffectId) => (e: React.PointerEvent) => {
    e.preventDefault()
    dragIdRef.current = id
    setDragId(id)

    const onMove = (ev: PointerEvent) => {
      const drag = dragIdRef.current
      if (!drag) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const pedal = (el as HTMLElement | null)?.closest('[data-fx-id]') as
        | HTMLElement
        | null
      const targetId = pedal?.dataset.fxId as EffectId | undefined
      if (!targetId || targetId === drag) return
      const cur = useStore.getState().fxOrder
      const next = cur.filter((x) => x !== drag)
      const idx = next.indexOf(targetId)
      if (idx < 0) return
      next.splice(idx, 0, drag)
      setFxOrder(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragIdRef.current = null
      setDragId(null)
      getEngine().setEffectOrder(useStore.getState().fxOrder)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const chainLabel = fxOrder
    .filter((id) => AUDIO_FX.includes(id))
    .map((id) => defsById[id]?.name)
    .filter(Boolean)
    .join(' → ')

  return (
    <section
      className="effects-row rack-panel flex flex-col gap-2 rounded-lg p-3"
      aria-label="Effects chain"
    >
      <span className="effects-row-title group-legend legend">EFFECTS</span>
      <header className="effects-row-header flex items-center justify-between gap-3">
        <span className="effects-row-hint legend">drag ⠿ to reorder</span>
        <span className="effects-row-chain legend">{chainLabel}</span>
      </header>
      <div className="effects-row-pedals scroll-clean flex gap-3 overflow-x-auto pb-1">
        {ordered.map((def) => (
          <div key={def.id} data-fx-id={def.id} className="shrink-0">
            <EffectPedal
              def={def}
              enabled={fxEnabled[def.id]}
              params={fxParams[def.id]}
              dragging={dragId === def.id}
              onDragStart={onDragStart(def.id)}
              onToggle={(id) => {
                toggleFxEnabled(id)
                getEngine().setEffectEnabled(id, !fxEnabled[id])
              }}
              onParamChange={(id, paramId, value) => {
                setFxParam(id, paramId, value)
                getEngine().setEffectParam(id, paramId, value)
              }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
