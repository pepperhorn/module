import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore, type MidiAccessStatus } from '../state/useStore'
import { Knob } from './Knob'
import { breathToGain, type BreathCurve } from '../input/breath'
import { breathMonitor } from '../input/midiMonitor'
import { requestMidi } from '../input/midiAccess'
import {
  BREATH_CC_CHOICES,
  BREATH_LIMITS,
  MIDI_PRESETS,
  MIDI_PRESET_ORDER,
  profileMatchesPreset,
  type MidiProfile,
} from '../input/midiProfile'

export interface LatencyInfo {
  baseLatencyMs: number
  outputLatencyMs: number | null
}

interface MidiPanelProps {
  /** Reads the AudioContext latency (engine.latencyInfo). Optional for tests. */
  getLatency?: () => LatencyInfo
  /** Render absolutely inside the nearest positioned ancestor (embed). */
  contained?: boolean
}

const CURVES: { id: BreathCurve; label: string }[] = [
  { id: 'linear', label: 'LIN' },
  { id: 'exponential', label: 'EXP' },
  { id: 'logarithmic', label: 'LOG' },
]

const pad3 = (n: number) => String(Math.max(0, Math.round(n))).padStart(3, '0')
const ccLabel = (cc: number) => `CC${String(cc).padStart(2, '0')}`

/**
 * MIDI & breath controls sheet, opened from the MIDI status pill. Shows the
 * permission state first; once granted, devices, presets, the live breath
 * meter and the breath shaping controls.
 */
