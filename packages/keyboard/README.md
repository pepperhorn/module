# @pepperhorn/keyboard

A client-side React 18 or 19 play-along keyboard with bundled piano and drums, six chord types, and pitch names. It shares the sound-module engine and supports one instance per page. Do not mount it on the same page as `@pepperhorn/sound-module`.

```tsx
import { Keyboard } from '@pepperhorn/keyboard'
import '@pepperhorn/keyboard/styles.css'

<Keyboard defaultMode="chord" defaultChord="min" showNoteNames />
```

Enable audio before playing. Use touch, a mouse, MIDI, or the computer keys A/W/S/E/D/F/T/G/Y/H/U/J/K/O/L/P/;/'. Focus the keyboard to play with the computer keys. Z and X shift the pitched range down or up. Drums use a fixed GM range.

The stylesheet loads the bundled Poppins font from the package. Its stylesheet includes the compiled utilities and does not require Tailwind on the host.

## Initial settings

| Prop | Default |
| --- | --- |
| `defaultPatch` | `piano`. Also accepts `drums` or a built-in patch ID. |
| `defaultMode` | `play` |
| `defaultChord` | `maj`. Also accepts `min`, `dim`, `aug`, `7`, and `maj7`. |
| `showNoteNames` | `false` |
| `accidentals` | `flat` |
| `octaves` | Fits the component width, from two to four. |
| `startOctave` | `3` (C3 is MIDI 48). |
| `assetBaseUrl` | The package’s bundled sample URLs. Set this only to serve the sounds yourself. |
| `className` | Optional class on the root. |

Volume, name spelling, note names, effects, and MIDI device are saved in the browser under `pepperhorn-keyboard:`. Saved preferences take precedence over initial props. The patch, playing mode, chord type and octave shift are not saved.

## Drawers and MIDI

Open Sounds from the current patch name. Piano and Drums are bundled. The other sounds are grouped by bank and stream on selection. The gear opens Effects, with a Settings button alongside it. Turning on an effect at zero sets a starting amount. Raising the amount above zero turns the effect on.

Play the keys while a drawer is open to try a change. Press Escape, press the opening button again, or click outside the drawer and keys to close it.

In Settings, adjust volume, shift the keyboard by up to two octaves, choose sharps or flats, or select a Web MIDI input. Octave shift is disabled for the fixed drum range. Plug in a controller before enabling audio, or use **Check for MIDI devices** in Settings. Select **All inputs** to play from any connected device. Web MIDI requires a supporting browser and permission. Touch and computer keys work without it.

## Astro and Vite

Mount with `<Keyboard client:only="react" />` in Astro 7 with `@astrojs/react`. Keep the library out of Vite dev dependency pre-bundling so its relative asset URLs resolve beside the built JavaScript.

```js
// astro.config.mjs
export default defineConfig({
  integrations: [react()],
  vite: { optimizeDeps: { exclude: ['@pepperhorn/keyboard'] } },
})
```

For Vite without Astro, put `optimizeDeps` at the top level of the Vite config. Vite production builds emit and rewrite the bundled sample URLs. To serve them yourself, copy the contents of `dist/assets/` to a public directory and set `assetBaseUrl` to that directory, for example `/keyboard-assets/`. Keep the `piano/` and `drums/` subdirectories. The built-in catalog uses CDN samples. See `dist/assets/NOTICE` for bundled sample credits.

## Local checks

From the repo root, run `npm run build:keyboard && npm run verify:keyboard`. Verify the packed package in a production Vite host with `node packages/keyboard/e2e/host-build.mjs`. With Chromium and `playwright-core` available, run `node packages/keyboard/e2e/smoke.mjs`. Set `PLAYWRIGHT_MODULE` to the absolute path of a local playwright-core entry if it is not installed in the repo.

Run `node packages/keyboard/e2e/widths.mjs` to check the built keyboard at 360, 390 and 1280 px. It saves screenshots to a temporary directory, or to `KEYBOARD_WIDTH_SCREENSHOTS` if set. Both browser checks accept `CHROMIUM_BIN` for a cached Chromium executable.

## Releasing

Tag a commit that contains the release workflow with `keyboard-v<version>`, using the version in `packages/keyboard/package.json` at that commit. The workflow verifies the package before publishing to npm via OIDC. Tags starting with `v` release `@pepperhorn/sound-module` instead.
