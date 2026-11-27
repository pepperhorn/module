export class VoiceTracker {
  private keys = new Map<number, number[]>()
  private counts = new Map<number, number>()

  press(key: number, notes: number[]): number[] {
    if (this.keys.has(key)) return []
    const unique = [...new Set(notes)]
    this.keys.set(key, unique)
    const starts: number[] = []
    for (const n of unique) {
      const c = this.counts.get(n) ?? 0
      this.counts.set(n, c + 1)
      if (c === 0) starts.push(n)
    }
    return starts
  }

  release(key: number): number[] {
    const notes = this.keys.get(key)
    if (!notes) return []
    this.keys.delete(key)
    const stops: number[] = []
    for (const n of notes) {
      const c = (this.counts.get(n) ?? 0) - 1
      if (c <= 0) {
        this.counts.delete(n)
        stops.push(n)
      } else {
        this.counts.set(n, c)
      }
    }
    return stops
  }

  held(): ReadonlySet<number> {
    return new Set(this.counts.keys())
  }

  roots(): ReadonlySet<number> {
    return new Set(this.keys.keys())
  }
}
