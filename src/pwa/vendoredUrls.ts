// Pure mapping from absolute sample file paths under <publicDir>/smplr-samples
// to their encoded, rooted public URL paths. Used by the Vite plugin that
// builds the `virtual:vendored-samples` list. Kept framework-free so it is
// unit-testable without Vite.
export function toVendoredUrls(publicDir: string, absPaths: string[]): string[] {
  const normDir = publicDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = `${normDir}/smplr-samples/`
  const out: string[] = []
  for (const raw of absPaths) {
    const p = raw.replace(/\\/g, '/')
    if (!p.startsWith(prefix)) continue
    const rel = p.slice(prefix.length)
    const encoded = rel.split('/').map(encodeURIComponent).join('/')
    out.push(`/smplr-samples/${encoded}`)
  }
  return out
}
