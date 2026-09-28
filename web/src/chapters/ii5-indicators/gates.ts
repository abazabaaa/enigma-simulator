/**
 * Chapter ii5-indicators · gate `indicators` (PLAN §4.4). PURE (L4): engine, lib/rng, crypto, contracts and
 * lesson/kinds only.
 *  - fill-ad         custom (in-page) · 2/3 · fill 8 cells of AD from 12–20 indicators of a generated day
 *  - ad-fixed-point  choice(4) · once · constant answer · a fixed point of AD is legitimate (instance-varied)
 *  - build-ad        code · 2/3 · buildAD(indicators) → 26 characters, paired with the prediction AD(X)
 *  - rejewski-steps  order(6) · once · constant answer · from the doubled key to AD's cycles (Parsons)
 *  - fallback fill-ad
 * Every counted instance needs the key idea (letters 1 and 4 of an indicator come from the same key letter): the
 * generators redraw any instance that a naive reading (MISREADINGS) would get right.
 * The scene Views import the day, the bet truths and the helpers below, so scenes, prompts and checks agree.
 */

import type { Choice, Letter, MachineConfig } from '../../contracts/core'
import type { CodeAnswer } from '../../contracts/code'
import type { ChapterGates, CheckResult, ItemLogic } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import {
  REJEWSKI_65,
  dayKey,
  encryptIndicator,
  makeIndicators,
  productsFromMachine,
  products,
  sixPermutations,
} from '../../crypto'
import { LETTERS, createMachine, fixedPoints, normalizeConfig, pressKey, step } from '../../engine'
import { createRng, int, pick, randLetter, sample, shuffle, type Rng } from '../../lib/rng'
import { choiceItem, codeItem, orderItem, orderRollback, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Letter of an index (A = 0), wrapping. */
export const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
/** Index of a letter (either case), −1 for anything else. */
export const idx = (l: string): number => LETTERS.indexOf(String(l).toUpperCase() as Letter)
/** An indicator as it was written: 'AUQAMN' → 'AUQ AMN'. */
export const spaced = (s: string): string => `${s.slice(0, 3)} ${s.slice(3)}`

// ---------------------------------------------------------------------------
// The chapter's machine and the scenes' truths
// ---------------------------------------------------------------------------

/**
 * The scene day: an Enigma I of the time (UKW-A, rotors I–III, six cables) at its Grundstellung YJS. Its AD, BE and
 * CF have no fixed point (11 11 2 2 · 7 7 6 6 · 6 6 4 4 3 3), so whatever key an operator types twice, no letter of
 * the second half repeats the letter above it: the `halves` bet has one answer for every key.
 */
export const DAY: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'A',
  rotors: ['I', 'III', 'II'],
  rings: 'DUM',
  positions: 'YJS',
  plugboard: ['MC', 'LD', 'EX', 'WA', 'OU', 'YV'],
})

/** Every setting fixed; the keyboard is the learner's (the double-key scene). */
export const KEYS_ONLY: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: true,
  plugboard: true,
}

/** Every control locked, the keyboard included, and the lamps hidden (table scenes and the gate). */
export const READ_ONLY: MachineLocks = { ...KEYS_ONLY, keyboard: true, lampsHidden: true }

/** The six machine permutations' products for DAY (the engine's own, with stepping). */
export const DAY_PRODUCTS = productsFromMachine(DAY)

/** The `halves` bet's truth for DAY: 'differ' when no product has a fixed point (no key can repeat a letter). */
export const HALVES_TRUTH: 'differ' | 'first' | 'match' = (() => {
  const fixed = [DAY_PRODUCTS.AD, DAY_PRODUCTS.BE, DAY_PRODUCTS.CF].map((p) => fixedPoints(p).length > 0)
  if (fixed.every((f) => !f)) return 'differ'
  return fixed.every(Boolean) ? 'match' : 'first'
})()

