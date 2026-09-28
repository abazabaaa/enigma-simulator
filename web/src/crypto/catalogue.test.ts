import { beforeAll, describe, expect, it } from 'vitest'
import { normalizeConfig } from '../engine'
import { createRng, randLetter } from '../lib/rng'
import { pairedPartitions } from '../lib/keyspace'
import {
  CATALOGUE_ORDERS,
  buildCatalogue,
  buildPackedCatalogue,
  catalogueStats,
  characteristicAt,
  unpackCatalogue,
  type Catalogue,
} from './catalogue'
import { clearCatalogueCache, getCatalogue } from './catalogueClient'
import { dayKey } from './generators'
import { characteristic, productsFromMachine } from './rejewski'

let catalogue: Catalogue
let buildMs = 0

beforeAll(() => {
  const t = performance.now()
  catalogue = buildCatalogue({ reflector: 'A' })
  buildMs = performance.now() - t
  console.info(`[timing] buildCatalogue (UKW-A, 6 orders, 105,456 settings) in Node: ${buildMs.toFixed(0)} ms`)
})

describe('buildCatalogue', () => {
  it('files 105,456 settings (6 orders × 17,576) within the time budget', () => {
    const s = catalogueStats(catalogue)
    expect(s.entries).toBe(105456)
    expect(s.distinct).toBeLessThanOrEqual(pairedPartitions() ** 3)
    expect(s.distinct).toBeGreaterThan(1000)
    expect(s.histogram.reduce((sum, h) => sum + h.size * h.count, 0)).toBe(105456)
    expect(s.histogram.reduce((sum, h) => sum + h.count, 0)).toBe(s.distinct)
    expect(s.maxBucket).toBe(s.histogram.at(-1)!.size)
    expect(buildMs).toBeLessThan(10_000)
  })

  it('every key is a paired characteristic and every setting appears exactly once', () => {
    const seen = new Set<string>()
    for (const [key, list] of catalogue) {
      expect(key).toMatch(/^AD:[\d.]+ BE:[\d.]+ CF:[\d.]+$/)
      for (const part of key.split(' ')) {
        const lengths = part.slice(3).split('.').map(Number)
        expect(lengths.reduce((a, b) => a + b, 0)).toBe(26)
      }
      for (const e of list) seen.add(`${e.rotors.join('-')}:${e.positions}`)
    }
    expect(seen.size).toBe(105456)
    expect(CATALOGUE_ORDERS).toHaveLength(6)
  })

  it('characteristicAt equals the engine’s products, stepping included', () => {
    const r = createRng(11)
    // positions whose six presses carry the middle rotor (and double-step it): right at Q/E/V − k, middle at notch
    const special = ['AAQ', 'ADU', 'ADV', 'AEV', 'QEV', 'BDS', 'ZZT', 'AQO', 'AVQ']
    for (let k = 0; k < 300; k++) {
      const order = CATALOGUE_ORDERS[k % 6]!
      const positions = k < special.length ? special[k]! : randLetter(r) + randLetter(r) + randLetter(r)
      const day = normalizeConfig({ model: 'I', reflector: 'A', rotors: order, rings: 'AAA', positions, plugboard: 'AB CD' })
      const p = productsFromMachine(day)
      expect(characteristicAt(order, 'A', positions)).toBe(characteristic(p.AD, p.BE, p.CF))
    }
  })

  it('every one of 100 generated 1936 days is among the candidates for its characteristic', () => {
    for (let s = 0; s < 100; s++) {
      const day = dayKey(createRng(9000 + s), { era: '1936', rings: 'AAA' })
      const p = productsFromMachine(day)
      const candidates = catalogue.get(characteristic(p.AD, p.BE, p.CF)) ?? []
      expect(candidates.some((c) => c.rotors.join('-') === day.rotors.join('-') && c.positions === day.positions.join('')))
        .toBe(true)
    }
  })

  it('packs and unpacks losslessly (the worker’s transfer format)', () => {
    const packed = buildPackedCatalogue({ reflector: 'B', orders: [['II', 'I', 'III']] })
    expect(packed.codes).toHaveLength(17576)
    expect(packed.starts[packed.keys.length]).toBe(17576)
    const map = unpackCatalogue(packed)
    expect(catalogueStats(map).entries).toBe(17576)
    const [key, list] = [...map][0]!
    expect(characteristicAt(['II', 'I', 'III'], 'B', list[0]!.positions)).toBe(key)
  })
})

describe('getCatalogue (catalogueClient)', () => {
  it('falls back to the main thread without Worker, memoises, and reports progress to the total', async () => {
    clearCatalogueCache()
    const progress: number[] = []
    const first = getCatalogue('A', (d, t) => {
      expect(t).toBe(105456)
      progress.push(d)
    })
    expect(getCatalogue('A')).toBe(first)
    const c = await first
    expect(catalogueStats(c).entries).toBe(105456)
    expect(progress.at(-1)).toBe(105456)
    expect(progress.length).toBeGreaterThan(10)
    let late = 0
    await getCatalogue('A', (d) => (late = d))
    expect(late).toBe(105456)
    clearCatalogueCache()
  })
})
