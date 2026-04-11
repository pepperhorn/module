import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import { findPatch } from '../patches/catalog'
import { EFFECT_DEFS } from '../audio/effects'

export function SaveDialog() {
  const open = useStore((s) => s.saveDialogOpen)
  const setOpen = useStore((s) => s.setSaveDialogOpen)
  const currentPatchId = useStore((s) => s.currentPatchId)
  const userPatches = useStore((s) => s.userPatches)
  const fxEnabled = useStore((s) => s.fxEnabled)
  const fxParams = useStore((s) => s.fxParams)
  const saveCurrentAsUserPatch = useStore((s) => s.saveCurrentAsUserPatch)

  const basePatch = useMemo(() => {
    const cu = userPatches.find((u) => u.id === currentPatchId)
    return findPatch(cu?.basePatchId ?? currentPatchId)
  }, [currentPatchId, userPatches])

  const defaultName = useMemo(() => {
    if (!basePatch) return 'My Patch'
    const existing = userPatches.filter((u) =>
      u.name.startsWith(basePatch.name),
    ).length
    return existing === 0 ? `${basePatch.name} #1` : `${basePatch.name} #${existing + 1}`
  }, [basePatch, userPatches])

  const [name, setName] = useState(defaultName)

  useEffect(() => {
    if (open) setName(defaultName)
  }, [open, defaultName])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const enabledFx = EFFECT_DEFS.filter((d) => fxEnabled[d.id])
  const fxSummary = enabledFx
    .map((d) => `${d.name} ${Math.round((fxParams[d.id]?.mix ?? 0) * 100)}%`)
    .join(' · ') || 'no FX engaged'

  const handleSave = () => {
    const id = saveCurrentAsUserPatch(name)
    if (id) setOpen(false)
  }

  return (
    <div
      className="save-dialog fade-in fixed inset-0 z-[55] flex items-center justify-center bg-text/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        className="save-dialog-card pop-in flex w-[min(420px,calc(100vw-2rem))] flex-col gap-4 rounded-2xl bg-bg p-5 shadow-2xl"
        style={{ border: '1px solid var(--color-rack-edge)' }}
      >
        <div className="save-dialog-header flex items-baseline justify-between">
          <div className="font-display text-base font-semibold text-text">
            Save User Patch
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-text/50">
            usr bank
          </div>
        </div>

        <div className="save-dialog-base flex flex-col gap-1 rounded-md p-3"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)',
            border: '1px solid var(--color-rack-edge)',
          }}
        >
          <div className="font-mono text-[9px] uppercase tracking-widest text-text/40">
            base patch
          </div>
          <div className="font-display text-sm text-text">
            {basePatch?.name ?? '(unknown)'}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-text/50">
            {basePatch?.category} · {basePatch?.bank}
          </div>
        </div>

        <div className="save-dialog-fx flex flex-col gap-1">
          <div className="font-mono text-[9px] uppercase tracking-widest text-text/40">
            fx state
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-text/60">
            {fxSummary}
          </div>
        </div>

        <label className="save-dialog-name flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text/40">
            name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
            className="save-dialog-input rounded-md px-3 py-2 font-display text-sm outline-none focus:ring-2 focus:ring-coral"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-rack-edge)',
              color: 'var(--color-text)',
            }}
            autoFocus
            maxLength={48}
          />
        </label>

        <div className="save-dialog-actions flex items-center justify-end gap-2">
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider text-text/70"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-rack-edge)',
            }}
            onClick={() => setOpen(false)}
          >
            cancel
          </button>
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider text-bg"
            style={{
              background:
                'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
              boxShadow:
                'inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 10px rgba(255,107,107,0.3)',
            }}
            onClick={handleSave}
            disabled={!basePatch}
          >
            save
          </button>
        </div>
      </div>
    </div>
  )
}
