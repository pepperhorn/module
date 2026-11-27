export interface DrumPad {
  midi: number
  sample: string
  label: string
  short: string
}

function pads(notes: number[], sample: string, label: string, short: string): DrumPad[] {
  return notes.map(midi => ({ midi, sample, label, short }))
}

export const DRUM_RANGE = { low: 35, high: 59 }

export const DRUM_MAP: readonly DrumPad[] = [
  ...pads([35, 36], 'kick', 'Kick', 'Kick'),
  ...pads([37], 'crossstick', 'Side stick', 'Stick'),
  ...pads([38], 'snare-on1', 'Snare', 'Snare'),
  ...pads([40], 'snare-on2', 'Snare 2', 'Snr 2'),
  ...pads([41, 43], 'floor-tom', 'Floor tom', 'Fl Tom'),
  ...pads([42], 'hh-closed1', 'Closed hi-hat', 'HH'),
  ...pads([44], 'hh-foot', 'Pedal hi-hat', 'Ped HH'),
  ...pads([46], 'hh-open', 'Open hi-hat', 'Open HH'),
  ...pads([45, 47, 48, 50], 'hi-tom', 'Tom', 'Tom'),
  ...pads([49, 57], 'crash', 'Crash', 'Crash'),
  ...pads([51, 59], 'ride', 'Ride', 'Ride'),
  ...pads([53], 'ride-bell', 'Ride bell', 'Bell'),
].sort((a, b) => a.midi - b.midi)

export function drumPadFor(midi: number): DrumPad | undefined {
  return DRUM_MAP.find(pad => pad.midi === midi)
}
