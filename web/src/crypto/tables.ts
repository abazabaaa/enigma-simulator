/**
 * Precomputed scrambler tables shared by the catalogue and the bombe (internal to the kit). PURE.
 *
 * Rings are AAA and there is no plugboard, so a rotor's window position IS its core offset. A rotor at offset o
 * maps x ↦ W[x + o] − o towards the reflector and W⁻¹ on the way back, exactly as the engine's
 * `rotorPermutation`; `perm(l, m, r)` equals the engine's `machinePermutation` at windows (l, m, r).
 */

import { REFLECTOR_PERMS, ROTORS, ROTOR_PERMS, type ReflectorName, type RotorName } from '../engine'

const N = 26

/** Positions per rotor order: 26³. */
export const POSITIONS_PER_ORDER = 17576

/** 'AAA' … 'ZZZ' by index (right letter fastest). */
export const POSITION_STRINGS: readonly string[] = Array.from({ length: POSITIONS_PER_ORDER }, (_, i) =>
  String.fromCharCode(65 + Math.floor(i / 676), 65 + (Math.floor(i / 26) % 26), 65 + (i % 26)),
)

/** Index of a 3-letter position string ('AAA' = 0, 'AAB' = 1: the right letter runs fastest). */
export function positionIndex(positions: string): number {
  const p = positions.toUpperCase()
  if (!/^[A-Z]{3}$/.test(p)) throw new RangeError(`Expected three letters, got ${JSON.stringify(positions)}`)
  return (p.charCodeAt(0) - 65) * 676 + (p.charCodeAt(1) - 65) * 26 + (p.charCodeAt(2) - 65)
}

/** The position string of an index, modulo 17,576 (inverse of positionIndex). */
export function positionString(index: number): string {
  return POSITION_STRINGS[((index % POSITIONS_PER_ORDER) + POSITIONS_PER_ORDER) % POSITIONS_PER_ORDER]!
}

export interface RotorTables {
  /** fwd[o * 26 + x]: the rotor at core offset o, towards the reflector. */
  readonly fwd: Uint8Array
  /** bwd[o * 26 + x]: the same rotor on the way back (the inverse). */
  readonly bwd: Uint8Array
  /** 1 at the window positions from which the next press carries the left neighbour. */
  readonly turnover: Uint8Array
}

const rotorCache = new Map<RotorName, RotorTables>()

export function rotorTables(name: RotorName): RotorTables {
  let t = rotorCache.get(name)
  if (!t) {
    const w = ROTOR_PERMS[name].forward
    const wi = ROTOR_PERMS[name].backward
    const fwd = new Uint8Array(N * N)
    const bwd = new Uint8Array(N * N)
    for (let o = 0; o < N; o++) {
      for (let x = 0; x < N; x++) {
        fwd[o * N + x] = (w[(x + o) % N]! - o + N) % N
        bwd[o * N + x] = (wi[(x + o) % N]! - o + N) % N
      }
    }
    const turnover = new Uint8Array(N)
    for (const ch of ROTORS[name].turnovers) turnover[ch.charCodeAt(0) - 65] = 1
    t = { fwd, bwd, turnover }
    rotorCache.set(name, t)
  }
  return t
}

export interface ScramblerTables {
  readonly left: RotorTables
  readonly middle: RotorTables
  readonly right: RotorTables
  /** inner[(l · 26 + m) · 26 + x]: middle, left, reflector, left⁻¹, middle⁻¹ at offsets l and m. */
  readonly inner: Uint8Array
  /** Write the scrambler (no plugboard) at window positions (l, m, r) into `out`. */
  perm(l: number, m: number, r: number, out: Uint8Array | number[]): void
}

const scramblerCache = new Map<string, ScramblerTables>()

/** Tables for one rotor order (3 rotors, LEFT → RIGHT) and reflector; memoised. */
export function scramblerTables(rotors: readonly RotorName[], reflector: ReflectorName): ScramblerTables {
  if (rotors.length !== 3) throw new RangeError(`Expected 3 rotors, got ${rotors.length}`)
  const cacheKey = `${rotors.join('-')}/${reflector}`
  const cached = scramblerCache.get(cacheKey)
  if (cached) return cached
  const [L, M, R] = rotors.map(rotorTables) as [RotorTables, RotorTables, RotorTables]
  const U = REFLECTOR_PERMS[reflector]
  const inner = new Uint8Array(N * N * N)
  for (let l = 0; l < N; l++) {
    for (let m = 0; m < N; m++) {
      const base = (l * N + m) * N
      for (let x = 0; x < N; x++) {
        const a = M.fwd[m * N + x]!
        const b = L.fwd[l * N + a]!
        const c = U[b]!
        const d = L.bwd[l * N + c]!
        inner[base + x] = M.bwd[m * N + d]!
      }
    }
  }
  const tables: ScramblerTables = {
    left: L,
    middle: M,
    right: R,
    inner,
    perm(l, m, r, out) {
      const base = (l * N + m) * N
      const ro = r * N
      for (let x = 0; x < N; x++) out[x] = R.bwd[ro + inner[base + R.fwd[ro + x]!]!]!
    },
  }
  scramblerCache.set(cacheKey, tables)
  return tables
}
