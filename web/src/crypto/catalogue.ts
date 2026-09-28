/**
 * Rejewski's card catalogue (PLAN §3.11, §4.4 II.7). PURE: the worker and the client call these functions.
 *
 * For every rotor order and every Grundstellung (rings AAA, no plugboard, since the plugboard cannot change cycle
 * lengths) the catalogue files the setting under its characteristic, the cycle types of AD, BE and CF. The six
 * permutations are the machine at presses 1…6 from the Grundstellung, with the engine's stepping (the middle
 * rotor, and with it the double step, may move during the six presses), so a day's characteristic computed with
 * `productsFromMachine` finds the day among its candidates. 6 orders × 17,576 positions = 105,456 entries.
 *
 * Speed: rotor tables per offset (from ROTOR_PERMS) and the inner (middle · left · reflector · left⁻¹ · middle⁻¹)
 * permutation per (left, middle) are precomputed in typed arrays; one entry then costs 6 × 26 × 3 lookups.
 */

import type { ReflectorName, RotorName } from '../engine'
import {
  POSITIONS_PER_ORDER,
  POSITION_STRINGS,
  positionIndex,
  scramblerTables,
  type ScramblerTables,
} from './tables'

export { POSITIONS_PER_ORDER, positionIndex, positionString } from './tables'

/** One catalogue card: a rotor order (LEFT → RIGHT) and a Grundstellung such as 'NKU' (rings AAA). */
export interface CatalogueEntry {
  readonly rotors: readonly RotorName[]
  readonly positions: string
}

/** Characteristic ('AD:… BE:… CF:…', as `characteristic()` writes it) → the settings that produce it. */
export type Catalogue = ReadonlyMap<string, readonly CatalogueEntry[]>

export interface CatalogueStats {
  /** Total cards (105,456 for the default catalogue). */
  readonly entries: number
  /** Distinct characteristics. */
  readonly distinct: number
  /** The largest number of settings sharing one characteristic. */
  readonly maxBucket: number
  /** How many characteristics have exactly `size` settings, ascending by size. */
  readonly histogram: readonly { readonly size: number; readonly count: number }[]
}

/** The six orders of rotors I, II and III: the Polish catalogue before December 1938. */
export const CATALOGUE_ORDERS: readonly (readonly RotorName[])[] = Object.freeze(
  (
    [
      ['I', 'II', 'III'],
      ['I', 'III', 'II'],
      ['II', 'I', 'III'],
      ['II', 'III', 'I'],
      ['III', 'I', 'II'],
      ['III', 'II', 'I'],
    ] as RotorName[][]
  ).map((o) => Object.freeze(o)),
)

const N = 26
const PRODUCT_NAMES = ['AD', 'BE', 'CF'] as const

/** Cycle lengths of compose(p, q) (x ↦ q[p[x]]), descending, joined with '.'. */
function productType(p: Uint8Array, q: Uint8Array, seen: Uint8Array, lengths: number[]): string {
  seen.fill(0)
  lengths.length = 0
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue
    let len = 0
    let x = s
    while (!seen[x]) {
      seen[x] = 1
      len++
      x = q[p[x]!]!
    }
    lengths.push(len)
  }
  lengths.sort((a, b) => b - a)
  return lengths.join('.')
}

interface Scratch {
  readonly perms: Uint8Array[]
  readonly seen: Uint8Array
  readonly lengths: number[]
}

const newScratch = (): Scratch => ({
  perms: Array.from({ length: 6 }, () => new Uint8Array(N)),
  seen: new Uint8Array(N),
  lengths: [],
})

/** The characteristic at window positions (l, m, r) for prepared tables, with the engine's stepping. */
function characteristicFor(t: ScramblerTables, l0: number, m0: number, r0: number, s: Scratch): string {
  let l = l0
  let m = m0
  let r = r0
  for (let k = 0; k < 6; k++) {
    const rightAt = t.right.turnover[r] === 1
    const middleAt = t.middle.turnover[m] === 1
    r = (r + 1) % N
    if (rightAt || middleAt) m = (m + 1) % N
    if (middleAt) l = (l + 1) % N
    t.perm(l, m, r, s.perms[k]!)
  }
  let out = ''
  for (let k = 0; k < 3; k++) {
    if (k) out += ' '
    out += `${PRODUCT_NAMES[k]}:${productType(s.perms[k]!, s.perms[k + 3]!, s.seen, s.lengths)}`
  }
  return out
}

