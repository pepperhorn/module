/**
 * Whether an overlay's Escape handler (bound on window) should act on `e`.
 * Full-screen app overlays own the whole page, so any Escape counts. A
 * contained (embed) overlay only answers Escape pressed inside the element it
 * is drawn in — the module root — so Escape elsewhere on the host page is left
 * to the host.
 */
export function escapeIsForOverlay(
  e: KeyboardEvent,
  overlay: HTMLElement | null,
  contained: boolean,
): boolean {
  if (!contained) return true
  const host = overlay?.parentElement ?? overlay
  return !!host && e.target instanceof Node && host.contains(e.target)
}
