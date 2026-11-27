import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const dist = new URL('../dist/', import.meta.url)
const read = name => readFileSync(new URL(name, dist), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './styles.css'])
const types = pkg.exports['.'].types.replace(/^\.\/dist\//, '')
assert.ok(read(types).includes('Keyboard'))
assert.deepEqual(Object.keys(await import(new URL('index.js', dist))), ['Keyboard'])

const { assets, modules } = JSON.parse(read('inventory.json'))
assert.ok(assets.length > 0, 'no bundled sampler assets declared')
for (const asset of assets) {
  assert.match(asset, /^assets\/(piano|drums)\/[\w#.-]+\.(ogg|m4a|mp3)$/)
  assert.ok(statSync(new URL(asset, dist)).size > 0, `empty asset: ${asset}`)
}
assert.ok(modules.includes('packages/keyboard/src/Keyboard.tsx'))
const forbidden = /(?:^|\/)(?:AuthModal|Rack|DebugPanel|useAuth)(?:[./]|$)/
for (const id of modules) assert.doesNotMatch(id, forbidden)
assert.doesNotMatch(read('index.js'), /\b(?:AuthModal|DebugPanel|useAuth|registerSW)\b/)
for (const asset of ['piano/notes.json', 'drums/kit.json', 'NOTICE']) {
  assert.ok(read(join('assets', asset)).trim())
}

for (const weight of [400, 600]) {
  assert.ok(statSync(new URL(`fonts/poppins-latin-${weight}-normal.woff2`, dist)).size > 0)
}
assert.ok(read('fonts/OFL.txt').trim())

const css = postcss.parse(read('styles.css'))
let count = 0
css.walkRules(rule => {
  selectorParser(selectors => {
    selectors.each(selector => {
      const first = selector.first
      const combinator = selector.nodes.find(node => node.type === 'combinator')
      const root = first.type === 'class' && first.value === 'keyboard-module' &&
        (!combinator || [' ', '>'].includes(combinator.value))
      const utility = !combinator && first.toString() === ':where(.keyboard-module, .keyboard-module *)'
      assert.ok(root || utility, `unscoped selector: ${selector}`)
      count++
    })
  }).processSync(rule.selector)
})
assert.ok(count > 0, 'missing styles')
console.log(`keyboard dist OK (1 export, ${assets.length} sampler files, ${count} scoped selectors)`)
