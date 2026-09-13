import { beforeEach, describe, expect, it } from 'vitest'
import { buildEffectChain, CHAIN_EFFECT_IDS, type ChainEffectId } from './effects'

/**
 * A recording stand-in for the handful of Web Audio calls the chain makes, so
 * the wiring can be asserted directly. jsdom has no AudioContext, and the graph
 * is the part of reordering that can actually break.
 */
class FakeNode {
  readonly outgoing = new Set<FakeNode>()
  gain = { value: 1 }
  frequency = { value: 0 }
  Q = { value: 0 }
  delayTime = { value: 0 }
  type = ''
  curve: unknown = null
  oversample = ''
  buffer: unknown = null
  normalize = true

  constructor(readonly kind: string) {}

  // Returns the target so `a.connect(b).connect(c)` chains, as it does for real.
  connect(target: FakeNode): FakeNode {
    this.outgoing.add(target)
    return target
  }

  disconnect(target?: FakeNode): void {
    if (target) this.outgoing.delete(target)
    else this.outgoing.clear()
  }

  start(): void {}
  stop(): void {}
}

function fakeContext() {
  const nodes: FakeNode[] = []
  const make = (kind: string) => {
    const node = new FakeNode(kind)
    nodes.push(node)
    return node
  }
  const destination = make('destination')
  const context = {
    sampleRate: 48000,
    destination,
    createGain: () => make('gain'),
    createBiquadFilter: () => make('biquad'),
    createDelay: () => make('delay'),
    createConvolver: () => make('convolver'),
    createOscillator: () => make('oscillator'),
    createWaveShaper: () => make('shaper'),
    createBuffer: (channels: number, length: number, sampleRate: number) => ({
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    }),
  }
  return { context: context as unknown as AudioContext, nodes, destination }
}

/**
 * Every distinct simple path from `from` to `to`. Each effect splits into a dry
 * and a wet branch internally, so a healthy four-effect chain has 2^4 = 16 of
 * them — the count is a fingerprint of the graph, not a defect.
 */
function pathCount(from: FakeNode, to: FakeNode): number {
  let found = 0
  const walk = (node: FakeNode, trail: Set<FakeNode>) => {
    if (node === to) {
      found += 1
      return
    }
    for (const next of node.outgoing) {
      if (trail.has(next)) continue
      trail.add(next)
      walk(next, trail)
      trail.delete(next)
    }
  }
  walk(from, new Set([from]))
  return found
}

/** Nodes reachable from `from`, so the routed set can be compared across orders. */
function reachable(from: FakeNode): Set<FakeNode> {
  const seen = new Set<FakeNode>([from])
  const queue = [from]
  while (queue.length > 0) {
    for (const next of queue.pop()!.outgoing) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

function totalEdges(nodes: FakeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.outgoing.size, 0)
}

describe('buildEffectChain wiring', () => {
  let harness: ReturnType<typeof fakeContext>
  let chain: ReturnType<typeof buildEffectChain>

  beforeEach(() => {
    harness = fakeContext()
    chain = buildEffectChain(harness.context)
  })

  const entry = () => chain.inputNode as unknown as FakeNode
  const master = () => chain.master as unknown as FakeNode
  /** The node the entry feeds: identifies whichever effect is currently first. */
  const firstStage = () => [...entry().outgoing][0]

  it('starts on the default order and reaches the destination', () => {
    expect(chain.getOrder()).toEqual([...CHAIN_EFFECT_IDS])
    expect(master().outgoing.has(harness.destination as unknown as FakeNode)).toBe(true)
  })

  // The reason the chain has a dedicated entry node at all: instruments are
  // wired to inputNode at construction and kept in the engine's LRU cache, so
  // if reordering changed which node that was, every cached instrument would
  // go silent.
  it('keeps inputNode identity across reorders', () => {
    const before = chain.inputNode
    chain.setOrder(['reverb', 'delay', 'chorus', 'distortion'])
    chain.setOrder(['chorus', 'reverb', 'distortion', 'delay'])
    expect(chain.inputNode).toBe(before)
  })

  it('feeds exactly one stage and is fed by exactly one', () => {
    expect(entry().outgoing.size).toBe(1)
    const intoMaster = harness.nodes.filter((n) => n.outgoing.has(master()))
    expect(intoMaster.length).toBe(1)
  })

  it('puts the requested effect first, distinctly for each one', () => {
    const seen = new Map<ChainEffectId, FakeNode>()
    for (const id of CHAIN_EFFECT_IDS) {
      chain.setOrder([id])
      expect(chain.getOrder()[0]).toBe(id)
      seen.set(id, firstStage())
    }
    // Four effects first ⇒ four different entry targets: the order is really
    // driving the wiring, not just the reported state.
    expect(new Set(seen.values()).size).toBe(CHAIN_EFFECT_IDS.length)

    // And it is deterministic — asking again lands on the same node.
    for (const [id, node] of seen) {
      chain.setOrder([id])
      expect(firstStage()).toBe(node)
    }
  })

  it('routes through the same nodes whatever the order', () => {
    chain.setOrder([...CHAIN_EFFECT_IDS])
    const forward = reachable(entry())
    chain.setOrder(['reverb', 'delay', 'chorus', 'distortion'])
    expect(reachable(entry())).toEqual(forward)
  })

  // A reorder that forgot to tear the old edges down would still sound roughly
  // right at first, while quietly duplicating the signal down stale branches.
  it('does not accumulate stale connections as the order changes', () => {
    const edges = totalEdges(harness.nodes)
    const paths = pathCount(entry(), master())
    expect(paths).toBe(2 ** CHAIN_EFFECT_IDS.length)

    for (const order of [
      ['reverb', 'delay', 'chorus', 'distortion'],
      ['chorus', 'distortion', 'reverb', 'delay'],
      ['delay', 'reverb', 'distortion', 'chorus'],
      [...CHAIN_EFFECT_IDS],
    ] as ChainEffectId[][]) {
      chain.setOrder(order)
      expect(totalEdges(harness.nodes)).toBe(edges)
      expect(pathCount(entry(), master())).toBe(paths)
    }
  })

  it('repairs an order that is missing effects rather than unwiring them', () => {
    chain.setOrder(['reverb'] as ChainEffectId[])
    expect([...chain.getOrder()].sort()).toEqual([...CHAIN_EFFECT_IDS].sort())
    expect(pathCount(entry(), master())).toBe(2 ** CHAIN_EFFECT_IDS.length)
  })

  it('still routes to the master after every effect is bypassed', () => {
    for (const id of CHAIN_EFFECT_IDS) chain.setEnabled(id, false)
    chain.setOrder(['delay', 'chorus', 'reverb', 'distortion'])
    expect(pathCount(entry(), master())).toBe(2 ** CHAIN_EFFECT_IDS.length)
  })
})
