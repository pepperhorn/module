import { useMemo, useState } from 'react'
import { EFFECT_DEFS, isChainEffectId, type EffectId } from '../audio/effects'
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
  const moveFx = useStore((s) => s.moveFx)
  const fxVisible = useStore((s) => s.fxVisible)
  const toggleFxVisible = useStore((s) => s.toggleFxVisible)

  // Pedals start closed — the board is for reaching a footswitch, not a pot.
  const [expanded, setExpanded] = useState<Set<EffectId>>(new Set())
  const toggleExpanded = (id: EffectId) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  const handleMove = (id: EffectId, delta: number) => {
    if (!isChainEffectId(id)) return
    moveFx(id, delta)
    // Read the order back rather than recomputing it, so the chain is wired
    // from exactly what the store settled on.
    getEngine().setEffectOrder(useStore.getState().fxOrder)
  }

  return (
    <section
      className={`effects-row rack-panel flex shrink-0 flex-col gap-2 rounded-xl ${
        shown ? 'p-3 sm:p-4' : 'px-3 py-2'
      }`}
      aria-label="Effects chain"
    >
      <header
        className={`effects-row-header flex items-center gap-3 ${
          shown ? 'justify-between' : 'justify-end'
        }`}
      >
        {shown && (
          <span className="effects-row-path truncate font-mono text-[10px] uppercase tracking-widest text-text/50">
            {signalPath}
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            aria-expanded={shown}
            onClick={(e) => {
              e.stopPropagation()
              toggleFxVisible()
            }}
            className="effects-row-toggle cell-hit h-11 shrink-0 rounded-lg px-3 font-mono text-[10px] uppercase tracking-widest"
            style={{
              background: shown
                ? 'linear-gradient(180deg, var(--color-lavender) 0%, #9C82C6 100%)'
                : 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
              color: shown ? 'var(--color-bg)' : 'var(--color-text)',
              border: shown ? '1px solid transparent' : '1px solid var(--color-rack-edge)',
              touchAction: 'manipulation',
            }}
          >
            {shown ? 'HIDE FX ▴' : `SHOW FX ▾ · ${activeCount} ON`}
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
            <EffectPedal
              key={def.id}
              def={def}
              enabled={fxEnabled[def.id]}
              params={fxParams[def.id]}
              expanded={expanded.has(def.id)}
              onToggleExpanded={toggleExpanded}
              onToggle={(id) => {
                toggleFxEnabled(id)
                getEngine().setEffectEnabled(id, !fxEnabled[id])
              }}
              onParamChange={(id, paramId, value) => {
                setFxParam(id, paramId, value)
                getEngine().setEffectParam(id, paramId, value)
              }}
            />
          ))}
          {chainDefs.map((def, index) => (
            <EffectPedal
              key={def.id}
              def={def}
              enabled={fxEnabled[def.id]}
              params={fxParams[def.id]}
              expanded={expanded.has(def.id)}
              onToggleExpanded={toggleExpanded}
              onMove={(delta) => handleMove(def.id, delta)}
              canMoveEarlier={index > 0}
              canMoveLater={index < chainDefs.length - 1}
              position={index + 1}
              chainLength={chainDefs.length}
              onToggle={(id) => {
                toggleFxEnabled(id)
                getEngine().setEffectEnabled(id, !fxEnabled[id])
              }}
              onParamChange={(id, paramId, value) => {
                setFxParam(id, paramId, value)
                getEngine().setEffectParam(id, paramId, value)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
