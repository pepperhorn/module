import { EFFECT_DEFS } from '../audio/effects'
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

export function EffectsRow({ collapsible = false }: EffectsRowProps) {
  const fxEnabled = useStore((s) => s.fxEnabled)
  const fxParams = useStore((s) => s.fxParams)
  const toggleFxEnabled = useStore((s) => s.toggleFxEnabled)
  const setFxParam = useStore((s) => s.setFxParam)
  const fxVisible = useStore((s) => s.fxVisible)
  const toggleFxVisible = useStore((s) => s.toggleFxVisible)

  const shown = collapsible ? fxVisible : true
  const activeCount = EFFECT_DEFS.filter((def) => fxEnabled[def.id]).length

  return (
    <section
      className={`effects-row rack-panel flex flex-col gap-2 rounded-xl ${
        shown ? 'p-3 sm:p-4' : 'px-3 py-2'
      }`}
      aria-label="Effects chain"
    >
      <header
        className={`effects-row-header flex items-center gap-3 ${
          shown ? 'justify-between' : 'justify-end'
        }`}
      >
        {/* The chain label is only worth its line when the pedals are showing. */}
        {shown && (
          <span className="truncate font-mono text-[10px] uppercase tracking-widest text-text/50">
            DBL → DIST → CHORUS → DELAY → REVERB
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
            className="effects-row-toggle cell-hit shrink-0 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest"
            style={{
              background: shown
                ? 'linear-gradient(180deg, var(--color-lavender) 0%, #9C82C6 100%)'
                : 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
              color: shown ? 'var(--color-bg)' : 'var(--color-text)',
              border: shown ? '1px solid transparent' : '1px solid var(--color-rack-edge)',
            }}
          >
            {shown ? 'HIDE FX ▴' : `SHOW FX ▾ · ${activeCount} ON`}
          </button>
        )}
      </header>
      {shown && (
        <div className="effects-row-pedals scroll-clean flex gap-3 overflow-x-auto pb-1">
          {EFFECT_DEFS.map((def) => (
            <EffectPedal
              key={def.id}
              def={def}
              enabled={fxEnabled[def.id]}
              params={fxParams[def.id]}
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
