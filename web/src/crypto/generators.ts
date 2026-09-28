/**
 * Generators for Acts II–IV (PLAN §3.11). PURE and seeded: every configuration passes validateConfig.
 *
 * Eras (PLAN §4.3 F8, F9, F13):
 *  - '1932' and '1936': Enigma I with UKW-A (the reflector until 1/2 Nov 1937), the three rotors I, II and III in a
 *    random order, 6 plugs by default;
 *  - '1940': Enigma I with UKW-B, three of rotors I–V, 10 plugs by default.
 * Rings are random unless `rings: 'AAA'`; positions (the Grundstellung) are random.
 */

import {
  createMachine,
  encipher,
  normalizeConfig,
  validateConfig,
  type Letter,
  type MachineConfig,
  type RotorName,
} from '../engine'
import { int, pick, randLetter, sample, shuffle } from '../lib/rng'
import { turnoverWithin } from './menu'
import type { Rng } from './types'

export type Era = '1932' | '1936' | '1940'

export interface DayKeyOptions {
  readonly era: Era
  /** Plugboard cables (default 6 before 1940, 10 in 1940). */
  readonly plugs?: number
  /** Default 'random'. */
  readonly rings?: 'AAA' | 'random'
  /** Draw the rotor order from these orders only (each LEFT → RIGHT), e.g. the candidate orders of a puzzle. */
  readonly orders?: readonly (readonly RotorName[])[]
}

/** A day's key for an era (see above). Throws if `orders` holds an order the era's machine cannot take. */
export function dayKey(r: Rng, o: DayKeyOptions): MachineConfig {
  const early = o.era !== '1940'
  const reflector = early ? 'A' : 'B'
  const pool: RotorName[] = early ? ['I', 'II', 'III'] : ['I', 'II', 'III', 'IV', 'V']
  const rotors: RotorName[] = o.orders?.length ? [...pick(r, o.orders)] : early ? shuffle(r, pool) : sample(r, pool, 3)
  const plugs = o.plugs ?? (early ? 6 : 10)
  if (!Number.isInteger(plugs) || plugs < 0 || plugs > 13) throw new RangeError(`Bad plug count ${plugs}`)
  const letters = shuffle(r, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[])
  const plugboard = Array.from({ length: plugs }, (_, i) => letters[2 * i]! + letters[2 * i + 1]!)
  const rings = rotors.map(() => (o.rings === 'AAA' ? 'A' : randLetter(r)))
  const positions = rotors.map(() => randLetter(r))
  const config: MachineConfig = { model: 'I', reflector, rotors, rings, positions, plugboard }
  const problems = validateConfig(config)
  if (problems.length) throw new RangeError(`dayKey: ${problems.join('; ')}`)
  return normalizeConfig(config)
}

/** Filler words for generated plaintext (German military vocabulary, X as the word separator). */
const WORDS = [
  'AN', 'DIE', 'GRUPPE', 'WETTER', 'VORHERSAGE', 'KEINE', 'BESONDEREN', 'EREIGNISSE', 'MELDUNG', 'NORD', 'OST',
  'SUED', 'WEST', 'NULL', 'EINS', 'ZWEI', 'DREI', 'VIER', 'FUENF', 'SECHS', 'SIEBEN', 'ACHT', 'NEUN', 'STAB',
  'FEIND', 'BEI', 'UHR', 'NACHT', 'LAGE', 'RUHIG', 'BRUECKE', 'STRASSE', 'DORF', 'HOEHE', 'FLUSS', 'ERBITTE',
  'MUNITION', 'ANKUNFT', 'ABMARSCH', 'REGIMENT', 'KOMPANIE', 'BATTERIE', 'STELLUNG', 'VERBINDUNG', 'X',
] as const

function filler(r: Rng, length: number): string {
  let s = ''
  while (s.length < length) s += pick(r, WORDS) + 'X'
  return s.slice(0, length)
}

export interface CribbedMessageOptions {
  readonly day: MachineConfig
  /** The crib (plaintext known at some offset): letters A–Z. */
  readonly crib: string
  /** Message length in letters (≥ the crib's length). */
  readonly length: number
}

/**
 * A message whose plaintext contains `crib` at a random `offset`, enciphered on `day` from a fresh message setting
 * `start` (random windows; day.positions is not used). `start` is redrawn until the middle rotor does not step
 * during the crib's key presses (offset + 1 … offset + crib.length), so the bombe's drum semantics hold over the
 * whole crib: the true stop is trueBombePosition(day, start, offset).
 */
export function cribbedMessage(r: Rng, o: CribbedMessageOptions): { plain: string; cipher: string; offset: number
  start: string } {
  const crib = o.crib.toUpperCase()
  if (!/^[A-Z]+$/.test(crib)) throw new RangeError(`A crib is letters A–Z, got ${JSON.stringify(o.crib)}`)
  if (!Number.isInteger(o.length) || o.length < crib.length) {
    throw new RangeError(`A ${crib.length}-letter crib does not fit in ${o.length} letters`)
  }
  const offset = int(r, o.length - crib.length + 1)
  const plain = filler(r, offset) + crib + filler(r, o.length - offset - crib.length)
  let start = ''
  for (let attempt = 0; attempt < 1000; attempt++) {
    start = o.day.rotors.map(() => randLetter(r)).join('')
    if (turnoverWithin(o.day.rotors, start, offset + 1, offset + crib.length) === null) break
  }
  const cipher = encipher(createMachine({ ...o.day, positions: start }), plain).output
  return { plain, cipher, offset, start }
}
