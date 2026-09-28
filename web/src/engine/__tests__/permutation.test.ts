import { describe, expect, it } from 'vitest'
import {
  apply,
  compose,
  conjugate,
  cycleSignature,
  cycles,
  equals,
  fixedPoints,
  formatCycles,
  fromCycles,
  fromPairs,
  fromWiring,
  identity,
  inverse,
  isInvolution,
  isPermutation,
  shift,
  toWiring,
  type Perm,
} from '../permutation'
import { mulberry32, shuffle } from './helpers'

const randomPerm = (rng: () => number, n = 26): Perm => shuffle(rng, identity(n))

describe('permutation utilities', () => {
  it('composes LEFT TO RIGHT: compose(p, q)[i] === q[p[i]]', () => {
    const p = fromCycles('(ab)', 3) // swaps a, b
    const q = fromCycles('(bc)', 3) // swaps b, c
    // a --p--> b --q--> c
    expect(apply(compose(p, q), 0)).toBe(2)
    expect(formatCycles(compose(p, q), { includeFixedPoints: false })).toBe('(acb)')
    expect(formatCycles(compose(q, p), { includeFixedPoints: false })).toBe('(abc)')
  })

  it("reproduces the notes' toy example (ab)(cd)(ef) · (bc)(de)(fa) = (ace)(bfd)", () => {
    const X = fromCycles('(ab)(cd)(ef)', 6)
    const Y = fromCycles('(bc)(de)(fa)', 6)
    expect(isInvolution(X) && isInvolution(Y)).toBe(true)
    expect(formatCycles(compose(X, Y))).toBe('(ace)(bfd)')
    // Rejewski's theorem: a product of two fixed-point-free involutions has its cycles in
    // pairs of equal length.
    expect(cycleSignature(compose(X, Y))).toEqual([3, 3])
  })

  it("decomposes Christensen's AD from the 65 indicators into 10 10 2 2 1 1", () => {
    // Source: https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf
    const AD = fromWiring('ACBVIKZTJMXHUQDFLWSENPRGOY')
    expect(formatCycles(AD)).toBe('(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    expect(cycleSignature(AD)).toEqual([10, 10, 2, 2, 1, 1])
    expect(fixedPoints(AD)).toEqual([0, 18])
  })

  it('round-trips wiring strings, cycles and pairs', () => {
    const w = 'EKMFLGDQVZNTOWYHXUSPAIBRCJ'
    expect(toWiring(fromWiring(w))).toBe(w)
    const p = fromWiring(w)
    expect(equals(fromCycles(formatCycles(p)), p)).toBe(true)
    expect(equals(fromCycles(formatCycles(p, { uppercase: true, includeFixedPoints: false })), p)).toBe(true)
    const plug = fromPairs('AV BS CG')
    expect(equals(plug, fromPairs(['AV', 'BS', 'CG']))).toBe(true)
    expect(formatCycles(plug, { includeFixedPoints: false, uppercase: true })).toBe('(AV)(BS)(CG)')
    expect(isInvolution(plug)).toBe(true)
    expect(fixedPoints(plug)).toHaveLength(20)
  })

  it('rejects malformed input', () => {
    expect(() => fromWiring('AAB')).toThrow(RangeError)
    expect(() => fromPairs('AB BC')).toThrow(/more than one pair/)
    expect(() => fromPairs('AA')).toThrow(/itself/)
    expect(() => fromPairs('ABC')).toThrow(/two letters/)
    expect(() => fromCycles('(ab)(bc)')).toThrow(/more than one cycle/)
    expect(() => fromCycles('ab')).toThrow(/Malformed/)
    expect(() => fromCycles('(ag)', 6)).toThrow(/outside/)
    expect(() => compose(identity(3), identity(4))).toThrow(/sizes/)
    expect(isPermutation([0, 0, 1])).toBe(false)
    expect(isPermutation([2, 0, 1])).toBe(true)
  })

  it('satisfies the group laws on random permutations', () => {
    const rng = mulberry32(0xe1)
    for (let t = 0; t < 200; t++) {
      const [p, q, r] = [randomPerm(rng), randomPerm(rng), randomPerm(rng)]
      expect(isPermutation(compose(p, q))).toBe(true)
      expect(equals(compose(compose(p, q), r), compose(p, compose(q, r)))).toBe(true)
      expect(equals(compose(p, inverse(p)), identity())).toBe(true)
      expect(equals(compose(inverse(p), p), identity())).toBe(true)
      expect(equals(inverse(compose(p, q)), compose(inverse(q), inverse(p)))).toBe(true)
      expect(equals(compose(p, q, r), compose(compose(p, q), r))).toBe(true)
    }
  })

  it('conjugation relabels cycles and preserves the cycle signature', () => {
    const rng = mulberry32(0xc0)
    for (let t = 0; t < 100; t++) {
      const p = randomPerm(rng)
      const by = randomPerm(rng)
      const c = conjugate(p, by)
      expect(cycleSignature(c)).toEqual(cycleSignature(p))
      for (let i = 0; i < 26; i++) expect(c[by[i]!]).toBe(by[p[i]!])
    }
    // Toy check: conjugating (ab) by (bc) gives (ac).
    expect(formatCycles(conjugate(fromCycles('(ab)', 3), fromCycles('(bc)', 3)), { includeFixedPoints: false })).toBe(
      '(ac)',
    )
  })

  it('cycles are canonical and cover every point once', () => {
    const rng = mulberry32(7)
    for (let t = 0; t < 50; t++) {
      const p = randomPerm(rng)
      const cs = cycles(p)
      expect(cs.flat().sort((a, b) => a - b)).toEqual(identity(26))
      for (const c of cs) expect(Math.min(...c)).toBe(c[0])
      expect(cs.map((c) => c[0])).toEqual([...cs.map((c) => c[0]!)].sort((a, b) => a - b))
      expect(cycleSignature(p).reduce((a, b) => a + b, 0)).toBe(26)
    }
    expect(cycles(identity(4), { includeFixedPoints: false })).toEqual([])
    expect(formatCycles(identity(4), { includeFixedPoints: false })).toBe('()')
  })

  it('shift(k) is the cyclic rotation i -> i + k', () => {
    expect(shift(1, 4)).toEqual([1, 2, 3, 0])
    expect(shift(-1, 4)).toEqual([3, 0, 1, 2])
    expect(equals(compose(shift(5), shift(-5)), identity())).toBe(true)
    expect(cycleSignature(shift(1))).toEqual([26])
  })
})
