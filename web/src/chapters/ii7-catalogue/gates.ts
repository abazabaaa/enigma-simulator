/**
 * Chapter ii7-catalogue · gate `catalogue` (PLAN §4.4; problem-first). PURE (L4): engine, lib/rng, lib/keyspace,
 * crypto, contracts, lesson/kinds and this chapter's data.ts.
 *  - signature        custom · 2/3 · a 1936-style day's AD, BE and CF in cycle notation → its characteristic key
 *  - lookup           set-machine · 2/3 · the day's products, 60 indicators and a test message whose first five
 *                     letters are known, plus a catalogue query → the day's rotor order and ground setting
 *  - set-plugs        set-machine · once · rotors and ground setting right, no cables → cables until it decrypts
 *  - lookup-transfer  set-machine · once · transfer · only the raw indicators, a wheel order other than I-II-III
 *  - rejewski-parsons order(6) · once · constant answer
 *  - fallback lookup
 * No instance carries its answer (window.__course.gate() is readable): solve() runs the method itself (the
 * characteristic, a search of the chapter's card table with the known letters, the greedy cable search).
 * Every counted instance holds the case a misconception gets wrong (see the naive* helpers and the MISCONCEPTION
 * BOT tests): the cycles are never listed longest first already, the day is never the first setting on its card,
 * and the test message always needs three cables or more. Rings stay at 01 throughout.
 */

import type { Choice, Letter, MachineConfig } from '../../contracts/core'
import type { ChapterGates, CheckResult, ItemLogic, ItemSetup, Rollback } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { PartId, StageRef } from '../../contracts/stage'
import {
  CATALOGUE_ORDERS,
  characteristic,
  characteristicAt,
  dayKey,
  encryptIndicator,
  positionIndex,
  positionString,
  products as observedProducts,
  productsFromMachine,
  sixPermutations,
} from '../../crypto'
import {
  LETTERS,
  compose,
  createMachine,
  cycleSignature,
  cycles,
  encipher,
  machinePermutation,
  normalizeConfig,
  positionsToString,
  step,
  type RotorName,
} from '../../engine'
import { CATALOGUE_SETTINGS, pairedPartitions } from '../../lib/keyspace'
import { int, pick, randLetter, randomPerm, shuffle, type Rng } from '../../lib/rng'
import { orderItem, orderRollback, randomPairedPartition, setMachineItem, verdict } from '../../lesson/kinds'
import { LOOKUP_CODES } from './data'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
export const idx = (l: string): number => LETTERS.indexOf(String(l).toUpperCase() as Letter)

export const PRODUCTS = ['AD', 'BE', 'CF'] as const
export type ProductName = (typeof PRODUCTS)[number]

/** A day's three products, AD = compose(A, D) and so on (A first). */
export interface Products3 {
  readonly AD: readonly number[]
  readonly BE: readonly number[]
  readonly CF: readonly number[]
}

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

/** The cycle of `p` that contains `x`, starting at x. */
export function cycleOf(p: readonly number[], x: number): number[] {
  const out = [x]
  for (let y = p[x]!; y !== x; y = p[y]!) out.push(y)
  return out
}

/** A cycle as lower-case letters in brackets: (axcy). */
export const cycleText = (c: readonly number[]): string => `(${c.map((x) => L(x).toLowerCase()).join('')})`

/** Cycle notation as Rejewski wrote it: each cycle from its first letter, cycles in alphabetical order of that letter. */
export const notation = (p: readonly number[]): string => cycles(p).map(cycleText).join('')

// ---------------------------------------------------------------------------
// The cyclometer scene: two rotor sets, the second three steps on, lamps that light a whole cycle
// ---------------------------------------------------------------------------

/**
 * The cyclometer's day: Enigma I with UKW-A, rotors I II III, rings 01 01 01, ground setting MZH, no cables. Its six
 * presses move only the right rotor, so the two rotor sets stand exactly three places apart (MZI and MZL for AD).
 * AD = (axcy)(bwvpiztmj)(dfqlgsuro)(ehnk).
 */
