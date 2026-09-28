/**
 * Rejewski's attack on the doubled indicator (PLAN §3.11, §4.4 II.5–II.7). PURE.
 *
 * Before 15 Sept 1938 every operator typed his 3-letter message key TWICE at the day's Grundstellung, so the first
 * six cipher letters of every message came from the same six machine permutations A…F (the machine at presses
 * 1…6 from the Grundstellung). Each is an involution, so the indicator s₁…s₆ of key k₁k₂k₃ gives
 * AD: s₁ ↦ s₄ (A sends s₁ to k₁, D sends k₁ to s₄), BE: s₂ ↦ s₅ and CF: s₃ ↦ s₆. The cycle type of each product is
 * unchanged by the plugboard (conjugation), and its cycles come in equal-length pairs.
 */

import {
  compose,
  createMachine,
  cycleSignature,
  cycles,
  encipher,
  indexToLetter,
  letterToIndex,
  machinePermutation,
  step,
  type MachineConfig,
  type Perm,
} from '../engine'
import { int } from '../lib/rng'
import type { Products, Rng } from './types'

export { REJEWSKI_65 } from './data/rejewski65'

const clean = (s: string): string => s.replace(/\s+/g, '').toUpperCase()

/** The six-letter indicator: `messageKey` (3 letters) typed twice from `day.positions`, with stepping. */
export function encryptIndicator(day: MachineConfig, messageKey: string): string {
  const key = clean(messageKey)
  if (!/^[A-Z]{3}$/.test(key)) throw new RangeError(`A message key is 3 letters, got ${JSON.stringify(messageKey)}`)
  return encipher(createMachine(day), key + key).output
}

/** `count` random message keys (uniform letters) and their indicators on `day`. */
export function makeIndicators(r: Rng, day: MachineConfig, count: number): { keys: string[]; indicators: string[] } {
  const keys: string[] = []
  const indicators: string[] = []
  for (let i = 0; i < count; i++) {
    const key = indexToLetter(int(r, 26)) + indexToLetter(int(r, 26)) + indexToLetter(int(r, 26))
    keys.push(key)
    indicators.push(encryptIndicator(day, key))
  }
  return { keys, indicators }
}

const PRODUCT_NAMES = ['AD', 'BE', 'CF'] as const

/**
 * AD, BE and CF as observed from `indicators` (six letters each; spaces ignored). Every mapping is counted; the
 * mappings are accepted by majority (ties: first seen), and a mapping whose source or target is already taken is
 * rejected and reported ONCE: 'CF: Z→W vs X→W' (vs the accepted mapping to the same target, else from the same
 * source). REJEWSKI_65 yields exactly one conflict, for SYZ SCW.
 */
export function products(indicators: readonly string[]): Products {
  const list = indicators.map(clean)
  for (const s of list) {
    if (!/^[A-Z]{6}$/.test(s)) throw new RangeError(`An indicator is six letters, got ${JSON.stringify(s)}`)
  }
  const conflicts: string[] = []
  const [AD, BE, CF] = [0, 1, 2].map((k) => {
    const counts = new Map<string, { from: number; to: number; count: number; first: number }>()
    list.forEach((s, i) => {
      const key = s[k]! + s[k + 3]!
      const seen = counts.get(key)
      if (seen) seen.count++
      else counts.set(key, { from: letterToIndex(s[k]!), to: letterToIndex(s[k + 3]!), count: 1, first: i })
    })
    const ranked = [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first)
    const image: (number | null)[] = new Array<number | null>(26).fill(null)
    const preimage: (number | null)[] = new Array<number | null>(26).fill(null)
    const arrow = (from: number, to: number) => `${indexToLetter(from)}→${indexToLetter(to)}`
    for (const { from, to } of ranked) {
      const owner = preimage[to]
      const target = image[from]
      if (owner === null && target === null) {
        image[from] = to
        preimage[to] = from
      } else if (owner !== null) {
        conflicts.push(`${PRODUCT_NAMES[k]}: ${arrow(from, to)} vs ${arrow(owner, to)}`)
      } else {
        conflicts.push(`${PRODUCT_NAMES[k]}: ${arrow(from, to)} vs ${arrow(from, target!)}`)
      }
    }
    return image
  })
  return { AD: AD!, BE: BE!, CF: CF!, conflicts }
}

