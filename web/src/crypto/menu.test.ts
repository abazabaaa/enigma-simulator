import { describe, expect, it } from 'vitest'
import { createMachine, step, type Letter, type RotorName } from '../engine'
import { createRng, int, randLetter, sample } from '../lib/rng'
import { crashes, isConsistentCrib, zeroCrashOffsets } from './cribs'
import { closures, loops, menuFromCrib, menuFromEdges, turnoverWithin, type Menu } from './menu'

const CIPHER = 'WSNPNLKLSTCS'
const CRIB = 'ATTACKATDAWN'

/** A loop up to rotation and direction: the lexicographically smallest reading. */
function canon(loop: readonly string[]): string {
  const n = loop.length
  const reads: string[] = []
  for (const seq of [loop, [...loop].reverse()]) {
    for (let k = 0; k < n; k++) reads.push([...seq.slice(k), ...seq.slice(0, k)].join(''))
  }
  return reads.sort()[0]!
}

/** Each consecutive pair (and last → first) of the loop is joined by a distinct menu edge. */
function isLoopOf(m: Menu, loop: readonly Letter[]): boolean {
  if (loop.length === 1) return m.edges.some((e) => e.a === loop[0] && e.b === loop[0])
  const used = new Set<number>()
  for (let i = 0; i < loop.length; i++) {
    const [x, y] = [loop[i]!, loop[(i + 1) % loop.length]!]
    const k = m.edges.findIndex((e, j) => !used.has(j) && ((e.a === x && e.b === y) || (e.a === y && e.b === x)))
    if (k < 0) return false
    used.add(k)
  }
  return new Set(loop).size === loop.length
}

describe('cribs', () => {
  it('vector 14: ATTACKATDAWN under WSNPNLKLSTCS has no crash', () => {
    expect(crashes(CIPHER, CRIB, 0)).toEqual([])
    expect(isConsistentCrib(CIPHER, CRIB, 0)).toBe(true)
    expect(zeroCrashOffsets(CIPHER, CRIB)).toEqual([0])
  })

  it('finds crashes and zero-crash offsets', () => {
    expect(crashes('ABCDEF', 'XBXDX', 0)).toEqual([1, 3])
    expect(crashes('ABCDEF', 'bcd', 1)).toEqual([0, 1, 2])
    expect(zeroCrashOffsets('AAAB', 'A')).toEqual([3])
    expect(isConsistentCrib('ABCDEF', 'XYZ', 4)).toBe(false) // out of range
    expect(isConsistentCrib('ABCDEF', 'XYZ', -1)).toBe(false)
    expect(() => crashes('ABC', 'ABCD', 0)).toThrow(RangeError)
  })
})

describe('vector 14: the ATTACKATDAWN menu', () => {
  const m = menuFromCrib(CIPHER, CRIB, 0)

  it('has the twelve published edges', () => {
    const edges = m.edges.map((e) => `${e.a}${e.b}@${e.pos}`)
    expect(edges).toEqual(['AW@1', 'TS@2', 'TN@3', 'AP@4', 'CN@5', 'KL@6', 'AK@7', 'TL@8', 'DS@9', 'AT@10', 'WC@11',
      'NS@12'])
    expect(m.letters).toEqual(['A', 'C', 'D', 'K', 'L', 'N', 'P', 'S', 'T', 'W'])
  })

  it('has 3 closures and the loops ATLK, TNS and TAWCN', () => {
    expect(closures(m)).toBe(3)
    const found = loops(m)
    expect(found).toHaveLength(3)
    expect(found.map(canon).sort()).toEqual(['AKLT', 'ATNCW', 'NST'].map((l) => canon(l.split(''))).sort())
    for (const l of ['ATLK', 'TNS', 'TAWCN']) expect(found.map(canon)).toContain(canon(l.split('')))
    for (const l of found) expect(isLoopOf(m, l)).toBe(true)
    expect(found[0]).toEqual(['N', 'S', 'T']) // shortest first, from its first letter alphabetically
  })

  it('counts closures as E − V + C as edges are added one by one', () => {
    const counts = m.edges.map((_, k) => closures(menuFromEdges(m.edges.slice(0, k + 1))))
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3])
  })
})

