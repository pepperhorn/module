# Breath Control & Wind Controllers — Design

**Status:** Draft, awaiting review
**Date:** 2026-09-18
**Extends:** [`2026-04-13-midi-mappings-design.md`](./2026-04-13-midi-mappings-design.md)

## Goal

Make MODULE play properly when the controller is a wind instrument rather than a
keyboard — Akai EWI USB, Odisei Travel Sax 2, Odisei Travel Clarinet — by landing
the MIDI parameter work the April design deferred, with **breath as the primary
expression axis** rather than one CC destination among ten.

**None of the April design is built.** There is no `MidiRouter`, no `midiParse`,
no settings overlay, and no stored mapping — `useWebMidi` still handles note-on
and note-off and drops every Control Change byte on the floor. So this is not a
patch on top of shipped code: it is the April work, built once, with breath
treated as a first-class axis from the start rather than retrofitted.

The April design treats breath as one row in a mapping table landing on a master
gain scaler. That is correct as far as it goes, and this design keeps its data
model, its router seam and its profile/overlay UX wholesale. But it does not
answer the four questions that decide whether a Travel Sax feels like an
instrument or like a stuck note, and those questions are what this document adds.

---

## What changed since April

Two things in the codebase, one in the wider world.

**The chain now has a stable entry node.** `buildEffectChain` used to expose
distortion's input as `inputNode`; since the reorderable-chain work it exposes a
dedicated `entry` GainNode whose identity never changes. That node is the natural
home for a breath stage: every instrument kind already feeds it (smplr classes and
`CustomSampler` alike), it sits ahead of the FX chain, and nothing about it changes
when effects are reordered or when the instrument LRU swaps a patch underneath.
Before that change, a breath gain would have needed per-instrument plumbing and
would have fought the instrument cache.

**The chain is reorderable.** "Where does breath sit in the signal path" is now a
question with a real answer rather than an accident of wiring order — see
*Signal path* below.

**The April design is still entirely unbuilt**, which is a freedom rather than a
problem: the breath path can be designed into the router from the first commit
instead of being threaded through a mapping table that already shipped.

**Safari still has no Web MIDI.** See *Platform reality* — this materially limits
who can use the feature and needs saying out loud before anyone builds it.

---

## Platform reality (verify before committing effort)

| Browser | Web MIDI |
|---|---|
| Chrome / Edge desktop | Yes |
| Chrome Android | Yes (from v152) |
| **Safari macOS** | **No** |
| **Safari iOS / iPadOS** | **No** |