export function MidiPanel({ getLatency, contained = false }: MidiPanelProps) {
  const open = useStore((s) => s.midiPanelOpen)
  const setOpen = useStore((s) => s.setMidiPanelOpen)
  const status = useStore((s) => s.midiStatus)

  const cardRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [setOpen])

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // Keep Tab inside the dialog.
  const onTrapKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !cardRef.current) return
    const items = cardRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex="0"], input, select',
    )
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return (
    <div
      className={`midi-panel-scrim fade-in ${contained ? 'absolute' : 'fixed'} inset-0 z-[55] flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-4`}
      style={{ background: 'var(--scrim)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="midi-panel-title"
        onKeyDown={onTrapKey}
        className={`midi-panel pop-in scroll-clean flex ${contained ? 'max-h-full' : 'max-h-[92dvh]'} w-full flex-col gap-4 overflow-y-auto rounded-t-2xl p-4 sm:w-[min(640px,calc(100vw-2rem))] sm:rounded-2xl sm:p-5`}
        style={{
          background: 'var(--face-bg)',
          border: '1px solid var(--face-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <header className="midi-panel-header flex items-center justify-between gap-3">
          <div className="midi-panel-heading flex flex-col gap-0.5">
            <h2
              id="midi-panel-title"
              className="midi-panel-title font-display text-base font-semibold tracking-wide text-text"
            >
              MIDI / Breath
            </h2>
            <StatusLine status={status} />
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close MIDI settings"
            className="midi-panel-close hw-btn legend-strong flex h-11 min-w-11 items-center justify-center px-3"
            onClick={close}
          >
            CLOSE
          </button>
        </header>

        {status === 'granted' ? <GrantedBody getLatency={getLatency} /> : <AccessState status={status} />}
      </div>
    </div>
  )
}

function StatusLine({ status }: { status: MidiAccessStatus }) {
  const devices = useStore((s) => s.midiDevices)
  const map: Record<MidiAccessStatus, { text: string; color: string }> = {
    unsupported: { text: 'not supported in this browser', color: 'var(--color-legend)' },
    idle: { text: 'midi off · not yet enabled', color: 'var(--color-legend)' },
    pending: { text: 'waiting for permission…', color: 'var(--color-amber)' },
    denied: { text: 'permission blocked', color: 'var(--color-coral)' },
    error: { text: 'could not open midi', color: 'var(--color-coral)' },
    granted: {
      text: devices.length ? `${devices.length} input${devices.length > 1 ? 's' : ''} connected` : 'enabled · no device',
      color: devices.length ? 'var(--color-lime)' : 'var(--color-amber)',
    },
  }
  const s = map[status]
  return (
    <span className="midi-panel-status legend flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="midi-panel-status-led inline-block h-2 w-2 rounded-full"
        style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
      />
      {s.text}
    </span>
  )
}

function Section({ title, className, children }: { title: string; className: string; children: ReactNode }) {
  return (
    <section className={`${className} rack-panel mt-2 flex flex-col gap-3 rounded-lg p-3 pt-4`}>
      <span className={`${className}-legend group-legend legend`}>{title}</span>
      {children}
    </section>
  )
}

function EnableButton({ label }: { label: string }) {
  const pending = useStore((s) => s.midiStatus === 'pending')
  return (
    <button
      type="button"
      disabled={pending}
      className="midi-enable-btn hw-btn hw-btn-accent flex min-h-11 items-center justify-center gap-2 self-start px-5"
      style={{ ['--hw-accent' as string]: 'var(--color-sky)' }}
      onClick={() => void requestMidi()}
    >
      <span
        aria-hidden="true"
        className="midi-enable-btn-led hw-btn-led"
        style={{ background: 'var(--color-sky)', boxShadow: '0 0 5px rgba(91,192,235,0.8)' }}
      />
      <span className="midi-enable-btn-label legend" style={{ color: 'var(--ink-sky)' }}>
        {pending ? 'WAITING…' : label}
      </span>
    </button>
  )
}

/** The explanation shown for every state except `granted`. */
function AccessState({ status }: { status: Exclude<MidiAccessStatus, 'granted'> }) {
  let body: ReactNode
  if (status === 'unsupported') {
    body = (
      <>
        <p className="midi-state-text font-body text-sm text-text">
          This browser has no Web MIDI. Use Chrome or Edge on a desktop, or Chrome on Android with
          your controller plugged in over USB-C.
        </p>
        <p className="midi-state-note legend">iOS browsers cannot do Web MIDI — this is a platform limit.</p>
      </>
    )
  } else if (status === 'denied') {
    body = (
      <>
        <p className="midi-state-text font-body text-sm text-text">
          MIDI access was blocked for this site, so no controller can reach The Module.
        </p>
        <ol className="midi-state-steps font-body list-decimal space-y-1 pl-5 text-sm text-text">
          <li className="midi-state-step">Tap the site-settings icon left of the address bar.</li>
          <li className="midi-state-step">
            Open <b>Site settings</b> → <b>MIDI devices</b> (Android: <b>Permissions</b>) and choose <b>Allow</b>.
          </li>
          <li className="midi-state-step">Come back and tap Try again, or reload the page.</li>
        </ol>
        <p className="midi-state-note legend">Desktop: chrome://settings/content/midiDevices</p>
        <EnableButton label="TRY AGAIN" />
      </>
    )
  } else if (status === 'error') {
    body = (
      <>
        <p className="midi-state-text font-body text-sm text-text">
          MIDI could not be opened. Unplug and re-plug the controller, then try again.
        </p>
        <EnableButton label="TRY AGAIN" />
      </>
    )
  } else {
    body = (
      <>
        <p className="midi-state-text font-body text-sm text-text">
          Play The Module from a USB MIDI keyboard or a wind controller (Travel Sax 2, Travel
          Clarinet, EWI). Your browser will ask once for permission.
        </p>
        <EnableButton label="ENABLE MIDI" />
      </>
    )
  }
  return (
    <Section title="ACCESS" className={`midi-access midi-access-${status}`}>
      <div className="midi-access-body flex flex-col gap-3" data-midi-state={status}>
        {body}
      </div>
    </Section>
  )
}

function GrantedBody({ getLatency }: MidiPanelProps) {
  const devices = useStore((s) => s.midiDevices)
  const profile = useStore((s) => s.midiProfile)
  const applyPreset = useStore((s) => s.applyMidiPreset)
  const modified = !profileMatchesPreset(profile)

  return (
    <>
      <Section title="INPUTS" className="midi-devices">
        {devices.length === 0 ? (
          <p className="midi-devices-empty font-body text-sm text-text" data-midi-state="no-devices">
            MIDI is on, but nothing is plugged in. Connect a class-compliant USB controller — on a
            phone, a USB-C cable (or OTG adapter) is all you need.
          </p>
        ) : (
          <ul className="midi-devices-list flex flex-col gap-1.5">
            {devices.map((d) => (
              <li key={d.id} className="midi-device flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="midi-device-led inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: 'var(--color-lime)', boxShadow: '0 0 6px var(--color-lime)' }}
                />
                <span className="midi-device-name legend-strong truncate">{d.name}</span>
                {d.manufacturer && <span className="midi-device-maker legend truncate">{d.manufacturer}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={modified ? 'DEVICE PRESET · MODIFIED' : 'DEVICE PRESET'} className="midi-presets">
        <div className="midi-presets-grid grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MIDI_PRESET_ORDER.map((id) => {
            const p = MIDI_PRESETS[id]
            const active = profile.preset === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                title={p.label}
                className="midi-preset-btn hw-btn flex min-h-11 items-center justify-center gap-2 px-2"
                onClick={() => applyPreset(id)}
              >
                <span
                  aria-hidden="true"
                  className="midi-preset-led hw-btn-led"
                  style={active ? { background: 'var(--color-lime)', boxShadow: '0 0 5px rgba(181,232,83,0.8)' } : {}}
                />
                <span className={`midi-preset-label ${active ? 'legend-strong' : 'legend'}`}>{p.short}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <BreathSection profile={profile} getLatency={getLatency} />
    </>
  )
}

function Segmented<T extends string | number>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`segmented segmented-${name.replace(/\s+/g, '-').toLowerCase()} flex gap-1`}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={active}
            className="segmented-btn hw-btn flex min-h-9 min-w-12 items-center justify-center gap-1.5 px-2.5"
            onClick={() => onChange(o.id)}
          >
            <span
              aria-hidden="true"
              className="segmented-led hw-btn-led"
              style={active ? { background: 'var(--color-sky)', boxShadow: '0 0 5px rgba(91,192,235,0.8)' } : {}}
            />
            <span className={`segmented-label ${active ? 'legend-strong' : 'legend'}`}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function KnobCell({
  name,
  readout,
  children,
}: {
  name: string
  readout: string
  children: ReactNode
}) {
  return (
    <div className={`breath-knob breath-knob-${name} flex flex-col items-center gap-1`}>
      {children}
      <span className="breath-knob-value font-mono text-[11px] text-text/80">{readout}</span>
    </div>
  )
}

function BreathSection({ profile, getLatency }: { profile: MidiProfile } & MidiPanelProps) {
  const update = useStore((s) => s.updateBreath)
  const setEnabled = useStore((s) => s.setBreathEnabled)
  const learning = useStore((s) => s.midiLearning)
  const setLearning = useStore((s) => s.setMidiLearning)
  const b = profile.breath

  const ccOptions = BREATH_CC_CHOICES.map((cc) => ({ id: cc as number, label: `CC${cc}` }))
  if (!BREATH_CC_CHOICES.includes(b.cc as (typeof BREATH_CC_CHOICES)[number])) {
    ccOptions.push({ id: b.cc, label: `CC${b.cc}` })
  }

  return (
    <Section title="BREATH" className="midi-breath">
      <div className="breath-enable-row flex flex-wrap items-center justify-between gap-2">
        <p className="breath-enable-text font-body max-w-[34ch] text-xs text-text/80">
          Breath gates notes and sets loudness. It arms on the first breath message, so keyboards
          still play straight through.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={profile.enabled}
          className="breath-enable-btn hw-btn flex min-h-11 items-center gap-2 px-4"
          onClick={() => setEnabled(!profile.enabled)}
        >
          <span
            aria-hidden="true"
            className="breath-enable-led hw-btn-led"
            style={profile.enabled ? { background: 'var(--color-lime)', boxShadow: '0 0 5px rgba(181,232,83,0.8)' } : {}}
          />
          <span className={`breath-enable-label ${profile.enabled ? 'legend-strong' : 'legend'}`}>
            BREATH {profile.enabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      <div
        className="breath-controls flex flex-col gap-3"
        style={{ opacity: profile.enabled ? 1 : 0.55, transition: 'opacity 120ms ease-out' }}
      >
        <BreathMeter profile={profile} getLatency={getLatency} />

        <div className="breath-cc-row flex flex-wrap items-center gap-2">
          <span className="breath-cc-legend legend w-16">SOURCE</span>
          <Segmented name="Breath CC" value={b.cc} options={ccOptions} onChange={(cc) => update({ cc })} />
          <button
            type="button"
            aria-pressed={learning}
            className={`breath-learn-btn hw-btn hw-btn-accent flex min-h-9 items-center gap-1.5 px-3 ${learning ? 'breath-learning' : ''}`}
            style={{ ['--hw-accent' as string]: learning ? 'var(--color-amber)' : 'var(--color-lavender)' }}
            onClick={() => setLearning(!learning)}
          >
            <span
              aria-hidden="true"
              className={`breath-learn-led hw-btn-led ${learning ? 'led-on' : ''}`}
              style={learning ? { background: 'var(--color-amber)', color: 'var(--color-amber)' } : {}}
            />
            <span className="breath-learn-label legend-strong">{learning ? 'BLOW NOW…' : 'LEARN'}</span>
          </button>
        </div>
        {learning && (
          <p className="breath-learn-hint legend" aria-live="polite">
            Blow a long swell into the controller — the first CC that sweeps becomes the breath source.
          </p>
        )}

        <div className="breath-knobs grid grid-cols-4 justify-items-center gap-2">
          <KnobCell name="gate" readout={pad3(b.gateThreshold)}>
            <Knob
              label="GATE"
              value={b.gateThreshold}
              min={BREATH_LIMITS.gateThreshold.min}
              max={BREATH_LIMITS.gateThreshold.max}
              step={1}
              defaultValue={2}
              color="var(--color-coral)"
              size={52}
              onChange={(v) => update({ gateThreshold: v })}
            />
          </KnobCell>
          <KnobCell name="floor" readout={b.floor.toFixed(2)}>
            <Knob
              label="FLOOR"
              value={b.floor}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0}
              color="var(--color-sky)"
              size={52}
              onChange={(v) => update({ floor: Math.min(v, b.ceiling) })}
            />
          </KnobCell>
          <KnobCell name="ceiling" readout={b.ceiling.toFixed(2)}>
            <Knob
              label="CEIL"
              value={b.ceiling}
              min={0}
              max={1}
              step={0.01}
              defaultValue={1}
              color="var(--color-sky)"
              size={52}
              onChange={(v) => update({ ceiling: Math.max(v, b.floor) })}
            />
          </KnobCell>
          <KnobCell name="smooth" readout={`${Math.round(b.smoothingMs)}ms`}>
            <Knob
              label="SMOOTH"
              value={b.smoothingMs}
              min={BREATH_LIMITS.smoothingMs.min}
              max={BREATH_LIMITS.smoothingMs.max}
              step={1}
              unit="ms"
              defaultValue={8}
              color="var(--color-mint)"
              size={52}
              onChange={(v) => update({ smoothingMs: v })}
            />
          </KnobCell>
        </div>

        <div className="breath-curve-row flex flex-wrap items-center gap-2">
          <span className="breath-curve-legend legend w-16">CURVE</span>
          <Segmented name="Breath curve" value={b.curve} options={CURVES} onChange={(curve) => update({ curve })} />
        </div>

        <div className="breath-velocity-row flex flex-wrap items-center gap-3">
          <span className="breath-velocity-legend legend w-16">VELOCITY</span>
          <Segmented
            name="Velocity mode"
            value={b.velocityMode}
            options={[
              { id: 'fixed', label: 'FIXED' },
              { id: 'passthrough', label: 'DEVICE' },
            ]}
            onChange={(velocityMode) => update({ velocityMode })}
          />
          <KnobCell name="velocity" readout={pad3(b.fixedVelocity)}>
            <Knob
              label="VEL"
              value={b.fixedVelocity}
              min={BREATH_LIMITS.fixedVelocity.min}
              max={BREATH_LIMITS.fixedVelocity.max}
              step={1}
              defaultValue={100}
              color="var(--color-amber)"
              size={44}
              disabled={b.velocityMode !== 'fixed'}
              onChange={(v) => update({ fixedVelocity: v })}
            />
          </KnobCell>
        </div>
        <p className="breath-velocity-explain font-body text-xs text-text/80">
          {b.velocityMode === 'fixed'
            ? 'Fixed: every note starts at the same velocity and breath alone sets loudness — wind controllers already bake breath into velocity, so using both would make soft notes doubly quiet.'
            : 'Device: notes keep the velocity the controller sends, and breath still shapes loudness on top. Use it when your velocity is not breath-derived.'}
        </p>
      </div>
    </Section>
  )
}

/**
 * LCD breath meter. Values come from the module-level breathMonitor, read in
 * requestAnimationFrame and written straight to the DOM — no React render per
 * MIDI message or per frame.
 */
function BreathMeter({ profile, getLatency }: { profile: MidiProfile } & MidiPanelProps) {
  const rawRef = useRef<HTMLDivElement>(null)
  const gainRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const stateRef = useRef<HTMLSpanElement>(null)
  const profileRef = useRef(profile)
  profileRef.current = profile
  const [latency, setLatency] = useState<LatencyInfo | null>(() => getLatency?.() ?? null)

  useEffect(() => {
    if (!getLatency) return
    const id = setInterval(() => setLatency(getLatency()), 1000)
    return () => clearInterval(id)
  }, [getLatency])

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const { breath, enabled } = profileRef.current
      const raw = breathMonitor.raw
      const has = raw >= 0
      const v = has ? raw : 0
      const gain = enabled ? breathToGain(v, breath) : 1
      const gated = has && v < breath.gateThreshold
      let state: string
      if (!enabled) state = 'BYPASS'
      else if (!has)
        state =
          breathMonitor.lastCc >= 0 && breathMonitor.lastCc !== breath.cc
            ? `NO ${ccLabel(breath.cc)} · SEEING ${ccLabel(breathMonitor.lastCc)}`
            : `WAITING FOR ${ccLabel(breath.cc)}`
      else state = gated ? 'GATED' : 'OPEN'
      const text = `${ccLabel(breath.cc)} ${has ? pad3(v) : '---'}  GAIN ${gain.toFixed(2)}`
      const key = `${text}|${state}`
      if (key === last) return
      last = key
      if (rawRef.current) rawRef.current.style.width = `${(v / 127) * 100}%`
      if (gainRef.current) gainRef.current.style.width = `${gain * 100}%`
      if (textRef.current) textRef.current.textContent = text
      if (stateRef.current) {
        stateRef.current.textContent = state
        stateRef.current.style.color = gated ? 'var(--color-coral)' : 'var(--color-lcd-text)'
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const gatePct = (profile.breath.gateThreshold / 127) * 100
  const lat =
    latency == null
      ? 'LAT —'
      : `LAT ${latency.baseLatencyMs}+${latency.outputLatencyMs ?? '?'}MS`

  return (
    <div
      className="breath-meter lcd-bezel relative rounded-md p-1.5"
      style={{ background: 'var(--lcd-bezel-bg)', boxShadow: 'var(--lcd-bezel-shadow)' }}
    >
      <div
        className="breath-meter-screen relative flex flex-col gap-1.5 overflow-hidden rounded-[3px] px-3 py-2.5 font-mono text-lcd-text"
        style={{
          background: 'linear-gradient(180deg, #051B19 0%, #0A2B27 50%, #051B19 100%)',
          boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div className="breath-meter-row-top lcd-glow flex items-baseline justify-between gap-2 text-[12px] tracking-widest">
          <span ref={textRef} className="breath-meter-readout">
            {ccLabel(profile.breath.cc)} ---  GAIN 0.00
          </span>
          <span ref={stateRef} className="breath-meter-state text-[11px]">
            —
          </span>
        </div>
        <div className="breath-meter-legend flex justify-between text-[9px] tracking-widest text-lcd-dim">
          <span className="breath-meter-legend-raw">RAW 0–127</span>
          <span className="breath-meter-legend-gate">GATE {pad3(profile.breath.gateThreshold)}</span>
        </div>
        <div
          className="breath-meter-bar relative h-3 overflow-hidden rounded-[2px]"
          style={{ background: 'rgba(85,230,200,0.08)' }}
          aria-hidden="true"
        >
          <div
            ref={rawRef}
            className="breath-meter-fill absolute inset-y-0 left-0"
            style={{ width: 0, background: 'var(--color-lcd-text)', boxShadow: '0 0 6px rgba(85,230,200,0.7)' }}
          />
          <div
            className="breath-meter-gate absolute inset-y-[-2px] w-[2px]"
            style={{ left: `${gatePct}%`, background: 'var(--color-coral)', boxShadow: '0 0 4px var(--color-coral)' }}
          />
        </div>
        <div
          className="breath-meter-gain-bar relative h-1.5 overflow-hidden rounded-[2px]"
          style={{ background: 'rgba(85,230,200,0.08)' }}
          aria-hidden="true"
        >
          <div
            ref={gainRef}
            className="breath-meter-gain-fill absolute inset-y-0 left-0"
            style={{ width: 0, background: 'var(--color-amber)' }}
          />
        </div>
        <div className="breath-meter-footer flex flex-wrap items-baseline justify-between gap-x-3 text-[10px] tracking-widest text-lcd-dim">
          <span className="breath-meter-gain-legend">▬ GAIN AFTER CURVE</span>
          <span
            className="breath-meter-latency text-lcd-text"
            title="AudioContext base + output latency"
          >
            {lat}
          </span>
        </div>
      </div>
      <p className="breath-meter-latency-hint legend mt-1.5 px-1 normal-case tracking-normal">
        Bluetooth headphones/speakers add roughly 150–250 ms — use wired or USB audio for wind playing.
      </p>
    </div>
  )
}
