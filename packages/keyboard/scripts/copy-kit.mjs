import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const [source] = process.argv.slice(2)
if (!source || process.argv.length !== 3) {
  throw new Error('Usage: node packages/keyboard/scripts/copy-kit.mjs <src-dir>')
}

const destination = new URL('../assets/drums/', import.meta.url)
const manifest = JSON.parse(await readFile(resolve(source, 'kit.json'), 'utf8'))
const files = [...new Set(Object.values(manifest.samples).map(({ file }) => file))]
if (files.length === 0 || files.some(file => typeof file !== 'string' || file !== basename(file) || !file.endsWith('.ogg'))) {
  throw new Error('Expected kit.json to list .ogg sample filenames in the source directory')
}

const fallbackFiles = files.map(file => file.replace(/\.ogg$/, '.m4a'))
const fallbackSizes = await Promise.all(fallbackFiles.map(async file => {
  try {
    return (await stat(resolve(source, file))).size
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return 0
  }
}))
const hasFallback = fallbackSizes.every(size => size > 0)
if (!hasFallback && (fallbackSizes.some(size => size > 0) || manifest.formats?.includes('m4a'))) {
  throw new Error('Source kit has an incomplete .m4a set')
}

await mkdir(destination, { recursive: true })
const audioFiles = hasFallback ? [...files, ...fallbackFiles] : files
for (const file of audioFiles) {
  await copyFile(resolve(source, file), new URL(encodeURIComponent(file), destination))
}
await writeFile(new URL('kit.json', destination), JSON.stringify({
  ...manifest,
  formats: hasFallback ? ['ogg', 'm4a'] : ['ogg'],
}, null, 2) + '\n')
console.log(`Copied ${audioFiles.length} samples from ${manifest.id}`)
