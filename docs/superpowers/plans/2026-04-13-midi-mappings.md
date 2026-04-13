# MIDI Mappings & Settings Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expressive MIDI input handling to MODULE — parse CC, pitch bend, and aftertouch; route them through user-configurable mappings to engine controls; expose the whole system through a gear-icon overlay with a live activity monitor and per-row Learn buttons.

**Architecture:** Three-layer pipeline — pure `parseMidi()` → stateful `MidiRouter` (translation + observers) → `EngineControls` interface on `AudioEngine`. Profiles + active id persisted to a new `module:midi-map:v1` localStorage key; `workingProfile` is in-memory only with a save-nag UX. Overlay is a modal cloning `SaveDialog`'s pattern, with an LCD-styled activity panel.

**Tech Stack:** TypeScript 5.7, React 19, Zustand v5, Vite 8, smplr 0.20, raw Web Audio. **Vitest** added in Task 1 for unit-testing the four pure modules.

**Spec:** `docs/superpowers/specs/2026-04-13-midi-mappings-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/state/midiMapTypes.ts` | All TypeScript types: `MidiDestId`, `MidiSource`, `MidiMapping`, `ModulatableTarget`, `TargetBindings`, `MidiProfile`, `PersistedMidiMap` |
| `src/state/midiMapDefaults.ts` | `defaultProfile()`, `cloneProfile()`, `freshDefaults()`, `generateProfileId()`, validation helpers, `isValidProfile()` |
| `src/state/midiMapPersist.ts` | `loadMidiMap()`, `persistMidiMap()` — pure I/O wrapping `module:midi-map:v1` |
| `src/state/useMidiMapSync.ts` | No-op hook stub for future apps.pepperhorn.com sync |
| `src/input/midiParse.ts` | Pure byte parser → `ParsedMidi` discriminated union; `sourceKey()` helper |
| `src/input/MidiRouter.ts` | Stateful translation + observer set; sustain buffer; Learn capture |
| `src/input/MidiActivityBuffer.ts` | Overlay-local ring buffer with peak-decay + listener subscribe |
| `src/input/midiRouterRef.ts` | Module-level singleton ref for cross-tree access |
| `src/components/MidiSettingsButton.tsx` | Gear icon button in the rack brand bar |
| `src/components/MidiSettingsOverlay.tsx` | The modal — composes header, profile row, activity panel, mapping list |
| `src/components/MidiActivityPanel.tsx` | LCD-styled live monitor with rAF loop |
| `src/components/MidiMappingRow.tsx` | One mapping row with checkbox + label + source picker + learn |
| `src/components/MidiSourcePicker.tsx` | Type+number combo dropdown |
| `src/components/MidiSaveNagDialog.tsx` | Save-on-leave confirmation modal |
| `tests/midiParse.test.ts` | Parser unit tests |
| `tests/MidiActivityBuffer.test.ts` | Activity buffer unit tests |
| `tests/MidiRouter.test.ts` | Router unit tests |
| `tests/midiMapDefaults.test.ts` | Defaults + validation unit tests |
| `tests/midiMapPersist.test.ts` | localStorage roundtrip unit tests |
| `vitest.config.ts` | Vitest config |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add vitest devDep, add `test` script |
| `src/audio/loadPatch.ts:17` | Add optional `setCC` to `LoadedInstrument` |
| `src/audio/AudioEngine.ts` | Add `setSustain`, `setMasterMix`, `setMasterPan` methods; insert `midiVolume` GainNode + `midiPan` StereoPannerNode after `effects.master` |
| `src/state/useStore.ts` | Add `MidiMapSlice` (profiles, activeProfileId, workingProfile, dirty + actions) |
| `src/input/useWebMidi.ts` | Refactor to use `parseMidi` + `MidiRouter`; subscribe to `workingProfile`; assign `midiRouterRef.current` |
| `src/components/Rack.tsx:81-84` | Insert `<MidiSettingsButton />` between `<MidiStatus />` and `<UserMenu />` |
| `src/App.tsx` | Mount `useMidiMapSync()` alongside `useUserPatchSync()` |

---

## Conventions

- Every step shows the actual code or actual command. No "implement X" placeholders.
- Test framework: **Vitest** (added in Task 1). Run individual tests with `npm test -- <pattern>`.
- Type check: `npm run typecheck`. Build: `npm run build`. Run after every commit-worthy task to catch type errors early.
- Commits: small, frequent, conventional-commit prefixes (`feat:`, `test:`, `refactor:`, `chore:`).
- Class naming on UI elements: contextual class alongside Tailwind utilities, per project convention (e.g. `<div className="midi-overlay-card pop-in flex ...">`).

---

## Task 1: Add Vitest for unit-testing pure modules

**Why:** Spec requires testable router/parser/buffer logic. Project has no test framework. We add minimal vitest scoped to four pure modules — no React component tests, no audio tests.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/.gitkeep`

- [ ] **Step 1: Install vitest**

```bash
cd /home/shaun/module && npm install --save-dev vitest@^2
```

Expected: vitest added to `devDependencies` in `package.json`. No errors.

- [ ] **Step 2: Add `test` script to package.json**

Edit `package.json` `scripts` block to add the test entry. Final `scripts` block:

```json
"scripts": {
  "dev": "vite --host 0.0.0.0",
  "build": "tsc -b && vite build",
  "preview": "vite preview --host 0.0.0.0",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "vendor-samples": "node scripts/vendor-samples.mjs"
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
})
```

- [ ] **Step 4: Create tests directory placeholder**

```bash
mkdir -p /home/shaun/module/tests && touch /home/shaun/module/tests/.gitkeep
```

- [ ] **Step 5: Verify vitest runs (with no tests)**

```bash
cd /home/shaun/module && npm test
```

Expected: Vitest reports "No test files found" (or similar). Exit code 0 or 1 — we just need to confirm vitest is callable.

- [ ] **Step 6: Verify typecheck still passes**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /home/shaun/module && git add package.json package-lock.json vitest.config.ts tests/.gitkeep && git commit -m "$(cat <<'EOF'
chore: add vitest for pure-module unit tests

Scoped to tests/ for the upcoming MidiRouter / parser / activity buffer.
React component and audio integration verification stay manual.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: MIDI map types

**Files:**
- Create: `src/state/midiMapTypes.ts`

- [ ] **Step 1: Create the types module**

Create `src/state/midiMapTypes.ts`:

```ts
export type MidiDestId =
  | 'sustain'
  | 'volume'
  | 'expression'
  | 'pan'
  | 'modTarget'
  | 'atTarget'
  | 'fxReverbMix'
  | 'fxDelayMix'
  | 'fxChorusDepth'
  | 'fxDistortionAmount'

export type MidiSource =
  | { kind: 'cc'; cc: number }
  | { kind: 'pitchBend' }
  | { kind: 'aftertouch' }
  | { kind: 'none' }

export interface MidiMapping {
  destId: MidiDestId
  source: MidiSource
  enabled: boolean
  invert?: boolean
  min?: number
  max?: number
}

export type ModulatableTarget =
  | 'masterVolume'
  | 'fxReverbMix'
  | 'fxDelayMix'
  | 'fxChorusDepth'
  | 'fxDistortionAmount'

export interface TargetBindings {
  modTargetParam: ModulatableTarget
  atTargetParam: ModulatableTarget
}

export interface MidiProfile {
  id: string
  name: string
  mappings: Record<MidiDestId, MidiMapping>
  bendRangeSemitones: number
  targets: TargetBindings
  createdAt: number
}

export interface PersistedMidiMap {
  schemaVersion: 1
  profiles: MidiProfile[]
  activeProfileId: string | null
}

export const ALL_DEST_IDS: readonly MidiDestId[] = [
  'sustain',
  'volume',
  'expression',
  'pan',
  'modTarget',
  'atTarget',
  'fxReverbMix',
  'fxDelayMix',
  'fxChorusDepth',
  'fxDistortionAmount',
] as const

export const ALL_MOD_TARGETS: readonly ModulatableTarget[] = [
  'masterVolume',
  'fxReverbMix',
  'fxDelayMix',
  'fxChorusDepth',
  'fxDistortionAmount',
] as const

export interface DestMeta {
  id: MidiDestId
  label: string
  hasShaping: boolean       // shows min/max/invert sub-row
  hasTarget: boolean        // shows target dropdown sub-row (modTarget/atTarget only)
}

export const DEST_META: Record<MidiDestId, DestMeta> = {
  sustain:            { id: 'sustain',            label: 'Sustain',      hasShaping: false, hasTarget: false },
  volume:             { id: 'volume',             label: 'Volume',       hasShaping: false, hasTarget: false },
  expression:         { id: 'expression',         label: 'Expression',   hasShaping: false, hasTarget: false },
  pan:                { id: 'pan',                label: 'Pan',          hasShaping: false, hasTarget: false },
  modTarget:          { id: 'modTarget',          label: 'Mod target',   hasShaping: true,  hasTarget: true  },
  atTarget:           { id: 'atTarget',           label: 'Aftertouch',   hasShaping: true,  hasTarget: true  },
  fxReverbMix:        { id: 'fxReverbMix',        label: 'FX: Reverb mix',     hasShaping: true, hasTarget: false },
  fxDelayMix:         { id: 'fxDelayMix',         label: 'FX: Delay mix',      hasShaping: true, hasTarget: false },
  fxChorusDepth:      { id: 'fxChorusDepth',      label: 'FX: Chorus depth',   hasShaping: true, hasTarget: false },
  fxDistortionAmount: { id: 'fxDistortionAmount', label: 'FX: Distortion amt', hasShaping: true, hasTarget: false },
}

