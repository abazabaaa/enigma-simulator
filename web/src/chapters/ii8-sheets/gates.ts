/**
 * Chapter ii8-sheets · gate `sheets` (PLAN §4.4 "ii8-sheets"; optional, never blocks III.9). PURE (L4): engine,
 * lib/rng, crypto, contracts and lesson/kinds.
 *  - females-needed  numbers(1, [1, 30], ±1) · 2/3 · N settings, a share p survives each sheet → ⌈log(N/2) / log(1/p)⌉
 *  - survivors       numbers(1, ±10 %) · 2/3 · N, p, k sheets → N·pᵏ
 *  - fallback stack-to-one · custom, in-page · stack the day's sheets until one setting remains → [k, the setting]
 *
 * The day (from 15 September 1938): every operator picks his own starting position, sends it in clear, and types his
 * doubled message key from there. A "female" repeats a letter at places 1 and 4: it can only happen where the
 * product of the machine at presses 1 and 4 has a fixed point. A Zygalski sheet (crypto femaleSheet) has a hole at
 * every such position of one wheel order and left-rotor position, over the 26 × 26 middle × right positions repeated
 * a–z, a–y into 51 × 51. Each female's sheet is laid over the first one, shifted by how far its starting position is
 * from the first female's; light passes only where every sheet has a hole: at the day's middle and right ring
 * settings (and, for a while, at a few impostors). Only females whose four presses move no middle rotor are used,
 * so the sheets hold exactly.
 */

