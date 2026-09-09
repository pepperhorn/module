import type { EffectDef, EffectId } from '../audio/effects'
import { PedalKnob } from './PedalKnob'

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

/** Knobs are laid out in rows of two, the way a compact stompbox is built. */
const KNOBS_PER_ROW = 2

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size))
  return rows
}

/**
 * One effect as a stompbox: painted enclosure, silk-screened name, status LED,
 * rows of pots (two per row) and a footswitch that stomps the effect in and out.
 */
export function EffectPedal({
  def,
  enabled,
  params,
  onToggle,
  onParamChange,
}: EffectPedalProps) {
  const hex = COLOR_HEX[def.color] ?? COLOR_HEX.sky
  const rows = chunk(def.params, KNOBS_PER_ROW)

  return (
    <div
      className="effect-pedal flex h-full flex-col items-center gap-2.5 rounded-lg px-3 pb-3 pt-2.5"
      style={{
        minWidth: 148,
        background: `linear-gradient(180deg, color-mix(in srgb, ${hex} 12%, #FFFFFF) 0%, color-mix(in srgb, ${hex} 6%, #EEF1F6) 100%)`,
        border: `1px solid color-mix(in srgb, ${hex} 40%, var(--color-rack-edge))`,
        boxShadow: enabled
          ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 0 14px ${hex}33, 0 2px 4px rgba(20,30,60,0.12)`
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(20,30,60,0.1)',
      }}
    >
      <header className="effect-pedal-header flex w-full items-center justify-between gap-2">
        <span
          className="effect-pedal-name font-display text-xs font-semibold uppercase tracking-widest"
          style={{ color: hex }}
        >
          {def.name}
        </span>
        <span
          aria-hidden="true"
          className={`effect-pedal-led h-2.5 w-2.5 rounded-full ${enabled ? 'led-on' : ''}`}
          style={{
            color: hex,
            background: enabled ? hex : 'rgba(20,30,60,0.15)',
            boxShadow: enabled
              ? `0 0 6px ${hex}, 0 0 14px ${hex}80`
              : 'inset 0 1px 1px rgba(0,0,0,0.18)',
          }}
        />
      </header>

      <div className="effect-pedal-knobs flex flex-col gap-2">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="effect-pedal-knob-row flex items-start justify-center gap-3"
          >
            {row.map((param) => (
              <PedalKnob
                key={param.id}
                label={param.label}
                value={params[param.id] ?? param.default}
                min={param.min}
                max={param.max}
                step={param.step}
                unit={param.unit}
                color={hex}
                labels={param.labels}
                defaultValue={param.default}
                onChange={(v) => onParamChange(def.id, param.id, v)}
              />
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-pressed={enabled}
        aria-label={`${def.name} ${enabled ? 'on' : 'off'}`}
        title={enabled ? 'Stomp to bypass' : 'Stomp to engage'}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(def.id)
        }}
        className="effect-pedal-switch cell-hit mt-auto flex w-full items-center justify-center gap-2 rounded-md py-2 font-mono text-[10px] uppercase tracking-widest"
        style={{
          color: enabled ? '#FFFFFF' : 'rgba(20,30,60,0.55)',
          background: enabled
            ? `linear-gradient(180deg, ${hex} 0%, color-mix(in srgb, ${hex} 78%, #000000) 100%)`
            : 'linear-gradient(180deg, #FDFDFE 0%, #DFE4EC 100%)',
          border: `1px solid ${enabled ? 'transparent' : 'var(--color-rack-edge)'}`,
          boxShadow: enabled
            ? `inset 0 2px 4px rgba(0,0,0,0.28), 0 0 10px ${hex}55`
            : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 0 rgba(20,30,60,0.14)',
        }}
      >
        <span
          aria-hidden="true"
          className="effect-pedal-switch-cap h-3 w-3 rounded-full"
          style={{
            background: enabled
              ? 'radial-gradient(circle at 34% 30%, #FFFFFF 0%, #D8DEE7 70%, #A9B2C0 100%)'
              : 'radial-gradient(circle at 34% 30%, #FFFFFF 0%, #C6CDD8 70%, #98A2B2 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(20,30,60,0.2)',
          }}
        />
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}