export const HALVES_OPTIONS: readonly Choice[] = [
  { id: 'match', label: 'The second three letters repeat the first three', misconception: true },
  { id: 'differ', label: 'The second three letters are different from the first three' },
  { id: 'first', label: 'Only the first letter repeats', misconception: true },
]

/** The 65 indicators' products (vector 13): AD, BE, CF as letter indices; CF resolves the one conflict by majority. */
export const SIXTY_FIVE = products(REJEWSKI_65)
const full = (p: readonly (number | null)[]): number[] => p.map((x) => x ?? 0)
/** Vector 13's AD, BE and CF as permutations (every letter is determined by the 65). */
export const AD65 = full(SIXTY_FIVE.AD)
export const BE65 = full(SIXTY_FIVE.BE)
export const CF65 = full(SIXTY_FIVE.CF)

/** The `ad-fixed` bet's truth: does the 65 indicators' AD send some letter to itself? */
export const AD_FIXED_TRUTH: 'yes' | 'no' = fixedPoints(AD65).length > 0 ? 'yes' : 'no'

/** The index of the first of the 65 that contradicts an earlier majority (SYZ SCW), or −1. */
export const CONFLICT_AT: number = (() => {
  for (let k = 1; k <= REJEWSKI_65.length; k++) {
    if (products(REJEWSKI_65.slice(0, k)).conflicts.length) return k - 1
  }
  return -1
})()

/** A permutation as its image letters ('ACB…'), '?' for an unknown cell. */
export const imagesOf = (p: readonly (number | null)[]): string => p.map((x) => (x === null ? '?' : L(x))).join('')

/** AD as observed from indicators: the image of each letter, null where no indicator starts with it. */
export const adOf = (indicators: readonly string[]): (number | null)[] => [...products(indicators).AD]

/**
 * The letters a key letter passes through at press `press` (1…6) from the day's Grundstellung: the key, then the
 * output of each stage (plugboard, entry wheel, rotors, reflector, rotors, entry wheel, plugboard). The last is the lamp.
 */
export function pathAtPress(day: MachineConfig, press: number, key: string): string[] {
  let state = createMachine(day)
  for (let k = 1; k < press; k++) state = step(state).state
  return [key.toUpperCase(), ...pressKey(state, key).trace.map((t) => t.output)]
}

/** The first indicator in the list whose letter `pos` (0-based) is `letter`, or null. */
export function indicatorWith(indicators: readonly string[], pos: number, letter: number): string | null {
  return indicators.find((s) => s[pos] === L(letter)) ?? null
}

// ---------------------------------------------------------------------------
// Misreadings: the naive strategies the gate must defeat (MISCONCEPTION BOTS)
// ---------------------------------------------------------------------------

/** How a learner with a misconception fills cell `x` (a letter index) from the indicators ('' when stuck). */
export const MISREADINGS: Readonly<Record<string, (indicators: readonly string[], x: number) => string>> = {
  /** "The key is typed twice, so the halves repeat": AD sends every letter to itself. */
  same: (_s, x) => L(x),
  /** Neighbouring letters: letter 1 → letter 2. */
  next: (s, x) => indicatorWith(s, 0, x)?.[1] ?? '',
  /** AD read backwards: letter 4 → letter 1. */
  backwards: (s, x) => indicatorWith(s, 3, x)?.[0] ?? '',
  /** The wrong pair of positions: letter 2 → letter 5 (that is BE). */
  second: (s, x) => indicatorWith(s, 1, x)?.[4] ?? '',
}

// ---------------------------------------------------------------------------
// fill-ad: custom, in-page (rollback: perm)
// ---------------------------------------------------------------------------

export interface FillAdInstance {
  /** 12–20 indicators of one generated day, six letters each. */
  readonly indicators: readonly string[]
  /** The 8 letters (indices, ascending) whose AD cell the learner fills; each starts at least one indicator. */
  readonly targets: readonly number[]
}

/** The learner's letters for the target cells, in target order ('' for a blank cell). */
export type FillAdAnswer = readonly string[]

export const FILL_COUNT = 8

