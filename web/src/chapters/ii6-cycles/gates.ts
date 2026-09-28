/**
 * Chapter ii6-cycles · gate `cycles` (PLAN §4.4; problem-first). PURE (L4): engine, lib/rng, crypto, contracts and
 * lesson/kinds only.
 *  - lengths        numbers (multiset) · 2/3 · the cycle lengths of XY, X and Y swap-only on 18–22 letters, the type
 *                   drawn uniformly (no guessed answer is right on more than 1 instance in 29)
 *  - relabel        letters · 2/3 · a day's AD plus one new cable X–Y → the cycle of the new AD through X, from X
 *  - stecker-set    set-machine · 2/3 · add exactly one cable so that X and Y share a cycle of AD
 *  - cycle-lengths  code · 2/3 · cycleLengths(perm), paired with the prediction cycleLengths(AD) for the shown day
 *                   (days thinned so that no AD type is the answer on more than about 2 % of them)
 *  - align-pair     custom (in-page) · 2/3 · line every long cycle of XY up under its partner, one known swap each
 *  - fallback stecker-set
 * Every counted instance needs the chapter's idea: the generators redraw or flatten what a naive or constant answer
 * would get right (the naive* helpers and the MISCONCEPTION and CONSTANT BOT tests). Scenes import the truths below.
 */

import type { Choice, Letter, MachineConfig } from '../../contracts/core'
import type { CodeAnswer } from '../../contracts/code'
import type { ChapterGates, CheckResult, ItemLogic, ItemSetup, Rollback } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { StageRef } from '../../contracts/stage'
import {
  REJEWSKI_65,
  alignmentPairs,
  dayKey,
  isPairedType,
  pairedCycles,
  products,
} from '../../crypto'
import {
  LETTERS,
  REFLECTOR_PERMS,
  compose,
  conjugate,
  createMachine,
  cycleSignature,
  cycles,
  formatCycles,
  fromCycles,
  fromPairs,
  identity,
  machinePermutation,
  normalizeConfig,
  shift,
  step,
} from '../../engine'
import { createRng, int, pick, randomPerm, shuffle, type Rng } from '../../lib/rng'
import { codeItem, lettersItem, numbersItem, numbersMatch, partitions, setMachineItem, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
export const idx = (l: string): number => LETTERS.indexOf(String(l).toUpperCase() as Letter)
/** A cable as it is written on the plugboard: 'FN' → 'F–N'. */
export const dash = (pair: string): string => `${pair[0]}–${pair[1]}`

/** The cycle of `p` that contains `x`, starting at x. */
export function cycleOf(p: readonly number[], x: number): number[] {
  const out = [x]
  for (let y = p[x]!; y !== x; y = p[y]!) out.push(y)
  return out
}

/** A cycle as lower-case letters in brackets: (afhq). */
export const cycleText = (c: readonly number[]): string => `(${c.map((x) => L(x).toLowerCase()).join('')})`

// ---------------------------------------------------------------------------
// The chapter's machine and the scenes' truths
// ---------------------------------------------------------------------------

/**
 * The day of the stecker-toggle scene and the gate: an Enigma I of the time (UKW-A, rotors I–III, six cables) at its
 * Grundstellung ZPQ. AD = (afhq)(beuyiv)(csolmz)(dwp)(gkxt)(jnr): lengths 6 6 4 4 3 3.
 */
export const DAY: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'A',
  rotors: ['II', 'I', 'III'],
  rings: 'JZL',
  positions: 'ZPQ',
  plugboard: ['SY', 'LO', 'UV', 'XW', 'PR', 'AE'],
})

/** Every control locked, the keyboard included, and the lamps hidden. */
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
 * AD of a machine at its Grundstellung: the engine's machine permutation at press 1, then at press 4 (with stepping).
 * The same as productsFromMachine(cfg).AD, without computing BE and CF.
 */