export const CYCLO_DAY: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'A',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'MZH',
  plugboard: [],
})

/** The key of the scene's bet (the only key before the reveal). */
export const CYCLO_KEY: Letter = 'A'

/** The windows after each of the six presses from a ground setting (the engine's stepping). */
export function sixWindows(day: MachineConfig): string[] {
  let s = createMachine(day)
  const out: string[] = []
  for (let k = 0; k < 6; k++) {
    s = step(s).state
    out.push(positionsToString(s))
  }
  return out
}

/** The two rotor sets' windows for product k (0 AD, 1 BE, 2 CF): the machine at presses k + 1 and k + 4. */
export function cyclometerWindows(day: MachineConfig, k: 0 | 1 | 2): [string, string] {
  const w = sixWindows(day)
  return [w[k]!, w[k + 3]!]
}

/** The scrambler of `day` standing at `windows` (no stepping). */
export const permAt = (day: MachineConfig, windows: string): number[] => [
  ...machinePermutation(createMachine({ ...day, positions: windows })),
]

/**
 * What a key lights on the cyclometer: the current runs through the first set (A), the second (D), and round again
 * until it returns, so every letter of x's cycle of AD lights, and so does its partner, the image of that cycle under A.
 */
export function litLamps(first: readonly number[], second: readonly number[], x: number): { cycle: number[]; partner: number[] } {
  const p = compose(first, second)
  return { cycle: cycleOf(p, x), partner: cycleOf(p, first[x]!) }
}

const [CYCLO_W1, CYCLO_W4] = cyclometerWindows(CYCLO_DAY, 0)
/** AD of the cyclometer's day, as its two rotor sets make it. */
export const CYCLO_AD: readonly number[] = compose(permAt(CYCLO_DAY, CYCLO_W1), permAt(CYCLO_DAY, CYCLO_W4))
/** The `lamps` bet's truth: how many lamps key A lights (both cycles of its pair). */
export const LAMPS_TRUTH = String(2 * cycleOf(CYCLO_AD, idx(CYCLO_KEY)).length)

// ---------------------------------------------------------------------------
// The catalogue scene: 105,456 settings, about 1.03 million possible characteristics
// ---------------------------------------------------------------------------

/** Cycle types a product can have (a partition of 13, doubled): 101; so 101³ possible characteristics. */
export const CYCLE_TYPES = pairedPartitions()
export const POSSIBLE_CHARACTERISTICS = CYCLE_TYPES ** 3
export { CATALOGUE_SETTINGS }

export const BUCKET_OPTIONS: readonly Choice[] = [
  { id: 'one', label: 'About 1: the day itself', misconception: true },
  { id: 'ten', label: 'About 10' },
  { id: 'thousand', label: 'About 1,000', misconception: true },
]

/** The card size of the median setting: half of all settings sit on cards of this size or smaller. */
export function weightedMedian(histogram: readonly { size: number; count: number }[]): number {
  const total = histogram.reduce((s, h) => s + h.size * h.count, 0)
  let seen = 0
  for (const h of histogram) {
    seen += h.size * h.count
    if (2 * seen >= total) return h.size
  }
  return histogram.at(-1)?.size ?? 0
}

/** The bet option nearest to a card size on a log scale (1, 10 or 1,000). */
export function bucketChoice(size: number): 'one' | 'ten' | 'thousand' {
  const lg = Math.log10(Math.max(1, size))
  const options = [
    ['one', 0],
    ['ten', 1],
    ['thousand', 3],
  ] as const
  return [...options].sort((a, b) => Math.abs(lg - a[1]) - Math.abs(lg - b[1]))[0]![0]
}

// ---------------------------------------------------------------------------
// Keys: 'AD:9.9.4.4 BE:8.8.5.5 CF:8.8.5.5'
// ---------------------------------------------------------------------------

