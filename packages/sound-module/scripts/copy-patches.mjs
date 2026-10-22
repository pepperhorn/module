/**
 * Copies public/patches/** (the CST patch audio) into dist/patches/**, so a
 * host can serve it from its own origin. The folder's README.md stays behind.
 */
import { cpSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(pkgRoot, '../../public/patches');
const target = join(pkgRoot, 'dist/patches');

rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) => basename(path) !== 'README.md',
});
console.log(`copied ${source} → ${target}`);