Source: [caniuse.com/midi](https://caniuse.com/midi).

This is the single most important fact in this document. MODULE is an installable
PWA and a large part of its point is playing on a phone — but on iOS, where a PWA
is *only* ever Safari's engine, `navigator.requestMIDIAccess` does not exist. An
iPhone user cannot drive MODULE from a Travel Sax at all, however the app is
written. The Odisei devices are marketed heavily around an iOS companion app,
so this mismatch is exactly the one a user will walk into.

Consequences for this design:

- The target platforms are **desktop Chrome/Edge and Android Chrome**. Say so in
  the UI rather than letting an iOS user hunt for a setting that cannot work.
- `useWebMidi` already feature-detects and degrades silently. That silence is now
  wrong: the MIDI settings entry point should render an explicit *"Web MIDI isn't
  available in this browser"* state on Safari rather than an empty device list.
- Nothing here is worth building **for iOS** without a different transport, and
  there isn't one worth having (Web Bluetooth is also absent on iOS Safari).

---

## Device facts

Verified against vendor and review sources; anything not verified is marked and
should be confirmed against hardware before it is relied on.

| | Travel Sax 2 | Travel Clarinet | Akai EWI USB |
|---|---|---|---|
| Breath → | **CC2** by default | **CC2** by default | CC2 (per April design) |
| Breath CC configurable | Yes — CC2 / CC7 / CC11, called "Breath Channel" in the app | Yes — "MIDI breath channel" in the app | — |
| Velocity | Derived from breath by default; can be disabled | Derived from breath by default; can be fixed | — |
| Transport | USB-C class-compliant MIDI | USB-C class-compliant MIDI | USB |
| Bluetooth | Pairs with the companion app; **not** established as a MIDI transport | Bluetooth is for audio backing tracks, not MIDI | — |
| Extra expression | **None** — breath and fingering only, no bite or pitch sensor | Not established | Bite, pitch plates, aftertouch |
| Idle behaviour | **Sends C#4 with breath and velocity when no keys are fingered** | Not established | — |
| Transpose | — | Semitone transpose in the app | — |

Sources: [Synth and Software review](https://synthandsoftware.com/2025/06/odiseimusic-travel-sax-2-the-synth-and-software-review/),
[Odisei — Travel Clarinet features](https://odiseimusic.com/en-us/blogs/news/top-features-travel-clarinet),
[Odisei — Travel Sax 2](https://odiseimusic.com/travel-sax-2/).

Three of these rows drive real design decisions:

1. **Breath-derived velocity + CC2 both arriving** means dynamics get applied
   twice — squared, not doubled — unless we decide which one owns loudness.
2. **The idle C#4** means a Travel Sax with nothing fingered still emits a note.
   Without a breath gate, MODULE drones a C# the moment it is plugged in.
3. **No bite or pitch sensor on the Travel Sax 2** means the April design's
   deferred pitch-bend work (Phase B) buys these users nothing. It stays deferred.
   The EWI is the only one of the three that would benefit.

---

## The four problems

### 1. smplr cannot modulate a sounding voice

`LoadedInstrument.start({ note, velocity })` fixes a voice's loudness at note-on
and returns only a stop function. There is no per-voice gain afterwards. smplr
exposes `Channel.setVolume` per *instrument*, and `CustomSampler` has its own
output gain — two different mechanisms, neither per-voice.

So continuous breath cannot shape an individual note through the instrument API.
It has to be a gain stage the instrument feeds.

**Decision:** one `BreathStage` GainNode between `entry` and the effects chain,
shared by every instrument. Uniform across instrument kinds, untouched by patch
changes, and invisible to the LRU cache.

The honest cost: this is a **global** gain, not per-voice. If a keyboard and a
wind controller are connected at once, breath ducks both. Wind controllers are
monophonic and this is how hardware breath modules behave, so it is the right
trade — but it is a trade, and the UI should not pretend breath is per-note.

### 2. Dynamics applied twice

Both Odisei instruments send breath-derived velocity *and* CC2 by default. Apply
velocity at note-on and breath to the gain stage and a soft note is quiet twice.

**Decision:** a `velocityMode` on the breath config, defaulting to `fixed` when a
breath source is active:

- `fixed` — note-on uses a constant velocity (default 100); breath owns loudness.
- `passthrough` — use the incoming velocity; breath still owns the gain stage.
  For devices whose velocity is *not* breath-derived.

Defaulting to `fixed` means the device's own default settings work correctly with
no configuration on either side, which is the outcome worth optimising for.

### 3. The idle note

A Travel Sax with nothing fingered sends C#4. Breath is at zero, so the gain stage
is at its floor — but at floor > 0, or with an FX tail, that is still audible.

**Decision:** a **breath gate**. Below `gateThreshold` (default 2/127), a note-on
is held rather than started; it starts if breath rises above the threshold while
the note is still held. When breath falls back below the threshold, sounding notes
are released. The gate is armed only while a breath source is assigned and
enabled, so it cannot strand a keyboard player's notes.

This also gives the correct articulation for free: on a wind controller the note
should begin when you blow, not when your fingers land.

### 4. CC flood and zipper noise

Wind controllers send breath continuously — dense enough that one Web Audio param
write per MIDI message is both wasteful and audibly grainy, because an abrupt
`gain.value` assignment is a discontinuity.

**Decision, two parts:**

- **Coalesce**: the router keeps the latest breath value and schedules at most one
  audio-param update per animation frame. MIDI messages are never dropped for
  other purposes (the activity monitor still sees every byte), only the *param
  write* is rate-limited.
- **Smooth**: write with `setTargetAtTime`, not `.value`. Time constant from
  `smoothingMs` (default 8ms), which is short enough to feel immediate and long
  enough to remove the stepping.

---

## Signal path

```
instrument ──► entry ──► BreathStage ──► [ reorderable FX chain ] ──► master ──► out
                          ▲
                          │ setTargetAtTime(breath, …)
                          │
MIDI in ──► parseMidi ──► MidiRouter ──► BreathStage.set(0..1)
                              │
                              ├──► note gate ──► engine.noteOn / noteOff
                              └──► other destinations (April design)
```

**Breath sits pre-FX, deliberately.** Post-FX it would chop reverb and delay tails
the instant you stopped blowing, which is wrong — a real breath-controlled voice
feeds a reverb that then decays on its own. Pre-FX, releasing breath stops feeding
the chain and the tails ring out naturally.

It also means breath is unaffected by chain reordering, which is what we want: the
order arrows move effects relative to each other, not relative to the player.

---

## Data model

Extends the April `MidiProfile` rather than replacing it.

```ts
/** Added to MidiDestId. */
type MidiDestId = /* …April destinations… */ | 'breath'

type BreathCurve = 'linear' | 'exponential' | 'logarithmic'

interface BreathConfig {
  /** Usually { kind: 'cc', cc: 2 }. Shares the April MidiSource union. */
  source: MidiSource
  enabled: boolean

  /** Below this (0..127) the gate is shut. Default 2. */
  gateThreshold: number
  /** Gain floor when breath is at zero but the gate is open. Default 0. */
  floor: number
  /** Gain ceiling at full breath. Default 1. */
  ceiling: number
  /**
   * Response shape. `exponential` suits players who want a long quiet range;
   * `logarithmic` suits ones who want the top of the range to open up early.
   */
  curve: BreathCurve
  /** setTargetAtTime time constant, ms. Default 8. */
  smoothingMs: number
  /** Whether note-on velocity or breath owns loudness. Default 'fixed'. */
  velocityMode: 'fixed' | 'passthrough'
  /** Velocity used when velocityMode is 'fixed'. Default 100. */
  fixedVelocity: number
}

interface MidiProfile {
  // …April fields…
  breath: BreathConfig
}
```

Deliberately *not* included: multi-point curve editors, per-patch breath, breath
→ filter (there is no filter), breath → vibrato (no per-voice pitch — see April's
Phase B). Three named curves and a floor/ceiling pair cover the real range of
preference without becoming a modulation matrix.

### Device presets

Presets are the whole user experience here. A player should plug in a Travel Sax,
pick "Travel Sax 2", and play — not read a CC table.

| Preset | Breath source | velocityMode | gateThreshold | curve | Notes |
|---|---|---|---|---|---|
| Travel Sax 2 | CC2 | `fixed` | 2 | exponential | Gate also suppresses the idle C#4 |
| Travel Clarinet | CC2 | `fixed` | 2 | exponential | Same family, same defaults |
| Akai EWI USB | CC2 | `fixed` | 2 | exponential | Bite/plates unassigned until Phase B |
| MIDI keyboard | none | `passthrough` | — | — | The April default profile, unchanged |

If the user has reconfigured their device's Breath Channel to CC7 or CC11, the
existing **Learn** flow re-assigns the source by gesture — blow into it — which is
a better answer than asking them what they set.

---

## Engine API

`AudioEngine` grows one method and knows nothing about MIDI:

```ts
/** 0..1, already gated, curved and clamped by the router. */
setBreath(level: number): void
```

`buildEffectChain` grows the stage:

```ts
interface EffectChain {
  // …existing…
  /** Pre-FX expression gain. Identity is stable, like inputNode. */
  setBreath: (level: number, smoothingMs: number) => void
}
```

Two rules, both learned from the reorderable-chain work:

- The stage is created once and never rewired. `setOrder` must not touch it.
- `inputNode` stays the node instruments connect to. The stage goes *behind* it,
  so instrument wiring and the LRU cache remain untouched.

---

## Note lifecycle with the gate

```
noteOn(n)   breath open?  ──yes──► engine.noteOn(n, velocityFor(n))
                └──no──► pending.add(n)                     [nothing sounds]

breath crosses threshold upward   ──► start every pending note, clear pending
breath crosses threshold downward ──► engine.noteOff every sounding note

noteOff(n)  ──► pending.delete(n); engine.noteOff(n)
```

Edge cases the implementation has to get right, each of which is a stuck or
missing note if it does not:

- **Gate shut while notes sound** — release them, but keep them in `pending` only
  if the device still holds the key, so breathing back in resumes the phrase.
- **Breath source disabled mid-phrase** — open the gate permanently and flush
  `pending`, or the player is left with silent keys.
- **Panic** (existing `engine.panic`) — clear `pending` as well as sounding notes.
- **Patch change mid-note** — the engine already stops the previous instrument;
  `pending` must be cleared too or a stale note starts on the new patch.
- **Device unplugged with the gate shut** — `onstatechange` should flush, or a
  held note never releases.

---

## UI

Extends the April `MidiSettingsOverlay` with a breath panel above the mapping
table, because for these users it *is* the feature:

- **Device preset picker** — the four presets above, applying in one tap.
- **Live breath meter** — an LCD-styled bar showing raw CC value, the gate
  threshold as a marked line, and the resulting gain after curve and floor. This
  is the diagnostic: a player who is "getting nothing" can see instantly whether
  breath is arriving at all, arriving on a different CC, or arriving but gated.
- **Gate / floor / ceiling / curve / smoothing** controls, reusing `PedalKnob`.
- **Velocity mode** as a two-state switch with a plain-language explanation of
  why `fixed` is the default.

On Safari, this panel is replaced by the unsupported-browser notice described in
*Platform reality*. Not a disabled form — an explanation.

Touch sizing follows the rules already established: 44px primary targets, 36px
minimum for dense secondary controls.

---

## Persistence

April specified `module:midi-map:v1`. Since it was never implemented there is
nothing in the wild to migrate from, so `breath` is simply part of the first
schema that ships — no v2, no migration path to carry.

What does carry over is the normalise-on-load discipline the FX order already
uses: never trust the stored shape. Coerce a stored profile into a valid one on
read — clamp the numeric fields, fall back to the keyboard preset for an
unrecognised curve or source — rather than letting a hand-edited or
future-version payload silently disable an expression axis. A profile that fails
to normalise should reset to a preset visibly, not fail quiet.

---

## Testing

The parts worth testing, in order of how badly they fail:

1. **Breath curve — pure.** `breathToGain(cc, config)` across all three curves,
   floor/ceiling clamping, and the gate boundary. Table-driven, no mocks.
2. **Gate state machine — pure.** Drive a sequence of note/breath events and
   assert the resulting engine calls, covering every edge case listed above. A
   stuck note is the failure mode here and it is fully reachable without audio.
3. **BreathStage wiring — fake AudioContext.** Reuse the recording fake from
   `effectChain.test.ts`: assert the stage sits between entry and the first
   effect, that its identity survives `setOrder`, and that reordering does not
   disconnect it.
4. **Router coalescing.** Feed a burst of CC2 messages and assert one param write
   per frame, with the *latest* value winning — not the first.
5. **Byte parsing.** As the April design specifies, with recorded byte arrays.

What cannot be unit-tested and needs hardware: actual latency, whether the curve
defaults feel right, and every Travel Clarinet row marked unverified above.

---

## Out of scope

- **Pitch bend, bite, vibrato** — still Phase B, and now with evidence it matters
  less: the Travel Sax 2 has no pitch or bite sensor at all. EWI-only.
- **Per-voice breath.** Needs a per-voice gain smplr does not expose. The global
  stage is the honest approximation.
- **iOS.** No Web MIDI, no workaround worth having.
- **Bluetooth MIDI.** Not established as a MIDI transport on either Odisei device;
  both do USB-C class-compliant MIDI, which Web MIDI already sees.
- **Breath → filter cutoff.** There is still no filter in the chain.
- **Fingering translation / transposition.** The devices do this themselves.

---

## Open questions

1. **Does the Travel Clarinet share the Travel Sax's idle-note behaviour?**
   Unverified. The gate makes it harmless either way, which is why the gate is
   default-on for both presets — but it should be confirmed.
2. **Is `exponential` the right default curve?** Chosen because breath controllers
   conventionally want a long quiet range, not from testing on these instruments.
3. **Should breath also scale FX sends**, so hard blowing pushes more reverb? It
   is expressive and cheap given the mapping system already reaches FX params, but
   it is a second axis on one gesture and may just muddy things.
4. **Does the gate want hysteresis?** A single threshold may chatter at the
   boundary. Separate open/close thresholds would fix it at the cost of a control.
5. **What happens with a keyboard and a wind controller connected together?**
   Currently: breath ducks both. Per-channel routing (April's deferred v2) is the
   real fix.

---

## Decisions log

| Decision | Rationale |
|---|---|
| Breath is a single global pre-FX gain stage, not per-voice | smplr exposes no per-voice gain; pre-FX lets tails decay naturally |
| The stage lives behind `entry`, which the chain work made stable | Uniform across instrument kinds, untouched by reorder or the LRU cache |
| `velocityMode` defaults to `fixed` | Both Odisei devices send breath-derived velocity by default; applying both squares the dynamics |
| Breath gate is default-on for wind presets | The Travel Sax 2 sends C#4 when unfingered, and blow-to-start is the right articulation anyway |
| Param writes coalesce per frame, written with `setTargetAtTime` | Wind controllers flood CC; direct `.value` writes are audibly grainy |
| Three named curves, no curve editor | Covers real preference without becoming a modulation matrix |
| Device presets are the primary UX; Learn is the fallback | Nobody should read a CC table to play a saxophone |
| Pitch bend stays deferred | The Travel Sax 2 has no pitch sensor; EWI-only, so it does not gate this work |
| Safari gets an explanation, not a disabled form | Web MIDI is absent on both macOS and iOS Safari, and silence looks like a bug |
