import { describe, expect, it } from 'vitest'
import {
  CHAIN_EFFECT_IDS,
  isChainEffectId,
  moveInOrder,
  normalizeFxOrder,
  type ChainEffectId,
} from './effects'

describe('isChainEffectId', () => {
  it('accepts the audio effects', () => {
    for (const id of CHAIN_EFFECT_IDS) expect(isChainEffectId(id)).toBe(true)
  })

  // The doublers fire notes in AudioEngine.noteOn rather than living in the
  // graph, so they have no position in the chain to move.
  it('rejects the note-level doublers', () => {
    expect(isChainEffectId('doubler1')).toBe(false)
    expect(isChainEffectId('doubler2')).toBe(false)
  })
})

describe('normalizeFxOrder', () => {
  it('keeps a valid order as given', () => {
    const order: ChainEffectId[] = ['reverb', 'delay', 'chorus', 'distortion']
    expect(normalizeFxOrder(order)).toEqual(order)
  })

  it('appends anything missing so no effect is left unwired', () => {
    expect(normalizeFxOrder(['reverb'])).toEqual([
      'reverb',
      'distortion',
      'chorus',
      'delay',
    ])
  })

  it('drops ids that are not part of the audio chain', () => {
    expect(normalizeFxOrder(['doubler1', 'reverb', 'nonsense'])).toEqual([
      'reverb',
      'distortion',
      'chorus',
      'delay',
    ])
  })

  it('drops duplicates rather than wiring an effect in twice', () => {
    expect(normalizeFxOrder(['reverb', 'reverb', 'delay'])).toEqual([
      'reverb',
      'delay',
      'distortion',
      'chorus',
    ])
  })

  it.each([[null], [undefined], ['reverb'], [42], [{}], [[1, 2, 3]]])(
    'falls back to the default order for %s',
    (input) => {
      expect(normalizeFxOrder(input)).toEqual([...CHAIN_EFFECT_IDS])
    },
  )

  it('always returns every effect exactly once', () => {
    const result = normalizeFxOrder(['delay', 'delay', 'bogus'])
    expect([...result].sort()).toEqual([...CHAIN_EFFECT_IDS].sort())
  })
})

describe('moveInOrder', () => {
  const base: ChainEffectId[] = ['distortion', 'chorus', 'delay', 'reverb']

  it('moves an effect later', () => {
    expect(moveInOrder(base, 'distortion', 1)).toEqual([
      'chorus',
      'distortion',
      'delay',
      'reverb',
    ])
  })

  it('moves an effect earlier', () => {
    expect(moveInOrder(base, 'reverb', -1)).toEqual([
      'distortion',
      'chorus',
      'reverb',
      'delay',
    ])
  })

  it('refuses to move past the start', () => {
    expect(moveInOrder(base, 'distortion', -1)).toEqual(base)
  })

  it('refuses to move past the end', () => {
    expect(moveInOrder(base, 'reverb', 1)).toEqual(base)
  })

  it('leaves the original array untouched', () => {
    const copy = [...base]
    moveInOrder(base, 'chorus', 1)
    expect(base).toEqual(copy)
  })

  it('never loses or duplicates an effect', () => {
    let order = base
    for (const [id, delta] of [
      ['reverb', -1],
      ['distortion', 1],
      ['delay', -1],
      ['chorus', 1],
    ] as Array<[ChainEffectId, number]>) {
      order = moveInOrder(order, id, delta)
      expect([...order].sort()).toEqual([...CHAIN_EFFECT_IDS].sort())
    }
  })
})