/** The cells of `targets` where `answer` disagrees with the indicators (`ad`: their AD, when already known). */
export function fillAdWrongCells(i: FillAdInstance, answer: unknown, ad = adOf(i.indicators)): number[] {
  const got = Array.isArray(answer) ? (answer as unknown[]) : []
  return i.targets.filter((t, k) => String(got[k] ?? '').toUpperCase() !== L(ad[t]!))
}

/** What each misreading would type into the target cells. */
export const misreadFill = (i: FillAdInstance, how: keyof typeof MISREADINGS): string[] =>
  i.targets.map((t) => MISREADINGS[how]!(i.indicators, t))

export function generateFillAd(r: Rng): FillAdInstance {
  for (;;) {
    const day = dayKey(r, { era: '1932' })
    const { indicators } = makeIndicators(r, day, 12 + int(r, 9))
    const ad = adOf(indicators)
    const known = ad.flatMap((v, x) => (v === null ? [] : [x]))
    if (known.length < FILL_COUNT) continue
    const inst: FillAdInstance = { indicators, targets: sample(r, known, FILL_COUNT).sort((a, b) => a - b) }
    // Every naive reading must get at least one cell wrong.
    if (Object.keys(MISREADINGS).every((how) => fillAdWrongCells(inst, misreadFill(inst, how), ad).length > 0)) return inst
  }
}

export function fillAdItem(id: string): ItemLogic<FillAdInstance, FillAdAnswer> {
  return {
    id,
    kind: 'custom',
    rule: WINDOW,
    compute: true,
    inPage: true,
    generate: (r) => generateFillAd(r),
    same: (a, b) => sameJson(a.indicators, b.indicators),
    solve(i) {
      const ad = adOf(i.indicators)
      return i.targets.map((t) => L(ad[t]!))
    },
    check(i, a): CheckResult {
      const wrongCells = fillAdWrongCells(i, a)
      return verdict(wrongCells.length === 0, { kind: 'perm', wrongCells })
    },
    sampleAnswer: (i, r) => i.targets.map(() => randLetter(r)),
    mutate(i, a, r) {
      const k = int(r, i.targets.length)
      return i.targets.map((_, j) => {
        const x = String(a[j] ?? 'A')
        return j === k ? L(idx(x) + 1) : x
      })
    },
    setup: () => ({ stage: null }),
    highlight: () => [],
  }
}

export const fillAd = fillAdItem('fill-ad')

// ---------------------------------------------------------------------------
// ad-fixed-point: choice(4), once, constant answer, instance-varied (rollback: none)
// ---------------------------------------------------------------------------

export interface FixedPointInstance {
  readonly options: readonly Choice[]
  /** A letter that AD sends to itself on this day. */
  readonly letter: Letter
  /** Two indicators of the day whose letters 1 and 4 are both `letter`. */
  readonly evidence: readonly string[]
}

export const FIXED_OPTIONS: readonly Choice[] = [
  { id: 'product', label: 'Nothing is wrong: AD combines two different machine positions, and together they can bring a letter back' },
  { id: 'faulty', label: 'The machine is faulty: an Enigma never enciphers a letter to itself', misconception: true },
  { id: 'mistyped', label: 'The two operators mistyped their message keys', misconception: true },
  { id: 'unplugged', label: 'That letter has no plugboard cable', misconception: true },
]

/** Why a distractor fails, for the instance's letter, without naming the right option. */
export const FIXED_FEEDBACK: Readonly<Record<string, (letter: string) => string>> = {
  faulty: (x) =>
    `Check each press on its own: press 1 turned the operator's key letter into ${x}, and press 4 turned the same ` +
    `key letter into ${x} again. Neither press sent a letter to itself. Which presses does AD combine?`,
  mistyped: () =>
    'Two different operators on the same day show the same pattern: a slip of the finger would not repeat like that.',
  unplugged: () =>
    'A cable decides which letters swap before and after the rotors; it cannot make one press undo another.',
}

