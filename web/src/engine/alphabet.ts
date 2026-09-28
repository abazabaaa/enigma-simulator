/**
 * Letters and their 0-based indices (A = 0 … Z = 25).
 */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Number of contacts on every Enigma wheel, plug and lamp. */
export const SIZE = 26

// prettier-ignore
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

export const LETTERS: readonly Letter[] = ALPHABET.split('') as Letter[]

/** True for a single uppercase letter A–Z. */
export function isLetter(value: unknown): value is Letter {
  return typeof value === 'string' && value.length === 1 && value >= 'A' && value <= 'Z'
}

/** Non-negative remainder: mod(-1, 26) === 25. */
export function mod(n: number, m: number = SIZE): number {
  return ((n % m) + m) % m
}

/** 'A' → 0 … 'Z' → 25. Accepts lowercase. Throws on anything else. */
export function letterToIndex(letter: string): number {
  const up = letter.toUpperCase()
  if (!isLetter(up)) throw new RangeError(`Not a letter A–Z: ${JSON.stringify(letter)}`)
  return up.charCodeAt(0) - 65
}

/** 0 → 'A' … 25 → 'Z'; other integers wrap modulo 26. */
export function indexToLetter(index: number): Letter {
  if (!Number.isInteger(index)) throw new RangeError(`Not an integer index: ${index}`)
  return LETTERS[mod(index)]
}

/** "adu" → ['A', 'D', 'U']. Throws if any character is not a letter. */
export function toLetters(text: string): Letter[] {
  return text.split('').map((c) => indexToLetter(letterToIndex(c)))
}
