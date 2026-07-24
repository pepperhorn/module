import { EFFECT_DEFS } from '../audio/effects'
import { EffectPedal } from './EffectPedal'
import { useStore } from '../state/useStore'
import { getEngine } from '../audio/AudioEngine'

export function EffectsRow() {
  const fxEnabled = useStore((s) => s.fxEnabled)
  const fxParams = useStore((s) => s.fxParams)
  const toggleFxEnabled = useStore((s) => s.toggleFxEnabled)
  const setFxParam = useStore((s) => s.setFxParam)

  return (
    <section
      className="effects-row rack-panel flex flex-col gap-2 rounded-lg p-3"
      aria-label="Effects chain"
    >
      <span className="effects-row-title group-legend legend">EFFECTS</span>
      <header className="effects-row-header flex items-center justify-end">
        <span className="effects-row-chain legend">
          DBL → DIST → CHORUS → DELAY → REVERB
        </span>
      </header>
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
    </section>
  )
}
