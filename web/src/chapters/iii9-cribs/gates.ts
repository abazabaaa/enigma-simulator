/**
 * Chapter iii9-cribs · gate `cribs` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts, lesson/kinds and crypto only.
 *  - crash-free          custom (CribStrip) · inPage · 2/3 · slide a crib under a generated 1940 message to an offset
 *                        with no crash (every message has 1–3 such offsets, none near either end)
 *  - crash-count         numbers(1) · 2/3 · the number of crashes of a crib at a given offset
 *  - is-consistent-crib  code · 2/3 · isConsistentCrib(cipher, crib, offset); the probe is the index of the first crash
 *                        at an offset of this instance's message
 *  - fallback crash-free
 * The scene data (vector 14, the crashes scene's intercept, the demonstration machine) lives here too, so the scenes,
 * the bets and the gate agree.
 */

import type { Letter } from '../../contracts/core'
import type { CodeCase } from '../../contracts/code'
import type { ChapterGates, CheckResult, ItemLogic, Rollback } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { crashes, isConsistentCrib, zeroCrashOffsets } from '../../crypto/cribs'
import { cribbedMessage, dayKey } from '../../crypto/generators'
import { normalizeConfig, type MachineConfig } from '../../engine'
import { createRng, int, pick, randLetter, sample, shuffle, type Rng } from '../../lib/rng'
import { codeItem, numbersItem, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const range = (n: number): number[] => Array.from({ length: n }, (_, k) => k)

// ---------------------------------------------------------------------------
// Scene data
// ---------------------------------------------------------------------------

/** PLAN §4.3 F21: the Bombe article's worked example. */
export const V14 = { cipher: 'WSNPNLKLSTCS', crib: 'ATTACKATDAWN' } as const

/**
 * The crashes scene's intercept: the twelve letters of vector 14 followed by fourteen letters made up for the exercise,
 * chosen so that the crib crashes everywhere except under vector 14 (offset 0).
 */
export const INTERCEPT = `${V14.cipher}TWDNCZKINKDIYF`

/** Where the crib sits while the learner bets: one crash, the crib's T under a cipher T. */
export const BET_OFFSET = 8

/** The crash the bet is about: its crib index and letter. */
export const BET_CRASH = (() => {
  const [index] = crashes(INTERCEPT, V14.crib, BET_OFFSET)
  return { index: index!, letter: V14.crib[index!] as Letter }
})()

/** The bet's truth, from the kit: can the crib sit at BET_OFFSET? ('yes' | 'no'). */
export const FITS_TRUTH: 'yes' | 'no' = isConsistentCrib(INTERCEPT, V14.crib, BET_OFFSET) ? 'yes' : 'no'

/** The offsets of the intercept where the crib has no crash (the scene's task target). */
export const INTERCEPT_FREE = zeroCrashOffsets(INTERCEPT, V14.crib)

/** A machine set up like a 1940 Enigma I (rotors from I–V, UKW-B, 10 cables): the scene's "press T" demonstration. */
export const DEMO_MACHINE: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['II', 'IV', 'V'],
  rings: 'BUL',
  positions: 'RTZ',
  plugboard: ['AV', 'BS', 'CG', 'DL', 'FU', 'HZ', 'IN', 'KM', 'OW', 'RX'],
})

/** Every control locked, the keyboard included, and the lamps hidden (the gate is on paper). */
export const READ_ONLY: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: true,
  plugboard: true,
  keyboard: true,
  lampsHidden: true,
}

/**
 * Cribs the gate slides (PLAN §4.3 research notes: “Keine besonderen Ereignisse”, “An die Gruppe”, weather reports;
 * WEUB = Wetterübersicht, YY a separator, SEQS = sechs).
 */
export const CRIBS: readonly string[] = [
  'KEINEBESONDERENEREIGNISSE',
  'ANDIEGRUPPE',
  'WETTERVORHERSAGE',
  'WEUBYYNULLSEQSNULLNULL',
]

