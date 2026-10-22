// @vitest-environment node
/**
 * Guards the promise the embed stylesheet makes to a host page (becreative,
 * which runs its own Tailwind v4): every rule only matches inside
 * `.sound-module`, no preflight or :root/html/body rules leak out, Tailwind's
 * internals and the keyframes are renamed, and fonts ship separately.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import postcss, { type Root, type Rule } from 'postcss'
import { buildStyles, SCOPE } from '../../packages/sound-module/scripts/build-css.mjs'

let css = ''
let root: Root
const rules: Rule[] = []

beforeAll(async () => {
  css = await buildStyles()
  root = postcss.parse(css)
  root.walkRules((rule) => {
    const parent = rule.parent
    if (parent?.type === 'atrule' && /keyframes$/.test((parent as postcss.AtRule).name)) return
    rules.push(rule)
  })
}, 60_000)

describe('styles.css', () => {
  it('scopes every selector to .sound-module', () => {
    const unscoped = rules
      .flatMap((r) => r.selectors)
      .filter((s) => !s.includes(SCOPE))
      // Tailwind's fallback for browsers without @property: it only sets the module's own variables.
      .filter((s) => !['*', '::before', '::after', '::backdrop'].includes(s.trim()))
    expect(unscoped).toEqual([])
  })

  it('has no global selectors', () => {
    expect(
      rules
        .flatMap((r) => r.selectors)
        .filter((s) => /^(html|body|:root|:host|button|input|svg|\*)\b/.test(s.trim()) && !/^\*$/.test(s.trim())),
    ).toEqual([])
  })

  it('renames Tailwind internals and converts rem', () => {
    expect(css).not.toMatch(/--tw-/)
    // Values and media queries only: arbitrary-value class names such as
    // `.max-w-\[10rem\]` keep `rem` in the selector, which is just a name.
    const remUses: string[] = []
    root.walkDecls((d) => void (/\d(rem)\b/.test(d.value) && remUses.push(`${d.prop}: ${d.value}`)))
    root.walkAtRules((at) => void (/\d(rem)\b/.test(at.params) && remUses.push(`@${at.name} ${at.params}`)))
    expect(remUses).toEqual([])
    root.walkAtRules('property', (at) => expect(at.params).toMatch(/^--sm-tw-/))
  })

  it('prefixes every keyframe and its uses', () => {
    root.walkAtRules(/keyframes$/, (at) => expect(at.params).toMatch(/^sm-/))
    root.walkDecls(/^animation(-name)?$/, (d) => expect(d.value).toMatch(/\bsm-[a-z-]+/))
  })

  it('declares the theme and material tokens on the root, dark and light', () => {
    const dark = rules.find(
      (r) => r.selector === '.sound-module' && r.some((n) => n.type === 'decl' && n.prop === '--color-coral'),
    )
    expect(dark).toBeTruthy()
    for (const p of ['--font-mono', '--font-legend', '--face-bg', '--scrim', '--card-bg']) expect(css).toContain(p)
    const light = rules.find((r) => r.selector === '.sound-module:where([data-theme="light"])')!
    // Lightning CSS lowercases hex colours, as in the app's own build.
    expect(css).not.toContain('.sound-module[data-theme')
    expect(light.toString()).toMatch(/--color-text: #26241F/i)
  })

  it('leaves the root box to the host: no margin, padding or border on .sound-module itself', () => {
    const boxProps = rules
      .filter((r) => r.selectors.some((sel) => sel.trim() === SCOPE))
      .flatMap((r) => r.nodes.filter((n): n is postcss.Declaration => n.type === 'decl'))
      .map((d) => d.prop)
      .filter((p) => /^(margin|padding|border)(-|$)/.test(p))
    expect(boxProps).toEqual([])
  })

  it('includes the component classes and the utilities the embed uses, scoped', () => {
    for (const s of ['.hw-btn:where(.sound-module, .sound-module *)', '.legend:where(', '.inset-0:where(', '.font-mono:where('])
      expect(css).toContain(s)
  })

  it('declares the sm- layer order with components below utilities (Tailwind order)', () => {
    const statements: string[] = []
    root.walkAtRules('layer', (at) => {
      if (!at.nodes) statements.push(at.params)
    })
    expect(statements.length).toBeGreaterThan(0)
    const order = statements[0].split(',').map((s) => s.trim())
    expect(order).toEqual(['sm-properties', 'sm-theme', 'sm-base', 'sm-components', 'sm-utilities'])
    // Every layer the stylesheet uses is named in the order statement, so none
    // is appended (and so outranks the utilities) by first use.
    const used = new Set<string>()
    root.walkAtRules('layer', (at) => {
      if (at.nodes) used.add(at.params.trim())
    })
    for (const l of used) expect(order).toContain(l)
  })

  it('does not bundle fonts', () => {
    expect(css).not.toMatch(/@font-face|@import/)
  })
})