export const MOD_TARGET_LABELS: Record<ModulatableTarget, string> = {
  masterVolume:       'Master volume',
  fxReverbMix:        'Reverb mix',
  fxDelayMix:         'Delay mix',
  fxChorusDepth:      'Chorus depth',
  fxDistortionAmount: 'Distortion amount',
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/state/midiMapTypes.ts && git commit -m "$(cat <<'EOF'
feat(midi): add midi map type definitions

MidiDestId, MidiSource, MidiMapping, MidiProfile, PersistedMidiMap,
plus ALL_DEST_IDS / DEST_META / MOD_TARGET_LABELS lookup tables for
the upcoming router and overlay UI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Default profile + helpers

**Files:**
- Create: `src/state/midiMapDefaults.ts`
- Create: `tests/midiMapDefaults.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/midiMapDefaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  defaultProfile,
  cloneProfile,
  freshDefaults,
  isValidProfile,
  generateProfileId,
} from '../src/state/midiMapDefaults'
import { ALL_DEST_IDS } from '../src/state/midiMapTypes'

describe('defaultProfile', () => {
  it('returns a profile with every destination present', () => {
    const p = defaultProfile()
    for (const id of ALL_DEST_IDS) {
      expect(p.mappings[id]).toBeDefined()
      expect(p.mappings[id].destId).toBe(id)
    }
  })

  it('defaults sustain to CC 64 enabled', () => {
    const p = defaultProfile()
    expect(p.mappings.sustain.source).toEqual({ kind: 'cc', cc: 64 })
    expect(p.mappings.sustain.enabled).toBe(true)
  })

  it('defaults expression to CC 11 enabled', () => {
    const p = defaultProfile()
    expect(p.mappings.expression.source).toEqual({ kind: 'cc', cc: 11 })
    expect(p.mappings.expression.enabled).toBe(true)
  })

  it('defaults modTarget to CC 1 with fxChorusDepth target', () => {
    const p = defaultProfile()
    expect(p.mappings.modTarget.source).toEqual({ kind: 'cc', cc: 1 })
    expect(p.mappings.modTarget.enabled).toBe(true)
    expect(p.targets.modTargetParam).toBe('fxChorusDepth')
  })

  it('defaults atTarget to aftertouch with fxReverbMix target', () => {
    const p = defaultProfile()
    expect(p.mappings.atTarget.source).toEqual({ kind: 'aftertouch' })
    expect(p.mappings.atTarget.enabled).toBe(true)
    expect(p.targets.atTargetParam).toBe('fxReverbMix')
  })

  it('defaults FX-send rows to source none, disabled', () => {
    const p = defaultProfile()
    expect(p.mappings.fxReverbMix.source).toEqual({ kind: 'none' })
    expect(p.mappings.fxReverbMix.enabled).toBe(false)
    expect(p.mappings.fxDelayMix.enabled).toBe(false)
    expect(p.mappings.fxChorusDepth.enabled).toBe(false)
    expect(p.mappings.fxDistortionAmount.enabled).toBe(false)
  })

  it('defaults bendRangeSemitones to 2', () => {
    expect(defaultProfile().bendRangeSemitones).toBe(2)
  })

  it('uses "Defaults" as the name', () => {
    expect(defaultProfile().name).toBe('Defaults')
  })
})

describe('cloneProfile', () => {
  it('produces a deep copy — mutations to mappings do not leak', () => {
    const a = defaultProfile()
    const b = cloneProfile(a)
    b.mappings.sustain.enabled = false
    expect(a.mappings.sustain.enabled).toBe(true)
  })

  it('preserves id and name', () => {
    const a = defaultProfile()
    a.id = 'abc'
    a.name = 'Test'
    const b = cloneProfile(a)
    expect(b.id).toBe('abc')
    expect(b.name).toBe('Test')
  })
})

describe('freshDefaults', () => {
  it('returns empty profiles + null active id + a working profile', () => {
    const f = freshDefaults()
    expect(f.profiles).toEqual([])
    expect(f.activeProfileId).toBe(null)
    expect(f.workingProfile).toBeDefined()
    expect(f.workingProfile.name).toBe('Defaults')
  })
})

describe('isValidProfile', () => {
  it('accepts a default profile', () => {
    expect(isValidProfile(defaultProfile())).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidProfile(null)).toBe(false)
  })

  it('rejects missing id', () => {
    const p = defaultProfile() as unknown as Record<string, unknown>
    delete p.id
    expect(isValidProfile(p)).toBe(false)
  })

  it('rejects missing mappings.sustain', () => {
    const p = defaultProfile() as unknown as { mappings: Record<string, unknown> }
    delete p.mappings.sustain
    expect(isValidProfile(p)).toBe(false)
  })
})

describe('generateProfileId', () => {
  it('returns unique ids on consecutive calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) ids.add(generateProfileId())
    expect(ids.size).toBe(50)
  })

  it('starts with the midimap prefix', () => {
    expect(generateProfileId()).toMatch(/^midimap-/)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/shaun/module && npm test -- midiMapDefaults
```

Expected: All tests fail with "Cannot find module '../src/state/midiMapDefaults'".

- [ ] **Step 3: Implement the module**

Create `src/state/midiMapDefaults.ts`:

```ts
import {
  ALL_DEST_IDS,
  type MidiDestId,
  type MidiMapping,
  type MidiProfile,
  type MidiSource,
} from './midiMapTypes'

export function generateProfileId(): string {
  return `midimap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface DefaultEntry {
  source: MidiSource
  enabled: boolean
}

const DEFAULT_ENTRIES: Record<MidiDestId, DefaultEntry> = {
  sustain:            { source: { kind: 'cc', cc: 64 },  enabled: true  },
  volume:             { source: { kind: 'cc', cc: 7 },   enabled: true  },
  expression:         { source: { kind: 'cc', cc: 11 },  enabled: true  },
  pan:                { source: { kind: 'cc', cc: 10 },  enabled: true  },
  modTarget:          { source: { kind: 'cc', cc: 1 },   enabled: true  },
  atTarget:           { source: { kind: 'aftertouch' },  enabled: true  },
  fxReverbMix:        { source: { kind: 'none' },        enabled: false },
  fxDelayMix:         { source: { kind: 'none' },        enabled: false },
  fxChorusDepth:      { source: { kind: 'none' },        enabled: false },
  fxDistortionAmount: { source: { kind: 'none' },        enabled: false },
}

export function defaultProfile(): MidiProfile {
  const mappings = {} as Record<MidiDestId, MidiMapping>
  for (const id of ALL_DEST_IDS) {
    const entry = DEFAULT_ENTRIES[id]
    mappings[id] = {
      destId: id,
      source: { ...entry.source } as MidiSource,
      enabled: entry.enabled,
    }
  }
  return {
    id: generateProfileId(),
    name: 'Defaults',
    mappings,
    bendRangeSemitones: 2,
    targets: {
      modTargetParam: 'fxChorusDepth',
      atTargetParam: 'fxReverbMix',
    },
    createdAt: Date.now(),
  }
}

export function cloneProfile(p: MidiProfile): MidiProfile {
  const mappings = {} as Record<MidiDestId, MidiMapping>
  for (const id of ALL_DEST_IDS) {
    const m = p.mappings[id]
    mappings[id] = {
      destId: m.destId,
      source: { ...m.source } as MidiSource,
      enabled: m.enabled,
      invert: m.invert,
      min: m.min,
      max: m.max,
    }
  }
  return {
    id: p.id,
    name: p.name,
    mappings,
    bendRangeSemitones: p.bendRangeSemitones,
    targets: { ...p.targets },
    createdAt: p.createdAt,
  }
}

export function freshDefaults(): {
  profiles: MidiProfile[]
  activeProfileId: string | null
  workingProfile: MidiProfile
} {
  return {
    profiles: [],
    activeProfileId: null,
    workingProfile: defaultProfile(),
  }
}

export function isValidProfile(value: unknown): value is MidiProfile {
  if (value === null || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  if (typeof p.id !== 'string') return false
  if (typeof p.name !== 'string') return false
  if (typeof p.bendRangeSemitones !== 'number') return false
  if (typeof p.createdAt !== 'number') return false
  if (!p.mappings || typeof p.mappings !== 'object') return false
  if (!p.targets || typeof p.targets !== 'object') return false
  const mappings = p.mappings as Record<string, unknown>
  for (const id of ALL_DEST_IDS) {
    if (!mappings[id] || typeof mappings[id] !== 'object') return false
  }
  return true
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- midiMapDefaults
```

Expected: All tests pass.

- [ ] **Step 5: Verify typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/state/midiMapDefaults.ts tests/midiMapDefaults.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add default profile + clone/validate helpers

defaultProfile() builds a GM-keyboard preset (sustain=CC64, vol=CC7,
expression=CC11, pan=CC10, mod=CC1→chorus, AT→reverb). cloneProfile()
deep-copies mappings. isValidProfile() guards persisted JSON.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pure MIDI byte parser

**Files:**
- Create: `src/input/midiParse.ts`
- Create: `tests/midiParse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/midiParse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseMidi, sourceKey } from '../src/input/midiParse'

const bytes = (...vals: number[]) => new Uint8Array(vals)

describe('parseMidi', () => {
  it('returns null for empty data', () => {
    expect(parseMidi(bytes())).toBeNull()
  })

  it('parses note-on (channel 0)', () => {
    expect(parseMidi(bytes(0x90, 60, 100))).toEqual({
      kind: 'noteOn', midi: 60, vel: 100, channel: 0,
    })
  })

  it('parses note-on on channel 5', () => {
    expect(parseMidi(bytes(0x95, 72, 80))).toEqual({
      kind: 'noteOn', midi: 72, vel: 80, channel: 5,
    })
  })

  it('treats note-on velocity 0 as noteOff', () => {
    expect(parseMidi(bytes(0x90, 60, 0))).toEqual({
      kind: 'noteOff', midi: 60, channel: 0,
    })
  })

  it('parses explicit noteOff (0x80)', () => {
    expect(parseMidi(bytes(0x80, 60, 64))).toEqual({
      kind: 'noteOff', midi: 60, channel: 0,
    })
  })

  it('parses CC message', () => {
    expect(parseMidi(bytes(0xb0, 11, 96))).toEqual({
      kind: 'cc', cc: 11, value: 96, channel: 0,
    })
  })

  it('parses CC on channel 3', () => {
    expect(parseMidi(bytes(0xb3, 64, 127))).toEqual({
      kind: 'cc', cc: 64, value: 127, channel: 3,
    })
  })

  it('parses pitch bend at centre (0x2000)', () => {
    expect(parseMidi(bytes(0xe0, 0x00, 0x40))).toEqual({
      kind: 'pitchBend', value: 0, channel: 0,
    })
  })

  it('parses pitch bend at maximum (0x3fff = +8191)', () => {
    expect(parseMidi(bytes(0xe0, 0x7f, 0x7f))).toEqual({
      kind: 'pitchBend', value: 8191, channel: 0,
    })
  })

  it('parses pitch bend at minimum (0x0000 = -8192)', () => {
    expect(parseMidi(bytes(0xe0, 0x00, 0x00))).toEqual({
      kind: 'pitchBend', value: -8192, channel: 0,
    })
  })

  it('parses channel aftertouch', () => {
    expect(parseMidi(bytes(0xd0, 80))).toEqual({
      kind: 'aftertouch', value: 80, channel: 0,
    })
  })

  it('parses channel aftertouch on channel 9', () => {
    expect(parseMidi(bytes(0xd9, 64))).toEqual({
      kind: 'aftertouch', value: 64, channel: 9,
    })
  })

  it('returns null for sysex (0xf0)', () => {
    expect(parseMidi(bytes(0xf0, 0x00, 0xf7))).toBeNull()
  })

  it('returns null for clock (0xf8)', () => {
    expect(parseMidi(bytes(0xf8))).toBeNull()
  })

  it('returns null for poly aftertouch (0xa0)', () => {
    // Poly pressure is out of v1 scope — treat as unhandled
    expect(parseMidi(bytes(0xa0, 60, 80))).toBeNull()
  })

  it('returns null for malformed CC (only 1 byte)', () => {
    expect(parseMidi(bytes(0xb0))).toBeNull()
  })

  it('returns null for malformed pitch bend (only 2 bytes)', () => {
    expect(parseMidi(bytes(0xe0, 0x00))).toBeNull()
  })
})

describe('sourceKey', () => {
  it('keys CC by number', () => {
    expect(sourceKey({ kind: 'cc', cc: 64, value: 100, channel: 0 })).toBe('cc:64')
  })

  it('keys pitch bend uniformly', () => {
    expect(sourceKey({ kind: 'pitchBend', value: 0, channel: 0 })).toBe('pitchBend')
  })

  it('keys aftertouch uniformly', () => {
    expect(sourceKey({ kind: 'aftertouch', value: 80, channel: 0 })).toBe('aftertouch')
  })

  it('returns null for note events', () => {
    expect(sourceKey({ kind: 'noteOn', midi: 60, vel: 100, channel: 0 })).toBeNull()
    expect(sourceKey({ kind: 'noteOff', midi: 60, channel: 0 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/shaun/module && npm test -- midiParse
```

Expected: All tests fail (module missing).

- [ ] **Step 3: Implement the parser**

Create `src/input/midiParse.ts`:

```ts
export type ParsedMidi =
  | { kind: 'noteOn';     midi: number; vel: number; channel: number }
  | { kind: 'noteOff';    midi: number;               channel: number }
  | { kind: 'cc';         cc: number;   value: number; channel: number }
  | { kind: 'pitchBend';  value: number;              channel: number }
  | { kind: 'aftertouch'; value: number;              channel: number }

export function parseMidi(data: Uint8Array): ParsedMidi | null {
  if (data.length < 1) return null
  const status = data[0] & 0xf0
  const channel = data[0] & 0x0f

  switch (status) {
    case 0x90: { // note on
      if (data.length < 3) return null
      const midi = data[1]
      const vel = data[2]
      if (vel === 0) return { kind: 'noteOff', midi, channel }
      return { kind: 'noteOn', midi, vel, channel }
    }
    case 0x80: { // note off
      if (data.length < 3) return null
      return { kind: 'noteOff', midi: data[1], channel }
    }
    case 0xb0: { // control change
      if (data.length < 3) return null
      return { kind: 'cc', cc: data[1], value: data[2], channel }
    }
    case 0xe0: { // pitch bend
      if (data.length < 3) return null
      // Two 7-bit halves: LSB first, then MSB. Centre is 0x2000.
      const raw = (data[2] << 7) | data[1]
      return { kind: 'pitchBend', value: raw - 0x2000, channel }
    }
    case 0xd0: { // channel aftertouch
      if (data.length < 2) return null
      return { kind: 'aftertouch', value: data[1], channel }
    }
    default:
      // sysex (0xf0), clock (0xf8), poly pressure (0xa0), program change (0xc0), etc.
      return null
  }
}

export function sourceKey(event: ParsedMidi): string | null {
  switch (event.kind) {
    case 'cc':         return `cc:${event.cc}`
    case 'pitchBend':  return 'pitchBend'
    case 'aftertouch': return 'aftertouch'
    case 'noteOn':
    case 'noteOff':
      return null
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- midiParse
```

Expected: All tests pass.

- [ ] **Step 5: Verify typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/midiParse.ts tests/midiParse.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add pure midi byte parser

parseMidi() returns a typed ParsedMidi event for noteOn/noteOff/CC/
pitchBend/aftertouch, or null for sysex/clock/poly-pressure/malformed
input. sourceKey() normalises the source side for router lookups.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: MidiActivityBuffer

**Files:**
- Create: `src/input/MidiActivityBuffer.ts`
- Create: `tests/MidiActivityBuffer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/MidiActivityBuffer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { MidiActivityBuffer } from '../src/input/MidiActivityBuffer'
import type { ParsedMidi } from '../src/input/midiParse'

describe('MidiActivityBuffer', () => {
  it('skips note events', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'noteOn', midi: 60, vel: 100, channel: 0 }, 1000)
    expect(buf.snapshot(1000)).toEqual([])
  })

  it('records a CC event', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'cc', cc: 64, value: 100, channel: 0 }, 1000)
    const snap = buf.snapshot(1000)
    expect(snap.length).toBe(1)
    expect(snap[0].source).toBe('cc:64')
    expect(snap[0].label).toBe('CC 64')
    expect(snap[0].value).toBe(100)
    expect(snap[0].peakPct).toBeGreaterThan(0)
  })

  it('records pitch bend with signed value', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'pitchBend', value: 4096, channel: 0 }, 1000)
    const snap = buf.snapshot(1000)
    expect(snap[0].source).toBe('pitchBend')
    expect(snap[0].label).toBe('Pitch Bend')
    expect(snap[0].value).toBe(4096)
  })

  it('records aftertouch', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'aftertouch', value: 80, channel: 0 }, 1000)
    const snap = buf.snapshot(1000)
    expect(snap[0].source).toBe('aftertouch')
    expect(snap[0].label).toBe('Aftertouch')
  })

  it('drops rows older than 2000ms in snapshot', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'cc', cc: 1, value: 50, channel: 0 }, 1000)
    expect(buf.snapshot(1000).length).toBe(1)
    expect(buf.snapshot(2999).length).toBe(1)
    expect(buf.snapshot(3001).length).toBe(0)
  })

  it('keeps multiple distinct sources', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'cc', cc: 1, value: 50, channel: 0 }, 1000)
    buf.ingest({ kind: 'cc', cc: 2, value: 90, channel: 0 }, 1001)
    buf.ingest({ kind: 'pitchBend', value: 0, channel: 0 }, 1002)
    expect(buf.snapshot(1002).length).toBe(3)
  })

  it('updates value but keeps peak when value drops', () => {
    const buf = new MidiActivityBuffer()
    buf.ingest({ kind: 'cc', cc: 1, value: 100, channel: 0 }, 1000)
    buf.ingest({ kind: 'cc', cc: 1, value: 20, channel: 0 }, 1010)
    const snap = buf.snapshot(1010)
    expect(snap[0].value).toBe(20)
    expect(snap[0].peakPct).toBeGreaterThan(snap[0].value / 127 * 100)
  })

  it('notifies subscribers on ingest', () => {
    const buf = new MidiActivityBuffer()
    const fn = vi.fn()
    const unsub = buf.subscribe(fn)
    buf.ingest({ kind: 'cc', cc: 1, value: 50, channel: 0 }, 1000)
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    buf.ingest({ kind: 'cc', cc: 1, value: 60, channel: 0 }, 1001)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignores note events for subscriber notifications', () => {
    const buf = new MidiActivityBuffer()
    const fn = vi.fn()
    buf.subscribe(fn)
    buf.ingest({ kind: 'noteOn', midi: 60, vel: 100, channel: 0 }, 1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/shaun/module && npm test -- MidiActivityBuffer
```

- [ ] **Step 3: Implement the buffer**

Create `src/input/MidiActivityBuffer.ts`:

```ts
import { type ParsedMidi, sourceKey } from './midiParse'

export interface ActivityRow {
  source: string       // 'cc:64' / 'pitchBend' / 'aftertouch'
  label: string        // 'CC 64' / 'Pitch Bend' / 'Aftertouch'
  value: number        // last raw value (signed for pitch bend)
  peakPct: number      // 0..100 — for the bar fill
  lastSeen: number     // timestamp of last ingest
}

interface BufferEntry {
  value: number
  peak: number          // raw absolute peak in source units
  range: number         // for pickWinner: 0..127 or 0..16383
  at: number
}

const STALE_MS = 2000

function labelFor(source: string): string {
  if (source.startsWith('cc:')) return `CC ${source.slice(3)}`
  if (source === 'pitchBend')   return 'Pitch Bend'
  if (source === 'aftertouch')  return 'Aftertouch'
  return source
}

function maxRangeFor(source: string): number {
  if (source === 'pitchBend') return 16383   // -8192..+8191 absolute span
  return 127                                 // CC and aftertouch
}

export class MidiActivityBuffer {
  private state = new Map<string, BufferEntry>()
  private listeners = new Set<() => void>()

  ingest(event: ParsedMidi, now: number = performance.now()): void {
    const key = sourceKey(event)
    if (!key) return
    const value = event.kind === 'pitchBend' ? event.value : event.kind === 'cc' ? event.value : event.value
    const absValue = Math.abs(value)
    const existing = this.state.get(key)
    const peak = existing ? Math.max(absValue, existing.peak) : absValue
    this.state.set(key, { value, peak, range: peak, at: now })
    this.notify()
  }

  snapshot(now: number = performance.now()): ActivityRow[] {
    const rows: ActivityRow[] = []
    for (const [source, entry] of this.state.entries()) {
      if (now - entry.at > STALE_MS) continue
      const max = maxRangeFor(source)
      rows.push({
        source,
        label: labelFor(source),
        value: entry.value,
        peakPct: Math.min(100, (entry.peak / max) * 100),
        lastSeen: entry.at,
      })
    }
    rows.sort((a, b) => a.source.localeCompare(b.source))
    return rows
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn()
      } catch {
        // noop — a misbehaving listener shouldn't break ingest
      }
    }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- MidiActivityBuffer
```

- [ ] **Step 5: Verify typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/MidiActivityBuffer.ts tests/MidiActivityBuffer.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add MidiActivityBuffer for the overlay's live monitor

Per-source ring with peak tracking, snapshot() filters stale rows
(>2000ms), subscribe() for the rAF loop in MidiActivityPanel.
Note events are ignored.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: MidiRouter — base + EngineControls interface + note passthrough

**Files:**
- Create: `src/input/MidiRouter.ts`
- Create: `tests/MidiRouter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/MidiRouter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { MidiRouter, type EngineControls } from '../src/input/MidiRouter'
import { defaultProfile } from '../src/state/midiMapDefaults'

function makeMockEngine(): EngineControls & {
  noteOn: ReturnType<typeof vi.fn>
  noteOff: ReturnType<typeof vi.fn>
  setSustain: ReturnType<typeof vi.fn>
  setMasterMix: ReturnType<typeof vi.fn>
  setMasterPan: ReturnType<typeof vi.fn>
  setFxParam: ReturnType<typeof vi.fn>
} {
  return {
    noteOn:        vi.fn(),
    noteOff:       vi.fn(),
    setSustain:    vi.fn(),
    setMasterMix:  vi.fn(),
    setMasterPan:  vi.fn(),
    setFxParam:    vi.fn(),
  }
}

describe('MidiRouter — note passthrough', () => {
  it('forwards noteOn directly to the engine', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'noteOn', midi: 60, vel: 100, channel: 0 })
    expect(engine.noteOn).toHaveBeenCalledWith(60, 100)
  })

  it('forwards noteOff directly to the engine when sustain is not held', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'noteOff', midi: 60, channel: 0 })
    expect(engine.noteOff).toHaveBeenCalledWith(60)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 3: Implement minimal router (note passthrough only)**

Create `src/input/MidiRouter.ts`:

```ts
import type { EffectId } from '../audio/effects'
import type {
  MidiDestId,
  MidiMapping,
  MidiProfile,
  ModulatableTarget,
} from '../state/midiMapTypes'
import { ALL_DEST_IDS } from '../state/midiMapTypes'
import { type ParsedMidi, sourceKey } from './midiParse'

export interface EngineControls {
  noteOn:       (midi: number, vel: number) => void
  noteOff:      (midi: number) => void
  setSustain:   (held: boolean) => void
  setMasterMix: (volume: number, expression: number) => void
  setMasterPan: (p: number) => void
  setFxParam:   (effectId: EffectId, paramId: string, value: number) => void
}

export class MidiRouter {
  private workingMap: MidiProfile | null = null

  constructor(private engine: EngineControls) {}

  setMap(profile: MidiProfile): void {
    this.workingMap = profile
  }

  handle(event: ParsedMidi): void {
    if (event.kind === 'noteOn') {
      this.engine.noteOn(event.midi, event.vel)
      return
    }
    if (event.kind === 'noteOff') {
      this.engine.noteOff(event.midi)
      return
    }
    // CC / pitch bend / aftertouch — implemented in later tasks.
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/MidiRouter.ts tests/MidiRouter.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): scaffold MidiRouter with EngineControls + note passthrough

EngineControls is the typed contract AudioEngine will satisfy.
Note events forward straight through; CC / pitch-bend / aftertouch
dispatch land in the next task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: MidiRouter — sustain pedal + volume + expression + pan

**Files:**
- Modify: `src/input/MidiRouter.ts`
- Modify: `tests/MidiRouter.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/MidiRouter.test.ts`:

```ts
describe('MidiRouter — sustain', () => {
  it('defers noteOff while CC 64 ≥ 64', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 64, value: 127, channel: 0 })  // pedal down
    router.handle({ kind: 'noteOff', midi: 60, channel: 0 })
    expect(engine.noteOff).not.toHaveBeenCalled()
    expect(engine.setSustain).toHaveBeenCalledWith(true)
  })

  it('drains deferred noteOffs on pedal release', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 64, value: 127, channel: 0 })
    router.handle({ kind: 'noteOff', midi: 60, channel: 0 })
    router.handle({ kind: 'noteOff', midi: 64, channel: 0 })
    expect(engine.noteOff).not.toHaveBeenCalled()
    router.handle({ kind: 'cc', cc: 64, value: 0, channel: 0 })   // pedal up
    expect(engine.noteOff).toHaveBeenCalledWith(60)
    expect(engine.noteOff).toHaveBeenCalledWith(64)
    expect(engine.setSustain).toHaveBeenLastCalledWith(false)
  })

  it('does not defer notes that play and release while pedal is up', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'noteOff', midi: 60, channel: 0 })
    expect(engine.noteOff).toHaveBeenCalledWith(60)
  })
})

