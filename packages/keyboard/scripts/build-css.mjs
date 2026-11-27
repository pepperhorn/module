import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const require = createRequire(import.meta.url)
const pkg = dirname(import.meta.dirname)
const dist = join(pkg, 'dist')
const styles = join(pkg, 'src/styles')
const temp = mkdtempSync(join(tmpdir(), 'keyboard-css-'))

try {
  const manifest = require.resolve('@tailwindcss/cli/package.json')
  const cli = join(dirname(manifest), require(manifest).bin.tailwindcss)
  const out = join(temp, 'utilities.css')
  execFileSync(process.execPath, [cli, '-i', join(styles, 'tailwind.css'), '-o', out, '--optimize'], { stdio: 'inherit' })
  const css = postcss.parse(readFileSync(out, 'utf8'))
  css.walkRules(rule => {
    rule.selector = selectorParser(selectors => {
      selectors.each(selector => {
        const scope = selectorParser().astSync(':where(.keyboard-module, .keyboard-module *)').first.first
        selector.prepend(scope)
      })
    }).processSync(rule.selector)
  })
  const base = readFileSync(join(styles, 'base.css'), 'utf8')
  writeFileSync(join(dist, 'styles.css'), `@layer kb-utilities, kb-base;\n${css}\n@layer kb-base {\n${base}}\n`)
  cpSync(join(styles, 'fonts'), join(dist, 'fonts'), { recursive: true })
  cpSync(join(pkg, 'assets'), join(dist, 'assets'), { recursive: true })
  console.log('keyboard styles and assets copied to dist')
} finally {
  rmSync(temp, { recursive: true, force: true })
}
