import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/useStore'
import { useFullCatalog } from '../state/useFullCatalog'
import { BANK_ORDER, BANK_LABELS, type Bank, type PatchManifest } from '../patches/types'
import { PatchCard } from './PatchCard'
import { escapeIsForOverlay } from './overlayEscape'

interface PatchPickerProps {
  onSelect: (id: string) => void
  /** Audition a patch without switching to it. */
  onPreview: (id: string) => void
  /** Fetch a patch's samples into the offline caches. */
  onDownload?: (id: string) => void
  /** Render absolutely inside the nearest positioned ancestor (embed). */
  contained?: boolean
  /** Show download buttons and the offline pill. Off in the embed. */
  offlineFeatures?: boolean
}

export function PatchPicker({
  onSelect,
  onPreview,
  onDownload,
  contained = false,
  offlineFeatures = true,
}: PatchPickerProps) {
  const open = useStore((s) => s.pickerOpen)
  const setPickerOpen = useStore((s) => s.setPickerOpen)
  const currentPatchId = useStore((s) => s.currentPatchId)
  const favourites = useStore((s) => s.favourites)
  const toggleFavourite = useStore((s) => s.toggleFavourite)
  const downloaded = useStore((s) => s.downloaded)
  const downloadingPatchId = useStore((s) => s.downloadingPatchId)
  const userPatches = useStore((s) => s.userPatches)
  const previewPatchId = useStore((s) => s.previewPatchId)
  const online = useStore((s) => s.online)

  const mergedCatalog = useFullCatalog()

  // A USR patch is playable offline whenever its underlying base patch is
  // cached — the audio source is shared. For everything else, the patch's
  // own id is the download marker.
  const isOfflineReady = useCallback(
    (patch: PatchManifest): boolean => {
      if (downloaded.has(patch.id)) return true
      if (patch.bank === 'USR') {
        const u = userPatches.find((x) => x.id === patch.id)
        if (u && downloaded.has(u.basePatchId)) return true
      }
      return false
    },
    [downloaded, userPatches],
  )

  const [bankFilter, setBankFilter] = useState<Bank | 'ALL'>('ALL')
  const [query, setQuery] = useState('')

  // Available banks (only those that have entries)
  const banksAvailable = useMemo(() => {
    const set = new Set<Bank>()
    for (const p of mergedCatalog) set.add(p.bank)
    return BANK_ORDER.filter((b) => set.has(b))
  }, [mergedCatalog])

  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape (contained: only Escape pressed inside the module)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!escapeIsForOverlay(e, overlayRef.current, contained)) return
      setPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setPickerOpen, contained])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mergedCatalog.filter((p) => {
      if (bankFilter !== 'ALL' && p.bank !== bankFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
  }, [mergedCatalog, bankFilter, query])

  const favList = useMemo(
    () => mergedCatalog.filter((p) => favourites.has(p.id)),
    [mergedCatalog, favourites],
  )

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className={`patch-picker fade-in ${contained ? 'absolute' : 'fixed'} inset-0 z-50 flex items-stretch justify-center p-2 sm:p-6 backdrop-blur-sm`}
      onClick={() => setPickerOpen(false)}
      style={{ background: 'var(--scrim)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Patch library"
        className="patch-picker-sheet pop-in flex w-full max-w-5xl flex-col overflow-hidden rounded-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <header
          className="patch-picker-header flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderBottom: '1px solid var(--color-rack-edge)' }}
        >
          <div className="patch-picker-title flex min-w-0 items-center gap-2.5">
            <div className="font-display text-lg font-medium text-text">Library</div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-legend">
              {filtered.length} patches
            </div>
            {offlineFeatures && !online && (
              <div
                className="patch-picker-offline-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest"
                title="You are offline — only cached patches are playable"
                style={{
                  background: 'rgba(255,184,77,0.18)',
                  color: '#7a4f0e',
                  border: '1px solid rgba(255,184,77,0.5)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 9999,
                    background: '#FFB84D',
                    boxShadow: '0 0 6px rgba(255,184,77,0.7)',
                  }}
                />
                offline
              </div>
            )}
          </div>
          <div className="patch-picker-controls flex items-center gap-2">
            <input
              type="text"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="patch-picker-search w-full min-w-0 rounded-md px-3 py-2 font-mono text-xs outline-none placeholder:text-legend focus:ring-2 focus:ring-coral sm:w-48"
              style={{
                background: 'var(--card-solid)',
                border: '1px solid var(--card-border)',
                color: 'var(--color-text)',
              }}
            />
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="patch-picker-close cell-hit shrink-0 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wider text-text/70 hover:text-text"
              style={{
                background: 'var(--pill-bg)',
                border: '1px solid var(--pill-border)',
              }}
            >
              Close<span className="hidden sm:inline"> · esc</span>
            </button>
          </div>
        </header>

        <div
          className="patch-picker-banks flex flex-wrap items-center gap-1.5 p-3"
          style={{ borderBottom: '1px solid var(--color-rack-edge)' }}
        >
          <BankChip
            label="All"
            active={bankFilter === 'ALL'}
            onClick={() => setBankFilter('ALL')}
          />
          {banksAvailable.map((b) => (
            <BankChip
              key={b}
              label={BANK_LABELS[b]}
              active={bankFilter === b}
              onClick={() => setBankFilter(b)}
            />
          ))}
        </div>

        <div className="patch-picker-body scroll-clean flex-1 overflow-y-auto p-4">
          {favList.length > 0 && bankFilter === 'ALL' && !query && (
            <section className="patch-picker-section mb-6">
              <h3 className="patch-picker-section-title mb-3 font-mono text-[11px] uppercase tracking-widest text-legend-strong">
                Your Library
              </h3>
              <div className="patch-picker-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {favList.map((p) => (
                  <PatchCard
                    key={p.id}
                    patch={p}
                    active={p.id === currentPatchId}
                    favourited
                    downloaded={downloaded.has(p.id)}
                    downloading={downloadingPatchId === p.id}
                    unavailableOffline={offlineFeatures && !online && !isOfflineReady(p)}
                    previewing={previewPatchId === p.id}
                    onSelect={(id) => {
                      onSelect(id)
                      setPickerOpen(false)
                    }}
                    onPreview={onPreview}
                    onToggleFavourite={toggleFavourite}
                    onDownload={onDownload}
                    showDownload={offlineFeatures}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="patch-picker-section">
            <h3 className="patch-picker-section-title mb-3 font-mono text-[11px] uppercase tracking-widest text-legend-strong">
              Browse
            </h3>
            <div className="patch-picker-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((p) => (
                <PatchCard
                  key={p.id}
                  patch={p}
                  active={p.id === currentPatchId}
                  favourited={favourites.has(p.id)}
                  downloaded={downloaded.has(p.id)}
                  downloading={downloadingPatchId === p.id}
                  unavailableOffline={offlineFeatures && !online && !isOfflineReady(p)}
                  previewing={previewPatchId === p.id}
                  onSelect={(id) => {
                    onSelect(id)
                    setPickerOpen(false)
                  }}
                  onPreview={onPreview}
                  onToggleFavourite={toggleFavourite}
                  onDownload={onDownload}
                    showDownload={offlineFeatures}
                />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center font-mono text-xs text-legend">
                  No patches match.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function BankChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="bank-chip cell-hit rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider"
      style={
        active
          ? {
              background: 'var(--color-text)',
              color: 'var(--color-bg)',
            }
          : {
              background: 'var(--pill-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--pill-border)',
            }
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}