/**
 * The characteristic of a Grundstellung with rings AAA and no plugboard (equal to
 * `characteristic(...Object.values(productsFromMachine(day)))` for any plugboard). Fast path of the catalogue.
 */
export function characteristicAt(rotors: readonly RotorName[], reflector: ReflectorName, positions: string): string {
  const i = positionIndex(positions)
  return characteristicFor(scramblerTables(rotors, reflector), Math.floor(i / 676), Math.floor(i / 26) % 26, i % 26,
    newScratch())
}

/** The catalogue in transferable form (what the worker posts): bucket k holds codes[starts[k] … starts[k+1]). */
export interface PackedCatalogue {
  readonly reflector: ReflectorName
  readonly orders: readonly (readonly RotorName[])[]
  readonly keys: readonly string[]
  readonly starts: Uint32Array
  /** orderIndex × 17,576 + positionIndex, in scan order within each bucket. */
  readonly codes: Uint32Array
}

export interface BuildCatalogueOptions {
  readonly reflector: ReflectorName
  readonly orders?: readonly (readonly RotorName[])[]
  onProgress?(done: number, total: number): void
}

/** Build the catalogue in packed form (the worker's entry point). */
export function buildPackedCatalogue(o: BuildCatalogueOptions): PackedCatalogue {
  const orders = (o.orders ?? CATALOGUE_ORDERS).map((x) => Object.freeze([...x]))
  const total = orders.length * POSITIONS_PER_ORDER
  const keyOf = new Map<string, number>()
  const keys: string[] = []
  const entryKey = new Uint32Array(total)
  const scratch = newScratch()
  let done = 0
  orders.forEach((order, oi) => {
    const t = scramblerTables(order, o.reflector)
    for (let pi = 0; pi < POSITIONS_PER_ORDER; pi++) {
      const key = characteristicFor(t, Math.floor(pi / 676), Math.floor(pi / 26) % 26, pi % 26, scratch)
      let id = keyOf.get(key)
      if (id === undefined) {
        id = keys.length
        keys.push(key)
        keyOf.set(key, id)
      }
      entryKey[oi * POSITIONS_PER_ORDER + pi] = id
      done++
      if (o.onProgress && done % 676 === 0) o.onProgress(done, total)
    }
  })
  const starts = new Uint32Array(keys.length + 1)
  for (let i = 0; i < total; i++) starts[entryKey[i]! + 1]!++
  for (let k = 0; k < keys.length; k++) starts[k + 1]! += starts[k]!
  const fill = starts.slice(0, keys.length)
  const codes = new Uint32Array(total)
  for (let i = 0; i < total; i++) codes[fill[entryKey[i]!]!++] = i
  return { reflector: o.reflector, orders, keys, starts, codes }
}

/** Rebuild the Map form from the packed form (entries share their order arrays and position strings). */
export function unpackCatalogue(p: PackedCatalogue): Catalogue {
  const orders = p.orders.map((x) => Object.freeze([...x]))
  const map = new Map<string, readonly CatalogueEntry[]>()
  p.keys.forEach((key, k) => {
    const list: CatalogueEntry[] = []
    for (let i = p.starts[k]!; i < p.starts[k + 1]!; i++) {
      const code = p.codes[i]!
      const rotors = orders[Math.floor(code / POSITIONS_PER_ORDER)]!
      list.push({ rotors, positions: POSITION_STRINGS[code % POSITIONS_PER_ORDER]! })
    }
    map.set(key, list)
  })
  return map
}

/**
 * The catalogue: characteristic → settings. Default: the 6 orders of I, II and III, rings AAA → 105,456 entries.
 * About a second in Node; the browser builds it in a worker through `getCatalogue` (catalogueClient.ts).
 */
export function buildCatalogue(o: BuildCatalogueOptions): Catalogue {
  return unpackCatalogue(buildPackedCatalogue(o))
}

/** Entries, distinct characteristics, the largest bucket and the bucket-size histogram. */
export function catalogueStats(c: Catalogue): CatalogueStats {
  let entries = 0
  let maxBucket = 0
  const bySize = new Map<number, number>()
  for (const list of c.values()) {
    entries += list.length
    maxBucket = Math.max(maxBucket, list.length)
    bySize.set(list.length, (bySize.get(list.length) ?? 0) + 1)
  }
  const histogram = [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count }))
  return { entries, distinct: c.size, maxBucket, histogram }
}