export function adOf(cfg: MachineConfig): number[] {
  let state = createMachine(cfg)
  const at: (readonly number[])[] = []
  for (let press = 1; press <= 4; press++) {
    state = step(state).state
    if (press === 1 || press === 4) at.push(machinePermutation(state))
  }
  return [...compose(at[0]!, at[1]!)]
}

/** The letters a configuration leaves without a cable. */
export const freeLetters = (cfg: MachineConfig): number[] => {
  const used = new Set(cfg.plugboard.join(''))
  return LETTERS.flatMap((l, x) => (used.has(l) ? [] : [x]))
}

export const withCable = (cfg: MachineConfig, pair: string): MachineConfig =>
  normalizeConfig({ ...cfg, plugboard: [...cfg.plugboard, pair] })

export const DAY_AD = adOf(DAY)

/** The cable the stecker-toggle reveal adds: two free letters in AD cycles of different lengths. */
export const DEMO_CABLE = 'FN'

/** The `lengths` bet's truth, from two ADs: do the cycle lengths change? */
export const lengthsTruth = (before: readonly number[], after: readonly number[]): 'unchanged' | 'change' =>
  sameJson(cycleSignature(before), cycleSignature(after)) ? 'unchanged' : 'change'

/** The truth for the scene's own cable, computed at the scene's setup. */
export const LENGTHS_TRUTH = lengthsTruth(DAY_AD, adOf(withCable(DAY, DEMO_CABLE)))

export const LENGTHS_OPTIONS: readonly Choice[] = [
  { id: 'change', label: 'They change', misconception: true },
  { id: 'unchanged', label: 'They stay the same' },
  { id: 'sometimes', label: 'It depends on the cable', misconception: true },
]

/** Rejewski's hexagon: X = (ab)(cd)(ef), Y = (bc)(de)(fa), and their product XY (X first). */
export const HEX_X = fromCycles('(ab)(cd)(ef)', 6)
export const HEX_Y = fromCycles('(bc)(de)(fa)', 6)
export const HEX_P = compose(HEX_X, HEX_Y)

/** The `pairs` bet's truth, from the product's own cycle lengths. */
export const PAIRS_TRUTH: 'pairs' | 'twos' | 'none' = (() => {
  const sig = cycleSignature(HEX_P)
  if (sig.every((l) => l === 2)) return 'twos'
  return isPairedType(sig) ? 'pairs' : 'none'
})()

export const PAIRS_OPTIONS: readonly Choice[] = [
  { id: 'pairs', label: 'Its cycles come in pairs of the same length' },
  { id: 'twos', label: 'All its cycles have length 2, like X and Y', misconception: true },
  { id: 'none', label: 'Its cycle lengths follow no pattern', misconception: true },
]

/** The product traced letter by letter, cycle by cycle: x →X→ via →Y→ to. */
export const HEX_STEPS: readonly { from: number; via: number; to: number }[] = cycles(HEX_P).flatMap((c) =>
  c.map((x) => ({ from: x, via: HEX_X[x]!, to: HEX_P[x]! })),
)

const SIXTY_FIVE = products(REJEWSKI_65)
const full = (p: readonly (number | null)[]): number[] => p.map((x) => x ?? 0)
/** Vector 13 (the 65 indicators): AD, BE and CF. */
export const AD65 = full(SIXTY_FIVE.AD)
export const BE65 = full(SIXTY_FIVE.BE)
export const CF65 = full(SIXTY_FIVE.CF)
/** CF's two 13-cycles. */
export const CF_PAIR = pairedCycles(CF65)[0] as [number[], number[]]

/**
 * The split of `p` = compose(X, Y) that writing cycle `b` under cycle `a` implies: X swaps each column, Y = compose(X, p)
 * (X first, then p). The split is valid when Y, on the letters of the two cycles, swaps letters in pairs as well.
 */
export function splitFromAlignment(
  p: readonly number[],
  a: readonly number[],
  b: readonly number[],
  offset: number,
  reversed: boolean,
): { x: number[]; y: number[]; valid: boolean } {
  const x = [...identity(p.length)]
  for (const [u, v] of alignmentPairs(a, b, offset, reversed)) {
    x[u] = v
    x[v] = u
  }
  const y = [...compose(x, p)]
  const letters = [...a, ...b]
  const valid = letters.every((u) => y[u] !== u && y[y[u]!] === u)
  return { x, y, valid }
}

