import { describe, expect, it } from 'vitest'
import { validateConfig, type ModelName } from '../engine'
import { mulberry32, shuffle as helperShuffle } from '../engine/__tests__/helpers'
import {
  createRng,
  int,
  pick,
  randLetter,
  randomConfig,
  randomInvolution,
  randomPerm,
  sample,
  seedFor,
  shuffle,
} from './rng'

describe('createRng', () => {
  it('draws exactly what the engine test helper mulberry32 draws (1,000 draws, 5 seeds)', () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, 2 ** 32 - 1]) {
      const a = createRng(seed)
      const b = mulberry32(seed)
      for (let i = 0; i < 1000; i++) expect(a()).toBe(b())
    }
  })

  it('stays in [0, 1)', () => {
    const r = createRng(7)
    for (let i = 0; i < 10_000; i++) {
      const x = r()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('shuffles like the engine helper', () => {
    const xs = Array.from({ length: 26 }, (_, i) => i)
    expect(shuffle(createRng(3), xs)).toEqual(helperShuffle(mulberry32(3), xs))
  })
})

describe('seedFor (FNV-1a 32-bit)', () => {
  it('matches the published FNV-1a test values', () => {
    expect(seedFor('')).toBe(0x811c9dc5)
    expect(seedFor('a')).toBe(0xe40c292c)
    expect(seedFor('foobar')).toBe(0xbf9cf968)
  })

  it('joins parts with U+001F and hashes UTF-8', () => {
    expect(seedFor('a', 'b')).toBe(seedFor('a\u001fb'))
    expect(seedFor('salt', 'i2-stepping/stepping/windows', 'inst', 3, 0)).toBe(
      seedFor('salt\u001fi2-stepping/stepping/windows\u001finst\u001f3\u001f0'),
    )
    expect(seedFor('a', 'b')).not.toBe(seedFor('ab'))
    expect(seedFor('Różycki')).not.toBe(seedFor('Rozycki'))
  })

  it('is unsigned 32-bit', () => {
    for (const s of ['x', 'y', 'enigma', 'long string of text']) {
      const h = seedFor(s)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(2 ** 32)
    }
  })
})

describe('helpers', () => {
  it('int, pick and randLetter stay in range', () => {
    const r = createRng(11)
    for (let i = 0; i < 1000; i++) {
      expect(int(r, 5)).toBeLessThan(5)
      expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']))
      expect('ABCDEF').toContain(randLetter(r, 6))
    }
    expect(() => pick(r, [])).toThrow(RangeError)
  })

  it('sample returns k distinct elements', () => {
    const r = createRng(5)
    for (let i = 0; i < 200; i++) {
      const s = sample(r, [1, 2, 3, 4, 5, 6, 7, 8], 5)
      expect(new Set(s).size).toBe(5)
    }
    expect(() => sample(r, [1, 2], 3)).toThrow(RangeError)
  })

  it('randomPerm is a permutation and randomInvolution has the requested pairs', () => {
    const r = createRng(9)
    for (let i = 0; i < 200; i++) {
      expect([...randomPerm(r, 26)].sort((a, b) => a - b)).toEqual(Array.from({ length: 26 }, (_, k) => k))
      const inv = randomInvolution(r, 26, 10)
      inv.forEach((v, k) => expect(inv[v]).toBe(k))
      expect(inv.filter((v, k) => v !== k)).toHaveLength(20)
    }
    expect(() => randomInvolution(r, 6, 4)).toThrow(RangeError)
  })
})

describe('randomConfig', () => {
  for (const model of ['I', 'M3', 'M4'] as const satisfies readonly ModelName[]) {
    it(`always passes validateConfig on the ${model} (1,000 configurations)`, () => {
      const r = createRng(seedFor('randomConfig', model))
      for (let i = 0; i < 1000; i++) {
        const c = randomConfig(r, { model })
        expect(validateConfig(c)).toEqual([])
        expect(c.model).toBe(model)
        expect(c.rotors).toHaveLength(model === 'M4' ? 4 : 3)
        expect(c.plugboard.length).toBeLessThanOrEqual(10)
      }
    })
  }

  it('defaults to model I, rotors I–V, UKW-B, 0–10 plugs, random rings', () => {
    const r = createRng(1)
    const plugs = new Set<number>()
    const rings = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const c = randomConfig(r)
      expect(c.model).toBe('I')
      expect(c.reflector).toBe('B')
      for (const rotor of c.rotors) expect(['I', 'II', 'III', 'IV', 'V']).toContain(rotor)
      plugs.add(c.plugboard.length)
      rings.add(c.rings.join(''))
    }
    expect(Math.min(...plugs)).toBe(0)
    expect(Math.max(...plugs)).toBe(10)
    expect(rings.size).toBeGreaterThan(100)
  })

  it('honours the options', () => {
    const r = createRng(2)
    for (let i = 0; i < 100; i++) {
      const c = randomConfig(r, { rotorsFrom: ['I', 'II', 'III'], plugs: [2, 6], rings: 'AAA', reflector: 'C' })
      expect([...c.rotors].sort()).toEqual(['I', 'II', 'III'])
      expect(c.rings.join('')).toBe('AAA')
      expect(c.reflector).toBe('C')
      expect(c.plugboard.length).toBeGreaterThanOrEqual(2)
      expect(c.plugboard.length).toBeLessThanOrEqual(6)
      expect(randomConfig(r, { plugs: 10 }).plugboard).toHaveLength(10)
      const m3 = randomConfig(r, { model: 'M3', rotorsFrom: ['VI', 'VII', 'VIII'] })
      expect([...m3.rotors].sort()).toEqual(['VI', 'VII', 'VIII'])
    }
  })

  it('refuses options that could not give a valid configuration', () => {
    const r = createRng(3)
    expect(() => randomConfig(r, { model: 'I', rotorsFrom: ['I', 'II', 'VI'] })).toThrow(/VI/)
    expect(() => randomConfig(r, { model: 'M4', reflector: 'B' })).toThrow(/Reflector B/)
    expect(() => randomConfig(r, { rotorsFrom: ['I', 'II'] })).toThrow(/3 distinct/)
    expect(() => randomConfig(r, { plugs: 14 })).toThrow(RangeError)
  })

  it('is deterministic per seed', () => {
    expect(randomConfig(createRng(99), { model: 'M4' })).toEqual(randomConfig(createRng(99), { model: 'M4' }))
  })
})
