# MIDI Mappings & Settings Overlay — Design

**Status:** Draft, awaiting review
**Date:** 2026-04-13
**Author:** Brainstormed in session

## Goal

Add expressive MIDI input handling to MODULE — beyond just note on/off — and give users a place to configure how their controller talks to the app. Driven by the user's Akai EWI USB needing bite, breath, pitch plates, and aftertouch to do something musical.

## In Scope (v1 / Phase A)

- Parse MIDI Control Change (`0xB0`), Channel Aftertouch (`0xD0`), and Pitch Bend (`0xE0`) bytes (currently dropped)
- A gear icon in the rack brand bar opening a `MidiSettingsOverlay` modal
- A live MIDI activity monitor inside the overlay (LCD-styled)
- Per-row "Learn" buttons for assigning sources by gesture
- User-named profiles for switching between controllers
- Save/Discard/Cancel "save nag" UX for unsaved edits
- localStorage persistence (`module:midi-map:v1`)
- A no-op `useMidiMapSync` hook seam for future apps.pepperhorn.com sync

## Out of Scope (v1)

- **Pitch bend destination** — smplr can't modify held-voice detune. Bytes are still parsed (so the activity monitor shows the EWI plates working), but no destination consumes them. See *Phase B (Deferred)* below.
- **True vibrato** — same blocker. Modulation/aftertouch route to FX-send targets only in v1.
- **Portamento** — smplr is polyphonic with no glide. Would require per-voice detune scheduling and a mono/legato mode switch. Not worth it just for v1.
- **Filter cutoff/res** — there's no filter in the FX chain. Adding one is its own feature, not a MIDI-mapping feature.
- **Per-channel mapping** — all 16 channels treated uniformly. Future v2 if anyone needs multi-controller setups.
- **Per-patch mapping overrides** — mappings are global user preferences, not patch-bound.
- **MPE / poly aftertouch** — not in scope.

## Architecture

```
MIDI bytes ─► useWebMidi ─► midiParse ─► MidiRouter ─► EngineControls ─► smplr/FX
                                              │
                                              ├──► useStore.workingProfile (read)
                                              │
                                              ├──► observers (overlay-attached only)
                                              │       │
                                              │       └──► MidiActivityBuffer
                                              │             │
                                              │             └──► overlay rAF loop
                                              │
                                              └──► flashMidiActivity (preserved)

Gear icon (Rack.tsx brand bar)
   │
   └──► MidiSettingsOverlay
            │
            ├─► reads workingProfile, mutates via store actions
            ├─► attaches activity observer on mount, detaches on unmount
            └─► save flow ─► persistMidiMap() ─► localStorage
                                    │
                                    └─► (future) useMidiMapSync ─► apps.pepperhorn.com
```

**Architectural bets:**

- `MidiRouter` is the **only** place where byte-level MIDI becomes engine commands. Not in the React hook, not in the audio engine. This is the seam to test.
- `AudioEngine` grows numeric command methods (`setMasterMix`, `setMasterPan`, etc.) but knows nothing about MIDI, profiles, or mappings.
- Profiles are full snapshots, not deltas. Same pattern as `UserPatch`.
- Activity monitor is overlay-local — zero cost when the overlay is closed.
- `workingProfile` is in-memory only; only saved profiles + active id are persisted. Closing the overlay without saving discards edits (with a confirmation nag).
- `useMidiMapSync` is mounted from day one as a no-op stub. When the cloud implementation lands later, no call sites change.

## Data Model

### Destinations (functions in the app)

```ts
type MidiDestId =
  | 'sustain'             // bool — defer noteOffs while source > 63
  | 'volume'              // 0..1 — master gain scaler
  | 'expression'          // 0..1 — second master gain scaler (multiplies with volume)
  | 'pan'                 // -1..+1
  | 'modTarget'           // 0..1, applied to whatever modTargetParam points at
  | 'atTarget'            // 0..1, applied to whatever atTargetParam points at
  | 'fxReverbMix'
  | 'fxDelayMix'
  | 'fxChorusDepth'
  | 'fxDistortionAmount'
```

