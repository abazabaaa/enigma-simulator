/**
 * Key-space arithmetic (PLAN §3.1, F-KS). Every figure shown in the app is computed here, in BigInt,
 * never typed in by hand. PURE.
 */

function factorial(n: number): bigint {
  let f = 1n
  for (let i = 2n; i <= BigInt(n); i++) f *= i
  return f
}

/** Ways to plug `pairs` cables into 26 sockets: 26! / ((26 − 2p)! · p! · 2^p). 10 → 150738274937250n. */
export function plugboardCount(pairs: number): bigint {
  if (!Number.isInteger(pairs) || pairs < 0 || pairs > 13) throw new RangeError(`pairs must be 0–13, got ${pairs}`)
  return factorial(26) / (factorial(26 - 2 * pairs) * factorial(pairs) * 2n ** BigInt(pairs))
}

/** Rotor orders × 26³ start positions × plugboard settings (× 26² ring settings that matter, with rings). */
export function keyspace(o: { orders?: bigint; pairs?: number; rings?: boolean } = {}): bigint {
  const orders = o.orders ?? 60n // 5 × 4 × 3 rotor orders from I–V
  const positions = 26n ** 3n // 17,576
  const base = orders * positions * plugboardCount(o.pairs ?? 10)
  // Only the right and middle notches matter for stepping, so 26² = 676 ring settings count.
  return o.rings ? base * 676n : base
}

/** Integer partitions of 13 = the cycle types a product AD can have (its cycles come in equal pairs): 101. */
export function pairedPartitions(): number {
  const n = 13
  const ways = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 1 : 0))
  for (let part = 1; part <= n; part++) for (let s = part; s <= n; s++) ways[s]! += ways[s - part]!
  return ways[n]!
}

/** 6 rotor orders of I, II, III × 17,576 start positions: the entries of Rejewski's catalogue. */
export const CATALOGUE_SETTINGS: 105456 = 105456

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** Scientific notation with `digits` significant digits (default 3): 158962555217826360000n → '1.59 × 10²⁰'. */
export function formatSci(n: bigint, digits = 3): string {
  if (!Number.isInteger(digits) || digits < 1) throw new RangeError(`digits must be ≥ 1, got ${digits}`)
  if (n === 0n) return '0'
  const sign = n < 0n ? '−' : ''
  const abs = n < 0n ? -n : n
  let exponent = abs.toString().length - 1
  // Round half up to `digits` significant digits.
  const drop = exponent - (digits - 1)
  let mantissa = drop > 0 ? (abs + 5n * 10n ** BigInt(drop - 1)) / 10n ** BigInt(drop) : abs * 10n ** BigInt(-drop)
  if (mantissa.toString().length > digits) {
    mantissa /= 10n
    exponent += 1
  }
  const m = mantissa.toString()
  const text = digits > 1 ? `${m[0]}.${m.slice(1)}` : m
  const sup = String(exponent)
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)])
    .join('')
  return `${sign}${text} × 10${sup}`
}
