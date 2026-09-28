import { describe, expect, it } from 'vitest'
import {
  compose,
  conjugate,
  createMachine,
  cycleSignature,
  encipher,
  formatCycles,
  fromCycles,
  fromPairs,
  isInvolution,
  type Perm,
} from '../engine'
import { createRng, int, randomInvolution, shuffle } from '../lib/rng'
import { dayKey } from './generators'
import {
  REJEWSKI_65,
  alignmentPairs,
  characteristic,
  encryptIndicator,
  factorizationCount,
  isPairedType,
  makeIndicators,
  pairedCycles,
  products,
  productsFromMachine,
  sixPermutations,
} from './rejewski'

const complete = (p: readonly (number | null)[]): number[] => {
  expect(p.every((x) => x !== null)).toBe(true)
  return p as number[]
}

describe('vector 13: Rejewski’s day (REJEWSKI_65)', () => {
  const p = products(REJEWSKI_65)

  it('is F20 verbatim: 65 indicators, SYZ SCW once, SYX SCW four times', () => {
    expect(REJEWSKI_65).toHaveLength(65)
    expect(REJEWSKI_65.every((s) => /^[A-Z]{6}$/.test(s))).toBe(true)
    expect(REJEWSKI_65.filter((s) => s === 'SYZSCW')).toHaveLength(1)
    expect(REJEWSKI_65.filter((s) => s === 'SYXSCW')).toHaveLength(4)
    expect(REJEWSKI_65[0]).toBe('AUQAMN')
    expect(REJEWSKI_65[62]).toBe('SYZSCW')
    expect(REJEWSKI_65[64]).toBe('ZSJYWG')
  })

  it('reproduces the exact AD, BE and CF cycles and lengths', () => {
    const AD = complete(p.AD)
    const BE = complete(p.BE)
    const CF = complete(p.CF)
    expect(formatCycles(AD)).toBe('(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    expect(formatCycles(BE)).toBe('(axt)(blfqveoum)(cgy)(d)(hjpswizrn)(k)')
    expect(formatCycles(CF)).toBe('(abviktjgfcqny)(duzrehlxwpsmo)')
    expect(cycleSignature(AD)).toEqual([10, 10, 2, 2, 1, 1])
    expect(cycleSignature(BE)).toEqual([9, 9, 3, 3, 1, 1])
    expect(cycleSignature(CF)).toEqual([13, 13])
    expect(characteristic(AD, BE, CF)).toBe('AD:10.10.2.2.1.1 BE:9.9.3.3.1.1 CF:13.13')
    // Christensen's substitution string for AD
    expect(AD.map((i) => String.fromCharCode(65 + i)).join('')).toBe('ACBVIKZTJMXHUQDFLWSENPRGOY')
  })

  it('reports the SYZ SCW conflict exactly once and resolves it by majority', () => {
    expect(p.conflicts).toEqual(['CF: Z→W vs X→W'])
    expect(p.CF[23]).toBe(22) // X→W (four copies)
    expect(p.CF[25]).toBe(17) // Z→R (VQZ PVR twice)
  })

  it('factorizationCount(AD) = 20 and the published A, D are among them', () => {
    const AD = complete(p.AD)
    expect(factorizationCount(AD)).toBe(20)
    const A = fromCycles('(as)(br)(cw)(di)(ev)(fh)(gn)(jo)(kl)(my)(pt)(qx)(uz)')
    const D = fromCycles('(as)(bw)(cr)(dj)(ep)(ft)(gq)(hk)(iv)(lx)(mo)(nz)(uy)')
    expect(compose(A, D)).toEqual(AD)
    // the 10-cycles, aligned backwards at some offset, pair exactly as A does
    const [ten] = pairedCycles(AD)
    const [c1, c2] = ten!
    const fromA = c1!.map((x) => [x, A[x]])
    const offsets = Array.from({ length: 10 }, (_, k) => k).filter(
      (k) => JSON.stringify(alignmentPairs(c1!, c2!, k, true)) === JSON.stringify(fromA),
    )
    expect(offsets).toHaveLength(1)
  })
})

describe('products of two fixed-point-free involutions', () => {
  it('the toy hexagon: (ab)(cd)(ef) · (bc)(de)(fa) = (ace)(bfd)', () => {
    const X = fromCycles('(ab)(cd)(ef)', 6)
    const Y = fromCycles('(bc)(de)(fa)', 6)
    expect(formatCycles(compose(X, Y), { includeFixedPoints: false })).toBe('(ace)(bfd)')
    expect(isPairedType(cycleSignature(compose(X, Y)))).toBe(true)
    expect(factorizationCount(compose(X, Y))).toBe(3)
  })

  function fixedPointFreeInvolutions(n: number): number[][] {
    const out: number[][] = []
    const rec = (p: number[]) => {
      const i = p.indexOf(-1)
      if (i < 0) return void out.push([...p])
      for (let j = i + 1; j < n; j++) {
        if (p[j] !== -1) continue
        p[i] = j
        p[j] = i
        rec(p)
        p[i] = -1
        p[j] = -1
      }
    }
    rec(new Array<number>(n).fill(-1))
    return out
  }

  it.each([6, 8])('factorizationCount agrees with brute force on %i letters', (n) => {
    const invs = fixedPointFreeInvolutions(n)
    const counts = new Map<string, { perm: Perm; count: number }>()
    for (const x of invs) {
      for (const y of invs) {
        const p = compose(x, y)
        const key = p.join(',')
        const seen = counts.get(key)
        if (seen) seen.count++
        else counts.set(key, { perm: p, count: 1 })
      }
    }
    for (const { perm, count } of counts.values()) {
      expect(isPairedType(cycleSignature(perm))).toBe(true)
      expect(factorizationCount(perm)).toBe(count)
    }
    expect(factorizationCount(fromCycles('(abc)', n))).toBe(0)
  })

  it('isPairedType', () => {
    expect(isPairedType([10, 10, 2, 2, 1, 1])).toBe(true)
    expect(isPairedType([13, 13])).toBe(true)
    expect(isPairedType([3, 2, 1])).toBe(false)
    expect(isPairedType([2, 2, 2])).toBe(false)
  })
})

describe('the machine and its indicators', () => {
  it('encryptIndicator types the key twice at the Grundstellung', () => {
    const day = dayKey(createRng(7), { era: '1932' })
    const ind = encryptIndicator(day, 'abl')
    expect(ind).toMatch(/^[A-Z]{6}$/)
    expect(encipher(createMachine(day), ind).output).toBe('ABLABL')
  })

  it('A…F are fixed-point-free involutions', () => {
    const six = sixPermutations(dayKey(createRng(3), { era: '1936' }))
    expect(six).toHaveLength(6)
    for (const p of six) {
      expect(isInvolution(p)).toBe(true)
      expect(p.every((x, i) => x !== i)).toBe(true)
    }
  })

  it('productsFromMachine agrees with products(indicators) over 200 generated days', () => {
    for (let s = 0; s < 200; s++) {
      const r = createRng(500 + s)
      const day = dayKey(r, { era: s % 2 ? '1932' : '1936', rings: s % 3 ? 'random' : 'AAA' })
      const truth = productsFromMachine(day)
      const { keys, indicators } = makeIndicators(r, day, 120)
      expect(keys).toHaveLength(120)
      const seen = products(indicators)
      expect(seen.conflicts).toEqual([])
      for (const name of ['AD', 'BE', 'CF'] as const) {
        const known = seen[name].flatMap((x, i) => (x === null ? [] : [i]))
        expect(known.length).toBeGreaterThan(15)
        for (const i of known) expect(seen[name][i]).toBe(truth[name][i])
      }
    }
  })

  it('invariance: 1,000 random stecker sets leave the characteristic unchanged', () => {
    const r = createRng(2024)
    const base = dayKey(r, { era: '1936', plugs: 0 })
    const bare = productsFromMachine(base)
    const want = characteristic(bare.AD, bare.BE, bare.CF)
    expect(isPairedType(cycleSignature(bare.AD))).toBe(true)
    for (let k = 0; k < 1000; k++) {
      const cables = int(r, 14)
      const letters = shuffle(r, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
      const plugboard = Array.from({ length: cables }, (_, i) => letters[2 * i]! + letters[2 * i + 1]!)
      const day = { ...base, positions: base.positions, plugboard }
      const p = productsFromMachine(day)
      expect(characteristic(p.AD, p.BE, p.CF)).toBe(want)
      // and the relabelling is exactly the conjugation by the plugboard
      expect(p.AD).toEqual(conjugate(bare.AD, fromPairs(plugboard)))
    }
    // pure algebra: any involution S keeps the cycle type of a paired product
    for (let k = 0; k < 200; k++) {
      const S = randomInvolution(r, 26, int(r, 14))
      expect(cycleSignature(conjugate(bare.BE, S))).toEqual(cycleSignature(bare.BE))
    }
  })
})