// ---------------------------------------------------------------------------
// lengths: numbers (multiset), the cycle lengths of XY (rollback: cycles)
// ---------------------------------------------------------------------------

export interface LengthsInstance {
  readonly count: 'any'
  /** 18, 20 or 22 letters. */
  readonly n: number
  /** Two permutations made only of swaps, no letter fixed; the product is XY = compose(x, y). */
  readonly x: readonly number[]
  readonly y: readonly number[]
}

/** The letter counts of the lengths item: enough cycle types that no guessed answer comes up often. */
export const LENGTH_SIZES = [18, 20, 22] as const

const typeCache = new Map<number, number[][]>()

/**
 * The cycle types XY can have on n letters (Rejewski's theorems 1 and 2: every partition of n/2, each part twice),
 * as the partition parts, without "all ones" (X = Y) and "all twos" (the product looks like a set of swaps).
 */
export function lengthTypes(n: number): number[][] {
  let types = typeCache.get(n)
  if (!types) {
    types = partitions(n / 2).filter((p) => !p.every((x) => x === 1) && !p.every((x) => x === 2))
    typeCache.set(n, types)
  }
  return types
}

/**
 * X and Y, swap-only on n letters, whose product XY has two cycles of each length in `parts` (Rejewski's theorem 2):
 * each part l takes 2l shuffled letters a1 … a2l, X = (a1 a2)(a3 a4)…, Y = (a2 a3)(a4 a5)…(a2l a1), and then
 * XY = (a1 a3 … a2l−1)(a2l … a4 a2).
 */
export function swapsForType(r: Rng, n: number, parts: readonly number[]): { x: number[]; y: number[] } {
  const letters = shuffle(
    r,
    Array.from({ length: n }, (_, k) => k),
  )
  const x = Array.from({ length: n }, (_, k) => k)
  const y = [...x]
  let at = 0
  for (const l of parts) {
    const a = letters.slice(at, at + 2 * l)
    at += 2 * l
    for (let k = 0; k < 2 * l; k += 2) [x[a[k]!], x[a[k + 1]!]] = [a[k + 1]!, a[k]!]
    for (let k = 1; k < 2 * l; k += 2) {
      const [u, v] = [a[k]!, a[(k + 1) % (2 * l)]!]
      ;[y[u], y[v]] = [v, u]
    }
  }
  return { x, y }
}

/** The naive answer "a product of swaps is made of swaps too": n/2 twos. */
export const naiveLengths = (i: { n: number }): number[] => Array.from({ length: i.n / 2 }, () => 2)

/** The first cycle of `perm` whose length the learner did not count, or [] when every cycle was counted. */
function missedCycle(perm: readonly number[], got: readonly number[]): number[] {
  const pool = [...got]
  return (
    cycles(perm).find((c) => {
      const k = pool.indexOf(c.length)
      if (k === -1) return true
      pool.splice(k, 1)
      return false
    }) ?? []
  )
}

function lengthsRollback(perm: readonly number[], got: unknown): Rollback {
  const counted = Array.isArray(got) ? (got as unknown[]).map(Number).filter(Number.isFinite).sort((a, b) => b - a) : []
  return { kind: 'cycles', perm: [...perm], cycle: missedCycle(perm, counted), expected: cycleSignature(perm), got: counted }
}

