import type { ChainEffectId } from '../../../../src/audio/effects'
import type { KeyboardPrefs } from '../useKeyboardPrefs'

const EFFECTS = [
  ['reverb', 'Reverb', 0.32], ['delay', 'Delay', 0.35],
  ['chorus', 'Chorus', 0.4], ['distortion', 'Distortion', 0.3],
] as const satisfies readonly (readonly [ChainEffectId, string, number])[]

interface EffectsDrawerProps {
  effects: KeyboardPrefs['effects']
  onChange(id: ChainEffectId, effect: KeyboardPrefs['effects'][string]): void
}

export function EffectsDrawer({ effects, onChange }: EffectsDrawerProps) {
  return (
    <div className="kb-drawer-effects" role="group" aria-label="Effect controls">
      {EFFECTS.map(([id, label, startingAmount]) => {
        const { on = false, amount = 0 } = effects[id] ?? {}
        const percent = `${Math.round(amount * 100)}%`
        return (
          <div className="kb-effect" key={id}>
            <button
              className="kb-button kb-effect-btn" type="button" aria-pressed={on}
              onClick={() => onChange(id, { on: !on, amount: !on && amount === 0 ? startingAmount : amount })}
            >{label}</button>
            <input
              className="kb-range kb-effect-amount" type="range" min="0" max="1" step="0.01"
              aria-label={`${label} amount`} aria-valuetext={percent} value={amount}
              onChange={event => {
                const nextAmount = event.currentTarget.valueAsNumber
                onChange(id, { on: on || nextAmount > 0, amount: nextAmount })
              }}
            />
            <span className="kb-effect-value" aria-hidden="true">{percent}</span>
          </div>
        )
      })}
    </div>
  )
}