`pitchBend` and a `vibratoDepth` modulation target are **not** in v1 — see *Phase B (Deferred)*.

### Sources (incoming MIDI events)

```ts
type MidiSource =
  | { kind: 'cc'; cc: number }       // 0..127
  | { kind: 'pitchBend' }             // -8192..+8191, normalized
  | { kind: 'aftertouch' }            // 0..127
  | { kind: 'none' }                  // destination disabled
```

A `none` variant rather than a nullable, so the router can pattern-match without nil checks.

### Mapping rows

```ts
interface MidiMapping {
  destId: MidiDestId
  source: MidiSource
  enabled: boolean         // independent of source — quick on/off without losing the assignment
  invert?: boolean         // flip 0..127 → 127..0 (e.g. breath as volume-cut)
  min?: number             // output-range clamp, 0..1, default 0
  max?: number             // output-range clamp, 0..1, default 1
}
```

Shaping is intentionally minimal: invert + min/max only. No curves, no exponents, no multi-stage scaling. Anything beyond linear is the modular-routing rabbit hole — defer until proven necessary.

### Modulation targets

```ts
type ModulatableTarget =
  | 'masterVolume'         // adds to volume swell
  | 'fxReverbMix'
  | 'fxDelayMix'
  | 'fxChorusDepth'
  | 'fxDistortionAmount'
```

`vibratoDepth` is omitted from v1 — see *Phase B*.

```ts
interface TargetBindings {
  modTargetParam: ModulatableTarget
  atTargetParam: ModulatableTarget
}
```

Kept on the profile (not the mapping row) so both `modTarget` and `atTarget` read from the same vocabulary without duplication.

### Profile

```ts
interface MidiProfile {
  id: string                              // 'midimap-<base36-time>-<random>'
  name: string                            // user-editable
  mappings: Record<MidiDestId, MidiMapping>
  bendRangeSemitones: number              // 2 default; reserved for Phase B
  targets: TargetBindings
  createdAt: number
}
```

Full snapshots, not deltas. Easier to diff, easier to sync, easier to delete.

### Store slice

```ts
interface MidiMapSlice {
  profiles: MidiProfile[]                 // user's saved profiles
  activeProfileId: string | null          // null = "working from defaults"
  workingProfile: MidiProfile             // live state the router reads; always present
  dirty: boolean                          // workingProfile diverges from saved active

  setMapping: (destId: MidiDestId, patch: Partial<MidiMapping>) => void
  setBendRange: (semis: number) => void
  setTargetBinding: (which: 'mod' | 'at', target: ModulatableTarget) => void
  learnMapping: (destId: MidiDestId) => Promise<void>     // starts 1.5s capture
  cancelLearn: (destId: MidiDestId) => void

  saveProfile: () => void                                 // saves in place; falls through to saveAsProfile if no active id
  saveAsProfile: (name: string) => string                 // returns new id
  loadProfile: (id: string) => void                       // caller responsible for nag check
  deleteProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void

  resetToDefaults: () => void                             // working copy ← default profile, marks dirty
  discardChanges: () => void                              // working copy ← saved active (or defaults), clears dirty
}
```

The split between `workingProfile` (live, in-memory) and `profiles[]` (saved, persisted) means the router always reads one place, edits are always safe, and `dirty` lights up the Save button.

### Default profile (GM-keyboard shape)

| Destination          | Source         | Enabled | Notes                                          |
|----------------------|----------------|---------|------------------------------------------------|
| sustain              | CC 64          | ✓       |                                                |
| volume               | CC 7           | ✓       |                                                |
| expression           | CC 11          | ✓       | EWI users retarget to CC 2                     |
| pan                  | CC 10          | ✓       |                                                |
| modTarget            | CC 1           | ✓       | default target: `fxChorusDepth`                |
| atTarget             | Aftertouch     | ✓       | default target: `fxReverbMix`                  |
| fxReverbMix          | none           | ✗       | available as direct CC route                   |
| fxDelayMix           | none           | ✗       |                                                |
| fxChorusDepth        | none           | ✗       |                                                |
| fxDistortionAmount   | none           | ✗       |                                                |