describe('menus in general', () => {
  it('loops form a basis: closures(m) simple cycles of the menu, on 300 random menus', () => {
    const r = createRng(77)
    let simple = 0
    for (let s = 0; s < 300; s++) {
      const n = 4 + int(r, 10)
      const letters = sample(r, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[], n)
      const edges = Array.from({ length: 3 + int(r, 14) }, (_, i) => {
        const [a, b] = sample(r, letters, 2) as [Letter, Letter]
        return { a, b, pos: i + 1 }
      })
      const m = menuFromEdges(edges)
      const found = loops(m)
      expect(found).toHaveLength(closures(m))
      for (const l of found) expect(isLoopOf(m, l)).toBe(true)
      // independence over GF(2), checked by rank where letters name edges uniquely (no parallel edges)
      const pairs = new Set(edges.map((e) => [e.a, e.b].sort().join('')))
      if (pairs.size === edges.length) {
        simple++
        expect(rank(found.map((l) => edgeSet(m, l)))).toBe(found.length)
      }
    }
    expect(simple).toBeGreaterThan(100)
  })

  it('two edges between the same letters make a 2-letter loop; a crash edge a 1-letter loop', () => {
    const m = menuFromEdges([
      { a: 'A', b: 'B', pos: 1 },
      { a: 'B', b: 'A', pos: 2 },
      { a: 'C', b: 'C', pos: 3 },
    ])
    expect(closures(m)).toBe(2)
    expect(loops(m).map((l) => l.join('')).sort()).toEqual(['AB', 'C'])
    expect(loops(menuFromEdges([{ a: 'A', b: 'B', pos: 1 }]))).toEqual([])
  })
})

/** Edge indices of a loop (the first unused edge joining each consecutive pair), as a bit mask. */
function edgeSet(m: Menu, loop: readonly Letter[]): bigint {
  let bits = 0n
  const used = new Set<number>()
  const n = loop.length
  for (let i = 0; i < (n === 1 ? 1 : n); i++) {
    const [x, y] = [loop[i]!, loop[(i + 1) % n]!]
    const k = m.edges.findIndex((e, j) => !used.has(j) && ((e.a === x && e.b === y) || (e.a === y && e.b === x)))
    used.add(k)
    bits |= 1n << BigInt(k)
  }
  return bits
}

function rank(vectors: bigint[]): number {
  const rows = [...vectors]
  let r = 0
  for (let bit = 63; bit >= 0; bit--) {
    const mask = 1n << BigInt(bit)
    const i = rows.findIndex((v, k) => k >= r && (v & mask) !== 0n)
    if (i < 0) continue
    ;[rows[r], rows[i]] = [rows[i]!, rows[r]!]
    for (let k = 0; k < rows.length; k++) if (k !== r && (rows[k]! & mask) !== 0n) rows[k]! ^= rows[r]!
    r++
  }
  return r
}

describe('turnoverWithin', () => {
  it('ADU on I II III: the middle steps at press 2 (carry) and 3 (double step), then not for a while', () => {
    const rotors: RotorName[] = ['I', 'II', 'III']
    expect(turnoverWithin(rotors, 'ADU', 1, 12)).toBe(2)
    expect(turnoverWithin(rotors, 'ADU', 3, 12)).toBe(3)
    expect(turnoverWithin(rotors, 'ADU', 4, 20)).toBeNull()
    expect(turnoverWithin(rotors, 'ADU', 1, 1)).toBeNull()
  })

  it('agrees with the engine’s stepping on 500 random starts (3- and 4-rotor)', () => {
    const r = createRng(5)
    const pool: RotorName[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
    for (let s = 0; s < 500; s++) {
      const m4 = s % 5 === 0
      const three = sample(r, pool, 3)
      const rotors: RotorName[] = m4 ? ['Beta', ...three] : three
      const start = rotors.map(() => randLetter(r)).join('')
      const from = 1 + int(r, 10)
      const to = from + int(r, 30)
      let state = createMachine({ model: m4 ? 'M4' : 'M3', reflector: m4 ? 'B-thin' : 'B', rotors, rings: 'A'.repeat(rotors.length),
        positions: start })
      let want: number | null = null
      for (let k = 1; k <= to; k++) {
        const res = step(state)
        state = res.state
        if (want === null && k >= from && res.stepped.middle) want = k
      }
      expect(turnoverWithin(rotors, start, from, to)).toBe(want)
    }
  })
})
