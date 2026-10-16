import { useMemo, useRef, useState } from 'react'
import { EFFECT_DEFS, isChainEffectId, type ChainEffectId, type EffectId } from '../audio/effects'
import { EffectPedal } from './EffectPedal'
import { useStore } from '../state/useStore'
import { getEngine } from '../audio/AudioEngine'

interface EffectsRowProps {
  /**
   * Put the pedalboard behind a show/hide toggle. Keyboard mode uses this so
   * the keys keep the screen unless you actually want the FX.
   */
  collapsible?: boolean
}

/** Note-level effects: fired per note, so they sit ahead of the audio chain. */
const NOTE_EFFECT_IDS: EffectId[] = ['doubler1', 'doubler2']

export function EffectsRow({ collapsible = false }: EffectsRowProps) {
  const fxEnabled = useStore((s) => s.fxEnabled)
  const fxParams = useStore((s) => s.fxParams)
  const fxOrder = useStore((s) => s.fxOrder)
  const toggleFxEnabled = useStore((s) => s.toggleFxEnabled)
  const setFxParam = useStore((s) => s.setFxParam)
  const setFxOrder = useStore((s) => s.setFxOrder)
  const fxVisible = useStore((s) => s.fxVisible)
  const toggleFxVisible = useStore((s) => s.toggleFxVisible)

  const noteDefs = useMemo(
    () => NOTE_EFFECT_IDS.map((id) => EFFECT_DEFS.find((d) => d.id === id)).filter((d) => d != null),
    [],
  )
  const chainDefs = useMemo(
    () => fxOrder.map((id) => EFFECT_DEFS.find((d) => d.id === id)).filter((d) => d != null),
    [fxOrder],
  )

  const shown = collapsible ? fxVisible : true
  const activeCount = EFFECT_DEFS.filter((def) => fxEnabled[def.id]).length
  const signalPath = [...noteDefs, ...chainDefs].map((d) => d.name).join(' → ')

  const [dragId, setDragId] = useState<ChainEffectId | null>(null)
  const dragIdRef = useRef<ChainEffectId | null>(null)

  // Begin a drag from a chain pedal's grip. Listeners are attached
  // synchronously here (not via an effect keyed on state) so an immediate move
  // is never missed. The pointer reorders live as it moves over other chain
  // pedals; on release the order the store settled on is wired into the audio
  // graph. Only audio-chain effects are draggable — the doublers are
  // note-level and have no position in the chain.
  const onDragStart = (id: ChainEffectId) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragIdRef.current = id
    setDragId(id)

    const onMove = (ev: PointerEvent) => {
      const drag = dragIdRef.current
      if (!drag) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const pedal = (el as HTMLElement | null)?.closest('[data-fx-id]') as HTMLElement | null
      const targetId = pedal?.dataset.fxId
      if (!targetId || targetId === drag || !isChainEffectId(targetId)) return
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
      // Read the order back rather than recomputing it, so the chain is wired
      // from exactly what the store settled on.
      getEngine().setEffectOrder(useStore.getState().fxOrder)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onToggle = (id: EffectId) => {
    toggleFxEnabled(id)
    getEngine().setEffectEnabled(id, !fxEnabled[id])
  }
  const onParamChange = (id: EffectId, paramId: string, value: number) => {
    setFxParam(id, paramId, value)
    getEngine().setEffectParam(id, paramId, value)
  }

  return (
    <section
      className={`effects-row rack-panel flex shrink-0 flex-col gap-2 rounded-lg ${
        shown ? 'p-3' : 'px-3 py-2'
      }`}
      aria-label="Effects chain"
    >
      <span className="effects-row-title group-legend legend">EFFECTS</span>
      <header
        className={`effects-row-header flex items-center gap-3 ${
          shown ? 'justify-between' : 'justify-end'
        }`}
      >
        {shown && (
          <>
            <span className="effects-row-hint legend shrink-0">drag ⠿ to reorder</span>
            <span className="effects-row-chain legend min-w-0 truncate">{signalPath}</span>
          </>
        )}
        {collapsible && (
          <button
            type="button"
            aria-expanded={shown}
            onClick={(e) => {
              e.stopPropagation()
              toggleFxVisible()
            }}
            className="effects-row-toggle hw-btn hw-btn-accent flex h-11 shrink-0 items-center gap-2 px-3"
            style={{ ['--hw-accent' as string]: 'var(--color-lavender)', touchAction: 'manipulation' }}
          >
            <span
              aria-hidden="true"
              className="effects-row-toggle-led hw-btn-led"
              style={
                activeCount > 0
                  ? {
                      background: 'var(--color-lavender)',
                      boxShadow: '0 0 5px rgba(181,156,217,0.8)',
                    }
                  : {}
              }
            />
            <span className="effects-row-toggle-label legend-strong">
              {shown ? 'HIDE FX ▴' : `SHOW FX ▾ · ${activeCount} ON`}
            </span>
          </button>
        )}
      </header>
      {shown && (
        <div
          className={`effects-row-pedals scroll-clean flex items-start gap-3 overflow-x-auto pb-1 ${
            // In keyboard mode the pedals are a guest on a screen that belongs
            // to the keys: cap them and let them scroll rather than pushing the
            // keyboard off the bottom of a phone.
            collapsible ? 'max-h-[34dvh] overflow-y-auto' : ''
          }`}
        >
          {noteDefs.map((def) => (
            <div key={def.id} className="effects-row-slot effects-row-slot-note shrink-0">
              <EffectPedal
                def={def}
                enabled={fxEnabled[def.id]}
                params={fxParams[def.id]}
                onToggle={onToggle}
                onParamChange={onParamChange}
              />
            </div>
          ))}
          {chainDefs.map((def) => {
            const id = def.id as ChainEffectId
            return (
              <div key={id} data-fx-id={id} className="effects-row-slot effects-row-slot-chain shrink-0">
                <EffectPedal
                  def={def}
                  enabled={fxEnabled[id]}
                  params={fxParams[id]}
                  dragging={dragId === id}
                  onDragStart={onDragStart(id)}
                  onToggle={onToggle}
                  onParamChange={onParamChange}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
