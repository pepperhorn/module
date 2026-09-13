import type { EffectDef, EffectId } from '../audio/effects'
import { PedalKnob } from './PedalKnob'

interface EffectPedalProps {
  def: EffectDef
  enabled: boolean
  params: Record<string, number>
  expanded: boolean
  onToggle: (id: EffectId) => void
  onParamChange: (id: EffectId, paramId: string, value: number) => void
  onToggleExpanded: (id: EffectId) => void
  /** Absent for note-level effects, which have no position in the chain. */
  onMove?: (delta: number) => void
  canMoveEarlier?: boolean
  canMoveLater?: boolean
  /** 1-based position in the audio chain, for the arrows' labels. */
  position?: number
  chainLength?: number
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
 * One effect as a stompbox. Closed it is a painted enclosure carrying only what
 * you reach for mid-performance — the chain-order arrows and the footswitch —
 * and opens to its pots on demand, so a six-pedal board still fits a phone.
 *
 * The enclosure is painted in the effect's colour either way — saturated when
 * engaged, washed out when bypassed — so each pedal keeps its identity while
 * the state of the whole board stays readable at a glance.
 */
export function EffectPedal({
  def,
  enabled,
  params,
  expanded,
  onToggle,
  onParamChange,
  onToggleExpanded,
  onMove,
  canMoveEarlier = false,
  canMoveLater = false,
  position,
  chainLength,
}: EffectPedalProps) {
  const hex = COLOR_HEX[def.color] ?? COLOR_HEX.sky
  const rows = chunk(def.params, KNOBS_PER_ROW)
  const positionLabel =
    position && chainLength ? ` (${position} of ${chainLength})` : ''

  return (
    <div
      className="effect-pedal flex w-40 shrink-0 flex-col gap-2 rounded-xl px-2.5 pb-2.5 pt-2"
      style={{
        background: enabled
          ? `linear-gradient(180deg, ${hex} 0%, color-mix(in srgb, ${hex} 80%, #000000) 100%)`
          : `linear-gradient(180deg, color-mix(in srgb, ${hex} 22%, #FFFFFF) 0%, color-mix(in srgb, ${hex} 14%, #E4E8EE) 100%)`,
        border: `1px solid ${
          enabled
            ? `color-mix(in srgb, ${hex} 70%, #000000)`
            : `color-mix(in srgb, ${hex} 35%, var(--color-rack-edge))`
        }`,
        boxShadow: enabled
          ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px ${hex}55, 0 2px 4px rgba(20,30,60,0.18)`
          : 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(20,30,60,0.1)',
      }}
    >
      {/* Chain order, top centre */}
      <div className="effect-pedal-order flex items-center justify-between gap-1">
        <OrderArrow
          direction="earlier"
          name={def.name}
          positionLabel={positionLabel}
          enabled={enabled}
          available={Boolean(onMove)}
          disabled={!canMoveEarlier}
          onClick={() => onMove?.(-1)}
        />
        <button
          type="button"
          aria-expanded={expanded}
          title={expanded ? `Hide ${def.name} controls` : `Show ${def.name} controls`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpanded(def.id)
          }}
          className="effect-pedal-name cell-hit flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center rounded-md px-1 py-0.5"
          style={{
          color: enabled ? '#FFFFFF' : 'var(--color-text)',
          touchAction: 'manipulation',
        }}
        >
          <span className="truncate font-display text-xs font-semibold uppercase tracking-widest">
            {def.name}
          </span>
          <span
            aria-hidden="true"
            className="mt-0.5 rounded-full px-1.5 font-mono text-[10px] leading-tight"
            style={{
              background: enabled ? 'rgba(255,255,255,0.22)' : 'rgba(20,30,60,0.07)',
            }}
          >
            {expanded ? '▴' : '▾'}
          </span>
        </button>
        <OrderArrow
          direction="later"
          name={def.name}
          positionLabel={positionLabel}
          enabled={enabled}
          available={Boolean(onMove)}
          disabled={!canMoveLater}
          onClick={() => onMove?.(1)}
        />
      </div>

      {expanded && (
        <div
          className="effect-pedal-knobs flex flex-col gap-2 rounded-lg py-2"
          style={{
            background: enabled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)',
          }}
        >
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
      )}

      <button
        type="button"
        aria-pressed={enabled}
        aria-label={`${def.name} ${enabled ? 'on' : 'off'}`}
        title={enabled ? 'Stomp to bypass' : 'Stomp to engage'}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(def.id)
        }}
        className="effect-pedal-switch cell-hit flex h-11 w-full items-center justify-center gap-2 rounded-lg font-mono text-[11px] uppercase tracking-widest"
        style={{
          color: enabled ? 'var(--color-text)' : 'rgba(20,30,60,0.55)',
          background: enabled
            ? 'linear-gradient(180deg, #FFFFFF 0%, #E6EAF0 100%)'
            : 'linear-gradient(180deg, #FDFDFE 0%, #DFE4EC 100%)',
          border: `1px solid ${enabled ? 'rgba(255,255,255,0.7)' : 'var(--color-rack-edge)'}`,
          boxShadow: enabled
            ? 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 0 rgba(0,0,0,0.18)'
            : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 0 rgba(20,30,60,0.14)',
          touchAction: 'manipulation',
        }}
      >
        <span
          aria-hidden="true"
          className={`effect-pedal-led h-2.5 w-2.5 rounded-full ${enabled ? 'led-on' : ''}`}
          style={{
            color: hex,
            background: enabled ? hex : 'rgba(20,30,60,0.2)',
            boxShadow: enabled
              ? `0 0 6px ${hex}, 0 0 12px ${hex}80`
              : 'inset 0 1px 1px rgba(0,0,0,0.18)',
          }}
        />
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function OrderArrow({
  direction,
  name,
  positionLabel,
  enabled,
  available,
  disabled,
  onClick,
}: {
  direction: 'earlier' | 'later'
  name: string
  positionLabel: string
  enabled: boolean
  available: boolean
  disabled: boolean
  onClick: () => void
}) {
  // Note-level effects keep the slot so the name stays optically centred, but
  // there is nothing to move.
  if (!available) return <span aria-hidden="true" className="h-9 w-9 shrink-0" />

  const label =
    direction === 'earlier'
      ? `Move ${name} earlier in the chain${positionLabel}`
      : `Move ${name} later in the chain${positionLabel}`

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="effect-pedal-order-arrow cell-hit flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm"
      style={{
        color: enabled ? '#FFFFFF' : 'var(--color-text)',
        background: enabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${enabled ? 'rgba(255,255,255,0.3)' : 'var(--color-rack-edge)'}`,
        opacity: disabled ? 0.3 : 1,
        touchAction: 'manipulation',
      }}
    >
      {direction === 'earlier' ? '◀' : '▶'}
    </button>
  )
}
