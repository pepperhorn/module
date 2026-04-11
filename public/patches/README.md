# Custom sample patches

Drop a folder under this directory containing:

- `patch.json` — the manifest (see `PatchManifest` in `src/patches/types.ts`)
- one or more audio files referenced by the manifest's `source.samples`

Vite picks up new folders via `import.meta.glob` at dev-server start, so add a
folder and reload the page to see your patch in the **CST** bank.

## `patch.json` shape

```json
{
  "id": "custom/my-patch",
  "name": "My Patch",
  "category": "Keys",
  "bank": "CST",
  "color": "amber",
  "defaultOctave": 4,
  "source": {
    "kind": "sampler",
    "baseUrl": "/patches/my-patch/",
    "samples": {
      "C3": "C3.ogg",
      "C4": ["C4-a.ogg", "C4-b.ogg"],
      "C5": {
        "p":  "C5-p.ogg",
        "mf": "C5-mf.ogg",
        "f":  ["C5-f-a.ogg", "C5-f-b.ogg"]
      }
    }
  }
}
```

The three forms above are all valid `SampleEntry` shapes:

- **string** — single sample
- **string[]** — round-robin variants
- **{ velTag: string | string[] }** — velocity-layered (each layer can also RR)

Velocity tags: `pp`, `p`, `mp`, `mf`, `f`, `ff`, `default`.

Sample keys are MIDI note names (`C4`, `F#3`, `Bb2`). The `CustomSampler`
pitch-shifts between them, so a patch with just `C2 C3 C4 C5` covers the
whole keyboard.

`color` is one of: `coral`, `amber`, `lime`, `sky`, `lavender`, `peach`,
`mint`, `rose`.