## MIDI Input Pipeline

### `src/input/midiParse.ts` — pure byte parsing

```ts
type ParsedMidi =
  | { kind: 'noteOn';     midi: number; vel: number; channel: number }
  | { kind: 'noteOff';    midi: number;               channel: number }
  | { kind: 'cc';         cc: number;   value: number; channel: number }
  | { kind: 'pitchBend';  value: number;              channel: number }   // -8192..+8191
  | { kind: 'aftertouch'; value: number;              channel: number }   // 0..127

function parseMidi(data: Uint8Array): ParsedMidi | null
```

Pure function, no dependencies. ~30 lines. Unit-testable with hex byte arrays.

### `src/input/MidiRouter.ts` — translation + observation

```ts
interface EngineControls {
  noteOn:           (midi: number, vel: number) => void
  noteOff:          (midi: number) => void
  setSustain:       (held: boolean) => void           // pedal raise drains held noteOffs
  setMasterMix:     (volume: number, expression: number) => void
  setMasterPan:     (p: number) => void
  setFxParam:       (effectId: EffectId, paramId: string, value: number) => void
}

class MidiRouter {
  constructor(private engine: EngineControls) {}

  private workingMap: MidiProfile | null = null
  private lookupTable: Map<string, MidiMapping[]> = new Map()
  private observers: Set<(e: ParsedMidi) => void> = new Set()
  private sustainHeld = false
  private deferredNoteOffs: Set<number> = new Set()

  setMap(profile: MidiProfile): void                  // rebuilds lookupTable
  handle(event: ParsedMidi): void                     // hot path
  addObserver(fn: (e: ParsedMidi) => void): () => void
}
```

**Hot path (`handle`):**