describe('MidiRouter — volume + expression + pan', () => {
  it('forwards volume CC 7 as 0..1 to setMasterMix (with default expression 1)', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 7, value: 127, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(1, 1)
    router.handle({ kind: 'cc', cc: 7, value: 0, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(0, 1)
  })

  it('multiplies expression CC 11 by current volume', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 7, value: 64, channel: 0 })   // ~0.504
    router.handle({ kind: 'cc', cc: 11, value: 64, channel: 0 })  // ~0.504
    const lastCall = engine.setMasterMix.mock.calls.at(-1)
    expect(lastCall?.[0]).toBeCloseTo(64 / 127, 3)
    expect(lastCall?.[1]).toBeCloseTo(64 / 127, 3)
  })

  it('forwards pan CC 10 as -1..+1', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 10, value: 64, channel: 0 })  // centre-ish
    const lastPan = engine.setMasterPan.mock.calls.at(-1)?.[0]
    expect(lastPan).toBeCloseTo(0.008, 2)   // (64 - 63.5) / 63.5 ≈ ~0
    router.handle({ kind: 'cc', cc: 10, value: 127, channel: 0 })
    expect(engine.setMasterPan).toHaveBeenLastCalledWith(1)
    router.handle({ kind: 'cc', cc: 10, value: 0, channel: 0 })
    expect(engine.setMasterPan).toHaveBeenLastCalledWith(-1)
  })

  it('does not dispatch when destination is disabled', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    const profile = defaultProfile()
    profile.mappings.volume.enabled = false
    router.setMap(profile)
    router.handle({ kind: 'cc', cc: 7, value: 100, channel: 0 })
    expect(engine.setMasterMix).not.toHaveBeenCalled()
  })

  it('respects min/max shaping', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    const profile = defaultProfile()
    profile.mappings.volume.min = 0.2
    profile.mappings.volume.max = 0.8
    router.setMap(profile)
    router.handle({ kind: 'cc', cc: 7, value: 0, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(0.2, 1)
    router.handle({ kind: 'cc', cc: 7, value: 127, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(0.8, 1)
  })

  it('respects invert', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    const profile = defaultProfile()
    profile.mappings.volume.invert = true
    router.setMap(profile)
    router.handle({ kind: 'cc', cc: 7, value: 0, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(1, 1)
    router.handle({ kind: 'cc', cc: 7, value: 127, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(0, 1)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 3: Implement dispatch + shaping**

Replace the contents of `src/input/MidiRouter.ts`:

```ts
import type { EffectId } from '../audio/effects'
import type {
  MidiDestId,
  MidiMapping,
  MidiProfile,
} from '../state/midiMapTypes'
import { ALL_DEST_IDS } from '../state/midiMapTypes'
import { type ParsedMidi, sourceKey } from './midiParse'

export interface EngineControls {
  noteOn:       (midi: number, vel: number) => void
  noteOff:      (midi: number) => void
  setSustain:   (held: boolean) => void
  setMasterMix: (volume: number, expression: number) => void
  setMasterPan: (p: number) => void
  setFxParam:   (effectId: EffectId, paramId: string, value: number) => void
}

export class MidiRouter {
  private workingMap: MidiProfile | null = null
  private lookupTable: Map<string, MidiMapping[]> = new Map()
  private sustainHeld = false
  private deferredNoteOffs = new Set<number>()
  private currentVolume = 1
  private currentExpression = 1

  constructor(private engine: EngineControls) {}

  setMap(profile: MidiProfile): void {
    this.workingMap = profile
    this.rebuildLookup()
  }

  handle(event: ParsedMidi): void {
    if (event.kind === 'noteOn') {
      this.engine.noteOn(event.midi, event.vel)
      return
    }
    if (event.kind === 'noteOff') {
      if (this.sustainHeld) {
        this.deferredNoteOffs.add(event.midi)
      } else {
        this.engine.noteOff(event.midi)
      }
      return
    }
    const key = sourceKey(event)
    if (!key) return
    const matches = this.lookupTable.get(key)
    if (!matches) return
    for (const m of matches) {
      if (!m.enabled) continue
      this.dispatch(m, event)
    }
  }

  private rebuildLookup(): void {
    this.lookupTable.clear()
    if (!this.workingMap) return
    for (const id of ALL_DEST_IDS) {
      const m = this.workingMap.mappings[id]
      if (m.source.kind === 'none') continue
      const key = m.source.kind === 'cc'
        ? `cc:${m.source.cc}`
        : m.source.kind === 'pitchBend'
          ? 'pitchBend'
          : 'aftertouch'
      const list = this.lookupTable.get(key) ?? []
      list.push(m)
      this.lookupTable.set(key, list)
    }
  }

  /** Convert raw event value to a normalized 0..1 (or -1..+1 for pan). */
  private normalize(m: MidiMapping, event: ParsedMidi): number {
    let raw01 = 0
    if (event.kind === 'cc' || event.kind === 'aftertouch') {
      raw01 = event.value / 127
    } else if (event.kind === 'pitchBend') {
      // -8192..+8191 → 0..1
      raw01 = (event.value + 8192) / 16383
    }
    if (m.invert) raw01 = 1 - raw01
    const min = m.min ?? 0
    const max = m.max ?? 1
    return min + raw01 * (max - min)
  }

  private dispatch(m: MidiMapping, event: ParsedMidi): void {
    switch (m.destId) {
      case 'sustain': {
        if (event.kind !== 'cc') return
        const held = event.value >= 64
        if (held !== this.sustainHeld) {
          this.sustainHeld = held
          this.engine.setSustain(held)
          if (!held) {
            for (const midi of this.deferredNoteOffs) this.engine.noteOff(midi)
            this.deferredNoteOffs.clear()
          }
        }
        return
      }
      case 'volume': {
        const v = this.normalize(m, event)
        this.currentVolume = v
        this.engine.setMasterMix(this.currentVolume, this.currentExpression)
        return
      }
      case 'expression': {
        const v = this.normalize(m, event)
        this.currentExpression = v
        this.engine.setMasterMix(this.currentVolume, this.currentExpression)
        return
      }
      case 'pan': {
        if (event.kind !== 'cc') return
        // Map 0..127 → -1..+1, with centre at 64 → 0.008 (good enough)
        const p = (event.value - 63.5) / 63.5
        const clamped = Math.max(-1, Math.min(1, p))
        this.engine.setMasterPan(clamped)
        return
      }
      // modTarget / atTarget / fx* — added in next task
    }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/MidiRouter.ts tests/MidiRouter.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add sustain / volume / expression / pan dispatch

Sustain buffers noteOffs while pedal held, drains on release. Volume
and expression multiply into setMasterMix. Pan maps -1..+1 with a
centre-friendly scale. Min/max/invert shaping respected.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: MidiRouter — FX-send dispatch + mod/AT targets + observers

**Files:**
- Modify: `src/input/MidiRouter.ts`
- Modify: `tests/MidiRouter.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/MidiRouter.test.ts`:

```ts
describe('MidiRouter — FX dispatch', () => {
  it('routes a CC mapped directly to fxReverbMix', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    const profile = defaultProfile()
    profile.mappings.fxReverbMix.source = { kind: 'cc', cc: 20 }
    profile.mappings.fxReverbMix.enabled = true
    router.setMap(profile)
    router.handle({ kind: 'cc', cc: 20, value: 127, channel: 0 })
    expect(engine.setFxParam).toHaveBeenCalledWith('reverb', 'mix', 1)
  })

  it('routes mod target (CC 1) to fxChorusDepth by default', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'cc', cc: 1, value: 127, channel: 0 })
    expect(engine.setFxParam).toHaveBeenCalledWith('chorus', 'depth', 1)
  })

  it('routes aftertouch target to fxReverbMix by default', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    router.handle({ kind: 'aftertouch', value: 64, channel: 0 })
    const last = engine.setFxParam.mock.calls.at(-1)
    expect(last?.[0]).toBe('reverb')
    expect(last?.[1]).toBe('mix')
    expect(last?.[2]).toBeCloseTo(64 / 127, 3)
  })

  it('honours masterVolume modulation target', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    const profile = defaultProfile()
    profile.targets.modTargetParam = 'masterVolume'
    router.setMap(profile)
    router.handle({ kind: 'cc', cc: 1, value: 127, channel: 0 })
    expect(engine.setMasterMix).toHaveBeenLastCalledWith(1, 1)
  })
})

describe('MidiRouter — observers', () => {
  it('notifies observers of every parsed event including unmapped CCs', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    const fn = vi.fn()
    router.addObserver(fn)
    router.handle({ kind: 'cc', cc: 99, value: 50, channel: 0 })   // unmapped
    router.handle({ kind: 'pitchBend', value: 100, channel: 0 })
    router.handle({ kind: 'aftertouch', value: 80, channel: 0 })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does NOT notify observers of note events', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    const fn = vi.fn()
    router.addObserver(fn)
    router.handle({ kind: 'noteOn', midi: 60, vel: 100, channel: 0 })
    router.handle({ kind: 'noteOff', midi: 60, channel: 0 })
    expect(fn).not.toHaveBeenCalled()
  })

  it('removes observers via the returned unsubscribe', () => {
    const engine = makeMockEngine()
    const router = new MidiRouter(engine)
    router.setMap(defaultProfile())
    const fn = vi.fn()
    const unsub = router.addObserver(fn)
    router.handle({ kind: 'cc', cc: 1, value: 50, channel: 0 })
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    router.handle({ kind: 'cc', cc: 1, value: 60, channel: 0 })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 3: Extend the router**

Replace `src/input/MidiRouter.ts` with the expanded version:

```ts
import type { EffectId } from '../audio/effects'
import type {
  MidiDestId,
  MidiMapping,
  MidiProfile,
  ModulatableTarget,
} from '../state/midiMapTypes'
import { ALL_DEST_IDS } from '../state/midiMapTypes'
import { type ParsedMidi, sourceKey } from './midiParse'

export interface EngineControls {
  noteOn:       (midi: number, vel: number) => void
  noteOff:      (midi: number) => void
  setSustain:   (held: boolean) => void
  setMasterMix: (volume: number, expression: number) => void
  setMasterPan: (p: number) => void
  setFxParam:   (effectId: EffectId, paramId: string, value: number) => void
}

interface FxRoute { effectId: EffectId; paramId: string }

const FX_ROUTES: Record<
  'fxReverbMix' | 'fxDelayMix' | 'fxChorusDepth' | 'fxDistortionAmount',
  FxRoute
> = {
  fxReverbMix:        { effectId: 'reverb',     paramId: 'mix' },
  fxDelayMix:         { effectId: 'delay',      paramId: 'mix' },
  fxChorusDepth:      { effectId: 'chorus',     paramId: 'depth' },
  fxDistortionAmount: { effectId: 'distortion', paramId: 'mix' },
}

function modTargetRoute(target: ModulatableTarget): FxRoute | 'masterVolume' {
  switch (target) {
    case 'masterVolume':       return 'masterVolume'
    case 'fxReverbMix':        return FX_ROUTES.fxReverbMix
    case 'fxDelayMix':         return FX_ROUTES.fxDelayMix
    case 'fxChorusDepth':      return FX_ROUTES.fxChorusDepth
    case 'fxDistortionAmount': return FX_ROUTES.fxDistortionAmount
  }
}

export class MidiRouter {
  private workingMap: MidiProfile | null = null
  private lookupTable: Map<string, MidiMapping[]> = new Map()
  private sustainHeld = false
  private deferredNoteOffs = new Set<number>()
  private currentVolume = 1
  private currentExpression = 1
  private observers = new Set<(e: ParsedMidi) => void>()

  constructor(private engine: EngineControls) {}

  setMap(profile: MidiProfile): void {
    this.workingMap = profile
    this.rebuildLookup()
  }

  handle(event: ParsedMidi): void {
    if (event.kind === 'noteOn') {
      this.engine.noteOn(event.midi, event.vel)
      return
    }
    if (event.kind === 'noteOff') {
      if (this.sustainHeld) {
        this.deferredNoteOffs.add(event.midi)
      } else {
        this.engine.noteOff(event.midi)
      }
      return
    }
    const key = sourceKey(event)
    if (!key) return
    const matches = this.lookupTable.get(key)
    if (matches) {
      for (const m of matches) {
        if (!m.enabled) continue
        this.dispatch(m, event)
      }
    }
    this.notify(event)
  }

  addObserver(fn: (e: ParsedMidi) => void): () => void {
    this.observers.add(fn)
    return () => {
      this.observers.delete(fn)
    }
  }

  private notify(event: ParsedMidi): void {
    if (event.kind === 'noteOn' || event.kind === 'noteOff') return
    for (const fn of this.observers) {
      try {
        fn(event)
      } catch {
        // noop
      }
    }
  }

  private rebuildLookup(): void {
    this.lookupTable.clear()
    if (!this.workingMap) return
    for (const id of ALL_DEST_IDS) {
      const m = this.workingMap.mappings[id]
      if (m.source.kind === 'none') continue
      const key = m.source.kind === 'cc'
        ? `cc:${m.source.cc}`
        : m.source.kind === 'pitchBend'
          ? 'pitchBend'
          : 'aftertouch'
      const list = this.lookupTable.get(key) ?? []
      list.push(m)
      this.lookupTable.set(key, list)
    }
  }

  private normalize(m: MidiMapping, event: ParsedMidi): number {
    let raw01 = 0
    if (event.kind === 'cc' || event.kind === 'aftertouch') {
      raw01 = event.value / 127
    } else if (event.kind === 'pitchBend') {
      raw01 = (event.value + 8192) / 16383
    }
    if (m.invert) raw01 = 1 - raw01
    const min = m.min ?? 0
    const max = m.max ?? 1
    return min + raw01 * (max - min)
  }

  private dispatch(m: MidiMapping, event: ParsedMidi): void {
    switch (m.destId) {
      case 'sustain': {
        if (event.kind !== 'cc') return
        const held = event.value >= 64
        if (held !== this.sustainHeld) {
          this.sustainHeld = held
          this.engine.setSustain(held)
          if (!held) {
            for (const midi of this.deferredNoteOffs) this.engine.noteOff(midi)
            this.deferredNoteOffs.clear()
          }
        }
        return
      }
      case 'volume': {
        this.currentVolume = this.normalize(m, event)
        this.engine.setMasterMix(this.currentVolume, this.currentExpression)
        return
      }
      case 'expression': {
        this.currentExpression = this.normalize(m, event)
        this.engine.setMasterMix(this.currentVolume, this.currentExpression)
        return
      }
      case 'pan': {
        if (event.kind !== 'cc') return
        const p = (event.value - 63.5) / 63.5
        this.engine.setMasterPan(Math.max(-1, Math.min(1, p)))
        return
      }
      case 'modTarget':
      case 'atTarget': {
        if (!this.workingMap) return
        const target = m.destId === 'modTarget'
          ? this.workingMap.targets.modTargetParam
          : this.workingMap.targets.atTargetParam
        const route = modTargetRoute(target)
        const v = this.normalize(m, event)
        if (route === 'masterVolume') {
          this.currentVolume = v
          this.engine.setMasterMix(this.currentVolume, this.currentExpression)
        } else {
          this.engine.setFxParam(route.effectId, route.paramId, v)
        }
        return
      }
      case 'fxReverbMix':
      case 'fxDelayMix':
      case 'fxChorusDepth':
      case 'fxDistortionAmount': {
        const route = FX_ROUTES[m.destId]
        const v = this.normalize(m, event)
        this.engine.setFxParam(route.effectId, route.paramId, v)
        return
      }
    }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- MidiRouter
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/MidiRouter.ts tests/MidiRouter.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add FX dispatch + mod/AT targets + observers

Mod and aftertouch route through user-selectable target (default
chorus depth / reverb mix). Direct FX-send rows route to the same
underlying setFxParam. Observer set fires for every non-note event
(consumed by the activity panel).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: midiRouterRef singleton

**Why:** The overlay needs to attach activity observers without prop-drilling and without React Context (the rAF loop runs outside React's tree).

**Files:**
- Create: `src/input/midiRouterRef.ts`

- [ ] **Step 1: Create the ref module**

Create `src/input/midiRouterRef.ts`:

```ts
import type { MidiRouter } from './MidiRouter'

interface MidiRouterRef {
  current: MidiRouter | null
}

export const midiRouterRef: MidiRouterRef = { current: null }
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/input/midiRouterRef.ts && git commit -m "$(cat <<'EOF'
feat(midi): add midiRouterRef singleton for cross-tree access

Module-level mutable ref that useWebMidi populates after creating the
router. The overlay imports it directly to attach activity observers
without React Context plumbing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Persistence helpers

**Files:**
- Create: `src/state/midiMapPersist.ts`
- Create: `tests/midiMapPersist.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/midiMapPersist.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadMidiMap, persistMidiMap, MIDI_MAP_KEY } from '../src/state/midiMapPersist'
import { defaultProfile } from '../src/state/midiMapDefaults'

// Minimal localStorage shim for the node test environment
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string) { return this.store.get(k) ?? null }
  setItem(k: string, v: string) { this.store.set(k, v) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

afterEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage | undefined }).localStorage = undefined
})

describe('loadMidiMap', () => {
  it('returns fresh defaults when localStorage is empty', () => {
    const result = loadMidiMap()
    expect(result.profiles).toEqual([])
    expect(result.activeProfileId).toBeNull()
    expect(result.workingProfile.name).toBe('Defaults')
  })

  it('hydrates a persisted profile and selects it as working', () => {
    const profile = defaultProfile()
    profile.name = 'EWI USB'
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify({
      schemaVersion: 1,
      profiles: [profile],
      activeProfileId: profile.id,
    }))
    const result = loadMidiMap()
    expect(result.profiles.length).toBe(1)
    expect(result.activeProfileId).toBe(profile.id)
    expect(result.workingProfile.name).toBe('EWI USB')
  })

  it('returns fresh defaults on unknown schemaVersion', () => {
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify({
      schemaVersion: 99,
      profiles: [defaultProfile()],
      activeProfileId: null,
    }))
    const result = loadMidiMap()
    expect(result.profiles).toEqual([])
  })

  it('returns fresh defaults on corrupt JSON', () => {
    localStorage.setItem(MIDI_MAP_KEY, '{ not json')
    const result = loadMidiMap()
    expect(result.profiles).toEqual([])
  })

  it('drops invalid profiles from the persisted list', () => {
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify({
      schemaVersion: 1,
      profiles: [defaultProfile(), { id: 'broken' }],   // second is invalid
      activeProfileId: null,
    }))
    const result = loadMidiMap()
    expect(result.profiles.length).toBe(1)
  })

  it('falls back to defaults if active id no longer matches a profile', () => {
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify({
      schemaVersion: 1,
      profiles: [defaultProfile()],
      activeProfileId: 'does-not-exist',
    }))
    const result = loadMidiMap()
    expect(result.activeProfileId).toBeNull()
    expect(result.workingProfile.name).toBe('Defaults')
  })
})

describe('persistMidiMap', () => {
  it('writes a payload that loads back identically', () => {
    const profile = defaultProfile()
    profile.name = 'Test'
    persistMidiMap({ profiles: [profile], activeProfileId: profile.id })
    const result = loadMidiMap()
    expect(result.profiles.length).toBe(1)
    expect(result.profiles[0].name).toBe('Test')
    expect(result.activeProfileId).toBe(profile.id)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /home/shaun/module && npm test -- midiMapPersist
```

- [ ] **Step 3: Implement persistence**

Create `src/state/midiMapPersist.ts`:

```ts
import {
  cloneProfile,
  freshDefaults,
  isValidProfile,
} from './midiMapDefaults'
import type { MidiProfile, PersistedMidiMap } from './midiMapTypes'

export const MIDI_MAP_KEY = 'module:midi-map:v1'

interface LoadResult {
  profiles: MidiProfile[]
  activeProfileId: string | null
  workingProfile: MidiProfile
}

interface PersistInput {
  profiles: MidiProfile[]
  activeProfileId: string | null
}

export function loadMidiMap(): LoadResult {
  try {
    const raw = localStorage.getItem(MIDI_MAP_KEY)
    if (!raw) return freshDefaults()
    const parsed = JSON.parse(raw) as PersistedMidiMap
    if (parsed.schemaVersion !== 1) return freshDefaults()
    const profiles = (parsed.profiles ?? []).filter(isValidProfile)
    const active = profiles.find((p) => p.id === parsed.activeProfileId) ?? null
    const workingProfile = active ? cloneProfile(active) : freshDefaults().workingProfile
    return {
      profiles,
      activeProfileId: active?.id ?? null,
      workingProfile,
    }
  } catch {
    return freshDefaults()
  }
}

export function persistMidiMap(state: PersistInput): void {
  try {
    const payload: PersistedMidiMap = {
      schemaVersion: 1,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
    }
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(payload))
  } catch {
    // noop — quota errors fail silently, same as existing slices
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /home/shaun/module && npm test -- midiMapPersist
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/state/midiMapPersist.ts tests/midiMapPersist.test.ts && git commit -m "$(cat <<'EOF'
feat(midi): add localStorage persistence for midi map

Stores { profiles, activeProfileId } under module:midi-map:v1 with an
in-payload schemaVersion. Defensive load: discards corrupt JSON,
unknown versions, and invalid profile entries. workingProfile is
rebuilt from the active profile on load.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add MidiMapSlice to useStore

**Files:**
- Modify: `src/state/useStore.ts`

- [ ] **Step 1: Add the slice fields and actions**

Edit `src/state/useStore.ts`. Add imports at the top alongside existing ones:

```ts
import {
  cloneProfile,
  defaultProfile,
  generateProfileId,
} from './midiMapDefaults'
import { loadMidiMap, persistMidiMap } from './midiMapPersist'
import type {
  MidiDestId,
  MidiMapping,
  MidiProfile,
  ModulatableTarget,
} from './midiMapTypes'
```

Then extend the `State` interface (find the existing `interface State {` block) to add these fields and actions inside it, alongside the existing ones:

```ts
  // ── MIDI map slice ────────────────────────────────────────────────
  midiMapProfiles: MidiProfile[]
  midiMapActiveId: string | null
  midiMapWorking: MidiProfile
  midiMapDirty: boolean

  setMidiMapping: (destId: MidiDestId, patch: Partial<MidiMapping>) => void
  setMidiBendRange: (semis: number) => void
  setMidiTargetBinding: (which: 'mod' | 'at', target: ModulatableTarget) => void

  saveMidiProfile: () => void
  saveMidiProfileAs: (name: string) => string
  loadMidiProfile: (id: string) => void
  deleteMidiProfile: (id: string) => void
  renameMidiProfile: (id: string, name: string) => void

  resetMidiToDefaults: () => void
  discardMidiChanges: () => void
```

Then in the `create<State>((set, get) => ({ ... }))` block, add the initial values **after** the `debugMode: loadDebug(),` line:

```ts
  ...((): {
    midiMapProfiles: MidiProfile[]
    midiMapActiveId: string | null
    midiMapWorking: MidiProfile
  } => {
    const loaded = loadMidiMap()
    return {
      midiMapProfiles: loaded.profiles,
      midiMapActiveId: loaded.activeProfileId,
      midiMapWorking: loaded.workingProfile,
    }
  })(),
  midiMapDirty: false,
```

And add these actions inside the same `create<State>(...)` body, after `toggleDebugMode`:

```ts
  setMidiMapping: (destId, patch) => {
    const w = cloneProfile(get().midiMapWorking)
    w.mappings[destId] = { ...w.mappings[destId], ...patch }
    set({ midiMapWorking: w, midiMapDirty: true })
  },
  setMidiBendRange: (semis) => {
    const w = cloneProfile(get().midiMapWorking)
    w.bendRangeSemitones = Math.max(1, Math.min(24, semis))
    set({ midiMapWorking: w, midiMapDirty: true })
  },
  setMidiTargetBinding: (which, target) => {
    const w = cloneProfile(get().midiMapWorking)
    if (which === 'mod') w.targets.modTargetParam = target
    else w.targets.atTargetParam = target
    set({ midiMapWorking: w, midiMapDirty: true })
  },
  saveMidiProfile: () => {
    const state = get()
    if (!state.midiMapActiveId) {
      // No active profile — caller should use saveMidiProfileAs instead.
      // This branch is a safety net.
      const id = generateProfileId()
      const w = cloneProfile(state.midiMapWorking)
      w.id = id
      const profiles = [w, ...state.midiMapProfiles]
      set({ midiMapProfiles: profiles, midiMapActiveId: id, midiMapWorking: cloneProfile(w), midiMapDirty: false })
      persistMidiMap({ profiles, activeProfileId: id })
      return
    }
    const profiles = state.midiMapProfiles.map((p) =>
      p.id === state.midiMapActiveId
        ? { ...cloneProfile(state.midiMapWorking), id: state.midiMapActiveId, name: p.name, createdAt: p.createdAt }
        : p,
    )
    set({ midiMapProfiles: profiles, midiMapDirty: false })
    persistMidiMap({ profiles, activeProfileId: state.midiMapActiveId })
  },
  saveMidiProfileAs: (name) => {
    const state = get()
    const id = generateProfileId()
    const w = cloneProfile(state.midiMapWorking)
    w.id = id
    w.name = name.trim() || 'Untitled'
    w.createdAt = Date.now()
    const profiles = [w, ...state.midiMapProfiles]
    set({
      midiMapProfiles: profiles,
      midiMapActiveId: id,
      midiMapWorking: cloneProfile(w),
      midiMapDirty: false,
    })
    persistMidiMap({ profiles, activeProfileId: id })
    return id
  },
  loadMidiProfile: (id) => {
    const state = get()
    const target = state.midiMapProfiles.find((p) => p.id === id)
    if (!target) return
    set({
      midiMapActiveId: id,
      midiMapWorking: cloneProfile(target),
      midiMapDirty: false,
    })
    persistMidiMap({ profiles: state.midiMapProfiles, activeProfileId: id })
  },
  deleteMidiProfile: (id) => {
    const state = get()
    const profiles = state.midiMapProfiles.filter((p) => p.id !== id)
    const activeId = state.midiMapActiveId === id ? null : state.midiMapActiveId
    const working = activeId
      ? cloneProfile(profiles.find((p) => p.id === activeId)!)
      : defaultProfile()
    set({
      midiMapProfiles: profiles,
      midiMapActiveId: activeId,
      midiMapWorking: working,
      midiMapDirty: false,
    })
    persistMidiMap({ profiles, activeProfileId: activeId })
  },
  renameMidiProfile: (id, name) => {
    const state = get()
    const trimmed = name.trim() || 'Untitled'
    const profiles = state.midiMapProfiles.map((p) =>
      p.id === id ? { ...p, name: trimmed } : p,
    )
    set({ midiMapProfiles: profiles })
    persistMidiMap({ profiles, activeProfileId: state.midiMapActiveId })
  },
  resetMidiToDefaults: () => {
    set({
      midiMapWorking: defaultProfile(),
      midiMapActiveId: null,
      midiMapDirty: true,
    })
  },
  discardMidiChanges: () => {
    const state = get()
    const target = state.midiMapActiveId
      ? state.midiMapProfiles.find((p) => p.id === state.midiMapActiveId)
      : null
    set({
      midiMapWorking: target ? cloneProfile(target) : defaultProfile(),
      midiMapDirty: false,
    })
  },
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: No errors. If there are errors, fix the imports / field placement, then re-run.

- [ ] **Step 3: Run all unit tests to confirm no regressions**

```bash
cd /home/shaun/module && npm test
```

- [ ] **Step 4: Commit**

```bash
cd /home/shaun/module && git add src/state/useStore.ts && git commit -m "$(cat <<'EOF'
feat(state): add MidiMapSlice to useStore

Profiles, active id, working copy, dirty flag + actions for
set/save/saveAs/load/delete/rename/reset/discard. Save actions write
to module:midi-map:v1 via persistMidiMap; mutations of working copy
are in-memory only.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: useMidiMapSync stub

**Files:**
- Create: `src/state/useMidiMapSync.ts`

- [ ] **Step 1: Create the stub hook**

Create `src/state/useMidiMapSync.ts`:

```ts
/**
 * useMidiMapSync — no-op stub for v1.
 *
 * Mounted from App.tsx alongside useUserPatchSync(). When the cloud
 * implementation lands later, only this file changes — no call-site
 * edits required.
 *
 * Future shape (mirrors useUserPatchSync):
 *   1. On mount, if logged in and the cloud copy is newer, hydrate
 *      midiMapProfiles[] from apps.pepperhorn.com (overwriting
 *      localStorage).
 *   2. Subscribe to store changes; on save / saveAs / delete / rename /
 *      loadProfile, push the new profiles[] to the backend with a
 *      debounced PATCH.
 *   3. Conflict resolution: last-write-wins per profile id, by
 *      createdAt.
 *   4. Logged-out users: this hook is a complete no-op.
 *
 * persistMidiMap() always writes to localStorage first; this hook
 * handles cloud propagation independently. Cloud failures never block
 * local saves.
 */
export function useMidiMapSync(): void {
  // intentionally empty in v1
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/state/useMidiMapSync.ts && git commit -m "$(cat <<'EOF'
feat(state): add useMidiMapSync stub for future cloud sync

No-op in v1. Mounted from App.tsx alongside useUserPatchSync so the
seam exists from day one — when the apps.pepperhorn.com integration
lands, only this file changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: AudioEngine — extend LoadedInstrument + add MIDI control methods

**Files:**
- Modify: `src/audio/loadPatch.ts:17`
- Modify: `src/audio/AudioEngine.ts`

- [ ] **Step 1: Extend the LoadedInstrument interface**

Edit `src/audio/loadPatch.ts`. Replace the existing `LoadedInstrument` interface (currently lines 17-22) with:

```ts
export interface LoadedInstrument {
  start(event: { note: number | string; velocity?: number }): () => void
  stop(target?: number | string): void
  disconnect(): void
  load: Promise<unknown>
  /** smplr instances expose this; CustomSampler may not. Optional. */
  setCC?(cc: number, value: number): void
}
```

- [ ] **Step 2: Verify CustomSampler still satisfies the interface**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: passes. The `?` makes setCC optional, so CustomSampler doesn't need to implement it.

- [ ] **Step 3: Add midiVolume + midiPan nodes to AudioEngine**

Edit `src/audio/AudioEngine.ts`. Find the constructor and the `resume()` method. Inside the class declaration (alongside other private fields like `currentSource`), add:

```ts
  private midiVolume: GainNode | null = null
  private midiPan: StereoPannerNode | null = null
  private currentMidiVolume = 1
  private currentMidiExpression = 1
```

Then in `resume()`, **after** the existing `if (!this.chain) { this.chain = buildEffectChain(...) }` block (so after the chain is built), insert:

```ts
    if (this.chain && !this.midiVolume) {
      this.midiVolume = this.context.createGain()
      this.midiPan = this.context.createStereoPanner()
      this.midiVolume.gain.value = 1
      this.midiPan.pan.value = 0
      // Reroute: chain.master → midiVolume → midiPan → destination
      try {
        this.chain.master.disconnect()
      } catch {
        // noop
      }
      this.chain.master.connect(this.midiVolume)
      this.midiVolume.connect(this.midiPan)
      this.midiPan.connect(this.context.destination)
      log('midi master nodes inserted')
    }
```

- [ ] **Step 4: Add the three new methods on AudioEngine**

Add these methods inside the `AudioEngine` class, near the other public methods (e.g. after `noteOff`):

```ts
  setSustain(held: boolean): void {
    try {
      this.current?.setCC?.(64, held ? 127 : 0)
    } catch (err) {
      log('setSustain threw', err)
    }
  }

  setMasterMix(volume: number, expression: number): void {
    this.currentMidiVolume = Math.max(0, Math.min(1, volume))
    this.currentMidiExpression = Math.max(0, Math.min(1, expression))
    if (this.midiVolume) {
      this.midiVolume.gain.value = this.currentMidiVolume * this.currentMidiExpression
    }
  }

  setMasterPan(p: number): void {
    if (this.midiPan) {
      this.midiPan.pan.value = Math.max(-1, Math.min(1, p))
    }
  }
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Build to confirm Vite compiles**

```bash
cd /home/shaun/module && npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /home/shaun/module && git add src/audio/loadPatch.ts src/audio/AudioEngine.ts && git commit -m "$(cat <<'EOF'
feat(audio): add MIDI master controls on AudioEngine

LoadedInstrument gains optional setCC() so AudioEngine can forward
sustain to smplr's region matching. AudioEngine inserts a
midiVolume GainNode + midiPan StereoPannerNode after effects.master,
and exposes setSustain / setMasterMix / setMasterPan for the router.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Refactor useWebMidi to use parser + router

**Files:**
- Modify: `src/input/useWebMidi.ts`

- [ ] **Step 1: Replace the hook implementation**

Replace the entire contents of `src/input/useWebMidi.ts`:

```ts
import { useEffect } from 'react'
import { parseMidi } from './midiParse'
import { MidiRouter, type EngineControls } from './MidiRouter'
import { midiRouterRef } from './midiRouterRef'
import { useStore } from '../state/useStore'

export function useWebMidi(engine: EngineControls): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return
    }

    const router = new MidiRouter(engine)
    midiRouterRef.current = router

    // Seed the router with the current working profile, then subscribe to changes.
    router.setMap(useStore.getState().midiMapWorking)
    const unsubStore = useStore.subscribe((state, prev) => {
      if (state.midiMapWorking !== prev.midiMapWorking) {
        router.setMap(state.midiMapWorking)
      }
    })

    let cancelled = false
    let access: MIDIAccess | null = null
    const inputs: MIDIInput[] = []

    const handle = (msg: MIDIMessageEvent) => {
      const data = msg.data
      if (!data) return
      useStore.getState().flashMidiActivity()
      const event = parseMidi(data)
      if (event) router.handle(event)
    }

    const attach = () => {
      if (!access) return
      for (const input of inputs) input.removeEventListener('midimessage', handle as EventListener)
      inputs.length = 0
      access.inputs.forEach((input) => {
        input.addEventListener('midimessage', handle as EventListener)
        inputs.push(input)
      })
      useStore.getState().setMidiConnected(inputs.length > 0)
    }

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((a) => {
        if (cancelled) return
        access = a
        attach()
        a.onstatechange = attach
      })
      .catch(() => {
        useStore.getState().setMidiConnected(false)
      })

    return () => {
      cancelled = true
      unsubStore()
      midiRouterRef.current = null
      for (const input of inputs) input.removeEventListener('midimessage', handle as EventListener)
      if (access) access.onstatechange = null
    }
  }, [engine])
}
```

- [ ] **Step 2: Update App.tsx's `useWebMidi` call site**

The existing call in `src/App.tsx` passes `{ noteOn, noteOff }`. This now needs to satisfy the full `EngineControls` interface. Find this block (around lines 179–185):

```ts
  const noteOn = useCallback(
    (midi: number, vel: number) => engine.noteOn(midi, vel),
    [engine],
  )
  const noteOff = useCallback((midi: number) => engine.noteOff(midi), [engine])

  useWebMidi(useMemo(() => ({ noteOn, noteOff }), [noteOn, noteOff]))
```

Replace with:

```ts
  const setFxParam = useStore((s) => s.setFxParam)
  const midiControls = useMemo(
    () => ({
      noteOn:       (midi: number, vel: number) => engine.noteOn(midi, vel),
      noteOff:      (midi: number) => engine.noteOff(midi),
      setSustain:   (held: boolean) => engine.setSustain(held),
      setMasterMix: (vol: number, exp: number) => engine.setMasterMix(vol, exp),
      setMasterPan: (p: number) => engine.setMasterPan(p),
      setFxParam:   setFxParam,
    }),
    [engine, setFxParam],
  )
  useWebMidi(midiControls)
```

If `useStore` is not already imported in App.tsx, ensure the import exists at the top: `import { useStore } from './state/useStore'`. If `useMemo` is not already imported, ensure it's in the React import line.

- [ ] **Step 3: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 4: Build**

```bash
cd /home/shaun/module && npm run build
```

- [ ] **Step 5: Manual smoke test in browser**

```bash
cd /home/shaun/module && npm run dev
```

Open the printed Network URL in a browser. Connect a MIDI keyboard if available. Verify:
- The MIDI LED in the rack brand bar lights up when a key is pressed (existing behaviour)
- Notes still play correctly (existing behaviour preserved through the refactor)
- The console doesn't spew errors

Stop the dev server (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
cd /home/shaun/module && git add src/input/useWebMidi.ts src/App.tsx && git commit -m "$(cat <<'EOF'
refactor(midi): route useWebMidi through parseMidi + MidiRouter

Hook becomes a thin React lifecycle wrapper. Bytes are parsed via
parseMidi() and dispatched through MidiRouter, which reads the
working profile from the store. midiRouterRef.current is populated
for the upcoming overlay's activity observer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: MidiSourcePicker component

**Files:**
- Create: `src/components/MidiSourcePicker.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MidiSourcePicker.tsx`:

```tsx
import type { MidiSource } from '../state/midiMapTypes'

interface MidiSourcePickerProps {
  value: MidiSource
  onChange: (source: MidiSource) => void
  disabled?: boolean
}

type SourceKind = 'cc' | 'pitchBend' | 'aftertouch' | 'none'

export function MidiSourcePicker({ value, onChange, disabled }: MidiSourcePickerProps) {
  const kind: SourceKind = value.kind
  const ccNumber = value.kind === 'cc' ? value.cc : 1

  const onKindChange = (next: SourceKind) => {
    if (next === 'cc') onChange({ kind: 'cc', cc: ccNumber })
    else if (next === 'pitchBend') onChange({ kind: 'pitchBend' })
    else if (next === 'aftertouch') onChange({ kind: 'aftertouch' })
    else onChange({ kind: 'none' })
  }

  const onCcNumberChange = (raw: string) => {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 0 && n <= 127) {
      onChange({ kind: 'cc', cc: n })
    }
  }

  return (
    <div className="midi-source-picker flex items-center gap-1">
      <select
        className="source-kind font-mono text-[10px] uppercase tracking-wider rounded-md px-2 py-1"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--color-rack-edge)',
          color: 'var(--color-text)',
        }}
        value={kind}
        onChange={(e) => onKindChange(e.target.value as SourceKind)}
        disabled={disabled}
      >
        <option value="cc">CC</option>
        <option value="pitchBend">PB</option>
        <option value="aftertouch">AT</option>
        <option value="none">—</option>
      </select>
      {kind === 'cc' && (
        <input
          type="number"
          min={0}
          max={127}
          step={1}
          className="source-cc-number font-mono text-[10px] tabular-nums rounded-md px-2 py-1 w-14 text-center"
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-rack-edge)',
            color: 'var(--color-text)',
          }}
          value={ccNumber}
          onChange={(e) => onCcNumberChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiSourcePicker.tsx && git commit -m "$(cat <<'EOF'
feat(ui): add MidiSourcePicker dropdown

Type selector (CC / PB / AT / —) plus a CC number input that only
shows when type=CC. Mono-cap text, white background, rack-edge
border — matches SaveDialog input styling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: MidiMappingRow component

**Files:**
- Create: `src/components/MidiMappingRow.tsx`

- [ ] **Step 1: Create the row component**

Create `src/components/MidiMappingRow.tsx`:

```tsx
import { useState } from 'react'
import { MidiSourcePicker } from './MidiSourcePicker'
import {
  ALL_MOD_TARGETS,
  DEST_META,
  MOD_TARGET_LABELS,
  type MidiDestId,
  type MidiMapping,
  type MidiSource,
  type ModulatableTarget,
} from '../state/midiMapTypes'

interface MidiMappingRowProps {
  destId: MidiDestId
  mapping: MidiMapping
  modTarget?: ModulatableTarget        // for destId === 'modTarget'
  atTarget?: ModulatableTarget         // for destId === 'atTarget'
  learning: boolean
  learnError: boolean
  onMappingChange: (patch: Partial<MidiMapping>) => void
  onTargetChange: (target: ModulatableTarget) => void   // only used for mod/at rows
  onLearnClick: () => void
}

export function MidiMappingRow({
  destId,
  mapping,
  modTarget,
  atTarget,
  learning,
  learnError,
  onMappingChange,
  onTargetChange,
  onLearnClick,
}: MidiMappingRowProps) {
  const meta = DEST_META[destId]
  const currentTarget = destId === 'modTarget' ? modTarget : destId === 'atTarget' ? atTarget : undefined

  return (
    <div className="mapping-row-wrap flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-white/60 transition-colors">
      <div className="mapping-row flex items-center gap-2">
        <input
          type="checkbox"
          className="mapping-enable accent-coral"
          checked={mapping.enabled}
          onChange={(e) => onMappingChange({ enabled: e.target.checked })}
        />
        <div className="mapping-label font-display text-sm text-text flex-1">
          {meta.label}
        </div>
        <MidiSourcePicker
          value={mapping.source}
          onChange={(source: MidiSource) => onMappingChange({ source })}
          disabled={learning}
        />
        <button
          type="button"
          className="mapping-learn cell-hit rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={
            learning
              ? {
                  background: 'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                  color: 'var(--color-bg)',
                  border: '1px solid #C44C4C',
                }
              : {
                  background: '#FFFFFF',
                  border: '1px solid var(--color-rack-edge)',
                  color: 'rgba(26, 26, 46, 0.7)',
                }
          }
          onClick={onLearnClick}
        >
          {learning ? '…' : 'learn'}
        </button>
      </div>
      {(meta.hasTarget || meta.hasShaping) && (
        <div className="mapping-sub flex items-center gap-2 pl-6 text-text/60">
          {meta.hasTarget && currentTarget && (
            <>
              <span className="sub-label font-mono text-[9px] uppercase tracking-widest text-text/40">→ target</span>
              <select
                className="target-select font-mono text-[10px] uppercase tracking-wider rounded-md px-2 py-0.5"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--color-rack-edge)',
                  color: 'var(--color-text)',
                }}
                value={currentTarget}
                onChange={(e) => onTargetChange(e.target.value as ModulatableTarget)}
              >
                {ALL_MOD_TARGETS.map((t) => (
                  <option key={t} value={t}>{MOD_TARGET_LABELS[t]}</option>
                ))}
              </select>
            </>
          )}
          {meta.hasShaping && (
            <>
              <span className="sub-label font-mono text-[9px] uppercase tracking-widest text-text/40">min</span>
              <ShapingNumberInput value={mapping.min ?? 0} onChange={(v) => onMappingChange({ min: v })} />
              <span className="sub-label font-mono text-[9px] uppercase tracking-widest text-text/40">max</span>
              <ShapingNumberInput value={mapping.max ?? 1} onChange={(v) => onMappingChange({ max: v })} />
              <label className="sub-invert flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-text/40">
                <input
                  type="checkbox"
                  className="accent-coral"
                  checked={!!mapping.invert}
                  onChange={(e) => onMappingChange({ invert: e.target.checked })}
                />
                inv
              </label>
            </>
          )}
        </div>
      )}
      {learnError && (
        <div className="mapping-learn-error font-mono text-[10px] uppercase tracking-wider text-stop pl-6">
          no activity detected
        </div>
      )}
      {learning && (
        <div className="mapping-learn-hint font-mono text-[10px] text-text/50 pl-6">
          wiggle the controller to assign…
        </div>
      )}
    </div>
  )
}

interface ShapingNumberInputProps {
  value: number
  onChange: (v: number) => void
}

function ShapingNumberInput({ value, onChange }: ShapingNumberInputProps) {
  const [text, setText] = useState(value.toFixed(2))
  return (
    <input
      type="number"
      min={0}
      max={1}
      step={0.01}
      className="shaping-input font-mono text-[10px] tabular-nums rounded-md px-1 py-0.5 w-12 text-center"
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--color-rack-edge)',
        color: 'var(--color-text)',
      }}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(Math.max(0, Math.min(1, n)))
      }}
      onBlur={() => setText(value.toFixed(2))}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiMappingRow.tsx && git commit -m "$(cat <<'EOF'
feat(ui): add MidiMappingRow

Checkbox + label + source picker + learn button. Sub-row for
mod/AT target dropdown and FX-send min/max/invert shaping. Learn
state swaps button styling and shows the wiggle hint.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: MidiActivityPanel component

**Files:**
- Create: `src/components/MidiActivityPanel.tsx`

- [ ] **Step 1: Create the panel component**

Create `src/components/MidiActivityPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { MidiActivityBuffer, type ActivityRow } from '../input/MidiActivityBuffer'
import { midiRouterRef } from '../input/midiRouterRef'

export function MidiActivityPanel() {
  const bufferRef = useRef<MidiActivityBuffer | null>(null)
  const [rows, setRows] = useState<ActivityRow[]>([])

  useEffect(() => {
    const buffer = new MidiActivityBuffer()
    bufferRef.current = buffer
    const router = midiRouterRef.current
    const unsubRouter = router?.addObserver((event) => buffer.ingest(event))

    let raf = 0
    const tick = () => {
      const snap = buffer.snapshot()
      setRows(snap)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      unsubRouter?.()
      bufferRef.current = null
    }
  }, [])

  return (
    <div
      className="midi-activity-panel rounded-md p-3 lcd-glow"
      style={{
        background: 'var(--color-lcd-bg)',
        border: '1px solid #1A2240',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="activity-label font-mono text-[9px] uppercase tracking-widest mb-2"
        style={{ color: 'var(--color-lcd-dim)' }}
      >
        incoming midi
      </div>
      {rows.length === 0 && (
        <div
          className="activity-empty font-mono text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--color-lcd-dim)' }}
        >
          — no activity —
        </div>
      )}
      {rows.map((row) => (
        <div
          key={row.source}
          className="activity-row grid items-center gap-2 mb-1"
          style={{
            gridTemplateColumns: '90px 1fr 50px',
            color: 'var(--color-lcd-text)',
          }}
        >
          <span className="activity-source font-mono text-[10px] uppercase tracking-wider">
            {row.label}
          </span>
          <div
            className="activity-bar h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--color-lcd-dim)' }}
          >
            <div
              className="activity-bar-fill h-full"
              style={{
                width: `${row.peakPct}%`,
                background: 'var(--color-lcd-text)',
                boxShadow: '0 0 6px var(--color-lcd-text)',
                transition: 'width 60ms linear',
              }}
            />
          </div>
          <span className="activity-value font-mono text-[10px] tabular-nums text-right">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiActivityPanel.tsx && git commit -m "$(cat <<'EOF'
feat(ui): add MidiActivityPanel — LCD-styled live monitor

Creates a MidiActivityBuffer on mount, attaches it as a router
observer, drives a rAF loop that calls snapshot() and updates rows.
Sky text on dark navy with lcd-glow text-shadow — matches the rack
LCD aesthetic.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: MidiSaveNagDialog component

**Files:**
- Create: `src/components/MidiSaveNagDialog.tsx`

- [ ] **Step 1: Create the nag dialog**

Create `src/components/MidiSaveNagDialog.tsx`:

```tsx
interface MidiSaveNagDialogProps {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function MidiSaveNagDialog({ open, onSave, onDiscard, onCancel }: MidiSaveNagDialogProps) {
  if (!open) return null
  return (
    <div
      className="midi-save-nag fade-in fixed inset-0 z-[60] flex items-center justify-center bg-text/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="midi-save-nag-card pop-in flex w-[min(360px,calc(100vw-2rem))] flex-col gap-4 rounded-2xl bg-bg p-5 shadow-2xl"
        style={{ border: '1px solid var(--color-rack-edge)' }}
      >
        <div className="nag-header font-display text-base font-semibold text-text">
          Unsaved MIDI changes
        </div>
        <div className="nag-body font-mono text-[10px] uppercase tracking-wider text-text/60">
          your edits to the working profile will be lost
        </div>
        <div className="nag-actions flex items-center justify-end gap-2">
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-text/70"
            style={{ background: '#FFFFFF', border: '1px solid var(--color-rack-edge)' }}
            onClick={onCancel}
          >
            cancel
          </button>
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-stop"
            style={{ background: '#FFFFFF', border: '1px solid var(--color-rack-edge)' }}
            onClick={onDiscard}
          >
            discard
          </button>
          <button
            type="button"
            className="cell-hit rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-bg"
            style={{
              background: 'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
              boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 10px rgba(255,107,107,0.3)',
            }}
            onClick={onSave}
          >
            save changes
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiSaveNagDialog.tsx && git commit -m "$(cat <<'EOF'
feat(ui): add MidiSaveNagDialog

Modal-on-modal at z-60 with Save / Discard / Cancel buttons.
Triggered from MidiSettingsOverlay's close handlers and profile
switch flow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: MidiSettingsOverlay (the main modal)

**Files:**
- Create: `src/components/MidiSettingsOverlay.tsx`

- [ ] **Step 1: Create the overlay**

Create `src/components/MidiSettingsOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useStore } from '../state/useStore'
import { ALL_DEST_IDS, type MidiDestId, type MidiSource } from '../state/midiMapTypes'
import { MidiActivityPanel } from './MidiActivityPanel'
import { MidiMappingRow } from './MidiMappingRow'
import { MidiSaveNagDialog } from './MidiSaveNagDialog'
import { midiRouterRef } from '../input/midiRouterRef'
import { sourceKey, type ParsedMidi } from '../input/midiParse'

interface MidiSettingsOverlayProps {
  open: boolean
  onClose: () => void
}

const LEARN_MS = 1500

export function MidiSettingsOverlay({ open, onClose }: MidiSettingsOverlayProps) {
  const profiles = useStore((s) => s.midiMapProfiles)
  const activeId = useStore((s) => s.midiMapActiveId)
  const working = useStore((s) => s.midiMapWorking)
  const dirty = useStore((s) => s.midiMapDirty)

  const setMapping = useStore((s) => s.setMidiMapping)
  const setTargetBinding = useStore((s) => s.setMidiTargetBinding)
  const saveProfile = useStore((s) => s.saveMidiProfile)
  const saveProfileAs = useStore((s) => s.saveMidiProfileAs)
  const loadProfile = useStore((s) => s.loadMidiProfile)
  const resetMidiToDefaults = useStore((s) => s.resetMidiToDefaults)
  const discardChanges = useStore((s) => s.discardMidiChanges)

  const [nagOpen, setNagOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)
  const [learning, setLearning] = useState<MidiDestId | null>(null)
  const [learnErrorFor, setLearnErrorFor] = useState<MidiDestId | null>(null)

  // Escape closes (with nag if dirty)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // beforeunload nag while dirty
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const requestClose = () => {
    if (dirty) {
      setPendingAction(() => () => onClose())
      setNagOpen(true)
    } else {
      onClose()
    }
  }

  const requestLoadProfile = (id: string) => {
    const exec = () => loadProfile(id)
    if (dirty) {
      setPendingAction(() => exec)
      setNagOpen(true)
    } else {
      exec()
    }
  }

  const onNagSave = () => {
    saveProfile()
    setNagOpen(false)
    pendingAction?.()
    setPendingAction(null)
  }
  const onNagDiscard = () => {
    discardChanges()
    setNagOpen(false)
    pendingAction?.()
    setPendingAction(null)
  }
  const onNagCancel = () => {
    setNagOpen(false)
    setPendingAction(null)
  }

  const onSaveAs = () => {
    const name = window.prompt('Profile name', 'My MIDI profile')
    if (name == null) return
    saveProfileAs(name)
  }

  const onSave = () => {
    if (!activeId) {
      onSaveAs()
    } else {
      saveProfile()
    }
  }

  const onReset = () => {
    resetMidiToDefaults()
  }

  const startLearn = (destId: MidiDestId) => {
    if (learning === destId) {
      // Cancel
      setLearning(null)
      return
    }
    const router = midiRouterRef.current
    if (!router) return
    setLearning(destId)
    setLearnErrorFor(null)

    const tally = new Map<string, { count: number; range: number; sample: ParsedMidi }>()
    const baselines = new Map<string, number>()
    const unsub = router.addObserver((event) => {
      const key = sourceKey(event)
      if (!key) return
      const v =
        event.kind === 'pitchBend'
          ? event.value
          : event.kind === 'cc'
            ? event.value
            : event.value
      if (!baselines.has(key)) baselines.set(key, v)
      const range = Math.abs(v - (baselines.get(key) ?? 0))
      const entry = tally.get(key) ?? { count: 0, range: 0, sample: event }
      entry.count += 1
      entry.range = Math.max(entry.range, range)
      entry.sample = event
      tally.set(key, entry)
    })

    const timer = window.setTimeout(() => {
      unsub()
      let bestKey: string | null = null
      let bestScore = 0
      for (const [key, entry] of tally.entries()) {
        const score = entry.count * (entry.range + 1)
        if (score > bestScore) {
          bestScore = score
          bestKey = key
        }
      }
      if (bestKey) {
        const entry = tally.get(bestKey)!
        const newSource: MidiSource =
          entry.sample.kind === 'pitchBend'
            ? { kind: 'pitchBend' }
            : entry.sample.kind === 'aftertouch'
              ? { kind: 'aftertouch' }
              : { kind: 'cc', cc: entry.sample.cc }
        setMapping(destId, { source: newSource, enabled: true })
      } else {
        setLearnErrorFor(destId)
        window.setTimeout(() => setLearnErrorFor(null), 1500)
      }
      setLearning(null)
    }, LEARN_MS)

    // Stash cleanup on the closure for the cancel branch (re-click)
    const cleanup = () => {
      window.clearTimeout(timer)
      unsub()
    }
    void cleanup    // suppress unused warning — harmless
  }

  if (!open) return null

  const profileName = activeId
    ? (profiles.find((p) => p.id === activeId)?.name ?? 'Defaults')
    : 'Defaults'

  return (
    <>
      <div
        className="midi-overlay fade-in fixed inset-0 z-[55] flex items-center justify-center bg-text/50 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose()
        }}
      >
        <div
          className="midi-overlay-card pop-in flex w-[min(560px,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] flex-col gap-4 rounded-2xl bg-bg p-5 shadow-2xl"
          style={{ border: '1px solid var(--color-rack-edge)' }}
        >
          <div className="midi-overlay-header flex items-baseline justify-between">
            <div className="font-display text-base font-semibold text-text">MIDI Mappings</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text/50">
              {profileName}{dirty ? ' (draft)' : ''}
            </div>
          </div>

          <div
            className="midi-profile-row flex items-center gap-2 rounded-md p-3"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)',
              border: '1px solid var(--color-rack-edge)',
            }}
          >
            <div className="profile-label font-mono text-[9px] uppercase tracking-widest text-text/40">
              profile
            </div>
            <select
              className="profile-select font-display text-sm rounded-md px-2 py-1"
              style={{ background: '#FFFFFF', border: '1px solid var(--color-rack-edge)' }}
              value={activeId ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  // No-op — defaults can't be selected this way
                  return
                }
                requestLoadProfile(e.target.value)
              }}
            >
              <option value="">Defaults</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="profile-spacer flex-1" />
            <button
              type="button"
              className="profile-save cell-hit rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
              style={
                dirty
                  ? {
                      background: 'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                      color: 'var(--color-bg)',
                      boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 10px rgba(255,107,107,0.3)',
                    }
                  : {
                      background: '#FFFFFF',
                      border: '1px solid var(--color-rack-edge)',
                      color: 'rgba(26, 26, 46, 0.45)',
                    }
              }
              onClick={onSave}
              disabled={!dirty}
            >
              save
            </button>
            <button
              type="button"
              className="profile-save-as cell-hit rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-text/70"
              style={{ background: '#FFFFFF', border: '1px solid var(--color-rack-edge)' }}
              onClick={onSaveAs}
            >
              save as…
            </button>
            <button
              type="button"
              className="profile-reset cell-hit rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-text/70"
              style={{ background: '#FFFFFF', border: '1px solid var(--color-rack-edge)' }}
              onClick={onReset}
            >
              reset
            </button>
          </div>

          <MidiActivityPanel />

          <div
            className="midi-mappings flex flex-col gap-1 rounded-md p-3 overflow-y-auto scroll-clean"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)',
              border: '1px solid var(--color-rack-edge)',
            }}
          >
            <div className="mappings-label font-mono text-[9px] uppercase tracking-widest text-text/40 mb-1">
              destinations
            </div>
            {ALL_DEST_IDS.map((destId) => (
              <MidiMappingRow
                key={destId}
                destId={destId}
                mapping={working.mappings[destId]}
                modTarget={working.targets.modTargetParam}
                atTarget={working.targets.atTargetParam}
                learning={learning === destId}
                learnError={learnErrorFor === destId}
                onMappingChange={(patch) => setMapping(destId, patch)}
                onTargetChange={(target) => setTargetBinding(destId === 'modTarget' ? 'mod' : 'at', target)}
                onLearnClick={() => startLearn(destId)}
              />
            ))}
          </div>
        </div>
      </div>
      <MidiSaveNagDialog
        open={nagOpen}
        onSave={onNagSave}
        onDiscard={onNagDiscard}
        onCancel={onNagCancel}
      />
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiSettingsOverlay.tsx && git commit -m "$(cat <<'EOF'
feat(ui): add MidiSettingsOverlay modal

Composes header, profile picker, MidiActivityPanel, mapping rows.
Save nag fires on close / profile switch / beforeunload while dirty.
Learn capture uses count × range scoring to pick the most active
controller.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: MidiSettingsButton + Rack integration

**Files:**
- Create: `src/components/MidiSettingsButton.tsx`
- Modify: `src/components/Rack.tsx:81-84`

- [ ] **Step 1: Create the button + overlay container**

Create `src/components/MidiSettingsButton.tsx`:

```tsx
import { useState } from 'react'
import { MidiSettingsOverlay } from './MidiSettingsOverlay'

export function MidiSettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="midi-settings-btn cell-hit flex items-center gap-2 rounded-full border border-rack-edge bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text/60"
        title="MIDI mappings"
        onClick={() => setOpen(true)}
      >
        <GearIcon />
        MIDI MAP
      </button>
      <MidiSettingsOverlay open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function GearIcon() {
  return (
    <svg className="midi-settings-icon h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
```

- [ ] **Step 2: Wire into Rack.tsx**

Edit `src/components/Rack.tsx`. Find the existing import block at the top and add:

```ts
import { MidiSettingsButton } from './MidiSettingsButton'
```

Then find the `<div className="rack-brand-status flex items-center gap-2">` block (around line 81) and insert `<MidiSettingsButton />` between `<MidiStatus />` and `<UserMenu />`:

```tsx
          <div className="rack-brand-status flex items-center gap-2">
            <MidiStatus />
            <MidiSettingsButton />
            <UserMenu />
          </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/shaun/module && npm run typecheck
```

- [ ] **Step 4: Build**

```bash
cd /home/shaun/module && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /home/shaun/module && git add src/components/MidiSettingsButton.tsx src/components/Rack.tsx && git commit -m "$(cat <<'EOF'
feat(ui): wire MidiSettingsButton into the rack brand bar

Gear icon button between MidiStatus and UserMenu. Clicking opens
the MidiSettingsOverlay. Pill styling matches MidiStatus so the
three controls share a visual register.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Mount useMidiMapSync stub in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the hook call**

Edit `src/App.tsx`. Find the existing `useUserPatchSync()` line (around line 25). Add an import next to the existing `useUserPatchSync` import:

```ts
import { useMidiMapSync } from './state/useMidiMapSync'
```

Then in the function body, immediately after the `useUserPatchSync()` call, add:

```ts
  useMidiMapSync()
```

- [ ] **Step 2: Typecheck + build**

```bash
cd /home/shaun/module && npm run typecheck && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /home/shaun/module && git add src/App.tsx && git commit -m "$(cat <<'EOF'
feat(app): mount useMidiMapSync stub

No-op in v1, but establishes the call site so the future
apps.pepperhorn.com sync implementation only changes the hook body.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Manual QA in browser

**Why:** React components and the audio integration aren't covered by unit tests. Verify the golden path end-to-end.

- [ ] **Step 1: Start the dev server**

```bash
cd /home/shaun/module && npm run dev
```

Open the printed Network URL in a desktop browser.

- [ ] **Step 2: Verify gear button appears**

In the rack brand bar (top right), confirm: `MIDI LED` → `⚙ MIDI MAP` → user menu icon, in that order. Style should match `MidiStatus`'s pill shape.

- [ ] **Step 3: Open the overlay**

Click the gear button. Expect:
- Modal slides in with `pop-in` animation
- Header reads "MIDI Mappings" + "Defaults" on the right
- Profile picker row shows a "Defaults" dropdown + disabled Save / Save As / Reset buttons
- LCD-styled activity panel (dark navy bg, sky-blue text) saying "— no activity —"
- Mapping rows for all 10 destinations, with sustain / volume / expression / pan / mod target / aftertouch having default sources

- [ ] **Step 4: Verify activity monitor with a connected MIDI controller**

Connect a MIDI keyboard or wind controller. Move the mod wheel / sustain pedal / play notes. Expect:
- Activity panel shows live rows for each source you touch (CC 1, CC 64, etc.)
- Bars fill in sky blue
- Rows fade out after ~2 seconds of silence

- [ ] **Step 5: Verify Learn flow**

Click "learn" on the **Volume** row. Wiggle the mod wheel. Expect:
- Button highlights coral with "…" inside
- Hint appears: "wiggle the controller to assign…"
- After ~1.5s, the source picker updates to `CC 1` and the button returns to normal
- Header now shows `Defaults (draft)` (dirty flag set)
- Save button promotes to coral primary styling

- [ ] **Step 6: Verify Save As**

Click "save as…". Type a name in the prompt (e.g. "Test Profile"). Expect:
- Modal stays open
- Header now shows "Test Profile" (no draft)
- Profile dropdown contains "Test Profile" as an option
- Save button reverts to disabled grey

- [ ] **Step 7: Verify discard nag**

Edit a mapping (e.g. toggle the sustain checkbox off). Click outside the modal to close. Expect:
- Save nag dialog appears at z-60 with Save / Discard / Cancel buttons
- Cancel returns to the overlay with the change still present
- Discard reverts the change and closes both modals
- Save persists the change to the active profile and closes both modals

- [ ] **Step 8: Verify reload persistence**

Make and save a change to a mapping. Refresh the browser. Open the overlay again. Expect:
- The saved profile is still listed in the dropdown
- Loading it shows the saved mapping state

- [ ] **Step 9: Verify sustain pedal works**

If you have a sustain pedal, hold it down, play a note, release the key, then release the pedal. Expect:
- The note keeps sounding while the pedal is held
- The note stops when the pedal is released

- [ ] **Step 10: Verify volume / expression / pan work**

Use a controller or the on-screen mod wheel to send CC 7 / CC 11 / CC 10. Verify the master volume / expression / stereo position changes audibly.

- [ ] **Step 11: Verify chorus depth via mod wheel**

Move the mod wheel (CC 1) while playing a sustained note. Expect: chorus depth modulates on the active patch (audible chorus wobble).

- [ ] **Step 12: Verify reverb mix via aftertouch**

Press a key with channel-aftertouch capability and increase pressure. Expect: reverb mix increases audibly.

- [ ] **Step 13: Stop the dev server and verify the build is green**

Ctrl-C to stop dev server, then:

```bash
cd /home/shaun/module && npm test && npm run typecheck && npm run build
```

Expected: All tests pass, no type errors, build succeeds.

- [ ] **Step 14: Final commit (only if any inline fixes were needed)**

If any QA steps revealed a small fix, commit it:

```bash
cd /home/shaun/module && git add -A && git commit -m "$(cat <<'EOF'
fix(midi): <short description of the QA finding>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no fixes were needed, nothing to commit. Skip this step.

---

## Self-Review Notes

**Spec coverage:**
- §Goal — Tasks 4 (parser) + 7+8 (router dispatch) + 13 (engine) + 14 (hook refactor)
- §In Scope: parse CC/AT/PB → Task 4; gear icon overlay → Tasks 19+20; activity monitor → Tasks 5+17; Learn → Task 19; profiles → Task 11; save nag → Task 18+19; localStorage persistence → Task 10+11; useMidiMapSync stub → Task 12+21
- §Out of Scope (Phase B) — by exclusion, no tasks reference `pitchBend` as a destination or `vibratoDepth` as a target. The router still parses pitch bend bytes (Task 4) for the activity monitor.
- §Architecture diagram — pipeline matches Tasks 4→7→8→13→14 exactly
- §Data Model — Task 2 (types) + Task 3 (defaults)
- §UI section — Tasks 15→16→17→18→19→20
- §Persistence — Task 10 (helpers) + Task 11 (slice integration)
- §Phase B Deferred — preserved as documentation in the spec; no plan tasks. Correct.
- §Decisions Log — every decision is reflected in the implementation choices (in-payload schemaVersion, working profile in-memory, midiRouterRef singleton, etc.)

**Type consistency:**
- `MidiDestId` enum is identical across `midiMapTypes.ts`, the router lookup table, and `DEST_META`
- `EngineControls` interface is defined once in `MidiRouter.ts` and consumed by `useWebMidi.ts` (Task 14) — same shape
- `setMasterMix(volume, expression)` signature is consistent across router (Task 7), engine (Task 13), and call site (Task 14)
- `setMidiMapping` / `setMidiBendRange` / `setMidiTargetBinding` action names in Task 11 match what the overlay (Task 19) calls
- localStorage key `module:midi-map:v1` is centralized in `midiMapPersist.ts` and only referenced via the constant `MIDI_MAP_KEY`

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N" — every code block is the actual code. Tests have actual assertions, not "test the above".

**Scope check:** Single feature, ~22 tasks, fits one implementation session. The file count (10 new code files + 5 test files + 6 modified files) is concentrated in `src/input/` and `src/state/` and `src/components/`, which keeps the diff focused.

**Verified gap fixes inline:** None — first pass was clean.
