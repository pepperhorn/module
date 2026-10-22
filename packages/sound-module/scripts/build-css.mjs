/**
 * Builds dist/styles.css — the sound module's self-contained stylesheet, which
 * a host (becreative, itself on Tailwind v4) can load without running
 * Tailwind — and copies dist/fonts.css.
 *
 * 1. Tailwind compiles src/embed/styles/tailwind.css: the theme tokens, the
 *    shared materials/components CSS and the utilities the embed's sources
 *    use. No preflight; src/embed/styles/base.css is the scoped stand-in.
 * 2. The output is made host-independent:
 *    - `:root`, `:host` and `html` become `.sound-module` (the theme tokens
 *      and the [data-theme="light"] overrides live on the module root);
 *    - every other rule is scoped to `.sound-module` and its descendants
 *      with `:where()`, so specificity is unchanged;
 *    - Tailwind's `--tw-*` custom properties (and their `@property`
 *      registrations) become `--sm-tw-*`, and its cascade layers are
 *      prefixed `sm-`, so nothing merges with a host's Tailwind;
 *    - every `@keyframes X` becomes `sm-X`, with the animations using it;
 *    - `rem` becomes `px` (1rem = 16px), so a host's root font size is moot.
 * 3. The base rules go in the `sm-base` layer, ahead of `sm-utilities`, the
 *    same order the standalone app has (preflight, utilities, then the
 *    unlayered materials/components).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '../..');
const stylesDir = join(repoRoot, 'src/embed/styles');
const dist = join(pkgRoot, 'dist');
const require = createRequire(import.meta.url);

export const SCOPE = '.sound-module';
const SCOPE_CLASS = SCOPE.slice(1);
const SCOPE_PSEUDO = `:where(${SCOPE}, ${SCOPE} *)`;
const VAR_PREFIX = '--sm-tw-';
const NAME_PREFIX = 'sm-';
const LAYERS = ['properties', 'theme', 'base', 'components', 'utilities'];
const LAYER_ORDER = `@layer ${['properties', 'theme', 'base', 'utilities'].map((l) => NAME_PREFIX + l).join(', ')};`;

function compileTailwind() {
  const tmp = mkdtempSync(join(tmpdir(), 'sm-css-'));
  const out = join(tmp, 'tailwind.css');
  try {
    const cliPkg = require.resolve('@tailwindcss/cli/package.json');
    const cli = join(dirname(cliPkg), require(cliPkg).bin.tailwindcss);
    // --optimize (Lightning CSS, no minification) flattens nesting, as the app's Vite build does.
    execFileSync(process.execPath, [cli, '-i', join(stylesDir, 'tailwind.css'), '-o', out, '--optimize'], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const isRootNode = (n) =>
  (n.type === 'pseudo' && (n.value === ':root' || n.value === ':host')) || (n.type === 'tag' && n.value === 'html');

/**
 * `:root[data-theme="light"]` → `.sound-module[data-theme="light"]`;
 * `.flex` → `.flex:where(.sound-module, .sound-module *)` (after the first class).
 */
const scopeSelector = selectorParser((selectors) => {
  const seen = new Set();
  selectors.each((selector) => {
    const head = selector.nodes[0];
    if (head && isRootNode(head)) head.replaceWith(selectorParser.className({ value: SCOPE_CLASS }));
    const text = selector.toString().trim();
    if (seen.has(text)) return void selector.remove(); // `:root, :host` → one `.sound-module`
    seen.add(text);
    if (text.startsWith(SCOPE)) return;
    let first;
    selector.walkClasses((n) => {
      first ??= n; // may sit inside `:where(.space-y-1 > …)`
    });
    if (!first) throw new Error(`Cannot scope selector without a class: ${text}`);
    first.parent.insertAfter(first, selectorParser.pseudo({ value: SCOPE_PSEUDO }));
  });
});