- Note events bypass the mapping system entirely. `noteOn` → `engine.noteOn`. `noteOff` → if `sustainHeld`, add to `deferredNoteOffs`; otherwise `engine.noteOff`. (Note events are not sent to observers — the existing top-bar MIDI LED already covers "any incoming MIDI" feedback, and the activity monitor is for unmapped-source discovery.)
- Non-note events: look up the source key in `lookupTable`, walk matched rows, apply `enabled` / `invert` / `min` / `max` shaping, dispatch to the engine method for that destination.
- Sustain semantics: when CC 64 (or whatever's mapped to `sustain`) crosses the 64 threshold, toggle `sustainHeld`. On rising edge, also call `engine.setSustain(true)` and `smplr.setCC(64, value)` (so soundfonts with cc64-mapped sample layers also respond). On falling edge, drain `deferredNoteOffs` via real `engine.noteOff` calls and clear the set.
- Every parsed event (including unmapped sources) is forwarded to observers, so the activity monitor sees everything.

**Lookup table** is keyed by `sourceKey(event)` (e.g. `"cc:2"`, `"pitchBend"`, `"aftertouch"`) and rebuilt only on `setMap()`. A single source can fan out to multiple destinations.

**`MidiActivityBuffer`** — overlay-owned, attached only while the overlay is open:

```ts
interface ActivityRow { source: string; label: string; value: number; peakPct: number; lastSeen: number }

class MidiActivityBuffer {
  private state = new Map<string, { value: number; peak: number; at: number }>()
  private listeners = new Set<() => void>()

  ingest(event: ParsedMidi): void          // skips note events
  snapshot(now: number): ActivityRow[]     // filters where now - at < 2000ms
  subscribe(fn: () => void): () => void
}
```

Buffer is created in the overlay's mount effect, subscribed to the router via `addObserver(buffer.ingest)`, and torn down on unmount. Render is driven by a `requestAnimationFrame` loop in the overlay, throttled to ~30fps. **Zero cost when the overlay is hidden.**

**Learn capture:**

```ts
async function learnMapping(destId: MidiDestId): Promise<MidiSource | null> {
  const tally = new Map<string, { count: number; range: number }>()
  const unsub = router.addObserver((e) => {
    if (e.kind === 'noteOn' || e.kind === 'noteOff') return
    const key = sourceKey(e)
    const entry = tally.get(key) ?? { count: 0, range: 0 }
    entry.count += 1
    entry.range = Math.max(entry.range, deviation(e))
    tally.set(key, entry)
  })
  await sleep(1500)               // cancellable via AbortController on second click
  unsub()
  return pickWinner(tally)        // ranks by count × range
}
```

**Why count × range:** wind controllers spam CC 2 at 100Hz even when stationary. Range biases the winner toward whichever source is actually moving (the one the user just wiggled), not the chattiest one.

### `src/input/useWebMidi.ts` (refactored)

```ts
useEffect(() => {
  const router = new MidiRouter(engine)
  const unsubStore = useStore.subscribe(
    (s) => s.workingProfile,
    (profile) => router.setMap(profile),
    { fireImmediately: true },
  )
  // request MIDIAccess, attach midimessage listeners that call:
  //   const event = parseMidi(msg.data); if (event) router.handle(event)
  // also call useStore.getState().flashMidiActivity() (preserved behaviour)
  midiRouterRef.current = router
  return () => {
    unsubStore()
    // detach listeners, dispose router
    midiRouterRef.current = null
  }
}, [engine])
```

**`midiRouterRef`** is a module-level singleton (`let midiRouterRef = { current: null as MidiRouter | null }`). The overlay imports it directly to attach activity observers — avoids React Context boilerplate for what's effectively a global service that needs to be reachable from outside React's render path.

## AudioEngine Integration

smplr exposes more than expected — most destinations map cleanly to existing API.

| Destination          | Implementation                                        | Real-time on held notes? |
|----------------------|-------------------------------------------------------|--------------------------|
| sustain              | Router buffers noteOffs; `smplr.setCC(64, v)` for region matching | ✓ |
| volume               | `smplr.output.setVolume(127 × volume × expression)`    | ✓                        |
| expression           | Same setter, multiplied with volume                   | ✓                        |
| pan                  | `smplr.output.pan = value`                            | ✓                        |
| fxReverbMix / Delay / Chorus / Distortion | `useStore.getState().setFxParam(...)`  | ✓                        |
| modTarget / atTarget | Routes to one of the FX param destinations above      | ✓                        |

**New engine methods:**

```ts
class AudioEngine {
  // ...existing methods unchanged
  setSustain(held: boolean): void              // forwards to smplr.setCC(64, held ? 127 : 0)
  setMasterMix(volume: number, expression: number): void  // 0..1 each
  setMasterPan(p: number): void                // -1..+1
}
```

`setFxParam` is reached from the router via `useStore.getState().setFxParam(...)` directly — the router is allowed to know about the store; the engine isn't. Smaller surface than threading a passthrough through the engine.

**Sustain semantics live in the router**, not the engine. The engine only learns "sustain is held / released" so it can call `smplr.setCC(64, ...)`. The actual deferred-noteOff buffer is the router's responsibility — clean separation, testable in isolation.

**No new audio nodes.** All Phase A destinations use existing smplr API or the existing FX param plumbing. Zero AudioWorklet code, zero new graph topology.

## UI — `MidiSettingsOverlay`

### Entry point

A new gear button in `Rack.tsx`'s `rack-brand-status` group at `Rack.tsx:81–84`, between `<MidiStatus />` and `<UserMenu />`. Order becomes `MIDI LED → ⚙ → user menu`. Same pill shape as `MidiStatus` so the three controls share a visual register.

```tsx
<button
  className="midi-settings-btn cell-hit flex items-center gap-2
             rounded-full border border-rack-edge bg-white/70
             px-3 py-1 font-mono text-[10px] uppercase tracking-widest
             text-text/60"
  title="MIDI mappings"
>
  <span className="midi-settings-icon h-3 w-3"> {/* gear svg */} </span>
  MIDI MAP
</button>
```

### Modal shell (clones `SaveDialog` pattern)

```tsx
<div className="midi-overlay fade-in fixed inset-0 z-[55] flex items-center
                justify-center bg-text/50 p-4 backdrop-blur-sm"
     onClick={closeOnBackdrop}>
  <div className="midi-overlay-card pop-in flex
                  w-[min(560px,calc(100vw-2rem))] max-h-[calc(100vh-4rem)]
                  flex-col gap-4 rounded-2xl bg-bg p-5 shadow-2xl"
       style={{ border: '1px solid var(--color-rack-edge)' }}>
    {/* header / profile row / activity panel / mappings */}
  </div>
</div>
```

Wider than `SaveDialog` (560px vs 420px) to fit mapping rows. `max-h` + `overflow-y-auto scroll-clean` on the mapping section so the modal doesn't blow out vertically.

### Header

```tsx
<div className="midi-overlay-header flex items-baseline justify-between">
  <div className="font-display text-base font-semibold text-text">MIDI Mappings</div>
  <div className="font-mono text-[10px] uppercase tracking-widest text-text/50">
    {profileName}{dirty ? ' (draft)' : ''}
  </div>
</div>
```

`(draft)` lowercase to match the existing mono-caps treatment used for `usr bank`, `base patch`, `MIDI on`, etc.

### Profile picker row

Same panel styling as `SaveDialog`'s base-patch card. Save / Save As / Reset use the **secondary button** styling (white bg, rack-edge border, mono caps). When `dirty`, the **Save** button promotes to the **primary** styling (coral gradient + glow) to draw the eye.

### Live activity panel — LCD treatment

This is the best fit I found. Use the LCD color tokens so the panel reads as "the rack module's MIDI activity display":

```tsx
<div className="midi-activity-panel rounded-md p-3 lcd-glow"
     style={{ background: 'var(--color-lcd-bg)',
              border: '1px solid #1A2240',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }}>
  <div className="activity-label font-mono text-[9px] uppercase tracking-widest"
       style={{ color: 'var(--color-lcd-dim)' }}>incoming midi</div>
  {/* one row per active source: source label / sky-glow bar / mono value */}
</div>
```

Sky text on dark navy + `.lcd-glow` text-shadow. Bars fill in sky with a sky-glow box-shadow. Visually pops against the warm-light surrounding modal — same contrast move as the main rack LCD already uses, so it lands feeling native.

Empty state: `— no activity —` in `var(--color-lcd-dim)`.

### Mapping rows

Wrapped in a panel matching `SaveDialog`'s base-patch card style (white→#F4F6F9 gradient, rack-edge border).

```tsx
<div className="mapping-row flex items-center gap-2 rounded-md px-2 py-1.5
                hover:bg-white/60 transition-colors">
  <input type="checkbox" className="mapping-enable accent-coral" />
  <div className="mapping-label font-display text-sm text-text flex-1">
    {dest.label}
  </div>
  <SourcePicker /> {/* mono-cap dropdown, white bg, rack-edge border */}
  <button className="mapping-learn cell-hit ...">learn</button>
</div>
```

**Sub-row** for `modTarget` / `atTarget` (and FX-send min/max/invert) — indented `pl-6`, same mono-cap label styling: `→ target`, `min`, `max`, `inv`.

**Learn capturing state** — button swaps to coral gradient + spinning ring SVG. Source picker disabled. Hint below row in `font-mono text-[10px] text-text/50`: *wiggle the controller to assign…*. On no-capture, hint flashes red (`text-stop`) for 600ms. Click Learn again to cancel.

### Save nag dialog

Modal-on-modal at `z-[60]` (above overlay's `z-[55]`). Same shell as `SaveDialog`, ~360px wide. Three buttons in mono caps:

- `cancel` — secondary
- `discard` — secondary, `text-stop`
- `save changes` — primary (coral gradient + glow)

Triggered by overlay close (X / Esc / backdrop), profile dropdown change, and `beforeunload` (handler attached only while `dirty`).

### Mobile (<640px)

Modal becomes full-screen (`inset-0 rounded-none`). Activity panel collapses to a single-row summary by default (`▸ activity (3 sources active)`), expanding on tap. Source pickers swap to native `<select>` for OS dropdown UX. Learn buttons stay 44px tall (Apple HIG).

### Files

```
src/components/
  MidiSettingsButton.tsx    ← gear icon in the rack brand bar
  MidiSettingsOverlay.tsx   ← the modal itself
  MidiActivityPanel.tsx     ← the live monitor (uses MidiActivityBuffer + rAF loop)
  MidiMappingRow.tsx        ← one row, reusable
  MidiSourcePicker.tsx      ← type+number combo dropdown
  MidiSaveNagDialog.tsx     ← save-on-leave confirmation

src/input/
  midiParse.ts              ← NEW: pure byte parser
  MidiRouter.ts             ← NEW: translation + observation
  MidiActivityBuffer.ts     ← NEW: overlay-local ring buffer
  useWebMidi.ts             ← REFACTORED: thin React lifecycle wrapper

src/state/
  useStore.ts               ← + MidiMapSlice
  useMidiMapSync.ts         ← NEW: no-op stub, mounted from App.tsx

src/audio/
  AudioEngine.ts            ← + setSustain / setMasterMix / setMasterPan
```

Six new components + four new non-component files. Each ≤200 lines.

### Design tokens audit

Every styling decision references something already in `index.css` or already used in `SaveDialog` / `MidiStatus`. **Zero new design tokens.**

| Use                  | Token / class                                                                |
|----------------------|-------------------------------------------------------------------------------|
| Modal backdrop       | `bg-text/50 backdrop-blur-sm`                                                |
| Modal card           | `rounded-2xl bg-bg shadow-2xl` + `border: var(--color-rack-edge)`            |
| Modal animations     | `.fade-in` (backdrop), `.pop-in` (card)                                      |
| Section labels       | `font-mono text-[9px] uppercase tracking-widest text-text/40`                |
| Section headings     | `font-display text-base font-semibold text-text`                             |
| Body content         | `font-display text-sm text-text`                                             |
| Tech subtext         | `font-mono text-[10px] uppercase tracking-wider text-text/60`                |
| Buttons              | `.cell-hit rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider` |
| Primary button       | coral gradient + inset bottom shadow + coral glow                            |
| Secondary button     | white bg + rack-edge border + `text-text/70`                                 |
| Inputs               | white bg + rack-edge border + `focus:ring-2 focus:ring-coral`                |
| Inset panel          | `linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)` + rack-edge border       |
| Activity LCD         | `var(--color-lcd-bg)` bg + `var(--color-lcd-text)` content + `.lcd-glow`     |
| Modal z-index        | overlay `z-[55]`, save nag `z-[60]`                                          |

## Persistence

### Storage layout

```
module:state:v1            ← unchanged
module:favourites:v1       ← unchanged
module:downloaded:v1       ← unchanged
module:user-patches:v1     ← unchanged
module:debug:v1            ← unchanged
module:midi-map:v1         ← NEW
```

The new key is fully isolated. No cross-key dependencies. If cleared, defaults take over.

### Payload

```ts
interface PersistedMidiMap {
  schemaVersion: 1
  profiles: MidiProfile[]
  activeProfileId: string | null
  // workingProfile is NOT persisted — rebuilt from active profile on load
}
```

`schemaVersion` is in-payload (not in the key name) because this slice will evolve more than the existing ones — Phase B will add `pitchBend` back. In-payload version lets us migrate without renaming the key.

### Load path

```ts
function loadMidiMap(): { profiles: MidiProfile[]; activeProfileId: string | null; workingProfile: MidiProfile } {
  try {
    const raw = localStorage.getItem('module:midi-map:v1')
    if (!raw) return freshDefaults()
    const parsed = JSON.parse(raw) as PersistedMidiMap
    if (parsed.schemaVersion !== 1) return freshDefaults()
    const profiles = parsed.profiles.filter(isValidProfile)
    const active = profiles.find((p) => p.id === parsed.activeProfileId) ?? null
    const workingProfile = active ? cloneProfile(active) : defaultProfile()
    return { profiles, activeProfileId: active?.id ?? null, workingProfile }
  } catch {
    return freshDefaults()
  }
}
```

`isValidProfile` is a runtime guard. Discard corrupt entries silently — same defensive pattern as `loadFavourites` / `loadUserPatches`.

### Save path

```ts
function persistMidiMap(state: State): void {
  try {
    const payload: PersistedMidiMap = {
      schemaVersion: 1,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
    }
    localStorage.setItem('module:midi-map:v1', JSON.stringify(payload))
  } catch {
    // noop — quota errors fail silently
  }
}
```

Called from `saveProfile`, `saveAsProfile`, `deleteProfile`, `renameProfile`, `loadProfile`. **Not** called from `setMapping` / `setBendRange` / `setTargetBinding` / `learnMapping` — those mutate `workingProfile` only, which is in-memory.

### Cloud sync seam

```ts
// src/state/useMidiMapSync.ts — NEW, no-op stub for v1
export function useMidiMapSync(): void {
  // Mounted from App.tsx alongside useUserPatchSync().
  //
  // Future shape (mirrors useUserPatchSync):
  //   1. On mount, if logged in and cloud copy is newer, hydrate profiles[]
  //      from apps.pepperhorn.com (overwriting localStorage).
  //   2. Subscribe to store; on save/delete/rename/loadProfile, debounce
  //      a PATCH to the backend.
  //   3. Conflict resolution: last-write-wins per profile id by createdAt.
  //   4. Logged-out users: complete no-op. localStorage is source of truth.
  //
  // persistMidiMap() always writes to localStorage first; this hook handles
  // cloud propagation independently. Cloud failures never block local saves.
}
```

**Why a stub now (not just a TODO):**
1. Wired into `App.tsx` from day one. Real implementation only changes the body.
2. Establishes the pattern: cloud sync is a separate hook from store mutation. Same shape as `useUserPatchSync`.
3. Lets the spec leave no obvious "TODO: figure out cloud" hole. The seam is real even if empty.

### Future backend contract

```
app_users.midi_map_profiles  ← JSONB, mirror of PersistedMidiMap.profiles
app_users.active_midi_map_id ← TEXT, mirror of activeProfileId
```

Two columns rather than one blob so `active_midi_map_id` can be indexed if we ever want to query "users who have an EWI profile". Adding the columns is part of the future Phase 2 PR that lands `useMidiMapSync` for real.

## Phase B (Deferred): pitch bend & true vibrato

**Why deferred:** smplr's public API doesn't expose modification of already-playing voices' detune. Real-time pitch bend and LFO-driven vibrato require modifying held voices — they need an audio-engine intervention beyond smplr's surface. The `detune` parameter on `NoteEvent` is set at `start()` time; `#private` voices are inaccessible after that.

**Why not Tone.js:** the README documents an iOS Safari / mobile Firefox crash in Tone's `Listener` initialization. Tree-shaking doesn't help — the global context instantiates at import-time, not first use. Surgical `import { PitchShift } from 'tone'` still triggers the crash. Re-introducing Tone for one feature would resurrect the crash for every user on those platforms.

**Realistic options when revisiting:**

1. **`soundtouchjs`** — ~30KB, MIT, AudioWorklet build, single-purpose, no global side effects. Lowest-risk drop-in.
2. **`phaze`** — ~5KB granular shifter, AudioWorklet, less polished.
3. **Hand-rolled granular AudioWorklet** — ~80–120 lines, no dep, full control, real DSP work.
4. **Re-test Tone** — verify whether newer versions have lazy-init or whether the iOS issue still reproduces. Cheapest diagnostic: a small reproduction page on a real iPhone before committing to anything.

**What unblocks the work:** a master-bus pitch-shifter `AudioWorkletNode` with one AudioParam (`pitchShift`, in semitones) inserted between `current.output` and the existing distortion node. Once that exists:

- Pitch bend writes directly to the param
- Vibrato is `setValueAtTime`/`linearRampToValueAtTime` on the same param (LFO from mod wheel or aftertouch)
- The data model gains back `pitchBend` as a `MidiDestId` and `vibratoDepth` as a `ModulatableTarget`
- The router and overlay don't change shape — they just expand their enums
- A migration in `loadMidiMap` adds the new destinations as `enabled: false` to existing profiles

**Latency budget:** any granular shifter adds ~10–20ms to the master bus. Acceptable for live wind-controller playing but not zero.

**Note:** even without Phase B, the EWI's bite sensor is still expressive in v1 — it routes to FX-send targets (chorus depth, reverb mix) by default. The bite still *does something musical*. What's lost is true pitch bending of held notes.

## Open Questions

These are flagged to revisit later (some now, some at Phase B):

1. **Sign-in merge policy** — when a logged-out user with local profiles signs in, do their local profiles merge with cloud profiles, or does cloud overwrite local? Defer until `useMidiMapSync` is implemented for real.
2. **Per-channel mapping** — punted from v1. If a user with multiple controllers asks, add `channelFilter?: number` to `MidiMapping` and one extra check in the router hot path.
3. **Curves / exponential shaping** — punted. Linear `min/max` only. Revisit if breath-to-volume feels unnatural in practice.
4. **Schema migration story** — when Phase B bumps to `schemaVersion: 2`, write a one-liner that adds `pitchBend` to existing profiles with `enabled: false`. Don't blow away user data.
5. **Visible feedback for sustain pedal state** — should the UI show "sustain held" anywhere outside the activity monitor? Probably not for v1; the LCD source badge is already busy.

## Decisions Log

| Date       | Decision                                                                 | Rationale                                                                          |
|------------|--------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| 2026-04-13 | Named-destinations model, not free-routing matrix                        | Matches user mental model ("map common MIDI parameters"), one screen of toggles    |
| 2026-04-13 | Tier 1 + Tier 2 destinations in v1; Tier 3 (portamento, filter) deferred | Tier 3 needs new engine features (filter node, mono/legato), out of scope          |
| 2026-04-13 | User-named profiles only (no built-in EWI profile)                       | User asked for the same pattern as USR patches; simpler defaults model             |
| 2026-04-13 | Live activity monitor + per-row Learn buttons                            | Activity = "is my controller working?"; Learn = "what was that CC number?"        |
| 2026-04-13 | `workingProfile` in-memory only, edits ephemeral until saved             | Save-nag UX with `(draft)` suffix; no surprise persistence of half-finished edits  |
| 2026-04-13 | `schemaVersion` in-payload, not in key name                              | This slice will evolve more than existing ones (Phase B); migration without rename |
| 2026-04-13 | Pitch bend & true vibrato deferred to Phase B (no separate timeline)     | smplr can't bend held voices; Tone.js crash on iOS rules out the easy answer       |
| 2026-04-13 | Phase A still ships even without pitch bend                              | Bite sensor routes to FX targets — still musical, just not pitch-bending           |
| 2026-04-13 | LCD treatment for the activity panel                                     | Matches the rack module's existing LCD aesthetic; pops against warm-light shell    |
| 2026-04-13 | `useMidiMapSync` mounted as a no-op stub from day one                    | Establishes the seam so the future cloud PR is body-only, no call-site edits       |
| 2026-04-13 | `midiRouterRef` module-level singleton, not React Context                | Router needs reachable from outside React render path (rAF loop)                   |
| 2026-04-13 | Note events bypass mapping system entirely                               | Existing top-bar MIDI LED already covers "any incoming MIDI" feedback              |