export function generateFixedPoint(r: Rng): FixedPointInstance {
  for (;;) {
    const day = dayKey(r, { era: '1932' })
    const { AD } = productsFromMachine(day)
    const fixed = fixedPoints(AD)
    if (!fixed.length) continue
    const x = pick(r, fixed)
    // The key letter that press 1 turns into x: A is its own inverse, so it is A(x).
    const k = L(sixPermutations(day)[0]![x]!)
    const keys = [0, 1].map(() => k + randLetter(r) + randLetter(r))
    return { options: shuffle(r, FIXED_OPTIONS), letter: L(x), evidence: keys.map((key) => encryptIndicator(day, key)) }
  }
}

export const adFixedPoint = choiceItem<FixedPointInstance>({
  id: 'ad-fixed-point',
  rule: ONCE,
  constantAnswer: true,
  generate: (r) => generateFixedPoint(r),
  same: (a, b) => sameJson([a.options, a.evidence], [b.options, b.evidence]),
  solve: () => 'product',
  check: (i, a) =>
    verdict(
      a === 'product',
      { kind: 'none' },
      FIXED_FEEDBACK[String(a)]?.(i.letter) ?? 'Look at which two presses AD combines.',
    ),
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// build-ad: code, paired with the prediction AD(X) for the shown indicators (rollback: perm)
// ---------------------------------------------------------------------------

export interface BuildAdInstance {
  readonly seed: number
  /** 6–10 indicators of one generated day, shown in the prompt. */
  readonly indicators: readonly string[]
  /** The letter whose image the learner predicts: AD(letter). */
  readonly letter: Letter
}

export const BUILD_AD_REFERENCE =
  'function buildAD(indicators) {\n' +
  "  const ad = new Array(26).fill('?')\n" +
  '  for (const s of indicators) ad[s.charCodeAt(0) - 65] = s[3]\n' +
  "  return ad.join('')\n" +
  '}\n'

/** The expected return value: 26 characters, the image of A, B, … or '?'. */
export const buildAdExpected = (indicators: readonly string[]): string => imagesOf(adOf(indicators))

/** The prediction's answer: the letter AD sends `letter` to, for the shown indicators. */
export const buildAdProbe = (i: BuildAdInstance): string => L(adOf(i.indicators)[idx(i.letter)]!)

export function generateBuildAd(r: Rng): BuildAdInstance {
  const seed = int(r, 2 ** 31)
  for (;;) {
    const day = dayKey(r, { era: '1932' })
    const { indicators } = makeIndicators(r, day, 6 + int(r, 5))
    const ad = adOf(indicators)
    // A letter whose image no naive reading gives (so the prediction needs letters 1 and 4).
    const ok = LETTERS.filter((_, x) => {
      const truth = ad[x]
      if (truth === null || truth === undefined) return false
      return Object.values(MISREADINGS).every((read) => read(indicators, x) !== L(truth))
    })
    if (ok.length) return { seed, indicators, letter: pick(r, ok) }
  }
}

function buildAdCases(i: BuildAdInstance) {
  const r = createRng(i.seed)
  const lists: { label: string; list: readonly string[] }[] = [
    { label: 'one indicator', list: ['ABCDEF'] },
    { label: 'two keys', list: ['QWERTZ', 'ASDFGH'] },
    { label: 'a repeated first letter', list: ['KAPMXQ', 'KZUMLB', 'BNHCHL'] },
    { label: 'no indicators', list: [] },
    { label: 'the 65 indicators (vector 13)', list: REJEWSKI_65 },
  ]
  // 20 random lists from four generated days (a pool of 30 indicators each: cheap for the bots and the lint).
  for (let d = 0; d < 4; d++) {
    const pool = makeIndicators(r, dayKey(r, { era: '1932' }), 30).indicators
    for (let k = 0; k < 5; k++) lists.push({ label: `day ${d + 1}, list ${k + 1}`, list: sample(r, pool, 1 + int(r, 30)) })
  }
  lists.push({ label: 'the shown indicators', list: i.indicators })
  return lists.map(({ label, list }, k) => ({
    label: `#${k + 1} ${label}`,
    fn: 'buildAD',
    args: [list],
    expect: buildAdExpected(list),
  }))
}

/** The perm rollback of a wrong run: the predicted cell, or the cells where the first failing case differed. */
export function buildAdRollback(i: BuildAdInstance, a: CodeAnswer) {
  const probeWrong = String(a?.probe ?? '').trim().toUpperCase() !== buildAdProbe(i)
  if (probeWrong) return { kind: 'perm' as const, wrongCells: [idx(i.letter)] }
  const f = a?.run?.firstFailure
  let wrongCells: number[] = []
  try {
    const want = JSON.parse(f?.expected ?? 'null') as unknown
    const got = JSON.parse(f?.actual ?? 'null') as unknown
    if (typeof want === 'string' && want.length === 26) {
      const g = typeof got === 'string' ? got : ''
      wrongCells = [...want].flatMap((c, k) => (g[k] === c ? [] : [k]))
    }
  } catch {
    wrongCells = []
  }
  return { kind: 'perm' as const, wrongCells }
}

export const buildAd = codeItem<BuildAdInstance>(
  {
    fnNames: ['buildAD'],
    signature: 'buildAD(indicators: string[]): string',
    brief:
      'Each indicator is six capital letters: a three-letter message key typed twice from the same start position. ' +
      "Write buildAD(indicators), which returns AD as 26 characters: position 0 holds the letter AD sends A to, " +
      "position 1 the image of B, and so on, with '?' where no indicator tells. Before you run it, predict one cell " +
      'for the indicators shown above.',
    starter: 'function buildAD(indicators) {\n  // 26 characters: the image of A, of B, …, or ? when unknown\n}\n',
    provided: '',
    maxLines: 10,
    reference: BUILD_AD_REFERENCE,
    cases: buildAdCases,
    probe: (i) => ({ call: `AD(${i.letter})`, expected: buildAdProbe(i) }),
  },
  {
    id: 'build-ad',
    rule: WINDOW,
    generate: (r) => generateBuildAd(r),
    same: (a, b) => a.seed === b.seed || sameJson(a.indicators, b.indicators),
    setup: () => ({ stage: null }),
    highlight: () => [],
    rollback: buildAdRollback,
  },
)

// ---------------------------------------------------------------------------
// rejewski-steps: order(6), once, constant answer (rollback: order)
// ---------------------------------------------------------------------------

export const STEP_BLOCKS: readonly Choice[] = [
  { id: 'grund', label: "The operator turns the rotors to the day's Grundstellung" },
  { id: 'twice', label: 'He types his three-letter message key twice' },
  { id: 'send', label: 'The six lamp letters go out at the head of the message: the indicator' },
  { id: 'collect', label: "Warsaw collects the day's indicators" },
  { id: 'pair', label: 'Letters 1 and 4 of each indicator fill one cell of AD (2 and 5 fill BE, 3 and 6 fill CF)' },
  { id: 'cycles', label: 'With the table full, following it letter to letter writes AD as cycles' },
]
export const STEP_ORDER = STEP_BLOCKS.map((b) => b.id)

export const rejewskiSteps = orderItem<{ blocks: readonly Choice[] }>({
  id: 'rejewski-steps',
  rule: ONCE,
  constantAnswer: true,
  generate(r) {
    let blocks = shuffle(r, STEP_BLOCKS)
    while (sameJson(blocks.map((b) => b.id), STEP_ORDER)) blocks = shuffle(r, STEP_BLOCKS)
    return { blocks }
  },
  same: (a, b) => sameJson(a.blocks, b.blocks),
  solve: () => [...STEP_ORDER],
  check: (_i, a) => verdict(sameJson(a, STEP_ORDER), orderRollback(STEP_ORDER, Array.isArray(a) ? a : [])),
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  indicators: {
    items: [fillAd, adFixedPoint, buildAd, rejewskiSteps] as ItemLogic[],
    fallback: fillAd as ItemLogic,
  },
}
