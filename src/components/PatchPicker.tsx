import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import { BANK_ORDER, BANK_LABELS, type Bank, type PatchManifest } from '../patches/types'
import { findPatch } from '../patches/catalog'
import { PatchCard } from './PatchCard'
import { getEngine } from '../audio/AudioEngine'

interface PatchPickerProps {
  onSelect: (id: string) => void
}

export function PatchPicker({ onSelect }: PatchPickerProps) {
  const open = useStore((s) => s.pickerOpen)
  const setPickerOpen = useStore((s) => s.setPickerOpen)
  const catalog = useStore((s) => s.catalog)
  const currentPatchId = useStore((s) => s.currentPatchId)
  const favourites = useStore((s) => s.favourites)
  const toggleFavourite = useStore((s) => s.toggleFavourite)
  const downloaded = useStore((s) => s.downloaded)
  const downloadingPatchId = useStore((s) => s.downloadingPatchId)
  const setDownloadingPatchId = useStore((s) => s.setDownloadingPatchId)
  const markDownloaded = useStore((s) => s.markDownloaded)
  const userPatches = useStore((s) => s.userPatches)
  const online = useStore((s) => s.online)

  // Merge user-saved patches into the picker as USR-bank manifests. Each
  // user patch reuses its base patch's source so it shares the engine cache.
  const mergedCatalog = useMemo<PatchManifest[]>(() => {
    const userManifests: PatchManifest[] = []
    for (const u of userPatches) {
      const base = findPatch(u.basePatchId)
      if (!base) continue
      userManifests.push({
        id: u.id,
        name: u.name,
        category: base.name,
        bank: 'USR',
        color: u.color,
        defaultOctave: base.defaultOctave,
        source: base.source,
      })
    }
    return [...userManifests, ...catalog]
  }, [catalog, userPatches])

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

  const handleDownload = useCallback(
    async (id: string) => {
      const patch = catalog.find((p) => p.id === id)
      if (!patch) return
      if (downloadingPatchId) return
      setDownloadingPatchId(id)
      try {
        const result = await getEngine().preloadPatch(patch)
        if (result.ok) markDownloaded(id)
      } finally {
        setDownloadingPatchId(null)
      }
    },
    [catalog, downloadingPatchId, setDownloadingPatchId, markDownloaded],
  )

  const [bankFilter, setBankFilter] = useState<Bank | 'ALL'>('ALL')
  const [query, setQuery] = useState('')

  // Available banks (only those that have entries)
  const banksAvailable = useMemo(() => {
    const set = new Set<Bank>()
    for (const p of mergedCatalog) set.add(p.bank)
    return BANK_ORDER.filter((b) => set.has(b))
  }, [mergedCatalog])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setPickerOpen])

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
      className="patch-picker fade-in fixed inset-0 z-50 flex items-stretch justify-center bg-text/40 p-2 sm:p-6 backdrop-blur-sm"
      onClick={() => setPickerOpen(false)}
    >
      <div
        className="patch-picker-sheet pop-in flex w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid var(--color-rack-edge)' }}
      >
        <header
          className="patch-picker-header flex items-center justify-between gap-3 p-4"
          style={{ borderBottom: '1px solid var(--color-rack-edge)' }}
        >
          <div className="patch-picker-title flex items-center gap-3">
            <div className="font-display text-lg font-medium text-text">Library</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text/40">
              {filtered.length} patches
            </div>
            {!online && (
              <div
                className="patch-picker-offline-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
                title="You are offline — only cached patches are playable"
                style={{
                  background: 'rgba(255,184,77,0.18)',
                  color: '#8a5a10',
                  border: '1px solid rgba(255,184,77,0.4)',
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
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="patch-picker-search w-48 rounded-md px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-coral"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-rack-edge)',
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="patch-picker-close cell-hit rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-text/60 hover:text-text"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-rack-edge)',
            }}
          >
            Close · esc
          </button>
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
              <h3 className="patch-picker-section-title mb-3 font-mono text-[10px] uppercase tracking-widest text-text/50">
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
                    unavailableOffline={!online && !isOfflineReady(p)}
                    onSelect={(id) => {
                      onSelect(id)
                      setPickerOpen(false)
                    }}
                    onToggleFavourite={toggleFavourite}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="patch-picker-section">
            <h3 className="patch-picker-section-title mb-3 font-mono text-[10px] uppercase tracking-widest text-text/50">
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
                  unavailableOffline={!online && !isOfflineReady(p)}
                  onSelect={(id) => {
                    onSelect(id)
                    setPickerOpen(false)
                  }}
                  onToggleFavourite={toggleFavourite}
                  onDownload={handleDownload}
                />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center font-mono text-xs text-text/40">
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
      className="bank-chip cell-hit rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
      style={
        active
          ? {
              background: 'var(--color-text)',
              color: 'var(--color-bg)',
            }
          : {
              background: '#FFFFFF',
              color: 'var(--color-text)',
              border: '1px solid var(--color-rack-edge)',
            }
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}
