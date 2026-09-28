/**
 * The Prologue (PLAN §4.4 "prologue"): the hook, with no gate. PURE (L4): engine, lib/keyspace and contracts only.
 * It holds what the scene Views and the tests share: the machine the learner types on, the bets' truths (constant,
 * computed from the engine at the scenes' fixed setup, so a revisit may fire the reveals in any order), the key-space
 * figure (every number from lib/keyspace) and the round-trip rule of the paper tape.
 */

import type { ChapterGates } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { LETTERS, createMachine, normalizeConfig, pressKey, type MachineConfig } from '../../engine'
import { formatSci, keyspace, plugboardCount } from '../../lib/keyspace'

/** The Prologue has no gate (G13: the hook). */
export const GATES: ChapterGates = {}

/** Enigma I, UKW-B, rotors I II III, rings 01 01 01, windows AAA, no cables. */
export const START: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

/** Everything but the keyboard is locked: the learner only types (the positions too, so a rewind is a reset). */
export const TYPE_ONLY: MachineLocks = { model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true }

// ---------------------------------------------------------------------------
// type-a-word: bet `own-letter`
// ---------------------------------------------------------------------------

export type OwnLetter = 'own' | 'other' | 'none'

/** What the first press at START lights, for every key: its own letter, another one, or (never) nothing. */
export function ownLetterTruth(config: MachineConfig = START): OwnLetter {
  const state = createMachine(config)
  return LETTERS.some((k) => pressKey(state, k).output === k) ? 'own' : 'other'
}

/** The bet's truth: the same whichever key the learner presses first. */
export const OWN_LETTER_TRUTH: OwnLetter = ownLetterTruth()

// ---------------------------------------------------------------------------
// type-a-word: the paper tape's round trip
// ---------------------------------------------------------------------------

export interface Tape {
  readonly input: string
  readonly output: string
}

/** A word must have at least this many letters to count for the round trip. */
export const ROUNDTRIP_MIN = 3

/**
 * The round trip is done when the current tape typed an earlier tape's output and lit that tape's input: the
 * ciphertext, typed from the same start, gives the word back.
 */
export function roundtripDone(earlier: readonly Tape[], current: Tape): boolean {
  if (current.input.length < ROUNDTRIP_MIN) return false
  return earlier.some((t) => t.input.length >= ROUNDTRIP_MIN && t.output === current.input && t.input === current.output)
}

// ---------------------------------------------------------------------------
// brute-force: bet `brute` and the key-space figure (every number from lib/keyspace)
// ---------------------------------------------------------------------------

export type Brute = 'year' | 'thousands' | 'no'

/** The bet's truth. */
export const BRUTE_TRUTH: Brute = 'no'

export interface KeyspaceLine {
  readonly id: 'orders' | 'positions' | 'plugboard' | 'total' | 'rings'
  readonly label: string
  /** The factors, as shown (each computed). */
  readonly factors: readonly string[]
  readonly value: bigint
  /** The value as shown: grouped digits, or scientific notation for the two totals. */
  readonly shown: string
}

const grouped = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 5 × 4 × 3: three different rotors chosen in order from five. */
export const ROTOR_ORDERS = 5n * 4n * 3n
/** 26 × 26 × 26 window letters. */
export const START_POSITIONS = 26n ** 3n
/** Only the right and middle rings change when a rotor carries: 26 × 26. */
export const RING_SETTINGS = 26n ** 2n
/** 10 cables, as the Wehrmacht used them. */
export const CABLES = 10

/** The figure's lines, in the order they appear. */
export function keyspaceLines(): KeyspaceLine[] {
  const plugs = plugboardCount(CABLES)
  const total = keyspace()
  const withRings = keyspace({ rings: true })
  return [
    { id: 'orders', label: 'Rotor orders: three of the five rotors, in order', factors: ['5', '4', '3'], value: ROTOR_ORDERS, shown: grouped(ROTOR_ORDERS) },
    { id: 'positions', label: 'Start positions: a letter in each window', factors: ['26', '26', '26'], value: START_POSITIONS, shown: grouped(START_POSITIONS) },
    { id: 'plugboard', label: `Plugboard: ${CABLES} cables, each pairing two of the 26 letters`, factors: [], value: plugs, shown: grouped(plugs) },
    {
      id: 'total',
      label: 'Together',
      factors: [grouped(ROTOR_ORDERS), grouped(START_POSITIONS), grouped(plugs)],
      value: total,
      shown: `${grouped(total)} ≈ ${formatSci(total)}`,
    },
    {
      id: 'rings',
      label: 'With the ring settings that matter',
      factors: [formatSci(total), grouped(RING_SETTINGS)],
      value: withRings,
      shown: `≈ ${formatSci(withRings)}`,
    },
  ]
}

/** Seconds in a year of 365.25 days. */
const YEAR_SECONDS = 36525n * 24n * 36n

/** Years to try `total` settings at `perSecond` settings a second (rounded down). */
export function yearsToTry(total: bigint, perSecond: bigint): bigint {
  if (perSecond <= 0n) throw new RangeError('perSecond must be positive')
  return total / perSecond / YEAR_SECONDS
}

/** A number of years, readable: grouped digits up to a million, scientific notation beyond. */
export function formatYears(years: bigint): string {
  if (years < 1n) return 'less than a year'
  if (years < 1_000_000n) return `${grouped(years)} year${years === 1n ? '' : 's'}`
  return `${formatSci(years)} years`
}

export { grouped }
