/**
 * Historical wiring data for the Wehrmacht Enigma I, Kriegsmarine M3 and M4.
 *
 * Every string below was cross-checked against three sources, which agree exactly
 * (see research_notes/…/technical_and_historical_ground_truth.md, Key Question 1):
 *   - Cryptomuseum, Enigma wiring:  https://www.cryptomuseum.com/crypto/enigma/wiring.htm
 *   - Cryptomuseum, Enigma M4:      https://www.cryptomuseum.com/crypto/enigma/m4/index.htm
 *   - Rijmenants, technical details: https://www.ciphermachinesandcryptology.com/en/enigmatech.htm
 *   - Wikipedia, Enigma rotor details: https://en.wikipedia.org/wiki/Enigma_rotor_details
 * and every published test vector in __fixtures__/vectors.json passes with them.
 *
 * Wiring convention: position i of the string is the letter the current leaves on when it
 * enters contact i (A = 0) with the rotor at position A and ring setting A (i.e. the core's
 * own frame), travelling right-to-left (from the entry wheel towards the reflector).
 */

import { ALPHABET, type Letter } from './alphabet'
import { fromWiring, inverse, type Perm } from './permutation'

export type RotorName = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'Beta' | 'Gamma'
export type ReflectorName = 'A' | 'B' | 'C' | 'B-thin' | 'C-thin'
export type ModelName = 'I' | 'M3' | 'M4'

export interface RotorSpec {
  readonly name: RotorName
  /** Wiring A..Z → output letters (core frame, right-to-left). */
  readonly wiring: string
  /**
   * Turnover letter(s): the letter showing in the WINDOW when the next key press carries the
   * neighbour to the left (Cryptomuseum/Wikipedia convention: rotor I is "Q", the Q→R step
   * carries). Empty for the Greek rotors, which never step. Tony Sale lists the letter AFTER
   * the carry ("R" for rotor I); do not mix the two conventions.
   */
  readonly turnovers: string
  /**
   * Letter(s) engraved on the alphabet ring at the notch itself. Always turnover + 8, because
   * the stepping pawl sits 8 positions away from the window. Useful for drawing the notch.
   */
  readonly notches: string
  /** Beta/Gamma: fits only the M4's fourth (leftmost) slot and never steps. */
  readonly greek: boolean
  /** When the rotor entered service, per the sources above. */
  readonly introduced: string
}

export interface ReflectorSpec {
  readonly name: ReflectorName
  /** Umkehrwalze wiring A..Z (an involution with no fixed points). */
  readonly wiring: string
  /** Thin reflectors fit only the M4 (next to a Greek rotor). */
  readonly thin: boolean
  /** Period of use, per the sources above. */
  readonly usage: string
}

export interface ModelSpec {
  readonly name: ModelName
  readonly label: string
  /** Number of rotor slots, including the M4's Greek slot. */
  readonly slots: 3 | 4
  /** Rotors allowed in the three stepping slots. */
  readonly rotors: readonly RotorName[]
  /** Rotors allowed in the M4's fourth (leftmost, non-stepping) slot; empty otherwise. */
  readonly greekRotors: readonly RotorName[]
  readonly reflectors: readonly ReflectorName[]
  /** The plugboard has 26 sockets, so at most 13 cables (10 was the WWII standard). */
  readonly maxPlugPairs: number
}

