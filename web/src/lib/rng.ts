/**
 * Seeded randomness (PLAN §3.1). PURE: gates, rules and crypto use this, never Math.random.
 * createRng is mulberry32, bit-identical to engine/__tests__/helpers.ts.
 */

import {
  LETTERS,
  MODELS,
  validateConfig,
  type Letter,
  type MachineConfig,
  type ModelName,
  type ReflectorName,
  type RotorName,
} from '../engine'

/** A random source returning floats in [0, 1). A bare function, so modules built on 01 need no import from 02. */
export type Rng = () => number

/** mulberry32: tiny, fast, deterministic 32-bit PRNG. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const encoder = new TextEncoder()

/** FNV-1a 32-bit over the UTF-8 bytes of parts.join('\u001f'). Unsigned. */
export function seedFor(...parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5
  for (const byte of encoder.encode(parts.join('\u001f'))) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 0 ≤ k < n */
export function int(r: Rng, n: number): number {
  return Math.floor(r() * n)
}

export function pick<T>(r: Rng, xs: readonly T[]): T {
  if (xs.length === 0) throw new RangeError('pick from an empty list')
  return xs[int(r, xs.length)]!
}

/** Fisher–Yates; the same draws as engine/__tests__/helpers.ts shuffle. */
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(r, i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** k distinct elements (by position), in random order. */
export function sample<T>(r: Rng, xs: readonly T[], k: number): T[] {
  if (k > xs.length) throw new RangeError(`cannot sample ${k} of ${xs.length}`)
  const a = [...xs]
  for (let i = 0; i < k; i++) {
    const j = i + int(r, a.length - i)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a.slice(0, k)
}

/** A letter among the first n (default 26). */
export function randLetter(r: Rng, n = 26): Letter {
  return LETTERS[int(r, n)]!
}

/** A uniformly random permutation of 0 … n−1. */
export function randomPerm(r: Rng, n: number): number[] {
  return shuffle(
    r,
    Array.from({ length: n }, (_, i) => i),
  )
}

/** An involution on n points with exactly `pairs` transpositions (the rest fixed). */
export function randomInvolution(r: Rng, n: number, pairs: number): number[] {
  if (pairs * 2 > n) throw new RangeError(`${pairs} pairs do not fit on ${n} points`)
  const p = Array.from({ length: n }, (_, i) => i)
  const pts = sample(r, p, pairs * 2)
  for (let i = 0; i < pairs; i++) {
    const a = pts[2 * i]!
    const b = pts[2 * i + 1]!
    p[a] = b
    p[b] = a
  }
  return p
}

export interface RandomConfigOptions {
  readonly model?: ModelName
  /** Stepping rotors to draw from (default: the model's). Rotors the model cannot take are an error. */
  readonly rotorsFrom?: readonly RotorName[]
  readonly reflector?: ReflectorName
  /** A number of cables, or an inclusive range. Default [0, 10]. */
  readonly plugs?: number | readonly [number, number]
  readonly rings?: 'AAA' | 'random'
}

/**
 * A random configuration that always passes validateConfig.
 * Defaults: model I, rotors I–V, UKW-B (B-thin on the M4), rings random, 0–10 plugs, random start.
 */
export function randomConfig(r: Rng, o: RandomConfigOptions = {}): MachineConfig {
  const model = o.model ?? 'I'
  const spec = MODELS[model]
  const from = o.rotorsFrom ?? spec.rotors
  const bad = from.filter((x) => !spec.rotors.includes(x))
  if (bad.length) throw new RangeError(`Rotors ${bad.join(', ')} do not fit the ${model}`)
  if (new Set(from).size < 3) throw new RangeError('randomConfig needs at least 3 distinct rotors')
  const reflector = o.reflector ?? (model === 'M4' ? 'B-thin' : 'B')
  if (!spec.reflectors.includes(reflector)) throw new RangeError(`Reflector ${reflector} does not fit the ${model}`)

  const stepping = sample(r, [...new Set(from)], 3)
  const rotors: RotorName[] = spec.slots === 4 ? [pick(r, spec.greekRotors), ...stepping] : stepping
  const [lo, hi] = typeof o.plugs === 'number' ? [o.plugs, o.plugs] : (o.plugs ?? [0, 10])
  if (lo < 0 || hi > 13 || lo > hi) throw new RangeError(`Bad plug count ${lo}–${hi}`)
  const cables = lo + int(r, hi - lo + 1)
  const letters = shuffle(r, LETTERS)
  const plugboard = Array.from({ length: cables }, (_, i) => letters[2 * i]! + letters[2 * i + 1]!)
  const rings: Letter[] = rotors.map(() => (o.rings === 'AAA' ? 'A' : randLetter(r)))
  const positions: Letter[] = rotors.map(() => randLetter(r))
  const config: MachineConfig = { model, reflector, rotors, rings, positions, plugboard }
  const problems = validateConfig(config)
  if (problems.length) throw new Error(`randomConfig produced an invalid config: ${problems.join('; ')}`)
  return config
}
