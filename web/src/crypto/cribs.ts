/**
 * Cribs (PLAN §3.11, §4.4 III.9). PURE. Enigma never enciphers a letter to itself, so a guessed plaintext (crib)
 * cannot sit at an offset where any crib letter equals the cipher letter above it (a "crash").
 * Letters are compared case-insensitively; offsets are 0-based indices into the cipher.
 */

const up = (s: string) => s.toUpperCase()

/** Indices i (0-based into the crib) with cipher[offset + i] === crib[i]. Offsets outside the cipher throw. */
export function crashes(cipher: string, crib: string, offset: number): number[] {
  const c = up(cipher)
  const p = up(crib)
  if (!Number.isInteger(offset) || offset < 0 || offset + p.length > c.length) {
    throw new RangeError(`Offset ${offset} does not fit a ${p.length}-letter crib under ${c.length} letters`)
  }
  const out: number[] = []
  for (let i = 0; i < p.length; i++) if (c[offset + i] === p[i]) out.push(i)
  return out
}

/** Every offset (0 … cipher.length − crib.length) where the crib has no crash. */
export function zeroCrashOffsets(cipher: string, crib: string): number[] {
  const out: number[] = []
  for (let k = 0; k + crib.length <= cipher.length; k++) if (crashes(cipher, crib, k).length === 0) out.push(k)
  return out
}

/** True when the crib fits under the cipher at `offset` (in range) without a crash. */
export function isConsistentCrib(cipher: string, crib: string, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset + crib.length > cipher.length) return false
  return crashes(cipher, crib, offset).length === 0
}
