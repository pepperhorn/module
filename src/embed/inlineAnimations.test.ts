// @vitest-environment node
/**
 * The embed's styles.css renames every keyframe `sm-*`, so a component that
 * names a keyframe in an inline style or an injected <style> must use the
 * `sm-` name too: a bare name would silently not animate inside the embed,
 * and an injected global `@keyframes X` would leak into the host page.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const src = resolve(__dirname, '..')
// A regex, not a list of strings: the app's Tailwind scans src/ (tests too),
// and a quoted timing-function keyword would emit a utility class.
const KEYWORD =
  /^(none|linear|ease(-(in|out|in-out))?|step-(start|end)|infinite|normal|reverse|alternate(-reverse)?|forwards|backwards|both|running|paused|initial|inherit|unset)$/

const files = ['components', 'embed'].flatMap((dir) =>
  readdirSync(join(src, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx') && !/\.test\.tsx$/.test(f))
    .map((f) => join(src, dir, f)),
)

/** Keyframe names in an `animation` value: the identifiers that are not keywords or functions. */
const keyframeNames = (value: string) =>
  value
    .replace(/[a-z-]+\([^)]*\)/gi, ' ') // cubic-bezier(…), steps(…), var(…)
    .split(/[\s,]+/)
    .filter((t) => /^[a-z_][\w-]*$/i.test(t) && !KEYWORD.test(t))

describe('inline animations in the embed sources', () => {
  it('scans the component and embed sources', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('name only sm- keyframes', () => {
    const bad: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/animation(?:Name)?\s*:\s*(['"`])(.*?)\1/g))
        for (const name of keyframeNames(m[2]))
          if (!name.startsWith('sm-')) bad.push(`${relative(src, file)}: ${m[0]}`)
      for (const m of text.matchAll(/@keyframes\s+([\w-]+)/g))
        if (!m[1].startsWith('sm-')) bad.push(`${relative(src, file)}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })
})