const remToPx = (value) =>
  value.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${+(parseFloat(n) * 16).toFixed(4)}px`);

const renameLayers = (params) =>
  params.replace(new RegExp(`(?<![\\w-])(${LAYERS.join('|')})(?![\\w-])`, 'g'), `${NAME_PREFIX}$1`);

/** PostCSS plugin: root rewrite, scoping, renamed internals/layers/keyframes, rem → px. */
const hostIndependent = () => ({
  postcssPlugin: 'sm-host-independent',
  Once(css) {
    const keyframes = new Set();
    css.walkAtRules((at) => {
      if (at.name === 'property') at.params = at.params.replace(/^--tw-/, VAR_PREFIX);
      else if (at.name === 'layer') at.params = renameLayers(at.params);
      else if (at.name === 'media' || at.name === 'supports' || at.name === 'container') at.params = remToPx(at.params);
      else if (/keyframes$/.test(at.name) && !at.params.startsWith(NAME_PREFIX)) {
        keyframes.add(at.params);
        at.params = NAME_PREFIX + at.params;
      }
    });
    const keyframeUse = keyframes.size
      ? new RegExp(`(?<![\\w-])(${[...keyframes].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g')
      : null;
    css.walkRules((rule) => {
      const parent = rule.parent;
      if (parent?.type === 'atrule' && /keyframes$/.test(parent.name)) return;
      // Tailwind's fallback for browsers without @property: `*, ::before, …` setting only internal variables.
      const internalsOnly = rule.nodes.every((n) => n.type !== 'decl' || n.prop.startsWith('--tw-'));
      if (/^\*/.test(rule.selector) && internalsOnly) {
        // Lightning CSS writes `:before`; keep the standard double colon.
        rule.selectors = rule.selectors.map((sel) => sel.replace(/^:(before|after)$/, '::$1'));
        return;
      }
      rule.selector = scopeSelector.processSync(rule.selector);
    });
    const animateTokens = new Map();
    css.walkDecls((decl) => {
      if (decl.prop.startsWith('--tw-')) decl.prop = VAR_PREFIX + decl.prop.slice(5);
      let value = remToPx(decl.value.replace(/--tw-/g, VAR_PREFIX));
      if (keyframeUse && /^(animation(-name)?|--animate-.*)$/.test(decl.prop)) value = value.replace(keyframeUse, `${NAME_PREFIX}$1`);
      decl.value = value;
      if (decl.prop.startsWith('--animate-')) animateTokens.set(decl.prop, value);
    });
    // `animation: var(--animate-pulse)` → the token's value, so the renamed
    // keyframe is named where it is used and no host token can stand in.
    css.walkDecls(/^animation$/, (decl) => {
      decl.value = decl.value.replace(/var\((--animate-[\w-]+)\)/g, (m, name) => animateTokens.get(name) ?? m);
    });
  },
});

/** `@pepperhorn/sound-module vX.Y.Z`, or just the name before the package manifest exists. */
function packageLabel() {
  const manifest = join(pkgRoot, 'package.json');
  if (!existsSync(manifest)) return '@pepperhorn/sound-module';
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  return `${pkg.name} v${pkg.version}`;
}

export async function buildStyles() {
  const compiled = await postcss([hostIndependent()]).process(compileTailwind(), { from: undefined });
  if (/--tw-/.test(compiled.css)) throw new Error('styles.css still contains --tw-');
  compiled.root.walkDecls((d) => {
    if (/\d+rem\b/.test(d.value)) throw new Error(`styles.css still uses rem: ${d.prop}: ${d.value}`);
  });
  const base = readFileSync(join(stylesDir, 'base.css'), 'utf8');
  const banner = `/*! ${packageLabel()} — precompiled styles. Generated with Tailwind CSS (MIT License, https://tailwindcss.com), scoped to ${SCOPE}. */\n`;
  return (
    banner +
    LAYER_ORDER +
    '\n' +
    `@layer ${NAME_PREFIX}base {\n${base}}\n` +
    compiled.css.replace(/^\/\*![^]*?\*\/\n?/, '')
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dist, { recursive: true });
  const css = await buildStyles();
  writeFileSync(join(dist, 'styles.css'), css);
  copyFileSync(join(stylesDir, 'fonts.css'), join(dist, 'fonts.css'));
  console.log(`dist/styles.css  ${(Buffer.byteLength(css) / 1024).toFixed(1)} kB`);
}