import type { Choice, Letter, MachineConfig } from '../../contracts/core'
import type { ChapterGates, CheckResult, ItemLogic } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { SHEET_SIZE, dayKey, encryptIndicator, femaleSheet } from '../../crypto'
import { scramblerTables } from '../../crypto/tables'
import { LETTERS, ROTORS, normalizeConfig, type RotorName } from '../../engine'
import { CATALOGUE_SETTINGS } from '../../lib/keyspace'
import { createRng, int, pick, randLetter, shuffle, type Rng } from '../../lib/rng'
import { numbersItem, numbersMatch, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const mod26 = (x: number) => ((x % 26) + 26) % 26

export const L = (i: number): Letter => LETTERS[mod26(i)]!
export const idx = (l: string): number => LETTERS.indexOf(String(l).toUpperCase() as Letter)

/** A ring setting as the course shows it: 01–26. */
export const ringNumber = (i: number): string => String(mod26(i) + 1).padStart(2, '0')

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

/** A neutral machine for the chapter's scenes (nothing here is typed on it). */
export const QUIET_MACHINE: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

// ---------------------------------------------------------------------------
// Females and sheets
// ---------------------------------------------------------------------------

/** One message's opening: the starting position sent in clear, then the doubled key enciphered from it. */
export interface Message {
  readonly setting: string
  readonly indicator: string
}

/** The places (0-based, 0–2) where an indicator repeats a letter three further on. */
export const femalePlaces = (indicator: string): number[] => [0, 1, 2].filter((k) => indicator[k] === indicator[k + 3])

const turnover = (r: RotorName): number => idx(ROTORS[r].turnovers[0]!)

/**
 * Whether the four presses from `setting` move no middle rotor, both on the real machine (windows, with the day's
 * rings) and on the sheet's model (core positions, rings 01): then the day's sheet holds exactly for this message.
 */
export function steadyFor(rotors: readonly RotorName[], rings: readonly number[], setting: string): boolean {
  const [, m, r] = [0, 1, 2].map((k) => idx(setting[k]!))
  const [tm, tr] = [turnover(rotors[1]!), turnover(rotors[2]!)]
  for (const shift of [0, rings[2]!]) {
    for (let t = 0; t < 4; t++) if (mod26(r! - shift + t) === tr) return false
  }
  return m !== tm && mod26(m! - rings[1]!) !== tm
}

/**
 * A 1–4 female at `setting` on `day` (whose four presses move no middle rotor, see steadyFor): the letter at places
 * 1 and 4 must be a fixed point y of AD there, and the key's first letter is then A(y). With the cables S, AD is
 * S·AD₀·S for the scrambler's AD₀, so y = S(y₀) for a fixed point y₀ of AD₀ and A(y) = S(A₀(y₀)). The scrambler comes
 * from the kit's tables at the rotors' core positions (window − ring). Null when AD has no fixed point here.
 */
export function femaleMessage(r: Rng, day: MachineConfig, setting: string): Message | null {
  const t = scramblerTables(day.rotors, day.reflector)
  const core = [0, 1, 2].map((k) => mod26(idx(setting[k]!) - idx(day.rings[k]!)))
  const a = new Uint8Array(26)
  const d = new Uint8Array(26)
  t.perm(core[0]!, core[1]!, mod26(core[2]! + 1), a)
  t.perm(core[0]!, core[1]!, mod26(core[2]! + 4), d)
  const fixed: number[] = []
  for (let x = 0; x < 26; x++) if (d[a[x]!] === x) fixed.push(x)
  if (!fixed.length) return null
  const s = LETTERS.map((_, x) => x)
  for (const pair of day.plugboard) {
    const [u, v] = [idx(pair[0]!), idx(pair[1]!)]
    s[u] = v
    s[v] = u
  }
  const key = L(s[a[pick(r, fixed)]!]!) + randLetter(r) + randLetter(r)
  return { setting, indicator: encryptIndicator(normalizeConfig({ ...day, positions: setting }), key) }
}

const sheetMemo = new Map<string, readonly boolean[]>()
/** The Zygalski sheet of a wheel order (reflector B) for the left rotor's core position `left` (memoised). */
export function sheetFor(rotors: readonly RotorName[], left: number): readonly boolean[] {
  const key = `${rotors.join('-')}/${left}`
  let s = sheetMemo.get(key)
  if (!s) {
    s = femaleSheet({ rotors, reflector: 'B', left: L(left) })
    sheetMemo.set(key, s)
  }
  return s
}

/** A female's sheet as it lies on the light table: the kit's sheet and its shift against the first female's. */
interface Placed {
  readonly sheet: readonly boolean[]
  readonly db: number
  readonly dc: number
}

function place(rotors: readonly RotorName[], leftRing: number, females: readonly Message[]): Placed[] {
  const first = females[0]
  if (!first) return []
  const [b0, c0] = [idx(first.setting[1]!), idx(first.setting[2]!)]
  return females.map((f) => ({
    sheet: sheetFor(rotors, mod26(idx(f.setting[0]!) - leftRing)),
    db: idx(f.setting[1]!) - b0,
    dc: idx(f.setting[2]!) - c0,
  }))
}

/**
 * The females' sheets laid on the light table (51 × 51 each, for LightTable): the first sheet unshifted, each later
 * one shifted by its setting's middle and right letters minus the first female's, so that one cell of the table means
 * one pair of middle and right ring settings on every sheet. `leftRing` picks each female's sheet (its left core).
 */
export function alignedSheets(rotors: readonly RotorName[], leftRing: number, females: readonly Message[]): boolean[][] {
  const cols = Array.from({ length: SHEET_SIZE }, (_, x) => x)
  return place(rotors, leftRing, females).map(({ sheet, db, dc }) => {
    const colMap = cols.map((x) => mod26(x + dc))
    const out: boolean[] = []
    for (let y = 0; y < SHEET_SIZE; y++) {
      const row = mod26(y + db) * SHEET_SIZE
      for (let x = 0; x < SHEET_SIZE; x++) out.push(sheet[row + colMap[x]!]!)
    }
    return out
  })
}

/** The cell (row, column) of the light table for a pair of middle and right ring settings. */
export const cellOf = (first: Message, ringM: number, ringR: number): [number, number] => [
  mod26(idx(first.setting[1]!) - ringM),
  mod26(idx(first.setting[2]!) - ringR),
]

/** Ring settings (middle × 26 + right) still lit after stacking the first `k` aligned sheets, ascending. */
export function litSettings(first: Message, sheets: readonly (readonly boolean[])[], k: number): number[] {
  const out: number[] = []
  for (let ringM = 0; ringM < 26; ringM++) {
    for (let ringR = 0; ringR < 26; ringR++) {
      const [y, x] = cellOf(first, ringM, ringR)
      if (sheets.slice(0, k).every((s) => s[y * SHEET_SIZE + x])) out.push(ringM * 26 + ringR)
    }
  }
  return out
}

/** The settings lit after each of the first `upTo` sheets (index k − 1), straight from the kit's sheets. */
export function litCounts(rotors: readonly RotorName[], leftRing: number, females: readonly Message[], upTo = females.length): number[][] {
  const first = females[0]
  if (!first) return []
  const placed = place(rotors, leftRing, females).slice(0, upTo)
  let alive = Array.from({ length: 676 }, (_, s) => s)
  const cells = alive.map((s) => cellOf(first, Math.floor(s / 26), s % 26))
  return placed.map(({ sheet, db, dc }) => {
    alive = alive.filter((s) => sheet[mod26(cells[s]![0] + db) * SHEET_SIZE + mod26(cells[s]![1] + dc)])
    return alive
  })
}

/** A setting index as the learner reads it: 'middle ring 07, right ring 22'. */
export const settingName = (s: number): string => `middle ring ${ringNumber(Math.floor(s / 26))}, right ring ${ringNumber(s % 26)}`

/** The first k at which exactly one setting is lit, or null. */
export function firstAlone(rotors: readonly RotorName[], leftRing: number, females: readonly Message[]): number | null {
  const k = litCounts(rotors, leftRing, females).findIndex((lit) => lit.length === 1)
  return k === -1 ? null : k + 1
}

// ---------------------------------------------------------------------------
// A day of females
// ---------------------------------------------------------------------------

export interface SheetDay {
  /** Enigma I, UKW-B, rotors I–III in some order, the day's rings and six cables. */
  readonly day: MachineConfig
  /** The day's 1–4 females, each at a starting position whose four presses move no middle rotor. */
  readonly females: readonly Message[]
}

/**
 * A day and its females: enough that exactly one setting is lit after some k sheets (k ≥ 5), plus `extra` more. When
 * `extra` is null the females stop at `count`.
 */
export function makeSheetDay(r: Rng, o: { extra: number } | { count: number }): SheetDay {
  for (;;) {
    const order = shuffle(r, ['I', 'II', 'III'] as RotorName[])
    const day = dayKey(r, { era: '1940', orders: [order], plugs: 6 })
    const rings = day.rings.map(idx)
    const females: Message[] = []
    for (let tries = 0; tries < 300 && females.length < 20; tries++) {
      const setting = randLetter(r) + randLetter(r) + randLetter(r)
      if (!steadyFor(day.rotors, rings, setting)) continue
      const f = femaleMessage(r, day, setting)
      if (f) females.push(f)
    }
    const k = firstAlone(day.rotors, rings[0]!, females)
    if (k === null || k < 5) continue
    const n = 'extra' in o ? k + o.extra : o.count
    if (n > females.length || n < k + 2) continue
    return { day, females: females.slice(0, n) }
  }
}

/** The truth of a sheet day: the day's middle and right ring settings as a setting index. */
export const daySetting = (d: SheetDay): number => idx(d.day.rings[1]!) * 26 + idx(d.day.rings[2]!)

let scene: SheetDay | null = null
/** The scenes' day (fixed seed): its 1–4 females for the light table. */
export function sceneDay(): SheetDay {
  scene ??= makeSheetDay(createRng(1938), { count: 14 })
  return scene
}

/** Messages of the scenes' day with no repeat at any distance of three (for the traffic shown beside the females). */
export function plainMessages(d: SheetDay, count: number): Message[] {
  const r = createRng(915)
  const out: Message[] = []
  while (out.length < count) {
    const setting = randLetter(r) + randLetter(r) + randLetter(r)
    const at = normalizeConfig({ ...d.day, positions: setting })
    const indicator = encryptIndicator(at, randLetter(r) + randLetter(r) + randLetter(r))
    if (femalePlaces(indicator).length === 0) out.push({ setting, indicator })
  }
  return out
}

/** Share of holes over the 26 sheets of a wheel order (reflector B). */
export function holeShare(rotors: readonly RotorName[]): number {
  let holes = 0
  for (let left = 0; left < 26; left++) {
    const s = sheetFor(rotors, left)
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (s[y * SHEET_SIZE + x]) holes++
  }
  return holes / (26 * 676)
}

export const SURVIVE_OPTIONS: readonly Choice[] = [
  { id: '10', label: 'About 10%', misconception: true },
  { id: '40', label: 'About 40%' },
  { id: '90', label: 'About 90%', misconception: true },
]

/** The `survive` bet's option nearest to a share. */
export const surviveChoice = (share: number): string =>
  [...SURVIVE_OPTIONS].sort((a, b) => Math.abs(share * 100 - Number(a.id)) - Math.abs(share * 100 - Number(b.id)))[0]!.id

/** The settings of the three rotors I–III in six orders: the Polish search after September 1938. */
export const ALL_SETTINGS = CATALOGUE_SETTINGS

/** Females until about one setting of N survives, when a share p of the settings survives each sheet. */
export const femalesNeeded = (n: number, p: number): number => Math.ceil(Math.log(n / 2) / Math.log(1 / p))

// ---------------------------------------------------------------------------
// females-needed: numbers(1), ⌈log(N/2) / log(1/p)⌉ (± 1)
// ---------------------------------------------------------------------------

export const SEARCH_SIZES = [
  { n: 676, what: 'the 676 middle and right ring settings of one stack of sheets (wheel order and left ring known)' },
  { n: 17576, what: 'the 17,576 positions of one wheel order' },
  { n: CATALOGUE_SETTINGS, what: 'the 105,456 settings of rotors I, II and III in their 6 orders' },
  { n: 1054560, what: 'the 1,054,560 settings of 60 wheel orders once rotors IV and V had come' },
] as const

export interface NeededInstance {
  readonly count: 1
  readonly n: number
  /** The share of settings that survives one sheet, e.g. 0.41. */
  readonly p: number
}

/** The MISCONCEPTION "p is the share a sheet removes": females counted with 1 − p surviving. */
export const naiveNeeded = (i: NeededInstance): number => femalesNeeded(i.n, 1 - i.p)

export const expected = (n: number, p: number, k: number): number => n * p ** k

const fmtNum = (x: number): string => (x >= 10 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1))

