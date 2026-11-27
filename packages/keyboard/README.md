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
| `assetBaseUrl` | The `assets/` directory beside the built JS. |
| `className` | Optional class on the root. |

Volume, name spelling, note names, effects, and MIDI device are saved in the browser under `pepperhorn-keyboard:`. Saved preferences take precedence over initial props. The patch, playing mode, chord type and octave shift are not saved.

## Astro and Vite

Mount with `<Keyboard client:only="react" />` in Astro 7 with `@astrojs/react`. Keep the library out of Vite dev dependency pre-bundling so its relative asset URLs resolve beside the built JavaScript.

```js
// astro.config.mjs
export default defineConfig({
  integrations: [react()],
  vite: { optimizeDeps: { exclude: ['@pepperhorn/keyboard'] } },
})
```

For Vite without Astro, put `optimizeDeps` at the top level of the Vite config. If the host relocates the library JS, copy the contents of `dist/assets/` to a public directory and set `assetBaseUrl` to that directory, for example `/keyboard-assets/`. Keep the `piano/` and `drums/` subdirectories. The built-in catalog uses CDN samples. See `dist/assets/NOTICE` for bundled sample credits.

## Local checks

From the repo root, run `npm run build:keyboard && npm run verify:keyboard`. With Chromium and `playwright-core` available, run `node packages/keyboard/e2e/smoke.mjs`. Set `PLAYWRIGHT_MODULE` to the absolute path of a local playwright-core entry if it is not installed in the repo.