/** The key the catalogue files a day under (each product's cycle lengths, longest first). */
export const characteristicOf = (p: Products3): string => characteristic(p.AD, p.BE, p.CF)

/** The characteristic of the cyclometer's day (the catalogue scene shows its card). */
export const CYCLO_CHARACTERISTIC = characteristicOf(productsFromMachine(CYCLO_DAY))

/** A key from three lists of lengths, in the order given (no sorting). */
export const keyOf = (lists: readonly (readonly number[])[]): string =>
  PRODUCTS.map((n, k) => `${n}:${(lists[k] ?? []).join('.')}`).join(' ')

/** A typed key made comparable: upper case, single spaces, no spaces around ':' or '.'. */
export function normalizeKey(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .replace(/\s*([:.])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The three lists of lengths in a key, or null when it is not of the form AD:… BE:… CF:…. */
export function parseKey(s: unknown): number[][] | null {
  const m = /^AD:([\d.]*) BE:([\d.]*) CF:([\d.]*)$/.exec(normalizeKey(s))
  if (!m) return null
  return [m[1]!, m[2]!, m[3]!].map((x) => x.split('.').filter(Boolean).map(Number))
}

/** The lengths of a product's cycles in the order its notation lists them. */
export const listedLengths = (p: readonly number[]): number[] => cycles(p).map((c) => c.length)

/** The MISCONCEPTION "copy the lengths in the order the cycles are written": never the catalogue's key. */
export const naiveSignature = (p: Products3): string => keyOf(PRODUCTS.map((n) => listedLengths(p[n])))

// ---------------------------------------------------------------------------
// signature: custom, build the characteristic key from AD, BE and CF (rollback: cycles)
// ---------------------------------------------------------------------------

export interface SignatureInstance {
  readonly products: Products3
}

/** The first cycle of `perm` whose length the learner's list does not account for. */
function missedCycle(perm: readonly number[], got: readonly number[]): number[] {
  const pool = [...got]
  const all = cycles(perm)
  return (
    all.find((c) => {
      const k = pool.indexOf(c.length)
      if (k === -1) return true
      pool.splice(k, 1)
      return false
    }) ?? all[0]!
  )
}

/** The rollback of a key: the first product whose lengths are wrong, and the cycle to walk. */
export function signatureRollback(p: Products3, answer: unknown): Extract<Rollback, { kind: 'cycles' }> {
  const lists = parseKey(answer) ?? [[], [], []]
  for (const [k, name] of PRODUCTS.entries()) {
    const perm = p[name]
    const expected = cycleSignature(perm)
    const got = lists[k] ?? []
    if (got.join('.') === expected.join('.')) continue
    const sameMultiset = [...got].sort((a, b) => b - a).join('.') === expected.join('.')
    // Right lengths in the wrong order: walk the first cycle that is listed before a longer one.
    const cycle = sameMultiset ? (cycles(perm).find((c) => c.length < expected[0]!) ?? cycles(perm)[0]!) : missedCycle(perm, got)
    return { kind: 'cycles', perm: [...perm], cycle, expected, got: [...got] }
  }
  const perm = p.AD
  return { kind: 'cycles', perm: [...perm], cycle: cycles(perm)[0]!, expected: cycleSignature(perm), got: lists[0] ?? [] }
}

export function signatureFeedback(p: Products3, answer: unknown): string {
  const rb = signatureRollback(p, answer)
  const name = PRODUCTS.find((n) => sameJson(p[n], rb.perm)) ?? 'AD'
  if (!parseKey(answer)) return 'Write the key as AD:… BE:… CF:…, each list of lengths joined by dots.'
  const sorted = [...rb.got].sort((a, b) => b - a).join('.') === rb.expected.join('.')
  if (sorted) {
    return (
      `The lengths of ${name} are right, but not longest first. The catalogue files each product's lengths in ` +
      'descending order, so a day has exactly one key whatever order its cycles are written in.'
    )
  }
  return `Recount ${name}: walk ${cycleText(rb.cycle)}, ${rb.cycle.length} letters, and count every cycle, fixed letters included.`
}

export const signature: ItemLogic<SignatureInstance, string> = {
  id: 'signature',
  kind: 'custom',
  rule: WINDOW,
  compute: true,
  inPage: false,
  generate(r) {
    for (;;) {
      const p = productsFromMachine(dayKey(r, { era: '1936', rings: 'AAA' }))
      const products: Products3 = { AD: p.AD, BE: p.BE, CF: p.CF }
      // Never a day whose cycles are all written longest first already: copying them in order must fail.
      if (naiveSignature(products) === characteristicOf(products)) continue
      return { products }
    }
  },
  same: (a, b) => sameJson(a.products, b.products),
  solve: (i) => characteristicOf(i.products),
  check(i, a): CheckResult {
    const ok = normalizeKey(a) === characteristicOf(i.products)
    return verdict(ok, signatureRollback(i.products, a), ok ? undefined : signatureFeedback(i.products, a))
  },
  sampleAnswer: (_i, r) => keyOf([0, 1, 2].map(() => randomPairedPartition(r, 26))),
  mutate(i, a) {
    const lists = parseKey(a) ?? PRODUCTS.map((n) => cycleSignature(i.products[n]))
    const k = lists.findIndex((l) => new Set(l).size > 1)
    return keyOf(lists.map((l, j) => (j === Math.max(0, k) ? [...l].reverse() : l)))
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------
// The day's traffic: indicators that show every letter in every place, and a test message
// ---------------------------------------------------------------------------

/**
 * `count` indicators of `day` (count ≥ 26) in which every letter appears in each of the six places, so AD, BE and
 * CF can be read off completely: 26 message keys chosen through A, B and C, then random keys, shuffled.
 */
export function dayIndicators(r: Rng, day: MachineConfig, count = 60): string[] {
  const [A, B, C] = sixPermutations(day) as [number[], number[], number[]]
  const sigma = randomPerm(r, 26)
  const tau = randomPerm(r, 26)
  const keys: string[] = []
  for (let j = 0; j < 26; j++) keys.push(L(A[j]!) + L(B[sigma[j]!]!) + L(C[tau[j]!]!))
  while (keys.length < count) keys.push(randLetter(r) + randLetter(r) + randLetter(r))
  return shuffle(
    r,
    keys.map((k) => encryptIndicator(day, k)),
  )
}

/** Words for test messages (X separates words, as in the traffic). */
const WORDS = [
  'ANGRIFF', 'MELDUNG', 'WETTER', 'KEINE', 'BESONDEREN', 'EREIGNISSE', 'NORD', 'OST', 'SUED', 'WEST', 'STAB',
  'FEIND', 'NACHT', 'LAGE', 'RUHIG', 'BRUECKE', 'STRASSE', 'DORF', 'HOEHE', 'FLUSS', 'MUNITION', 'ABMARSCH',
  'REGIMENT', 'KOMPANIE', 'BATTERIE', 'STELLUNG', 'VERBINDUNG', 'ERBITTE', 'ANKUNFT', 'VORHERSAGE', 'GRUPPE',
  'DIVISION', 'ARTILLERIE', 'FUNKSPRUCH', 'KAVALLERIE', 'BAHNHOF', 'KASERNE', 'UEBUNG', 'ZUG', 'STURM',
] as const

/** A plaintext of `length` letters that starts with a word of five letters or more. */
export function testPlaintext(r: Rng, length: number): string {
  let s = pick(
    r,
    WORDS.filter((w) => w.length >= 5),
  )
  while (s.length < length) s += `X${pick(r, WORDS)}`
  return s.slice(0, length)
}

const decrypt = (cfg: MachineConfig, message: string): string => encipher(createMachine(cfg), message).output

// ---------------------------------------------------------------------------
// lookup and lookup-transfer: set-machine, rotor order and ground setting from the card (rollback: machine)
// ---------------------------------------------------------------------------

/** A setting on a catalogue card: a rotor order (LEFT → RIGHT) and a ground setting, rings at 01. */
export interface CardSetting {
  readonly rotors: readonly RotorName[]
  readonly positions: string
}

/** Decode data.ts: four base-36 digits per setting, orderIndex × 17,576 + positionIndex. */
export function decodeCards(codes: string): CardSetting[] {
  const out: CardSetting[] = []
  for (let k = 0; k + 4 <= codes.length; k += 4) {
    const n = parseInt(codes.slice(k, k + 4), 36)
    out.push({ rotors: CATALOGUE_ORDERS[Math.floor(n / 17576)]!, positions: positionString(n % 17576) })
  }
  return out
}

export const encodeCard = (s: CardSetting): string => {
  const o = CATALOGUE_ORDERS.findIndex((x) => x.join('-') === s.rotors.join('-'))
  return (o * 17576 + positionIndex(s.positions)).toString(36).padStart(4, '0')
}

/**
 * The days the gate draws: settings whose card (UKW-A, rings 01) lists 2 to 5 settings and never first (the unit
 * tests re-derive every property from the built catalogue). The transfer never uses I-II-III, the scenes' order.
 */
export const CARD_TABLE: readonly CardSetting[] = decodeCards(LOOKUP_CODES)
export const TRANSFER_TABLE: readonly CardSetting[] = CARD_TABLE.filter((s) => s.rotors.join('-') !== 'I-II-III')

let tableKeys: string[] | null = null
/** The characteristic of every table setting (computed once). */
function cardTableKeys(): string[] {
  tableKeys ??= CARD_TABLE.map((s) => characteristicAt(s.rotors, 'A', s.positions))
  return tableKeys
}

export interface LookupInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'preview'
  /** The day's indicators (the first six letters of 60 messages). */
  readonly indicators: readonly string[]
  /** The day's AD, BE and CF (lookup); null in the transfer, where only the raw indicators are given. */
  readonly products: Products3 | null
  /** A test message typed at the day's ground setting; the preview decrypts it (with the day's hidden cables). */
  readonly message: string
  /** Its first five plaintext letters. */
  readonly crib: string
}

/** The day's products: given, or read off the indicators. */
export function dayProducts(i: Pick<LookupInstance, 'products' | 'indicators'>): Products3 {
  if (i.products) return i.products
  const p = observedProducts(i.indicators)
  const full = (x: readonly (number | null)[]) => x.map((v) => v ?? 0)
  return { AD: full(p.AD), BE: full(p.BE), CF: full(p.CF) }
}

export const dayCharacteristic = (i: Pick<LookupInstance, 'products' | 'indicators'>): string =>
  characteristicOf(dayProducts(i))

const ROTOR_PARTS: readonly PartId[] = ['rotor-left', 'rotor-middle', 'rotor-right']

export function generateLookup(r: Rng, transfer: boolean): LookupInstance {
  const card = pick(r, transfer ? TRANSFER_TABLE : CARD_TABLE)
  const base = dayKey(r, { era: '1936', rings: 'AAA', orders: [card.rotors] })
  const day = normalizeConfig({ ...base, positions: card.positions })
  const indicators = dayIndicators(r, day)
  const plain = testPlaintext(r, 30)
  const p = productsFromMachine(day)
  return {
    setup: { machine: normalizeConfig({ ...day, rotors: ['I', 'II', 'III'], positions: 'AAA' }), stage: 'rotors' },
    unlocked: ['rotors', 'positions'],
    trial: 'preview',
    indicators,
    products: transfer ? null : { AD: p.AD, BE: p.BE, CF: p.CF },
    message: decrypt(day, plain),
    crib: plain.slice(0, 5),
  }
}

/** The setting the method finds: the table settings filed under the day's key, tried on the test message. */
export function lookupSolve(i: LookupInstance): MachineConfig {
  const want = dayCharacteristic(i)
  const keys = cardTableKeys()
  for (const [k, s] of CARD_TABLE.entries()) {
    if (keys[k] !== want) continue
    const cfg = normalizeConfig({ ...i.setup.machine, rotors: [...s.rotors], positions: s.positions })
    if (decrypt(cfg, i.message).startsWith(i.crib)) return cfg
  }
  throw new Error('No card setting reads the test message')
}

export const settingText = (cfg: Pick<MachineConfig, 'rotors' | 'positions'>): string =>
  `${cfg.rotors.join('-')} at ${cfg.positions.join('')}`

export function lookupItem(id: string, transfer: boolean): ItemLogic<LookupInstance, MachineConfig> {
  return setMachineItem<LookupInstance>({
    id,
    rule: transfer ? ONCE : WINDOW,
    ...(transfer ? { transfer: true as const } : {}),
    generate: (r) => generateLookup(r, transfer),
    same: (a, b) => a.message === b.message && sameJson(a.indicators, b.indicators),
    predicate(i, cfg) {
      const want = dayCharacteristic(i)
      const got = characteristicAt(cfg.rotors, cfg.reflector, cfg.positions.join(''))
      if (got !== want) {
        return {
          field: 'positions',
          message: `${settingText(cfg)} has the characteristic ${got}, not the day's ${want}: it is not on the day's card.`,
          highlight: ROTOR_PARTS,
        }
      }
      const out = decrypt(cfg, i.message)
      if (!out.startsWith(i.crib)) {
        return {
          field: 'positions',
          message: `${settingText(cfg)} is on the day's card, but with it the test message begins ${out.slice(0, 5)}, not ${i.crib}.`,
          highlight: ROTOR_PARTS,
        }
      }
      return true
    },
    solve: lookupSolve,
    sampleAnswer: (i, r) =>
      normalizeConfig({
        ...i.setup.machine,
        rotors: [...pick(r, CATALOGUE_ORDERS)],
        positions: randLetter(r) + randLetter(r) + randLetter(r),
      }),
    highlight: () => ROTOR_PARTS.map((part) => ({ part, tone: 'hint' as const })),
  })
}

export const lookup = lookupItem('lookup', false)
export const lookupTransfer = lookupItem('lookup-transfer', true)

/** The windows after the first key press from a card setting (rings 01). */
export const afterFirstPress = (s: CardSetting): string =>
  sixWindows(normalizeConfig({ model: 'I', reflector: 'A', rotors: [...s.rotors], rings: 'AAA', positions: s.positions, plugboard: [] }))[0]!

/**
 * Double-step twins: two settings of one rotor order that stand alike after the first press (a middle rotor on its
 * turnover steps together with the left one), so they encipher every message alike and share a card.
 */
export const areTwins = (a: CardSetting, b: CardSetting): boolean =>
  a.rotors.join('-') === b.rotors.join('-') && afterFirstPress(a) === afterFirstPress(b)

/** The MISCONCEPTION "take the first setting on the card": the first setting filed under the day's key. */
export function firstCandidate(i: LookupInstance, card: readonly CardSetting[]): MachineConfig {
  const s = card[0]!
  return normalizeConfig({ ...i.setup.machine, rotors: [...s.rotors], positions: s.positions })
}

// ---------------------------------------------------------------------------
// set-plugs: set-machine, cables until the test message decrypts (rollback: machine)
// ---------------------------------------------------------------------------

export interface PlugsInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'preview'
  readonly maxPlugs: number
  /** The test message, typed at the ground setting the setup already shows. */
  readonly message: string
  /** Its known plaintext. */
  readonly plain: string
}

export const MAX_PLUGS = 6

/** The scrambler (no cables) at each of the message's presses, for the few instances in use (fast path). */
const scramblerMemo = new Map<string, readonly (readonly number[])[]>()
function columnScramblers(i: PlugsInstance): readonly (readonly number[])[] {
  const m = i.setup.machine
  const key = JSON.stringify([m.rotors, m.reflector, m.rings, m.positions, i.message.length])
  let perms = scramblerMemo.get(key)
  if (!perms) {
    let state = createMachine(normalizeConfig({ ...m, plugboard: [] }))
    const out: number[][] = []
    for (let k = 0; k < i.message.length; k++) {
      state = step(state).state
      out.push([...machinePermutation(state)])
    }
    perms = out
    if (scramblerMemo.size > 16) scramblerMemo.clear()
    scramblerMemo.set(key, perms)
  }
  return perms
}

/**
 * The test message decrypted with `plugs` as cables: at press k the machine is S·E_k·S (S the cables, E_k the
 * scrambler), the same as the engine's encipher (a unit test compares them).
 */
export function decryptWith(i: PlugsInstance, plugs: readonly string[]): string {
  const e = columnScramblers(i)
  const sw = LETTERS.map((_, x) => x)
  for (const p of plugs) {
    const [a, b] = [idx(p[0]!), idx(p[1]!)]
    sw[a] = b
    sw[b] = a
  }
  let out = ''
  for (let k = 0; k < i.message.length; k++) out += L(sw[e[k]![sw[idx(i.message[k]!)]!]!]!)
  return out
}

const matches = (a: string, b: string): number => [...a].filter((c, k) => c === b[k]).length

/**
 * The method, as the prompt teaches it: where the preview shows X and the plaintext has p, try the cable X–p (it is
 * right whenever the cipher letter there has no cable); keep a cable only if more letters come right, and take one
 * out when no new cable helps. Returns the cables once the whole message reads, or null when it gets stuck.
 */
export function plugSolver(i: PlugsInstance): string[] | null {
  let plugs: string[] = []
  let out = decryptWith(i, plugs)
  let score = matches(out, i.plain)
  for (let round = 0; round < 40 && score < i.plain.length; round++) {
    let moved = false
    const used = new Set(plugs.join(''))
    const tried = new Set<string>()
    for (let k = 0; k < out.length && !moved && plugs.length < i.maxPlugs; k++) {
      if (out[k] === i.plain[k]) continue
      const pair = [out[k]!, i.plain[k]!].sort().join('')
      if (tried.has(pair) || used.has(pair[0]!) || used.has(pair[1]!)) continue
      tried.add(pair)
      const next = [...plugs, pair]
      const o = decryptWith(i, next)
      const s = matches(o, i.plain)
      if (s > score) [plugs, out, score, moved] = [next, o, s, true]
    }
    for (const p of moved ? [] : plugs) {
      const next = plugs.filter((x) => x !== p)
      const o = decryptWith(i, next)
      const s = matches(o, i.plain)
      if (s > score) {
        ;[plugs, out, score, moved] = [next, o, s, true]
        break
      }
    }
    if (!moved) return null
  }
  return score === i.plain.length ? plugs.sort() : null
}

/** The cables of `plugs` without which the message no longer reads. */
export function neededCables(i: PlugsInstance, plugs: readonly string[]): string[] {
  return plugs.filter((p) => decryptWith(i, plugs.filter((x) => x !== p)) !== i.plain)
}

/** The MISCONCEPTION "one mismatch gives the plugboard": the cable from the first wrong letter alone. */
export function firstPairCable(i: PlugsInstance): MachineConfig {
  const out = decryptWith(i, [])
  const k = [...out].findIndex((c, j) => c !== i.plain[j])
  const pair = k === -1 ? [] : [[out[k]!, i.plain[k]!].sort().join('')]
  return normalizeConfig({ ...i.setup.machine, plugboard: pair })
}

export function generatePlugs(r: Rng): PlugsInstance {
  for (;;) {
    const day = dayKey(r, { era: '1936', rings: 'AAA' })
    const plain = testPlaintext(r, 36)
    const i: PlugsInstance = {
      setup: { machine: normalizeConfig({ ...day, plugboard: [] }), stage: 'plugboard' },
      unlocked: ['plugboard'],
      trial: 'preview',
      maxPlugs: MAX_PLUGS,
      message: decrypt(day, plain),
      plain,
    }
    // The method must work, and the message must need three cables or more (one mismatch never suffices).
    const solved = plugSolver(i)
    if (!solved || neededCables(i, day.plugboard).length < 3 || neededCables(i, solved).length < 3) continue
    return i
  }
}

const cablesText = (plugs: readonly string[]): string =>
  plugs.length ? `the cable${plugs.length === 1 ? '' : 's'} ${plugs.map((p) => `${p[0]}–${p[1]}`).join(', ')}` : 'no cables'

export const setPlugs = setMachineItem<PlugsInstance>({
  id: 'set-plugs',
  rule: ONCE,
  generate: (r) => generatePlugs(r),
  same: (a, b) => a.message === b.message && a.plain === b.plain,
  predicate(i, cfg) {
    const out = decrypt(cfg, i.message)
    if (out === i.plain) return true
    return {
      field: 'plugboard',
      message: `With ${cablesText(cfg.plugboard)} the test message reads ${out}: ${matches(out, i.plain)} of ${i.plain.length} letters are right.`,
      highlight: ['plugboard'],
    }
  },
  solve(i) {
    const plugs = plugSolver(i)
    if (!plugs) throw new Error('The cable search is stuck')
    return normalizeConfig({ ...i.setup.machine, plugboard: plugs })
  },
  sampleAnswer(i, r) {
    const letters = shuffle(r, [...LETTERS])
    const n = int(r, MAX_PLUGS + 1)
    return normalizeConfig({ ...i.setup.machine, plugboard: Array.from({ length: n }, (_, k) => letters[2 * k]! + letters[2 * k + 1]!) })
  },
  mutate(i, a) {
    const needed = neededCables(i, a.plugboard)
    const drop = needed[0] ?? a.plugboard[0]
    return normalizeConfig({ ...a, plugboard: a.plugboard.filter((p) => p !== drop) })
  },
  highlight: () => [{ part: 'plugboard', tone: 'hint' }],
})

// ---------------------------------------------------------------------------
// rejewski-parsons: order(6), once, constant answer (rollback: order)
// ---------------------------------------------------------------------------

export const PARSONS_BLOCKS: readonly Choice[] = [
  { id: 'collect', label: "Collect the day's indicators: the first six letters of every message" },
  { id: 'products', label: 'Read AD, BE and CF off the indicators' },
  { id: 'lengths', label: 'Count the cycle lengths of each product: the characteristic' },
  { id: 'lookup', label: 'Look the characteristic up in the catalogue' },
  { id: 'set', label: 'Set each rotor order and ground setting on its card until a test message reads' },
  { id: 'plugs', label: 'Recover the cables from the partly readable decrypt' },
]

export const rejewskiParsons = orderItem<{ blocks: readonly Choice[] }>({
  id: 'rejewski-parsons',
  rule: ONCE,
  constantAnswer: true,
  generate(r) {
    for (;;) {
      const blocks = shuffle(r, PARSONS_BLOCKS)
      if (blocks.some((b, k) => b.id !== PARSONS_BLOCKS[k]!.id)) return { blocks }
    }
  },
  same: (a, b) => sameJson(a.blocks, b.blocks),
  solve: () => PARSONS_BLOCKS.map((b) => b.id),
  check(_i, a) {
    const want = PARSONS_BLOCKS.map((b) => b.id)
    const got = Array.isArray(a) ? a.map(String) : []
    return verdict(sameJson(got, want), orderRollback(want, got))
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  catalogue: {
    items: [signature, lookup, setPlugs, lookupTransfer, rejewskiParsons] as ItemLogic[],
    fallback: lookup as ItemLogic,
  },
}
