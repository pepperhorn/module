import type { EffectDef, EffectId } from '../audio/effects'
import { Knob } from './Knob'

interface EffectPedalProps {
  def: EffectDef
  enabled: boolean
  params: Record<string, number>
  onToggle: (id: EffectId) => void
  onParamChange: (id: EffectId, paramId: string, value: number) => void
  /** Begin a drag-reorder from the grip handle (pointer = mouse or touch). */
  onDragStart?: (e: React.PointerEvent) => void
  /** This pedal is the one currently being dragged. */
  dragging?: boolean
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
  onDragStart,
  dragging = false,
}: EffectPedalProps) {
  const hex = COLOR_HEX[def.color] ?? COLOR_HEX.sky
  return (
    <div
      className="effect-pedal flex flex-col items-center gap-2 rounded-lg p-3"
      style={{
        background: 'var(--pedal-bg)',
        border: dragging ? `1px solid ${hex}` : '1px solid var(--pedal-border)',
        boxShadow: dragging
          ? `0 10px 24px rgba(0,0,0,0.55), 0 0 0 1px ${hex}66`
          : 'var(--pedal-shadow)',
        opacity: dragging ? 0.9 : 1,
        minWidth: 132,
      }}
    >
      <header className="effect-pedal-header flex w-full items-center justify-between">
        <span className="effect-pedal-namewrap flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={`Reorder ${def.name}`}
            title="Drag to reorder"
            onPointerDown={onDragStart}
            className="effect-pedal-grip shrink-0 leading-none text-legend"
            style={{ cursor: 'grab', touchAction: 'none', fontSize: '13px' }}
          >
            ⠿
          </button>
          <span
            className="effect-pedal-name font-display text-xs font-semibold uppercase tracking-wider"
            style={{ color: hex }}
          >
            {def.name}
          </span>
        </span>
        <button
          type="button"
          aria-label={enabled ? 'Bypass' : 'Enable'}
          title={enabled ? 'On — click to bypass' : 'Bypassed — click to enable'}
          onClick={() => onToggle(def.id)}
          className="effect-pedal-led h-3.5 w-3.5 rounded-full"
          style={{
            cursor: 'pointer',
            // A socketed indicator lamp: a light rim ring makes it read as a
            // button in BOTH states. Off = dim colour-hinted lens sunk into the
            // tile; on = bright glowing lamp.
            background: enabled
              ? hex
              : `radial-gradient(circle at 50% 35%, ${hex}55 0%, #0E1219 72%)`,
            boxShadow: enabled
              ? `0 0 6px ${hex}, 0 0 14px ${hex}80, inset 0 0 0 1px rgba(255,255,255,0.35)`
              : 'inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.22)',
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
