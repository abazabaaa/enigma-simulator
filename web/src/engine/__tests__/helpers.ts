/** Test helpers: a seeded PRNG and random (but historically valid) machine configurations. */

import { LETTERS, type Letter } from '../alphabet'
import type { MachineConfig } from '../machine'
import { MODELS, type ModelName, type RotorName } from '../wiring'

/** mulberry32: tiny, fast, deterministic 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n)
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[randInt(rng, items.length)]!
export const randLetter = (rng: Rng): Letter => pick(rng, LETTERS)

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function randomText(rng: Rng, length: number): string {
  return Array.from({ length }, () => randLetter(rng)).join('')
}

/** A random valid configuration for `model` with 0–13 plugboard cables. */
export function randomConfig(rng: Rng, model: ModelName = pick(rng, ['I', 'M3', 'M4'] as const)): MachineConfig {
  const spec = MODELS[model]
  const stepping = shuffle(rng, spec.rotors).slice(0, 3)
  const rotors: RotorName[] = spec.slots === 4 ? [pick(rng, spec.greekRotors), ...stepping] : stepping
  const letters = shuffle(rng, LETTERS)
  const cables = randInt(rng, 14)
  const plugboard = Array.from({ length: cables }, (_, i) => letters[2 * i]! + letters[2 * i + 1]!)
  return {
    model,
    reflector: pick(rng, spec.reflectors),
    rotors,
    rings: rotors.map(() => randLetter(rng)),
    positions: rotors.map(() => randLetter(rng)),
    plugboard,
  }
}