/** The machine permutations A…F: `day` at its positions (the Grundstellung), pressed 1…6 times (with stepping). */
export function sixPermutations(day: MachineConfig): readonly number[][] {
  let state = createMachine(day)
  const out: number[][] = []
  for (let i = 0; i < 6; i++) {
    state = step(state).state
    out.push([...machinePermutation(state)])
  }
  return out
}

/** The true products of `day`: AD = compose(A, D), BE = compose(B, E), CF = compose(C, F). */
export function productsFromMachine(day: MachineConfig): { AD: number[]; BE: number[]; CF: number[] } {
  const six = sixPermutations(day)
  const [A, B, C, D, E, F] = [0, 1, 2, 3, 4, 5].map((k) => six[k]!)
  return { AD: [...compose(A!, D!)], BE: [...compose(B!, E!)], CF: [...compose(C!, F!)] }
}

/** The day's characteristic: descending cycle lengths, e.g. 'AD:10.10.2.2.1.1 BE:9.9.3.3.1.1 CF:13.13'. */
export function characteristic(ad: Perm, be: Perm, cf: Perm): string {
  return [ad, be, cf].map((p, k) => `${PRODUCT_NAMES[k]}:${cycleSignature(p).join('.')}`).join(' ')
}

/** True when every cycle length occurs an even number of times (the type of a product of two such involutions). */
export function isPairedType(lengths: readonly number[]): boolean {
  const count = new Map<number, number>()
  for (const l of lengths) count.set(l, (count.get(l) ?? 0) + 1)
  return [...count.values()].every((c) => c % 2 === 0)
}

/**
 * How many ways `ad` = compose(X, Y) with X and Y fixed-point-free involutions (Rejewski's factorisations): the
 * 2k cycles of each length L are matched in (2k − 1)!! ways and each matched pair aligned in L ways, so the count is
 * ∏ (2k − 1)!! · L^k; 0 when the cycle type is not paired. Vector 13's AD gives 1 · 2 · 10 = 20.
 */
export function factorizationCount(ad: Perm): number {
  const lengths = cycleSignature(ad)
  if (!isPairedType(lengths)) return 0
  const count = new Map<number, number>()
  for (const l of lengths) count.set(l, (count.get(l) ?? 0) + 1)
  let total = 1
  for (const [length, m] of count) {
    for (let j = m - 1; j > 1; j -= 2) total *= j
    total *= length ** (m / 2)
  }
  return total
}

/**
 * The transpositions implied by writing cycle `b` under cycle `a` (same length L), shifted by `offset` and
 * optionally reversed: a[i] pairs with b'[(i + offset) mod L], where b' is b, or b read backwards from b[0] when
 * `reversed`. Rejewski's rule: the true X pairs a cycle with its partner written BACKWARDS, so one of the L
 * reversed alignments is the true one. Pairs are returned as [a-letter, b-letter] indices.
 */
export function alignmentPairs(a: readonly number[], b: readonly number[], offset: number, reversed: boolean):
  [number, number][] {
  const L = a.length
  if (b.length !== L) throw new RangeError(`Cycles of lengths ${L} and ${b.length} cannot be aligned`)
  const bb = reversed ? [b[0]!, ...b.slice(1).reverse()] : [...b]
  const k = ((offset % L) + L) % L
  return a.map((x, i) => [x, bb[(i + k) % L]!])
}

/** Cycles of `p` grouped by length, longest first: the pairs CycleAlign lines up (helper for chapters). */
export function pairedCycles(p: Perm): number[][][] {
  const byLength = new Map<number, number[][]>()
  for (const c of cycles(p)) byLength.set(c.length, [...(byLength.get(c.length) ?? []), c])
  return [...byLength.entries()].sort((x, y) => y[0] - x[0]).map(([, cs]) => cs)
}
