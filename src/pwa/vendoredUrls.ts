// Pure mapping from absolute sample file paths under <publicDir>/smplr-samples
// to their rooted public URL paths. The on-disk filenames are already the
// exact percent-encoded strings the CDN used (the vendor script saves files at
// `new URL(cdnUrl).pathname`), and loggedStorage.ts requests that same string
// at runtime. So we emit the relative path VERBATIM — re-encoding it would
// produce a URL that never matches the runtime request and the service-worker
// cache (keyed by request URL) would miss offline. Kept framework-free so it is
// unit-testable without Vite.
export function toVendoredUrls(publicDir: string, absPaths: string[]): string[] {
  const normDir = publicDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = `${normDir}/smplr-samples/`
  const out: string[] = []
  for (const raw of absPaths) {
    const p = raw.replace(/\\/g, '/')
    if (!p.startsWith(prefix)) continue
    const rel = p.slice(prefix.length)
    out.push(`/smplr-samples/${rel}`)
  }
  return out
}