/** Every (N, p) the item can ask, grouped by its answer: the answer is drawn uniformly, then an (N, p) giving it. */
const NEEDED_BY_ANSWER: ReadonlyMap<number, readonly { n: number; p: number }[]> = (() => {
  const m = new Map<number, { n: number; p: number }[]>()
  for (const { n } of SEARCH_SIZES) {
    for (let q = 35; q <= 45; q++) {
      const k = femalesNeeded(n, q / 100)
      m.set(k, [...(m.get(k) ?? []), { n, p: q / 100 }])
    }
  }
  return m
})()
export const NEEDED_ANSWERS: readonly number[] = [...NEEDED_BY_ANSWER.keys()].sort((a, b) => a - b)

export const femalesNeededItem = numbersItem<NeededInstance>({
  id: 'females-needed',
  rule: WINDOW,
  range: [1, 30],
  tolerance: 1,
  generate(r) {
    const { n, p } = pick(r, NEEDED_BY_ANSWER.get(pick(r, NEEDED_ANSWERS))!)
    return { count: 1, n, p }
  },
  same: (a, b) => a.n === b.n && a.p === b.p,
  solve: (i) => [femalesNeeded(i.n, i.p)],
  check(i, a): CheckResult {
    const ok = numbersMatch([femalesNeeded(i.n, i.p)], a, { tolerance: 1 })
    if (ok) return verdict(true)
    const k = Array.isArray(a) ? Number(a[0]) : NaN
    const left = Number.isFinite(k) ? expected(i.n, i.p, k) : NaN
    return verdict(
      false,
      { kind: 'none' },
      Number.isFinite(left)
        ? `With ${k} females, about ${fmtNum(left)} of the ${i.n.toLocaleString('en-US')} settings would still let light ` +
            `through (${i.n.toLocaleString('en-US')} × ${i.p}^${k}). Stack until about one or two are left.`
        : 'Type the number of females.',
    )
  },
  mutate: (_i, a) => [(Number(a[0]) || 0) + 3],
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// survivors: numbers(1), N·pᵏ (± 10 %)
// ---------------------------------------------------------------------------

export interface SurvivorsInstance {
  readonly count: 1
  readonly n: number
  readonly p: number
  readonly k: number
}

/** The MISCONCEPTIONS "each sheet removes p·N" (linear) and "1 − p survives". */
export const naiveSurvivors = (i: SurvivorsInstance): number[] => [i.n * i.p * i.k, expected(i.n, 1 - i.p, i.k)]

export const SURVIVORS_MAX = 20000

/**
 * Every (N, p, k) with N·pᵏ between 5 and 20,000, grouped into bins of 0.1 on a log scale: the item draws a bin
 * uniformly, then a question in it, so its answers spread evenly over the range and no constant is often right.
 */
const SURVIVOR_BINS: readonly (readonly SurvivorsInstance[])[] = (() => {
  const bins: SurvivorsInstance[][] = []
  for (const { n } of SEARCH_SIZES) {
    for (let q = 35; q <= 45; q++) {
      for (let k = 2; k <= 10; k++) {
        const e = expected(n, q / 100, k)
        if (e < 5 || e > SURVIVORS_MAX) continue
        const b = Math.floor((Math.log10(e) - Math.log10(5)) / 0.1)
        ;(bins[b] ??= []).push({ count: 1, n, p: q / 100, k })
      }
    }
  }
  return bins.filter((b) => b && b.length)
})()

export const survivorsItem = numbersItem<SurvivorsInstance>({
  id: 'survivors',
  rule: WINDOW,
  range: [0, SURVIVORS_MAX],
  tolerance: { relative: 0.1 },
  generate: (r) => pick(r, pick(r, SURVIVOR_BINS)),
  same: (a, b) => a.n === b.n && a.p === b.p && a.k === b.k,
  solve: (i) => [Math.round(expected(i.n, i.p, i.k) * 10) / 10],
  check(i, a): CheckResult {
    const e = expected(i.n, i.p, i.k)
    if (numbersMatch([e], a, { tolerance: { relative: 0.1 } })) return verdict(true)
    const got = Array.isArray(a) ? Number(a[0]) : NaN
    const k = Number.isFinite(got) && got > 0 ? Math.log(got / i.n) / Math.log(i.p) : NaN
    return verdict(
      false,
      { kind: 'none' },
      Number.isFinite(k)
        ? `${fmtNum(got)} settings would be left after about ${k.toFixed(1)} sheets, not ${i.k}: each sheet keeps a share ` +
            `${i.p} of what is still lit, so the shares multiply.`
        : 'Type the number of settings still lit.',
    )
  },
  sampleAnswer: (_i, r) => [int(r, SURVIVORS_MAX + 1)],
  mutate: (_i, a) => [Math.round((Number(a[0]) || 1) * 1.5 + 1)],
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// stack-to-one: custom, in-page (the fallback): stack sheets until one setting remains → [k, setting]
// ---------------------------------------------------------------------------

export interface StackInstance {
  readonly rotors: readonly RotorName[]
  /** The left rotor's ring setting, index 0–25 (taken as found: these are the right 26 sheets). */
  readonly leftRing: number
  readonly females: readonly Message[]
}

/** [the number of sheets stacked, the setting index (middle ring × 26 + right ring)]. */
export type StackAnswer = readonly [number, number]

export const stackSheets = (i: StackInstance): boolean[][] => alignedSheets(i.rotors, i.leftRing, i.females)

export function stackSolve(i: StackInstance): [number, number] {
  const lit = litCounts(i.rotors, i.leftRing, i.females)
  const k = lit.findIndex((l) => l.length === 1)
  return [k + 1, lit[k]![0]!]
}

export const stackToOne: ItemLogic<StackInstance, StackAnswer> = {
  id: 'stack-to-one',
  kind: 'custom',
  rule: WINDOW,
  compute: true,
  inPage: true,
  generate(r) {
    const d = makeSheetDay(r, { extra: 2 + int(r, 3) })
    return { rotors: d.day.rotors, leftRing: idx(d.day.rings[0]!), females: d.females }
  },
  same: (a, b) => sameJson(a.females, b.females),
  solve: (i) => stackSolve(i),
  check(i, a): CheckResult {
    const [k, s] = Array.isArray(a) ? [Number(a[0]), Number(a[1])] : [NaN, NaN]
    if (!Number.isInteger(k) || k < 1 || k > i.females.length) {
      return verdict(false, { kind: 'none' }, 'Stack at least one sheet.')
    }
    const counts = litCounts(i.rotors, i.leftRing, i.females, k)
    const lit = counts[k - 1]!
    if (lit.length !== 1) {
      return verdict(false, { kind: 'none' }, `With ${k} sheets stacked, ${lit.length} settings still let light through: stack on.`)
    }
    if (k > 1 && counts[k - 2]!.length === 1) {
      return verdict(false, { kind: 'none' }, `One setting was already alone before sheet ${k}: stop at the first sheet that leaves one.`)
    }
    return verdict(lit[0] === s, { kind: 'none' }, `The light passes at ${settingName(lit[0]!)}, not at ${Number.isInteger(s) ? settingName(s) : 'that cell'}.`)
  },
  sampleAnswer: (i, r) => [1 + int(r, i.females.length), int(r, 676)],
  mutate: (_i, a) => [Number(a[0]) + 1, Number(a[1])],
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  sheets: {
    items: [femalesNeededItem, survivorsItem] as ItemLogic[],
    fallback: stackToOne as ItemLogic,
  },
}
