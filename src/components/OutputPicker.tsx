import { useCallback, useEffect, useRef, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'

const STORAGE_KEY = 'module:sink-id:v1'

interface NavigatorWithSelect {
  mediaDevices: MediaDevices & {
    selectAudioOutput?: (opts?: { deviceId?: string }) => Promise<MediaDeviceInfo>
  }
}

/**
 * Output device picker.
 *
 * Uses `navigator.mediaDevices.selectAudioOutput()` (Chromium) for a one-tap
 * OS-style chooser when available — no microphone permission prompt needed.
 * Falls back to `enumerateDevices()` + a native <select> otherwise.
 *
 * Routes every `AudioContext` voice through the selected sink via
 * `AudioContext.setSinkId()`. Class-compliant USB audio interfaces appear
 * here as normal audiooutput entries once plugged in.
 */
export function OutputPicker() {
  const engine = getEngine()
  const [supported] = useState<boolean>(() => engine.sinkIdSupported)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [sinkId, setSinkIdState] = useState<string>(engine.sinkId)
  const [deviceLabel, setDeviceLabel] = useState<string>('Default')
  const [open, setOpen] = useState(false)
  const mountedRef = useRef(true)

  // Restore a previously selected sink on first mount.
  useEffect(() => {
    if (!supported) return
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) ?? ''
      } catch {
        return ''
      }
    })()
    if (stored) {
      engine.setSinkId(stored).catch(() => {
        // Device may have been unplugged since last session — silently fall
        // back to the OS default.
      })
    }
  }, [supported, engine])

  // Keep local state in sync with the engine.
  useEffect(() => {
    engine.onSinkChange = (id) => {
      if (!mountedRef.current) return
      setSinkIdState(id)
      try {
        localStorage.setItem(STORAGE_KEY, id)
      } catch {
        // noop
      }
    }
    return () => {
      mountedRef.current = false
      engine.onSinkChange = undefined
    }
  }, [engine])

  const refreshDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return []
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const outputs = all.filter((d) => d.kind === 'audiooutput')
      setDevices(outputs)
      return outputs
    } catch {
      return []
    }
  }, [])

  // Refresh device list on device changes (plug/unplug).
  useEffect(() => {
    if (!supported) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    void refreshDevices()
    const onChange = () => {
      void refreshDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onChange)
    }
  }, [supported, refreshDevices])

  // Derive a readable label for the current sink.
  useEffect(() => {
    if (!sinkId) {
      setDeviceLabel('Default')
      return
    }
    const hit = devices.find((d) => d.deviceId === sinkId)
    if (hit?.label) setDeviceLabel(hit.label)
    else if (sinkId === 'default') setDeviceLabel('Default')
    else setDeviceLabel('Output')
  }, [sinkId, devices])

  const pickViaBrowserChooser = useCallback(async (): Promise<boolean> => {
    const nav = navigator as NavigatorWithSelect
    if (!nav.mediaDevices?.selectAudioOutput) return false
    try {
      const info = await nav.mediaDevices.selectAudioOutput()
      await engine.setSinkId(info.deviceId)
      setDeviceLabel(info.label || 'Output')
      return true
    } catch {
      // User cancelled or no devices available — fall back to menu
      return false
    }
  }, [engine])

  const handleClick = useCallback(async () => {
    if (!supported) return
    const picked = await pickViaBrowserChooser()
    if (picked) return
    // Fall back to a manual enumerate-based menu. Labels may be empty until
    // mic permission has been granted — we still show deviceIds so power
    // users can select by position.
    const outs = await refreshDevices()
    setDevices(outs)
    setOpen(true)
  }, [supported, pickViaBrowserChooser, refreshDevices])

  const handleSelect = useCallback(
    async (deviceId: string) => {
      try {
        await engine.setSinkId(deviceId)
      } catch {
        // noop
      }
      setOpen(false)
    },
    [engine],
  )

  if (!supported) return null

  return (
    <>
      <button
        type="button"
        aria-label={`Audio output: ${deviceLabel}`}
        title={`Audio output: ${deviceLabel}`}
        onClick={(e) => {
          e.stopPropagation()
          void handleClick()
        }}
        className="rack-display-output hw-btn legend flex max-w-[10rem] items-center gap-1.5 overflow-hidden px-3 py-1.5"
      >
        <span
          aria-hidden="true"
          className="rack-display-output-led hw-btn-led"
          style={
            sinkId
              ? {
                  background: 'var(--color-sky)',
                  boxShadow: '0 0 5px rgba(91,192,235,0.8)',
                }
              : {}
          }
        />
        <span className="rack-display-output-label truncate">OUT · {deviceLabel}</span>
      </button>

      {open && (
        <div
          className="output-picker-backdrop fixed inset-0 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--scrim)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="output-picker-sheet pop-in mt-24 w-full max-w-sm rounded-xl p-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-sm font-medium text-text">
                Audio Output
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cell-hit rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-legend hover:text-text"
                style={{
                  background: 'var(--pill-bg)',
                  border: '1px solid var(--pill-border)',
                }}
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              <DeviceRow
                label="System default"
                selected={sinkId === '' || sinkId === 'default'}
                onClick={() => handleSelect('')}
              />
              {devices.map((d, i) => (
                <DeviceRow
                  key={d.deviceId || i}
                  label={d.label || `Output ${i + 1}`}
                  selected={d.deviceId === sinkId}
                  onClick={() => handleSelect(d.deviceId)}
                />
              ))}
              {devices.every((d) => !d.label) && (
                <p className="output-picker-names-hint mt-2 font-mono text-[10px] leading-snug text-legend">
                  Device names are hidden by the browser until you grant
                  microphone permission once. The OS default and any
                  connected USB interface will still work when selected.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DeviceRow({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cell-hit flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left"
      style={{
        background: selected ? 'var(--color-sky)' : 'var(--card-solid)',
        color: selected ? 'var(--color-bg)' : 'var(--color-text)',
        border: selected
          ? '1px solid transparent'
          : '1px solid var(--card-border)',
      }}
    >
      <span className="truncate">{label}</span>
      {selected && (
        <span aria-hidden="true" className="font-mono text-[10px]">
          ✓
        </span>
      )}
    </button>
  )
}