// ---------------------------------------------------------------------------
// Message generators (every cipher is a real 1940 encipherment of a plaintext holding the crib at `offset`)
// ---------------------------------------------------------------------------

/** Valid offsets of crash-free never lie this close to either end of the strip (no two-second answers). */
export const EDGE = 4

export interface CribbedIntercept {
  readonly day: MachineConfig
  readonly crib: string
  readonly cipher: string
  /** Where the crib really is (0-based). */
  readonly offset: number
  readonly start: string
}

function message(r: Rng): CribbedIntercept {
  const day = dayKey(r, { era: '1940' })
  const crib = pick(r, CRIBS)
  const length = 40 + int(r, 21)
  const m = cribbedMessage(r, { day, crib, length })
  return { day, crib, cipher: m.cipher, offset: m.offset, start: m.start }
}

/**
 * Generators run many times per instance (the gate engine regenerates an instance from its seed for the draw, the
 * view and the repeat check), and a real encipherment costs a fraction of a millisecond. This cache keys on the
 * seed's first draw and rebuilds the instance from a generator seeded by it: the result is still a pure function of
 * the seed.
 */
export function memoised<I>(make: (r: Rng) => I, size = 800): (r: Rng) => I {
  const cache = new Map<number, I>()
  return (r) => {
    const key = r()
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const value = make(createRng(Math.floor(key * 2 ** 32)))
    if (cache.size >= size) cache.delete(cache.keys().next().value!)
    cache.set(key, value)
    return value
  }
}

/** A different letter from `l`. */
function otherLetter(r: Rng, l: string): Letter {
  for (;;) {
    const x = randLetter(r)
    if (x !== l) return x
  }
}

/**
 * A message with exactly 1–3 offsets where the crib has no crash: the true offset and up to two others, none within
 * EDGE of either end. Wrong zero-crash offsets are given a crash by choosing a different letter outside the kept
 * windows (every cipher letter at a press is reachable by some plaintext letter, so the text is still a genuine
 * encipherment, of a slightly different filler).
 */
export function crashFreeMessage(r: Rng): CribbedIntercept {
  for (;;) {
    const m = message(r)
    const crib = m.crib
    const L = crib.length
    const max = m.cipher.length - L
    if (m.offset < EDGE || m.offset > max - EDGE) continue
    const inside = (k: number) => k >= EDGE && k <= max - EDGE
    const want = 1 + int(r, 3)
    const others = zeroCrashOffsets(m.cipher, crib).filter((k) => k !== m.offset && inside(k))
    const keep = new Set([m.offset, ...sample(r, others, Math.min(want - 1, others.length))])
    // Positions that never change again: the kept windows, and every letter chosen or relied on for a crash.
    const fixed = new Set<number>()
    const fix = (k: number) => range(L).forEach((i) => fixed.add(k + i))
    keep.forEach(fix)
    const cipher = [...m.cipher]
    let ok = true
    for (const k of shuffle(r, range(max + 1).filter((x) => !keep.has(x)))) {
      const hits = range(L).filter((i) => cipher[k + i] === crib[i])
      if (hits.some((i) => fixed.has(k + i))) continue
      if (hits.length) {
        fixed.add(k + pick(r, hits))
        continue
      }
      const free = range(L).filter((i) => !fixed.has(k + i))
      if (free.length) {
        const i = pick(r, free)
        cipher[k + i] = crib[i]!
        fixed.add(k + i)
      } else if (keep.size < 3 && inside(k)) {
        // A window of fixed letters with no crash: one more valid offset, when that is allowed.
        keep.add(k)
        fix(k)
      } else {
        ok = false
        break
      }
    }
    if (!ok) continue
    const text = cipher.join('')
    const zeros = zeroCrashOffsets(text, crib)
    if (zeros.length !== keep.size || zeros.some((k) => !keep.has(k))) continue
    return { ...m, cipher: text }
  }
}

