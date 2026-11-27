import { BANK_LABELS, BANK_ORDER, type PatchManifest } from '../../../../src/patches/types'
import { DRUMS_ID, PIANO_ID } from '../patches/bundled'

interface SoundsDrawerProps {
  catalog: readonly PatchManifest[]
  selectedId: string
  onSelect(id: string): void
}

export function SoundsDrawer({ catalog, selectedId, onSelect }: SoundsDrawerProps) {
  const bundled = catalog.filter(patch => patch.id === PIANO_ID || patch.id === DRUMS_ID)
  const builtins = catalog.filter(patch => patch.id !== PIANO_ID && patch.id !== DRUMS_ID)

  function group(label: string, patches: readonly PatchManifest[]) {
    return (
      <div key={label} className="kb-patch-group" role="group" aria-label={label}>
        <div className="kb-drawer-label">{label}</div>
        <div className="kb-patch-list flex flex-wrap">
          {patches.map(({ id, name }) => (
            <button
              key={id} className="kb-button kb-patch-btn" type="button" aria-pressed={id === selectedId}
              onClick={() => onSelect(id)}
            >{name}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="kb-drawer-sounds">
      {group('Bundled sounds', bundled)}
      {BANK_ORDER.map(bank => {
        const patches = builtins.filter(patch => patch.bank === bank)
        return patches.length > 0 ? group(BANK_LABELS[bank], patches) : null
      })}
    </div>
  )
}
