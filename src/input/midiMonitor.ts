// Live MIDI readings for the controls screen. Written on the hot MIDI path with
// plain field assignments (no React, no zustand), read by the breath meter in
// requestAnimationFrame while the sheet is open.

export const breathMonitor = {
  /** Last value on the configured breath CC, or -1 if none has arrived. */
  raw: -1,
  /** Last CC of any number, so "breath on the wrong CC" is visible. */
  lastCc: -1,
  lastCcValue: 0,
  /** performance.now() of the last breath-CC message. */
  at: 0,
}

export function resetBreathMonitor(): void {
  breathMonitor.raw = -1
  breathMonitor.lastCc = -1
  breathMonitor.lastCcValue = 0
  breathMonitor.at = 0
}
