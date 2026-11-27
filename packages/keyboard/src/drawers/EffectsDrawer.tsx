import type { ChainEffectId } from '../../../../src/audio/effects'
import type { KeyboardPrefs } from '../useKeyboardPrefs'

const EFFECTS = [
  ['reverb', 'Reverb'], ['delay', 'Delay'], ['chorus', 'Chorus'], ['distortion', 'Distortion'],
] as const satisfies readonly (readonly [ChainEffectId, string])[]

interface EffectsDrawerProps {
  effects: KeyboardPrefs['effects']
  onEnabled(id: ChainEffectId, on: boolean): void
  onAmount(id: ChainEffectId, amount: number): void
}

export function EffectsDrawer({ effects, onEnabled, onAmount }: EffectsDrawerProps) {
  return (
    <div className="kb-drawer-effects" role="group" aria-label="Effect controls">
      {EFFECTS.map(([id, label]) => {
        const { on = false, amount = 0 } = effects[id] ?? {}
        const percent = `${Math.round(amount * 100)}%`
        return (
          <div className="kb-effect" key={id}>
            <button
              className="kb-button kb-effect-btn" type="button" aria-pressed={on}
              onClick={() => onEnabled(id, !on)}
            >{label}</button>
            <input
              className="kb-range kb-effect-amount" type="range" min="0" max="1" step="0.01"
              aria-label={`${label} amount`} aria-valuetext={percent} value={amount}
              onChange={event => onAmount(id, event.currentTarget.valueAsNumber)}
            />
            <span className="kb-effect-value" aria-hidden="true">{percent}</span>
          </div>
        )
      })}
    </div>
  )
}
