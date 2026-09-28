/**
 * Permutations of {0, …, n−1} (n = 26 for Enigma, smaller for toy examples).
 *
 * A permutation is stored as an array of images: `p[i]` is where `p` sends `i`.
 *
 * COMPOSITION ORDER — left to right, as in Rejewski's papers and Christensen (2007):
 *
 *     compose(p, q)        means  "apply p first, then q"
 *     compose(p, q)[i] === q[p[i]]
 *
 * so the product written PQ is `compose(P, Q)`. With this convention the toy example
 * from the research notes reads naturally:
 *
 *     (ab)(cd)(ef) · (bc)(de)(fa) = (ace)(bfd)
 *
 * and Rejewski's AD (the permutation taking the 1st indicator letter to the 4th) is
 * `compose(A, D)`.
 *
 * All functions are pure and never mutate their arguments.
 */

import { SIZE } from './alphabet'

/** A permutation of 0..n−1 as an image array. */
export type Perm = readonly number[]

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = LOWER.toUpperCase()

function letterIndex(ch: string, n: number): number {
  const i = UPPER.indexOf(ch.toUpperCase())
  if (i < 0 || i >= n) throw new RangeError(`Letter ${JSON.stringify(ch)} is outside the first ${n} letters`)
  return i
}

function assertSameSize(perms: readonly Perm[]): number {
  const n = perms[0]!.length
  for (const p of perms) {
    if (p.length !== n) throw new RangeError(`Cannot combine permutations of sizes ${n} and ${p.length}`)
  }
  return n
}

/** True if `p` is a bijection of 0..p.length−1. */
export function isPermutation(p: readonly number[]): boolean {
  const seen = new Array<boolean>(p.length).fill(false)
  for (const x of p) {
    if (!Number.isInteger(x) || x < 0 || x >= p.length || seen[x]) return false
    seen[x] = true
  }
  return true
}

function checked(p: number[]): Perm {
  if (!isPermutation(p)) throw new RangeError(`Not a permutation: [${p.join(',')}]`)
  return p
}

/** The identity permutation on n points. */
export function identity(n: number = SIZE): Perm {
  return Array.from({ length: n }, (_, i) => i)
}

/** The cyclic shift i ↦ i + k (mod n). This is Rejewski's P^k (P = (abc…z)). */
export function shift(k: number, n: number = SIZE): Perm {
  return Array.from({ length: n }, (_, i) => (((i + k) % n) + n) % n)
}

/**
 * From a wiring table: the letter at position i is the image of the i-th letter.
 * `fromWiring('EKMF…')` sends A→E, B→K, C→M, …
 */
export function fromWiring(wiring: string): Perm {
  const n = wiring.length
  return checked(wiring.split('').map((c) => letterIndex(c, n)))
}

/** Back to a wiring table (uppercase letters). */
export function toWiring(p: Perm): string {
  return p.map((i) => UPPER[i]).join('')
}

/**
 * An involution built from disjoint letter pairs (plugboard, reflector):
 * `fromPairs('AV BS')` or `fromPairs(['AV', 'BS'])`. Unpaired letters are fixed.
 * Throws if a pair is malformed or a letter is used twice.
 */
export function fromPairs(pairs: string | readonly string[], n: number = SIZE): Perm {
  const list = typeof pairs === 'string' ? pairs.split(/[\s,]+/).filter(Boolean) : pairs
  const p = Array.from({ length: n }, (_, i) => i)
  const used = new Set<number>()
  for (const pair of list) {
    if (pair.length !== 2) throw new RangeError(`A pair must be two letters: ${JSON.stringify(pair)}`)
    const a = letterIndex(pair[0]!, n)
    const b = letterIndex(pair[1]!, n)
    if (a === b) throw new RangeError(`A letter cannot be paired with itself: ${pair}`)
    for (const x of [a, b]) {
      if (used.has(x)) throw new RangeError(`Letter ${UPPER[x]} is used in more than one pair`)
      used.add(x)
    }
    p[a] = b
    p[b] = a
  }
  return p
}

/**
 * From cycle notation, e.g. `fromCycles('(ace)(bfd)', 6)`. Letters are case-insensitive;
 * letters that do not appear are fixed points. Whitespace is ignored.
 */
