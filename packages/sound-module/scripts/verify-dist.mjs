/**
 * Checks packages/sound-module/dist before it is packed or published: the
 * entry, styles, types and patch audio are present, the bundle carries no
 * PWA/offline code and no inlined React, and every patch file matches its
 * source under public/patches. Exits non-zero on any failure.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '../..');
const dist = join(pkgRoot, 'dist');
const sourcePatches = join(repoRoot, 'public/patches');

const errors = [];

const REQUIRED = [
  'index.js',
  'styles.css',
  'fonts.css',
  'types/embed/index.d.ts',
  'patches/sine-key/C4.wav',
  'patches/poly-bass/C2.wav',
];
for (const file of REQUIRED) {
  const path = join(dist, file);
  if (!existsSync(path) || statSync(path).size === 0) errors.push(`missing or empty: dist/${file}`);
}

const indexPath = join(dist, 'index.js');
if (existsSync(indexPath)) {
  const bundle = readFileSync(indexPath, 'utf8');
  // `module-cdn-v1` and `/smplr-samples/` are not banned: they live in shared
  // code (loggedStorage's Cache API and vendored-sample tiers) that the embed
  // switches off at runtime with configureSampleSource({ mode: 'cdn' }),
  // covered by src/audio/loggedStorage.test.ts.
  for (const banned of ['registerSW', 'virtual:', 'workbox', 'serviceWorker']) {
    if (bundle.includes(banned)) errors.push(`dist/index.js contains app-only code: ${banned}`);
  }
  for (const marker of ['react.production', '__SECRET_INTERNALS']) {
    if (bundle.includes(marker)) errors.push(`dist/index.js inlines React: ${marker}`);
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const distPatches = join(dist, 'patches');
if (existsSync(distPatches)) {
  for (const path of walk(distPatches)) {
    const rel = relative(distPatches, path);
    const source = join(sourcePatches, rel);
    if (!existsSync(source)) errors.push(`dist/patches/${rel} has no source in public/patches`);
    else if (!readFileSync(source).equals(readFileSync(path))) errors.push(`dist/patches/${rel} differs from public/patches/${rel}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`verify-dist: ${e}`);
  process.exit(1);
}
console.log('sound-module dist OK');