// ---------------------------------------------------------------------------
// crash-free · custom (CribStrip) · inPage · 2/3 (rollback: crib)
// ---------------------------------------------------------------------------

export interface CrashFreeInstance {
  readonly cipher: string
  readonly crib: string
}

/** The last offset of a crib under a cipher. */
export const maxOffset = (i: CrashFreeInstance): number => i.cipher.length - i.crib.length

/** The crib rollback at an offset (clamped into the strip). */
export function cribRollback(cipher: string, crib: string, offset: number): Rollback {
  const max = cipher.length - crib.length
  const k = Math.max(0, Math.min(max, Number.isInteger(offset) ? offset : 0))
  return { kind: 'crib', offset: k, crashes: crashes(cipher, crib, k) }
}

function crashFreeCheck(i: CrashFreeInstance, a: unknown): CheckResult {
  const k = Number(a)
  if (!Number.isInteger(k) || k < 0 || k > maxOffset(i)) {
    return verdict(false, cribRollback(i.cipher, i.crib, 0), 'Slide the crib to an offset under the cipher text.')
  }
  const hits = crashes(i.cipher, i.crib, k)
  const n = hits.length
  return verdict(
    n === 0,
    cribRollback(i.cipher, i.crib, k),
    `At offset ${k} the crib crashes in ${n} column${n === 1 ? '' : 's'}: a letter can never be enciphered to itself, ` +
      'so the crib cannot sit there.',
  )
}

/** The offset nearest to `a` where the crib crashes (a wrong answer next to the learner's). */
function nearestCrash(i: CrashFreeInstance, a: number): number {
  const max = maxOffset(i)
  for (let d = 1; d <= max; d++) {
    for (const k of [a + d, a - d]) if (k >= 0 && k <= max && crashes(i.cipher, i.crib, k).length > 0) return k
  }
  return a
}

const crashFreeGenerate = memoised((r): CrashFreeInstance => {
  const m = crashFreeMessage(r)
  return { cipher: m.cipher, crib: m.crib }
})

export function crashFreeItem(id: string): ItemLogic<CrashFreeInstance, number> {
  return {
    id,
    kind: 'custom',
    rule: WINDOW,
    compute: false,
    inPage: true,
    generate: crashFreeGenerate,
    same: (a, b) => a.cipher === b.cipher && a.crib === b.crib,
    solve: (i) => zeroCrashOffsets(i.cipher, i.crib)[0]!,
    check: crashFreeCheck,
    sampleAnswer: (i, r) => int(r, maxOffset(i) + 1),
    mutate: (i, a) => nearestCrash(i, Number(a)),
    setup: () => ({ stage: null }),
    highlight: () => [],
  }
}

export const crashFree = crashFreeItem('crash-free')

// ---------------------------------------------------------------------------
// crash-count · numbers(1) · 2/3 (rollback: crib)
// ---------------------------------------------------------------------------

export interface CrashCountInstance {
  readonly count: 1
  readonly cipher: string
  readonly crib: string
  /** The offset to check (the crib does not really sit there). */
  readonly offset: number
}

/**
 * A message and an offset with 1–5 crashes. The crash counts at the neighbouring offsets differ from it, so reading
 * the crib one letter out of line is always wrong. Letters of the real crib's span are never edited.
 */