export const lengths = numbersItem<LengthsInstance>({
  id: 'lengths',
  rule: WINDOW,
  range: [0, 26],
  multiset: true,
  // The cycle type is drawn uniformly among the types of n: no single answer is likely (29, 40 or 55 types).
  generate(r) {
    const n = pick(r, LENGTH_SIZES)
    const { x, y } = swapsForType(r, n, pick(r, lengthTypes(n)))
    return { count: 'any', n, x, y }
  },
  same: (a, b) => sameJson([a.x, a.y], [b.x, b.y]),
  solve: (i) => cycleSignature(compose(i.x, i.y)),
  check(i, got): CheckResult {
    const perm = compose(i.x, i.y)
    return verdict(numbersMatch(cycleSignature(perm), got, { multiset: true }), lengthsRollback(perm, got))
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// relabel: letters, the cycle through X of AD after a new cable X–Y (rollback: cycles)
// ---------------------------------------------------------------------------

export interface RelabelInstance {
  /** The number of letters to type (the answer cycle's length). */
  readonly length: number
  /** The day at its Grundstellung, with its cables. */
  readonly day: MachineConfig
  /** The new cable, two free letters: 'XY'. */
  readonly cable: string
}

/** AD after the new cable, by relabelling: the conjugate of AD by the swap X–Y. */
export const relabelledAd = (i: RelabelInstance): number[] => [...conjugate(adOf(i.day), fromPairs([i.cable]))]

export const relabelAnswer = (i: RelabelInstance): string =>
  cycleOf(relabelledAd(i), idx(i.cable[0]!))
    .map(L)
    .join('')

/** Naive answers: the old cycle through X; the cycle Y was in, not relabelled; the right cycle read backwards. */
export function naiveRelabel(i: RelabelInstance): string[] {
  const ad = adOf(i.day)
  const [x, y] = [idx(i.cable[0]!), idx(i.cable[1]!)]
  const right = relabelAnswer(i)
  return [
    cycleOf(ad, x).map(L).join(''),
    cycleOf(ad, y).map(L).join(''),
    right[0]! + [...right.slice(1)].reverse().join(''),
  ]
}

export const relabel = lettersItem<RelabelInstance>({
  id: 'relabel',
  rule: WINDOW,
  generate(r) {
    for (;;) {
      const day = dayKey(r, { era: '1932' })
      const ad = adOf(day)
      const free = freeLetters(day)
      const pairs: [number, number][] = []
      for (const x of free) {
        for (const y of free) {
          if (x === y || cycleOf(ad, x).includes(y)) continue
          if (cycleOf(ad, y).length >= 3) pairs.push([x, y])
        }
      }
      if (!pairs.length) continue
      const [x, y] = pick(r, pairs)
      return { length: cycleOf(ad, y).length, day, cable: L(x) + L(y) }
    }
  },
  same: (a, b) => sameJson([a.day, a.cable], [b.day, b.cable]),
  solve: relabelAnswer,
  check(i, a): CheckResult {
    const want = relabelAnswer(i)
    const got = String(a ?? '').toUpperCase().replace(/[^A-Z]/g, '')
    const perm = relabelledAd(i)
    return verdict(got === want, {
      kind: 'cycles',
      perm,
      cycle: [...want].map(idx),
      expected: [...want].map(idx),
      got: [...got].map(idx),
    })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// stecker-set: set-machine, one new cable so that X and Y share a cycle of AD (rollback: machine)
// ---------------------------------------------------------------------------

export interface SteckerInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked'
  readonly maxPlugs: number
  readonly x: Letter
  readonly y: Letter
}

const pairName = (a: number, b: number): string => [L(a), L(b)].sort().join('')
const normPairs = (ps: readonly string[]): string[] => ps.map((p) => [...p.toUpperCase()].sort().join('')).sort()

/** Every new cable (two free letters) after which X and Y share a cycle of AD, sorted (`ad`: the day's AD). */
export function steckerSolutions(day: MachineConfig, x: Letter, y: Letter, ad: readonly number[] = adOf(day)): string[] {
  const free = new Set(freeLetters(day))
  const [xi, yi] = [idx(x), idx(y)]
  const out = new Set<string>()
  if (free.has(xi)) for (const z of cycleOf(ad, yi)) if (z !== yi && free.has(z)) out.add(pairName(xi, z))
  if (free.has(yi)) for (const w of cycleOf(ad, xi)) if (w !== xi && free.has(w)) out.add(pairName(yi, w))
  return [...out].sort()
}

/** Every new cable a learner could add: all pairs of free letters. */
export function freePairs(day: MachineConfig): string[] {
  const free = freeLetters(day)
  return free.flatMap((a, k) => free.slice(k + 1).map((b) => pairName(a, b)))
}

export function generateStecker(r: Rng): SteckerInstance {
  for (;;) {
    const day = dayKey(r, { era: '1932' })
    const ad = adOf(day)
    const short = LETTERS.map((_, x) => x).filter((x) => cycleOf(ad, x).length <= 3)
    const pairs: [number, number][] = []
    for (const x of short) {
      for (const y of short) {
        if (x >= y || cycleOf(ad, x).includes(y)) continue
        if (steckerSolutions(day, L(x), L(y), ad).length) pairs.push([x, y])
      }
    }
    if (!pairs.length) continue
    const [a, b] = pick(r, pairs)
    const [x, y] = int(r, 2) ? [a, b] : [b, a]
    return {
      setup: { machine: day, stage: 'plugboard' },
      unlocked: ['plugboard'],
      trial: 'locked',
      maxPlugs: day.plugboard.length + 1,
      x: L(x),
      y: L(y),
    }
  }
}

export function steckerItem(id: string): ItemLogic<SteckerInstance, MachineConfig> {
  return setMachineItem<SteckerInstance>({
    id,
    rule: WINDOW,
    generate: (r) => generateStecker(r),
    same: (a, b) => sameJson([a.setup.machine, a.x, a.y], [b.setup.machine, b.x, b.y]),
    predicate(i, cfg) {
      const day = i.setup.machine
      const had = normPairs(day.plugboard)
      const now = normPairs(cfg.plugboard)
      const removed = had.filter((p) => !now.includes(p))
      const added = now.filter((p) => !had.includes(p))
      const fail = (message: string) => ({ field: 'plugboard' as const, message, highlight: ['plugboard' as const] })
      if (removed.length) {
        return fail(`Keep the day's cables: ${removed.map(dash).join(', ')} ${removed.length === 1 ? 'is' : 'are'} missing.`)
      }
      if (added.length !== 1) {
        return fail(added.length ? `Add exactly one new cable, not ${added.length}.` : 'Add one new cable.')
      }
      const ad = adOf(cfg)
      const [x, y] = [idx(i.x), idx(i.y)]
      if (cycleOf(ad, x).includes(y)) return true
      return fail(
        `With the new cable ${dash(added[0]!)}, AD is ${formatCycles(ad)}: ${i.x} is in ${cycleText(cycleOf(ad, x))} ` +
          `and ${i.y} in ${cycleText(cycleOf(ad, y))}.`,
      )
    },
    solve: (i) => withCable(i.setup.machine, steckerSolutions(i.setup.machine, i.x, i.y)[0]!),
    sampleAnswer: (i, r) => withCable(i.setup.machine, pick(r, freePairs(i.setup.machine))),
    mutate(i) {
      const day = i.setup.machine
      const good = new Set(steckerSolutions(day, i.x, i.y))
      const direct = pairName(idx(i.x), idx(i.y))
      const wrong = freePairs(day).includes(direct) ? direct : freePairs(day).find((p) => !good.has(p))!
      return withCable(day, wrong)
    },
    highlight: () => [{ part: 'plugboard', tone: 'hint' }],
  })
}

export const steckerSet = steckerItem('stecker-set')

// ---------------------------------------------------------------------------
// cycle-lengths: code, paired with the prediction cycleLengths(AD) for the shown day (rollback: cycles)
// ---------------------------------------------------------------------------

export interface CycleLengthsInstance {
  readonly seed: number
  /** The day whose AD the prediction is about (shown as a table in the prompt). */
  readonly day: MachineConfig
}

export const CYCLE_LENGTHS_REFERENCE =
  'function cycleLengths(perm) {\n' +
  '  const seen = perm.map(() => false)\n' +
  '  const out = []\n' +
  '  for (let i = 0; i < perm.length; i++) {\n' +
  '    let n = 0\n' +
  '    for (let x = i; !seen[x]; x = perm[x]) { seen[x] = true; n++ }\n' +
  '    if (n) out.push(n)\n' +
  '  }\n' +
  '  return out.sort((a, b) => b - a)\n' +
  '}\n'

/** A prediction as the numbers it holds, space-separated: '[10, 10, 2]' and '10,10,2' both read '10 10 2'. */
export const canonLengths = (s: unknown): string => (String(s ?? '').match(/\d+/g) ?? []).map(Number).join(' ')

export const cycleLengthsProbe = (i: CycleLengthsInstance): string => cycleSignature(adOf(i.day)).join(' ')

/**
 * How often a generated day's AD has each of its commonest cycle types, per mille (60,000 days of the 1932 key:
 * UKW-A, rotors I–III, six cables; 80 types in all). Left alone, "13 13" would be the answer on a quarter of days.
 */
export const COMMON_AD_TYPES: Readonly<Record<string, number>> = {
  '13 13': 253.2,
  '12 12 1 1': 132.6,
  '11 11 2 2': 73.6,
  '10 10 3 3': 56,
  '9 9 4 4': 43.1,
  '8 8 5 5': 40.5,
  '10 10 2 2 1 1': 39.6,
  '7 7 6 6': 38,
  '11 11 1 1 1 1': 36.9,
  '9 9 3 3 1 1': 30.7,
  '8 8 4 4 1 1': 25.8,
  '7 7 5 5 1 1': 23.7,
  '8 8 3 3 2 2': 16.9,
  '7 7 4 4 2 2': 14.2,
  '6 6 5 5 2 2': 13.3,
  '6 6 4 4 3 3': 11.2,
  '6 6 6 6 1 1': 10.9,
  '9 9 2 2 2 2': 10.7,
  '9 9 2 2 1 1 1 1': 9.8,
  '7 7 3 3 2 2 1 1': 9.7,
  '6 6 4 4 2 2 1 1': 8.1,
  '8 8 3 3 1 1 1 1': 7.3,
  '5 5 4 4 3 3 1 1': 7.3,
  '7 7 3 3 3 3': 7,
  '8 8 2 2 2 2 1 1': 7,
  '7 7 4 4 1 1 1 1': 6.7,
  '6 6 5 5 1 1 1 1': 6.5,
  '10 10 1 1 1 1 1 1': 5.9,
  '5 5 5 5 3 3': 5.1,
  '5 5 4 4 4 4': 4.7,
  '5 5 5 5 2 2 1 1': 3.8,
  '6 6 3 3 3 3 1 1': 3.5,
  '6 6 3 3 2 2 2 2': 2.6,
  '5 5 3 3 3 3 2 2': 2.6,
  '5 5 4 4 2 2 1 1 1 1': 2.5,
  '6 6 3 3 2 2 1 1 1 1': 2.5,
  '5 5 4 4 2 2 2 2': 2.5,
  '8 8 2 2 1 1 1 1 1 1': 2.3,
  '4 4 4 4 3 3 2 2': 2.1,
}

/** A type more common than this (per mille) is kept only with probability CAP / its frequency. */
export const AD_TYPE_CAP = 2

/**
 * A day of the 1932 key whose AD type is drawn nearly flat: common types are thinned to AD_TYPE_CAP per mille, so no
 * single prediction ("13 13" above all) is right on more than about 2 % of days (about ten days drawn per instance).
 */
export function flatDay(r: Rng): MachineConfig {
  for (;;) {
    const day = dayKey(r, { era: '1932' })
    const f = COMMON_AD_TYPES[cycleSignature(adOf(day)).join(' ')]
    if (f === undefined || r() * f < AD_TYPE_CAP) return day
  }
}

function cycleLengthCases(i: CycleLengthsInstance) {
  const r = createRng(i.seed)
  const list: { label: string; perm: readonly number[] }[] = [
    { label: 'a swap', perm: [1, 0] },
    { label: 'the hexagon (ace)(bfd)', perm: HEX_P },
    { label: 'nothing moves', perm: identity(5) },
    { label: 'one cycle of 26', perm: shift(1, 26) },
    { label: 'reflector B', perm: REFLECTOR_PERMS.B },
    { label: "the 65 indicators' AD", perm: AD65 },
  ]
  for (let k = 0; k < 20; k++) list.push({ label: `random ${k + 1}`, perm: randomPerm(r, 2 + int(r, 25)) })
  list.push({ label: "this day's AD", perm: adOf(i.day) })
  return list.map(({ label, perm }, k) => ({
    label: `#${k + 1} ${label}`,
    fn: 'cycleLengths',
    args: [[...perm]],
    expect: cycleSignature(perm),
  }))
}

const cycleLengthsBase = codeItem<CycleLengthsInstance>(
  {
    fnNames: ['cycleLengths'],
    signature: 'cycleLengths(perm: number[]): number[]',
    brief:
      'A permutation is an array of images: perm[i] is where letter i goes (A = 0, B = 1, …). Write cycleLengths(perm), ' +
      'which returns the lengths of its cycles, longest first, a letter that stays put counting as a cycle of length ' +
      "1. Before you run it, predict what it returns for this day's AD (type the numbers, longest first).",
    starter: 'function cycleLengths(perm) {\n  // the lengths of the cycles, longest first\n}\n',
    provided: '',
    maxLines: 10,
    reference: CYCLE_LENGTHS_REFERENCE,
    cases: cycleLengthCases,
    probe: (i) => ({ call: 'cycleLengths(AD)', expected: cycleLengthsProbe(i) }),
  },
  {
    id: 'cycle-lengths',
    rule: WINDOW,
    generate: (r) => ({ seed: int(r, 2 ** 31), day: flatDay(r) }),
    same: (a, b) => a.seed === b.seed || sameJson(a.day, b.day),
    setup: () => ({ stage: null }),
    highlight: () => [],
    rollback: (i, a) => {
      const perm = adOf(i.day)
      const got = canonLengths(a?.probe).split(' ').filter(Boolean).map(Number)
      return lengthsRollback(perm, got)
    },
  },
)

/** The code item, reading the prediction as its numbers ('[6, 6, 4]', '6,6,4' and '6 6 4' all count). */
export const cycleLengths: ItemLogic<CycleLengthsInstance, CodeAnswer> = {
  ...cycleLengthsBase,
  check: (i, a) => cycleLengthsBase.check(i, a ? { ...a, probe: canonLengths(a.probe) } : a),
}

// ---------------------------------------------------------------------------
// align-pair: custom, in-page: line every long cycle of XY up under its partner so each column is a swap of X
// ---------------------------------------------------------------------------

/** One cycle of XY, the cycle X pairs it with (written from a random letter) and one known swap of X between them. */
export interface AlignPair {
  readonly a: readonly number[]
  readonly b: readonly number[]
  /** A letter of a and its partner in b. */
  readonly clue: readonly [number, number]
}

export interface AlignInstance {
  readonly n: number
  /** XY on n letters (X first), X and Y made only of swaps. */
  readonly product: readonly number[]
  /** Every pair of cycles of XY (lengths ≥ 3), in the order of their first letters. */
  readonly pairs: readonly AlignPair[]
}

export interface Alignment {
  readonly offset: number
  readonly reversed: boolean
}

/** One alignment per pair, in the instance's order. */
export type AlignAnswer = readonly Alignment[]

/**
 * The cycle lengths of the pairs to line up: at least 48 right alignments to choose from, so a guess that never looks
 * at the clues (say, "read backwards, do not slide") is right at most once in 48 instances.
 */
export const ALIGN_SETS: readonly (readonly number[])[] = [
  [4, 4, 3],
  [4, 4, 4],
  [5, 4, 3],
  [6, 3, 3],
]

/** X's swaps between a pair's cycles, from its clue (Rejewski's theorem 4: right neighbours pair with left ones). */
export function alignTruth(p: AlignPair): string[] {
  const n = p.a.length
  const ia = p.a.indexOf(p.clue[0])
  const jb = p.b.indexOf(p.clue[1])
  return Array.from({ length: n }, (_, k) => pairName(p.a[(ia + k) % n]!, p.b[(((jb - k) % n) + n) % n]!)).sort()
}

export const alignedPairs = (p: AlignPair, a: Alignment | undefined): string[] =>
  alignmentPairs(p.a, p.b, Number(a?.offset) || 0, !!a?.reversed)
    .map(([u, v]) => pairName(u, v))
    .sort()

/** Whether an alignment makes every column of the pair a swap of X. */
export const alignRight = (p: AlignPair, a: Alignment | undefined): boolean =>
  alignedPairs(p, a).join(' ') === alignTruth(p).join(' ')

/** The one right alignment of a pair (read backwards). */
export function solvePair(p: AlignPair): Alignment {
  for (let offset = 0; offset < p.a.length; offset++) {
    for (const reversed of [true, false]) if (alignRight(p, { offset, reversed })) return { offset, reversed }
  }
  return { offset: 0, reversed: true }
}

/** The naive alignment: keep each clue's column but read the lower cycle forwards. */
export function naiveAlign(i: AlignInstance): AlignAnswer {
  return i.pairs.map((p) => {
    const n = p.a.length
    return { offset: (((p.b.indexOf(p.clue[1]) - p.a.indexOf(p.clue[0])) % n) + n) % n, reversed: false }
  })
}

/** A guess that ignores the clues: every pair read backwards, not slid. */
export const blindAlign = (i: AlignInstance): AlignAnswer => i.pairs.map(() => ({ offset: 0, reversed: true }))

export function generateAlign(r: Rng): AlignInstance {
  const parts = shuffle(r, pick(r, ALIGN_SETS))
  const n = 2 * parts.reduce((t, l) => t + l, 0)
  const { x, y } = swapsForType(r, n, parts)
  const product = [...compose(x, y)]
  const pairs: AlignPair[] = []
  const seen = new Set<number>()
  for (const a of cycles(product)) {
    if (seen.has(a[0]!)) continue
    const partner = cycleOf(product, x[a[0]!]!)
    for (const c of [...a, ...partner]) seen.add(c)
    const start = int(r, partner.length)
    const k = int(r, a.length)
    pairs.push({ a, b: [...partner.slice(start), ...partner.slice(0, start)], clue: [a[k]!, x[a[k]!]!] })
  }
  return { n, product, pairs }
}

export const alignPair: ItemLogic<AlignInstance, AlignAnswer> = {
  id: 'align-pair',
  kind: 'custom',
  rule: WINDOW,
  compute: false,
  inPage: true,
  generate: (r) => generateAlign(r),
  same: (a, b) => sameJson([a.product, a.pairs], [b.product, b.pairs]),
  solve: (i) => i.pairs.map(solvePair),
  check(i, a): CheckResult {
    const got = Array.isArray(a) ? a : []
    const wrong = i.pairs.flatMap((p, k) => (alignRight(p, got[k]) ? [] : [k + 1]))
    return verdict(
      wrong.length === 0,
      { kind: 'none' },
      `Pair ${wrong.join(', ')}: some columns are not swaps of X. Keep the clue in one column: the letter after it in ` +
        'the upper cycle pairs with the letter before its partner in the lower one.',
    )
  },
  sampleAnswer: (i, r) => i.pairs.map((p) => ({ offset: int(r, p.a.length), reversed: r() < 0.5 })),
  mutate(i, a, r) {
    const k = int(r, i.pairs.length)
    return i.pairs.map((p, j) => {
      const x = a[j] ?? { offset: 0, reversed: true }
      return j === k ? { offset: ((Number(x.offset) || 0) + 1) % p.a.length, reversed: !!x.reversed } : x
    })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  cycles: {
    items: [lengths, relabel, steckerSet, cycleLengths, alignPair] as ItemLogic[],
    fallback: steckerSet as ItemLogic,
  },
}
