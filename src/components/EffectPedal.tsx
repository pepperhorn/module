import type { EffectDef, EffectId } from '../audio/effects'
import { Knob } from './Knob'

interface EffectPedalProps {
  def: EffectDef
  enabled: boolean
  params: Record<string, number>
  onToggle: (id: EffectId) => void
  onParamChange: (id: EffectId, paramId: string, value: number) => void
}

const COLOR_HEX: Record<string, string> = {
  coral: '#FF6B6B',
  amber: '#FFB84D',
  lime: '#B5E853',
  sky: '#5BC0EB',
  lavender: '#B59CD9',
  rose: '#FFA5B8',
}

export function EffectPedal({
  def,
  enabled,
  params,
  onToggle,
  onParamChange,
}: EffectPedalProps) {
  const hex = COLOR_HEX[def.color] ?? COLOR_HEX.sky
  return (
    <div
      className="effect-pedal flex flex-col items-center gap-2 rounded-lg p-3"
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
        border: '1px solid var(--color-rack-edge)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(20,30,60,0.06)',
        minWidth: 132,
      }}
    >
      <header className="effect-pedal-header flex w-full items-center justify-between">
        <span
          className="effect-pedal-name font-display text-xs font-semibold uppercase tracking-wider"
          style={{ color: hex }}
        >
          {def.name}
        </span>
        <button
          type="button"
          aria-label={enabled ? 'Bypass' : 'Enable'}
          onClick={() => onToggle(def.id)}
          className="effect-pedal-led h-3 w-3 rounded-full"
          style={{
            background: enabled ? hex : 'rgba(20,30,60,0.15)',
            boxShadow: enabled
              ? `0 0 6px ${hex}, 0 0 14px ${hex}80`
              : 'inset 0 1px 1px rgba(0,0,0,0.18)',
          }}
        />
      </header>
      <div className="effect-pedal-knobs grid grid-cols-3 gap-2">
        {def.params.map((p) => (
          <Knob
            key={p.id}
            label={p.label}
            value={params[p.id] ?? p.default}
            min={p.min}
            max={p.max}
            step={p.step}
            unit={p.unit}
            color={hex}
            size={36}
            labels={p.labels}
            defaultValue={p.default}
            onChange={(v) => onParamChange(def.id, p.id, v)}
          />
        ))}
      </div>
    </div>
  )
}