export const ROTORS: Readonly<Record<RotorName, RotorSpec>> = {
  I: { name: 'I', wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', turnovers: 'Q', notches: 'Y', greek: false, introduced: '1930' },
  II: { name: 'II', wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', turnovers: 'E', notches: 'M', greek: false, introduced: '1930' },
  III: { name: 'III', wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', turnovers: 'V', notches: 'D', greek: false, introduced: '1930' },
  IV: { name: 'IV', wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', turnovers: 'J', notches: 'R', greek: false, introduced: 'December 1938' },
  V: { name: 'V', wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', turnovers: 'Z', notches: 'H', greek: false, introduced: 'December 1938' },
  VI: { name: 'VI', wiring: 'JPGVOUMFYQBENHZRDKASXLICTW', turnovers: 'ZM', notches: 'HU', greek: false, introduced: '1939 (Navy)' },
  VII: { name: 'VII', wiring: 'NZJHGRCXMYSWBOUFAIVLPEKQDT', turnovers: 'ZM', notches: 'HU', greek: false, introduced: '1939 (Navy)' },
  VIII: { name: 'VIII', wiring: 'FKQHTLXOCBJSPDZRAMEWNIUYGV', turnovers: 'ZM', notches: 'HU', greek: false, introduced: '1939 (Navy)' },
  Beta: { name: 'Beta', wiring: 'LEYJVCNIXWPBQMDRTAKZGFUHOS', turnovers: '', notches: '', greek: true, introduced: 'Spring 1941' },
  Gamma: { name: 'Gamma', wiring: 'FSOKANUERHMBTIYCWLQPZXVGJD', turnovers: '', notches: '', greek: true, introduced: 'Spring 1942' },
}

export const REFLECTORS: Readonly<Record<ReflectorName, ReflectorSpec>> = {
  A: { name: 'A', wiring: 'EJMZALYXVBWFCRQUONTSPIKHGD', thin: false, usage: 'Enigma I until 1/2 November 1937' },
  B: { name: 'B', wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', thin: false, usage: 'Enigma I / M3, the standard WWII reflector' },
  C: { name: 'C', wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', thin: false, usage: 'Enigma I / M3 (occasional)' },
  'B-thin': { name: 'B-thin', wiring: 'ENKQAUYWJICOPBLMDXZVFTHRGS', thin: true, usage: 'M4 ("Bruno"), pairs with Beta' },
  'C-thin': { name: 'C-thin', wiring: 'RDOBJNTKVEHMLFCWZAXGYIPSUQ', thin: true, usage: 'M4 ("Caesar"), pairs with Gamma' },
}

/** Entry wheel (Eintrittswalze): the identity on the military Enigma I / M3 / M4. */
export const ETW_WIRING = ALPHABET

export const ROTOR_NAMES = Object.keys(ROTORS) as RotorName[]
export const REFLECTOR_NAMES = Object.keys(REFLECTORS) as ReflectorName[]

const STEPPING_ROTORS: readonly RotorName[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export const MODELS: Readonly<Record<ModelName, ModelSpec>> = {
  I: {
    name: 'I',
    label: 'Enigma I (Wehrmacht / Luftwaffe)',
    slots: 3,
    rotors: ['I', 'II', 'III', 'IV', 'V'],
    greekRotors: [],
    reflectors: ['A', 'B', 'C'],
    maxPlugPairs: 13,
  },
  M3: {
    name: 'M3',
    label: 'Enigma M3 (Kriegsmarine)',
    slots: 3,
    rotors: STEPPING_ROTORS,
    greekRotors: [],
    reflectors: ['B', 'C'],
    maxPlugPairs: 13,
  },
  M4: {
    name: 'M4',
    label: 'Enigma M4 (Kriegsmarine U-boats)',
    slots: 4,
    rotors: STEPPING_ROTORS,
    greekRotors: ['Beta', 'Gamma'],
    reflectors: ['B-thin', 'C-thin'],
    maxPlugPairs: 13,
  },
}

export const MODEL_NAMES = Object.keys(MODELS) as ModelName[]

/**
 * The Enigma keyboard and lampboard layout (German QWERTZ order, three rows), as on the
 * Enigma I: https://www.cryptomuseum.com/crypto/enigma/i/index.htm
 */
export const KEYBOARD_ROWS: readonly (readonly Letter[])[] = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'].map(
  (row) => row.split('') as Letter[],
)

/** Forward (towards the reflector) and backward permutations of each rotor's core. */
export const ROTOR_PERMS: Readonly<Record<RotorName, { readonly forward: Perm; readonly backward: Perm }>> =
  Object.fromEntries(
    ROTOR_NAMES.map((name) => {
      const forward = fromWiring(ROTORS[name].wiring)
      return [name, { forward, backward: inverse(forward) }]
    }),
  ) as Record<RotorName, { forward: Perm; backward: Perm }>

export const REFLECTOR_PERMS: Readonly<Record<ReflectorName, Perm>> = Object.fromEntries(
  REFLECTOR_NAMES.map((name) => [name, fromWiring(REFLECTORS[name].wiring)]),
) as Record<ReflectorName, Perm>