export function crashCountInstance(r: Rng): CrashCountInstance {
  for (;;) {
    const m = message(r)
    const L = m.crib.length
    const max = m.cipher.length - L
    const k = int(r, max + 1)
    if (k === m.offset) continue
    const t = 1 + int(r, 5)
    const inSpan = (p: number) => p >= m.offset && p < m.offset + L
    const cipher = [...m.cipher]
    const fixed = range(L).filter((i) => inSpan(k + i) && cipher[k + i] === m.crib[i])
    const editable = range(L).filter((i) => !inSpan(k + i))
    if (fixed.length > t || fixed.length + editable.length < t) continue
    const add = new Set(sample(r, editable, t - fixed.length))
    for (const i of editable) {
      if (add.has(i)) cipher[k + i] = m.crib[i]!
      else if (cipher[k + i] === m.crib[i]) cipher[k + i] = otherLetter(r, m.crib[i]!)
    }
    const text = cipher.join('')
    const n = crashes(text, m.crib, k).length
    const neighbours = [k - 1, k + 1].filter((x) => x >= 0 && x <= max).map((x) => crashes(text, m.crib, x).length)
    if (n !== t || neighbours.includes(n)) continue
    return { count: 1, cipher: text, crib: m.crib, offset: k }
  }
}

export const crashCount = numbersItem<CrashCountInstance>({
  id: 'crash-count',
  rule: WINDOW,
  range: [0, 25],
  generate: memoised(crashCountInstance),
  same: (a, b) => a.cipher === b.cipher && a.crib === b.crib && a.offset === b.offset,
  solve: (i) => [crashes(i.cipher, i.crib, i.offset).length],
  check(i, a) {
    const hits = crashes(i.cipher, i.crib, i.offset)
    const got = Array.isArray(a) ? Number(a[0]) : NaN
    return verdict(
      Array.isArray(a) && a.length === 1 && got === hits.length,
      cribRollback(i.cipher, i.crib, i.offset),
      'Compare every column: the cipher letter above, the crib letter below.',
    )
  },
  sampleAnswer: (i, r) => [int(r, i.crib.length + 1)],
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// is-consistent-crib · code · 2/3 (rollback: crib at the probe's offset)
// ---------------------------------------------------------------------------

export interface CribCodeInstance {
  readonly seed: number
  readonly cipher: string
  readonly crib: string
  /** The probe's offset (≥ 1; the crib crashes there). */
  readonly offset: number
}

/**
 * A message and a probe offset k ≥ 1 whose first crash sits at a uniformly drawn crib index f. The crash count at k
 * differs from f, so answering the count, the cipher index (k + f) or a 1-based index is always wrong.
 */
export function cribCodeInstance(r: Rng): CribCodeInstance {
  for (;;) {
    const m = message(r)
    const L = m.crib.length
    const max = m.cipher.length - L
    const f = int(r, L)
    const k = 1 + int(r, max)
    if (k === m.offset) continue
    const inSpan = (p: number) => p >= m.offset && p < m.offset + L
    const cipher = [...m.cipher]
    let ok = true
    for (let i = 0; i < f && ok; i++) {
      if (cipher[k + i] !== m.crib[i]) continue
      if (inSpan(k + i)) ok = false
      else cipher[k + i] = otherLetter(r, m.crib[i]!)
    }
    if (cipher[k + f] !== m.crib[f]) {
      if (inSpan(k + f)) ok = false
      else cipher[k + f] = m.crib[f]!
    }
    if (!ok) continue
    const text = cipher.join('')
    const hits = crashes(text, m.crib, k)
    if (hits[0] !== f || hits.length === f) continue
    return { seed: int(r, 2 ** 31), cipher: text, crib: m.crib, offset: k }
  }
}

/** The probe's answer: the crib index of the first crash at the instance's offset, −1 when there is none. */
export const firstCrash = (i: Pick<CribCodeInstance, 'cipher' | 'crib' | 'offset'>): number =>
  crashes(i.cipher, i.crib, i.offset)[0] ?? -1

export const IS_CONSISTENT_REFERENCE = [
  'function isConsistentCrib(cipher, crib, offset) {',
  '  if (offset < 0 || offset + crib.length > cipher.length) return false',
  '  for (let i = 0; i < crib.length; i++) {',
  '    if (cipher[offset + i] === crib[i]) return false',
  '  }',
  '  return true',
  '}',
  '',
].join('\n')

const FN = 'isConsistentCrib'

/** The visible tests (the first three cases): the same on every instance, never the probe. */
export const VISIBLE_CASES: readonly CodeCase[] = [
  { label: 'the textbook example', fn: FN, args: [V14.cipher, V14.crib, 0], expect: true },
  { label: 'O under O', fn: FN, args: ['KLMNOPQ', 'XYOZ', 2], expect: false },
  { label: 'past the end', fn: FN, args: ['KLMNOPQ', 'XYOZ', 4], expect: false },
]

const EDGE_CASES: readonly (readonly [string, string, number])[] = [
  ['ABC', 'AXY', 0],
  ['ABCD', 'XYZD', 0],
  ['ABCDE', 'XY', 3],
  ['ABCDE', 'XY', -1],
  ['AB', 'XYZ', 0],
  ['ABC', 'ABC', 0],
  ['QRSTUV', 'TUVW', 2],
]

function randomText(r: Rng, n: number): string {
  return Array.from({ length: n }, () => randLetter(r, 8)).join('')
}

export function cribCases(i: CribCodeInstance): CodeCase[] {
  const r = createRng(i.seed)
  const out: CodeCase[] = [...VISIBLE_CASES]
  const add = (label: string, cipher: string, crib: string, offset: number) =>
    out.push({ label, fn: FN, args: [cipher, crib, offset], expect: isConsistentCrib(cipher, crib, offset) })
  EDGE_CASES.forEach(([c, p, k], j) => add(`edge ${j + 1}`, c, p, k))
  const max = i.cipher.length - i.crib.length
  const offsets = new Set<number>()
  // Every zero-crash offset of the message, and random ones (both ends and past them included).
  for (const k of zeroCrashOffsets(i.cipher, i.crib)) offsets.add(k)
  while (offsets.size < 12) offsets.add(int(r, max + 5) - 2)
  offsets.delete(i.offset)
  for (const k of [...offsets].sort((a, b) => a - b)) add(`the message at offset ${k}`, i.cipher, i.crib, k)
  // Short random texts on eight letters, so crashes are common.
  for (let j = 0; j < 8; j++) {
    const cipher = randomText(r, 6 + int(r, 6))
    const crib = randomText(r, 2 + int(r, 4))
    add(`random ${j + 1}`, cipher, crib, int(r, cipher.length - crib.length + 3) - 1)
  }
  return out
}

export const isConsistent = codeItem<CribCodeInstance>(
  {
    fnNames: [FN],
    signature: 'isConsistentCrib(cipher: string, crib: string, offset: number): boolean',
    brief:
      'Write isConsistentCrib(cipher, crib, offset). Place the crib under the cipher text so that its first letter sits ' +
      'under cipher[offset] (offsets count from 0). Return true when the crib fits under the cipher text there and no ' +
      'crib letter sits under the same cipher letter (a crash); return false otherwise, including when the crib does ' +
      'not fit.',
    starter: 'function isConsistentCrib(cipher, crib, offset) {\n  // your code here\n}\n',
    provided: '',
    maxLines: 6,
    reference: IS_CONSISTENT_REFERENCE,
    cases: cribCases,
    probe: (i) => ({
      call: `the crib index of the first crash at offset ${i.offset} (−1 if none)`,
      expected: String(firstCrash(i)),
    }),
  },
  {
    id: 'is-consistent-crib',
    rule: WINDOW,
    generate: memoised(cribCodeInstance),
    same: (a, b) => a.cipher === b.cipher && a.crib === b.crib && a.offset === b.offset,
    setup: () => ({ stage: null }),
    highlight: () => [],
    rollback: (i) => cribRollback(i.cipher, i.crib, i.offset),
  },
)

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  cribs: {
    items: [crashFree, crashCount, isConsistent] as ItemLogic[],
    fallback: crashFree as ItemLogic,
  },
}