export function fromCycles(text: string, n: number = SIZE): Perm {
  const p = Array.from({ length: n }, (_, i) => i)
  const used = new Set<number>()
  const groups = text.replace(/\s+/g, '').match(/\(([^()]*)\)/g) ?? []
  const leftover = text.replace(/\s+/g, '').replace(/\(([^()]*)\)/g, '')
  if (leftover !== '') throw new RangeError(`Malformed cycle notation: ${JSON.stringify(text)}`)
  for (const g of groups) {
    const cyc = g.slice(1, -1).split('').map((c) => letterIndex(c, n))
    for (const x of cyc) {
      if (used.has(x)) throw new RangeError(`Letter ${UPPER[x]} appears in more than one cycle`)
      used.add(x)
    }
    cyc.forEach((x, k) => {
      p[x] = cyc[(k + 1) % cyc.length]!
    })
  }
  return p
}

/** Where `p` sends `i`. */
export function apply(p: Perm, i: number): number {
  const out = p[i]
  if (out === undefined) throw new RangeError(`Index ${i} is outside a permutation of size ${p.length}`)
  return out
}

/**
 * Left-to-right product: `compose(p, q, r)` applies p, then q, then r.
 * `compose(p, q)[i] === q[p[i]]`.
 */
export function compose(first: Perm, ...rest: readonly Perm[]): Perm {
  const n = assertSameSize([first, ...rest])
  const out = Array.from({ length: n }, (_, i) => i)
  for (let i = 0; i < n; i++) {
    let x = first[i]!
    for (const q of rest) x = q[x]!
    out[i] = x
  }
  return out
}

/** The inverse permutation: `compose(p, inverse(p))` is the identity. */
export function inverse(p: Perm): Perm {
  const out = new Array<number>(p.length)
  p.forEach((x, i) => {
    out[x] = i
  })
  return out
}

/**
 * Conjugate of `p` by `by`: `compose(inverse(by), p, by)` (= by⁻¹ p by, left to right).
 * It has the same cycle structure as `p`, with every letter relabelled through `by`:
 * if p contains the cycle (a b c) then the conjugate contains (by[a] by[b] by[c]).
 */
export function conjugate(p: Perm, by: Perm): Perm {
  return compose(inverse(by), p, by)
}

/** True if p and q are the same permutation. */
export function equals(p: Perm, q: Perm): boolean {
  return p.length === q.length && p.every((x, i) => x === q[i])
}

/** True if applying `p` twice gives the identity (p = p⁻¹). Plugboards and reflectors are involutions. */
export function isInvolution(p: Perm): boolean {
  return p.every((x, i) => p[x] === i)
}

/** Points that `p` leaves where they are. */
export function fixedPoints(p: Perm): number[] {
  return p.flatMap((x, i) => (x === i ? [i] : []))
}

/**
 * Disjoint-cycle decomposition. Each cycle starts at its smallest element and the cycles
 * are ordered by that element, so the result is canonical. Fixed points appear as 1-cycles
 * unless `includeFixedPoints` is false.
 */
export function cycles(p: Perm, options: { includeFixedPoints?: boolean } = {}): number[][] {
  const { includeFixedPoints = true } = options
  const seen = new Array<boolean>(p.length).fill(false)
  const out: number[][] = []
  for (let start = 0; start < p.length; start++) {
    if (seen[start]) continue
    const cyc: number[] = []
    let x = start
    while (!seen[x]) {
      seen[x] = true
      cyc.push(x)
      x = p[x]!
    }
    if (cyc.length > 1 || includeFixedPoints) out.push(cyc)
  }
  return out
}

/**
 * The cycle type: all cycle lengths (fixed points count as 1), sorted in DESCENDING order,
 * e.g. [10, 10, 2, 2, 1, 1] for Rejewski's AD. Conjugate permutations share a signature.
 */
export function cycleSignature(p: Perm): number[] {
  return cycles(p)
    .map((c) => c.length)
    .sort((a, b) => b - a)
}

/**
 * Cycle notation with letters: `(ace)(bfd)`. Lowercase by default (Rejewski's style).
 * The identity formats as `()` when fixed points are omitted.
 */
export function formatCycles(p: Perm, options: { includeFixedPoints?: boolean; uppercase?: boolean } = {}): string {
  const { includeFixedPoints = true, uppercase = false } = options
  if (p.length > 26) throw new RangeError('formatCycles supports at most 26 points')
  const alphabet = uppercase ? UPPER : LOWER
  const parts = cycles(p, { includeFixedPoints }).map((c) => `(${c.map((i) => alphabet[i]).join('')})`)
  return parts.length ? parts.join('') : '()'
}
