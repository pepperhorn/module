# @pepperhorn/sound-module

An embeddable React sound module: a sampled-instrument rack with an LCD patch
strip, a patch browser, a labelled on-screen piano, computer-keyboard play and
Web MIDI input. It is the same engine as the standalone PepperHorn Module app,
without any of the app's offline/PWA machinery.

## Install

```sh
npm install @pepperhorn/sound-module
```

`react` and `react-dom` (18 or 19) are peer dependencies.

## Usage

```tsx
import { SoundModule } from '@pepperhorn/sound-module'
import '@pepperhorn/sound-module/fonts.css' // optional
import '@pepperhorn/sound-module/styles.css' // required

export function Synth() {
  return (
    <div className="my-synth-wrapper mx-auto max-w-3xl">
      <SoundModule assetBaseUrl="" theme="dark" octaves={2} />
    </div>
  )
}
```

The component must be rendered client-side only (in Astro, `client:only="react"`).

### Stylesheets

- **`@pepperhorn/sound-module/styles.css` (required).** Precompiled, scoped to
  `.sound-module`, with no global resets. Its rules sit in `sm-*` cascade layers
  (`sm-properties`, `sm-theme`, `sm-base`, `sm-utilities`) plus unlayered
  component rules. **Load it after the host's global CSS**, so the `sm-*` layers
  are declared after the host's own layers. Note that unlayered host element
  rules (for example a bare `button { … }` outside any `@layer`) beat layered
  rules and can still leak in; keep host element styles layered or scoped.
- **`@pepperhorn/sound-module/fonts.css` (optional).** `@fontsource` imports for
  Michroma, Chakra Petch, Inter and JetBrains Mono. Skip it if the host already
  loads these fonts.

### Props

| Prop | Type | Default | |
|---|---|---|---|
| `assetBaseUrl` | `string` | — | Base URL that serves `/patches/**`. Pass `""` for same-origin. Omit it to hide the patches that need these files (the CST bank). |
| `theme` | `'dark' \| 'light'` | `'dark'` | Applied to the component root only (`data-theme`); `<html>` is not touched. |
| `octaves` | `number` | `2` | On-screen piano octaves (2 = 25 keys). |
| `className` | `string` | — | Extra classes on the root element. |

### Root element and theming

The root renders as
`<div class="sound-module sm-root …" data-theme="dark|light" tabindex="0">`.
The module sets its own typography on the root and has no box reset, so put
host spacing, sizing and typography classes **on a wrapper element**, not on
`className`. Use `className` only for hooks that do not fight the module's own
styles.

Theme tokens (`--color-*`, `--face-bg`, `--card-bg`, …) can be overridden with a
selector of specificity at least `(0,2,0)`; this holds for both themes, as the
module's own theme rules are `(0,1,0)`:

```css
.my-page .sound-module { --color-coral: #ff6f61; }
```

### Keyboard focus

The computer keyboard plays only while focus is inside the module; clicking or
pressing the on-screen piano focuses it. MIDI and breath input play regardless
of focus.

## Patch audio

Some patches play audio files shipped with the package at
`dist/patches/<folder>/<file>.wav` (currently `poly-bass/` and `sine-key/`).
Copy the **contents** of that folder into your public `patches/` directory so
that, with `assetBaseUrl=""`, `/patches/sine-key/C4.wav` resolves on your own
origin. Locate the package directory with:

```js
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const patchesDir = join(dirname(require.resolve('@pepperhorn/sound-module/package.json')), 'dist/patches')
```

The files are also exported individually as `@pepperhorn/sound-module/patches/*`.

## Host requirements

- **CSP:** `connect-src` must allow `https://smpldsnds.github.io`,
  `https://gleitz.github.io` and `https://goldst.dev` (sample CDNs), plus your
  own origin (or `assetBaseUrl`) for the patch audio.
- **Permissions-Policy:** `midi=(self)` on pages that host the module, for Web
  MIDI input.
- **One instance per page.** The module shares one audio engine and one store.

## Storage keys

The module uses `localStorage` on the host origin:

| Key | Contents |
|---|---|
| `module:state:v1` | Current patch, octave and velocity only |
| `module:midi-map:v1` | MIDI mappings |
| `module:midi-enabled:v1` | Whether MIDI input is enabled |
| `module:favourites:v1` | Favourite patches |
| `module:ui:v1` | Read only, ignored |

## License

MIT © 2026 PepperHorn
