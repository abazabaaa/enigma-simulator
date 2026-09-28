/**
 * Chapter iv-capstone · "the day key" (PLAN §4.4 iv-capstone, brief 16). PURE (L4): engine, lib/rng, contracts,
 * lesson/kinds, crypto and this chapter's data.ts.
 *
 * Two puzzle gates (first hint at attempt 3; every answer draws a fresh day):
 *  gate `polish` (a 1936-style day: UKW-A, rotors I–III, rings 01, 6 cables, doubled indicators at one ground setting)
 *   - polish-card     custom · once · 70 raw indicators → the day's characteristic (products → cycle lengths → key)
 *   - polish-key      set-machine · once · trial preview · 70 indicators and the first message → rotor order, message
 *                     key and cables such that the message reads (catalogue card → the doubled-key test picks the
 *                     day → cables → the first indicator gives the message key)
 *   - fallback polish-plugs   set-machine · rotors and message key preset, only the cables missing
 *  gate `british` (a 1940-style day: UKW-B, three of rotors I–V, rings 01, 10 cables, the key enciphered once)
 *   - british-menu    custom · once · a crib and an intercept → the crib's crash-free offset and a menu (≥ 2 closures)
 *   - british-key     set-machine · once · trial preview · the intercept, the crib and 3 candidate wheel orders →
 *                     rotor order, message key and cables such that it reads (menu → bombe → checking machine →
 *                     the remaining cables from the partial decrypt)
 *   - read-intercepts letters(10) · 2/3 · a broken day key and three intercepts of that day → the first 10
 *                     plaintext letters of one of them (start position in clear, message key enciphered once)
 *   - fallback british-plugs  set-machine · rotors and message key preset, only the cables missing
 *
 * No instance carries a day key, a catalogue card, a bombe stop or a stecker of the day it asks about
 * (window.__course.gate() is readable): a key item's instance holds the traffic and a `seed`, and the truth is
 * rebuilt from that seed on the checking side (polishDay, britishDay). The fallbacks and read-intercepts hand the
 * learner part of a key on purpose: what they ask for is never in the instance.
 * Every instance holds the case a misconception gets wrong (see the naive* helpers and the MISCONCEPTION BOT tests).
 */

import type { Letter, MachineConfig } from '../../contracts/core'
import type { ChapterGates, CheckResult, ItemLogic, ItemSetup, Rollback } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { PartId, StageRef } from '../../contracts/stage'
import { CATALOGUE_ORDERS, characteristic, checkStop, crashes, dayKey, positionString, testLetterOf } from '../../crypto'
import { closures, loops, menuFromEdges, type MenuEdge } from '../../crypto/menu'
import { scramblerTables } from '../../crypto/tables'
import {
  LETTERS,
  ROTORS,
  cycleSignature,
  cycles,
  mod,
  normalizeConfig,
  type ReflectorName,
  type RotorName,
} from '../../engine'
import { createRng, int, pick, randLetter, sample, shuffle, type Rng } from '../../lib/rng'
import { lettersItem, randomPairedPartition, setMachineItem, verdict } from '../../lesson/kinds'
import { POLISH_CARDS } from './data'

const ONCE = { kind: 'once' } as const
const WINDOW = { kind: 'window' } as const
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const range = (n: number): number[] => Array.from({ length: n }, (_, k) => k)

export const L = (i: number): Letter => LETTERS[mod(i)]!
/** A letter's index (A = 0); lower case is accepted. The hot paths of the generators call this, so no indexOf. */
export const idx = (l: string): number => {
  const c = l.charCodeAt(0)
  return c >= 97 ? c - 97 : c - 65
}
const letters3 = (r: Rng): string => String.fromCharCode(65 + int(r, 26), 65 + int(r, 26), 65 + int(r, 26))

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

/** A seed drawn from an instance's random source: the day is rebuilt from it on the checking side. */
const drawSeed = (r: Rng): number => int(r, 2 ** 31)

/** A small cache: generators and checks rebuild the same day from its seed many times. */
function memo<T>(make: (seed: number) => T, size = 400): (seed: number) => T {
  const cache = new Map<number, T>()
  return (seed) => {
    const hit = cache.get(seed)
    if (hit !== undefined) return hit
    const value = make(seed)
    if (cache.size >= size) cache.delete(cache.keys().next().value!)
    cache.set(seed, value)
    return value
  }
}

// ---------------------------------------------------------------------------
// A fast Enigma I (three rotors) on the crypto kit's scrambler tables; the unit tests compare it with the engine
// ---------------------------------------------------------------------------

/** What a machine needs besides its start windows: rotors LEFT → RIGHT, reflector, rings (3 letters), cables. */
export interface DayKey {
  readonly rotors: readonly RotorName[]
  readonly reflector: ReflectorName
  readonly rings: string
  readonly plugboard: readonly string[]
}

export const keyOfConfig = (c: Pick<MachineConfig, 'rotors' | 'reflector' | 'rings' | 'plugboard'>): DayKey => ({
  rotors: [...c.rotors],
  reflector: c.reflector,
  rings: c.rings.join(''),
  plugboard: [...c.plugboard],
})

/** A cable with its letters in alphabetical order ('QA' → 'AQ'), as checkStop and the machine store write them. */
export const sortPair = (p: string): string => [...p.toUpperCase()].sort().join('')

/** Cables in a canonical form: each pair sorted, the list sorted. */
export const canonicalCables = (plugs: readonly string[]): string[] => plugs.map(sortPair).sort()

/** The cables as a permutation of letter indices. */
export function plugPerm(plugs: readonly string[]): number[] {
  const S = range(26)
  for (const p of plugs) {
    const a = idx(p[0]!)
    const b = idx(p[1]!)
    S[a] = b
    S[b] = a
  }
  return S
}

/** The windows before each of `n` key presses and after them: the engine's stepping (double step included). */
export function windowsAfter(rotors: readonly RotorName[], start: string, n: number): string {
  const t = scramblerTables(rotors, 'B')
  let [l, m, r] = [...start.toUpperCase()].map(idx) as [number, number, number]
  for (let k = 0; k < n; k++) {
    const rightAt = t.right.turnover[r] === 1
    const middleAt = t.middle.turnover[m] === 1
    r = (r + 1) % 26
    if (rightAt || middleAt) m = (m + 1) % 26
    if (middleAt) l = (l + 1) % 26
  }
  return L(l) + L(m) + L(r)
}

/**
 * The scrambler (no cables) at key presses 1 … n from windows `start`, as the machine steps: perms[k][x] is where
 * press k + 1 sends x between the two passes through the plugboard.
 */
export function pressScramblers(k: Pick<DayKey, 'rotors' | 'reflector' | 'rings'>, start: string, n: number): number[][] {
  const t = scramblerTables(k.rotors, k.reflector)
  const rings = [...k.rings].map(idx)
  let [l, m, r] = [...start.toUpperCase()].map(idx) as [number, number, number]
  const out: number[][] = []
  for (let j = 0; j < n; j++) {
    const rightAt = t.right.turnover[r] === 1
    const middleAt = t.middle.turnover[m] === 1
    r = (r + 1) % 26
    if (rightAt || middleAt) m = (m + 1) % 26
    if (middleAt) l = (l + 1) % 26
    const perm = new Array<number>(26)
    t.perm(mod(l - rings[0]!), mod(m - rings[1]!), mod(r - rings[2]!), perm)
    out.push(perm)
  }
  return out
}

/** Encipher (or decipher: the same) `text` from windows `start`: straight from the kit's tables, no allocation per key. */
export function encipherFast(k: DayKey, start: string, text: string): string {
  const S = plugPerm(k.plugboard)
  const t = scramblerTables(k.rotors, k.reflector)
  const { fwd, bwd } = t.right
  const [gl, gm, gr] = [...k.rings].map(idx) as [number, number, number]
  let [l, m, r] = [...start.toUpperCase()].map(idx) as [number, number, number]
  let out = ''
  for (let j = 0; j < text.length; j++) {
    const rightAt = t.right.turnover[r] === 1
    const middleAt = t.middle.turnover[m] === 1
    r = (r + 1) % 26
    if (rightAt || middleAt) m = (m + 1) % 26
    if (middleAt) l = (l + 1) % 26
    const ro = ((r - gr + 26) % 26) * 26
    const base = (((l - gl + 26) % 26) * 26 + ((m - gm + 26) % 26)) * 26
    const x = S[text.charCodeAt(j) - 65]!
    out += String.fromCharCode(65 + S[bwd[ro + t.inner[base + fwd[ro + x]!]!]!]!)
  }
  return out
}

/** What a machine setting makes of `text` (the trial preview). */
export const decryptWith = (c: MachineConfig, text: string): string =>
  encipherFast(keyOfConfig(c), c.positions.join(''), text)

/** Letters of `a` that match `b`, position by position. */
export const matches = (a: string, b: string): number => [...a].filter((c, k) => c === b[k]).length

// ---------------------------------------------------------------------------
// Plaintext: German military words, X between words
// ---------------------------------------------------------------------------

/** The words of the day's messages (the British prompts print them: reading a partial decrypt needs them). */
export const VOCABULARY: readonly string[] = [
  'ANGRIFF', 'MELDUNG', 'WETTER', 'KEINE', 'BESONDEREN', 'EREIGNISSE', 'NORD', 'OST', 'SUED', 'WEST', 'STAB',
  'FEIND', 'NACHT', 'LAGE', 'RUHIG', 'BRUECKE', 'STRASSE', 'DORF', 'HOEHE', 'FLUSS', 'MUNITION', 'ABMARSCH',
  'REGIMENT', 'KOMPANIE', 'BATTERIE', 'STELLUNG', 'VERBINDUNG', 'ERBITTE', 'ANKUNFT', 'GRUPPE', 'DIVISION',
  'ARTILLERIE', 'FUNKSPRUCH', 'BAHNHOF', 'KASERNE', 'UEBUNG', 'ZUG', 'STURM', 'NEBEL', 'REGEN', 'WIND', 'KALT',
  'NULL', 'EINS', 'ZWEI', 'DREI', 'VIER', 'FUENF', 'SECHS', 'SIEBEN', 'ACHT', 'NEUN', 'UHR', 'BEI', 'VON', 'NACH',
]

/** `length` letters of words joined by X (the last word may be cut short). */
export function plaintext(r: Rng, length: number): string {
  let s = pick(r, VOCABULARY)
  while (s.length < length) s += `X${pick(r, VOCABULARY)}`
  return s.slice(0, length)
}

// ---------------------------------------------------------------------------
// The Polish day (1936 style)
// ---------------------------------------------------------------------------

/** A catalogue card entry: a rotor order (LEFT → RIGHT) and a ground setting, rings 01, reflector A. */
export interface CardSetting {
  readonly rotors: readonly RotorName[]
  readonly positions: string
}

export interface CardRow {
  /** The day's rotor order and ground setting. */
  readonly setting: CardSetting
  /** Its catalogue card, in catalogue order (never the setting first). */
  readonly card: readonly CardSetting[]
}

const decodeSetting = (code: string): CardSetting => {
  const n = parseInt(code, 36)
  return { rotors: CATALOGUE_ORDERS[Math.floor(n / 17576)]!, positions: positionString(n % 17576) }
}

export function decodeCards(data: string): CardRow[] {
  const out: CardRow[] = []
  let k = 0
  while (k + 5 <= data.length) {
    const setting = decodeSetting(data.slice(k, k + 4))
    const n = Number(data[k + 4])
    const card = range(n).map((j) => decodeSetting(data.slice(k + 5 + 4 * j, k + 9 + 4 * j)))
    out.push({ setting, card })
    k += 5 + 4 * n
  }
  return out
}

export const CARD_ROWS: readonly CardRow[] = decodeCards(POLISH_CARDS)

export const POLISH_CABLES = 6
export const INDICATOR_COUNT = 70
export const POLISH_MESSAGE_LENGTH = 42
/** The known opening of the first message. */
export const KNOWN_LETTERS = 6

export const settingText = (s: CardSetting): string => `${s.rotors.join('-')} at ${s.positions}`

/** The key a 1936-style day's machine has (reflector A, rings 01), for a rotor order and cables. */
export const polishKey = (rotors: readonly RotorName[], plugboard: readonly string[] = []): DayKey => ({
  rotors,
  reflector: 'A',
  rings: 'AAA',
  plugboard,
})

/** The six machine permutations at presses 1 … 6 from the ground setting, cables included (A … F). */
export function sixPerms(k: DayKey, ground: string): number[][] {
  const S = plugPerm(k.plugboard)
  return pressScramblers(k, ground, 6).map((E) => range(26).map((x) => S[E[S[x]!]!]!))
}

/** The doubled indicator of a message key: the key typed twice at the ground setting. */
export function indicatorOf(six: readonly (readonly number[])[], key: string): string {
  const [a, b, c] = [key.charCodeAt(0) - 65, key.charCodeAt(1) - 65, key.charCodeAt(2) - 65]
  return String.fromCharCode(
    65 + six[0]![a]!,
    65 + six[1]![b]!,
    65 + six[2]![c]!,
    65 + six[3]![a]!,
    65 + six[4]![b]!,
    65 + six[5]![c]!,
  )
}

/**
 * `count` indicators of a day in which every letter appears in each of the six places (so AD, BE and CF can be read
 * off completely): 26 keys chosen through A, B and C, then random keys; shuffled.
 */
export function coveringIndicators(r: Rng, six: readonly (readonly number[])[], count: number): string[] {
  const [A, B, C] = six as [number[], number[], number[]]
  const sigma = shuffle(r, range(26))
  const tau = shuffle(r, range(26))
  const keys: string[] = range(26).map((j) => L(A[j]!) + L(B[sigma[j]!]!) + L(C[tau[j]!]!))
  while (keys.length < count) keys.push(letters3(r))
  return shuffle(
    r,
    keys.map((key) => indicatorOf(six, key)),
  )
}

/** A product read off the indicators: positions p → p + 3 (0: AD, 1: BE, 2: CF); −1 where no indicator shows it. */
export function productOf(indicators: readonly string[], p: 0 | 1 | 2): number[] {
  const out = new Array<number>(26).fill(-1)
  for (const s of indicators) out[s.charCodeAt(p) - 65] = s.charCodeAt(p + 3) - 65
  return out
}

export const PRODUCTS = ['AD', 'BE', 'CF'] as const
export type ProductName = (typeof PRODUCTS)[number]
export interface Products3 {
  readonly AD: readonly number[]
  readonly BE: readonly number[]
  readonly CF: readonly number[]
}

export const productsOf = (indicators: readonly string[]): Products3 => ({
  AD: productOf(indicators, 0),
  BE: productOf(indicators, 1),
  CF: productOf(indicators, 2),
})

/** The catalogue key of three products: each product's cycle lengths, longest first. */
export const characteristicOf = (p: Products3): string => characteristic(p.AD, p.BE, p.CF)

/** Cycle lengths in the order the cycles are met walking from A, B, C … (the MISCONCEPTION: not sorted). */
export const listedLengths = (p: readonly number[]): number[] => cycles(p).map((c) => c.length)

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

/** The MISCONCEPTION "copy the lengths in the order the cycles are met": never the catalogue's key. */
export const naiveCharacteristic = (p: Products3): string => keyOf(PRODUCTS.map((n) => listedLengths(p[n])))

/**
 * The doubled-key test at a rotor order and ground setting, with some cables: the day's indicators deciphered there.
 * `pairs` counts letter pairs (1st and 4th, 2nd and 5th, 3rd and 6th) that agree, out of 3 per indicator; `doubled`
 * counts indicators that read as a key typed twice. At the day's own setting and cables every indicator reads doubled.
 */
export interface DoubledTest {
  readonly decrypts: readonly string[]
  readonly pairs: number
  readonly doubled: number
}

export function doubledTest(indicators: readonly string[], k: DayKey, ground: string): DoubledTest {
  const six = sixPerms(k, ground)
  const decrypts = indicators.map((s) =>
    range(6)
      .map((i) => L(six[i]![idx(s[i]!)]!))
      .join(''),
  )
  let pairs = 0
  let doubled = 0
  for (const d of decrypts) {
    const agree = range(3).filter((i) => d[i] === d[i + 3]).length
    pairs += agree
    if (agree === 3) doubled++
  }
  return { decrypts, pairs, doubled }
}

/** Letter-pair agreement only (the fast inner loop of the cable ranking), from the scramblers at presses 1 … 6. */
function pairScore(ind: readonly number[][], E: readonly (readonly number[])[], S: readonly number[]): number {
  let pairs = 0
  for (const s of ind) {
    for (let i = 0; i < 3; i++) {
      if (S[E[i]![S[s[i]!]!]!] === S[E[i + 3]![S[s[i + 3]!]!]!]) pairs++
    }
  }
  return pairs
}

export interface CableRank {
  readonly cable: string
  readonly pairs: number
}

/**
 * The cable finder: every single cable that could still be added (both letters free, at most `max` cables in all),
 * with the letter pairs that agree once it is in, best first (ties alphabetical). The polish-key workbench shows the
 * top of this list; adding the best cable each time is the method the generator guarantees to work.
 */
export function rankCables(indicators: readonly string[], k: DayKey, ground: string): CableRank[] {
  const E = pressScramblers(k, ground, 6)
  const ind = indicators.map((s) => [...s].map(idx))
  const used = new Set(k.plugboard.join(''))
  const out: CableRank[] = []
  const S = plugPerm(k.plugboard)
  for (let a = 0; a < 26; a++) {
    if (used.has(L(a))) continue
    for (let b = a + 1; b < 26; b++) {
      if (used.has(L(b))) continue
      S[a] = b
      S[b] = a
      out.push({ cable: L(a) + L(b), pairs: pairScore(ind, E, S) })
      S[a] = a
      S[b] = b
    }
  }
  return out.sort((x, y) => y.pairs - x.pairs || x.cable.localeCompare(y.cable))
}

/** The cables the cable finder leads to: the best cable each time, until every pair agrees (null if it stalls). */
export function greedyCables(indicators: readonly string[], rotors: readonly RotorName[], ground: string, max: number):
  string[] | null {
  let plugs: string[] = []
  const full = indicators.length * 3
  let score = doubledTest(indicators, polishKey(rotors), ground).pairs
  while (score < full) {
    if (plugs.length >= max) return null
    const best = rankCables(indicators, polishKey(rotors, plugs), ground)[0]
    if (!best || best.pairs <= score) return null
    plugs = [...plugs, best.cable]
    score = best.pairs
  }
  return plugs.sort()
}

export interface PolishDay {
  /** The day's machine: reflector A, rings 01, positions = the ground setting, 6 cables. */
  readonly day: MachineConfig
  readonly row: CardRow
  /** 70 indicators; the first belongs to the message. */
  readonly indicators: readonly string[]
  readonly messageKey: string
  readonly plain: string
  readonly cipher: string
}

const configOf = (k: DayKey, positions: string): MachineConfig =>
  normalizeConfig({ model: 'I', reflector: k.reflector, rotors: [...k.rotors], rings: k.rings, positions, plugboard: [...k.plugboard] })

/** The traffic of a 1936-style day at a card row: 6 cables, 70 indicators, the first message's key and body. */
function polishTraffic(r: Rng, row: CardRow) {
  const base = dayKey(r, { era: '1936', rings: 'AAA', orders: [row.setting.rotors] })
  const key = polishKey(row.setting.rotors, canonicalCables(base.plugboard))
  const ground = row.setting.positions
  const six = sixPerms(key, ground)
  let messageKey = letters3(r)
  while (messageKey === ground) messageKey = letters3(r)
  const indicators = [indicatorOf(six, messageKey), ...coveringIndicators(r, six, INDICATOR_COUNT - 1)]
  const plain = plaintext(r, POLISH_MESSAGE_LENGTH)
  const cipher = encipherFast(key, messageKey, plain)
  return { day: configOf(key, ground), key, ground, indicators, messageKey, plain, cipher }
}

/**
 * The MISCONCEPTIONS a Polish day must defeat, all with the day's own cables: the first setting on the card (its
 * first indicator read there for the message key), the ground setting used as the message key, and no cables.
 */
export function naivePolishConfigs(d: PolishDay): { firstCard: MachineConfig; groundAsKey: MachineConfig; noCables: MachineConfig } {
  const plugs = d.day.plugboard
  const first = d.row.card[0]!
  const firstKey = polishKey(first.rotors, plugs)
  const firstMessageKey = doubledTest([d.indicators[0]!], firstKey, first.positions).decrypts[0]!.slice(0, 3)
  return {
    firstCard: configOf(firstKey, firstMessageKey),
    groundAsKey: configOf(polishKey(d.day.rotors, plugs), d.day.positions.join('')),
    noCables: configOf(polishKey(d.day.rotors), d.messageKey),
  }
}

/** The doubled-key test with no cables at each setting of the day's card (the disambiguation the workbench shows). */
export function cardAgreement(d: Pick<PolishDay, 'row' | 'indicators'>): number[] {
  return d.row.card.map((s) => doubledTest(d.indicators, polishKey(s.rotors), s.positions).pairs)
}

/**
 * A 1936-style day from a seed: a card row, 6 random cables, 70 indicators, and a message. Redrawn until every
 * misconception fails, the doubled-key test (no cables) scores the day's setting clearly above every other setting
 * on its card, and the cable finder recovers cables with which the message reads.
 */
export const polishDay = memo((seed: number): PolishDay => {
  const r = createRng(seed)
  for (;;) {
    const row = pick(r, CARD_ROWS)
    const t = polishTraffic(r, row)
    const d: PolishDay = { day: t.day, row, indicators: t.indicators, messageKey: t.messageKey, plain: t.plain, cipher: t.cipher }
    const naive = naivePolishConfigs(d)
    if (Object.values(naive).some((c) => decryptWith(c, d.cipher) === d.plain)) continue
    const scores = cardAgreement(d)
    const own = scores[row.card.findIndex((s) => sameJson(s, row.setting))]!
    const others = scores.filter((_, k) => !sameJson(row.card[k], row.setting))
    if (own < 2 * Math.max(...others) || own < Math.max(...others) + 20) continue
    const cables = greedyCables(d.indicators, row.setting.rotors, row.setting.positions, POLISH_CABLES)
    if (!cables) continue
    const key = doubledTest([d.indicators[0]!], polishKey(row.setting.rotors, cables), row.setting.positions).decrypts[0]!
    if (key !== t.messageKey + t.messageKey) continue
    if (decryptWith(configOf(polishKey(row.setting.rotors, cables), t.messageKey), d.cipher) !== d.plain) continue
    return d
  }
})

/** The answer the method finds for a Polish day: its rotor order, the message key, the cables. */
export function polishSolution(d: PolishDay): MachineConfig {
  const cables = greedyCables(d.indicators, d.row.setting.rotors, d.row.setting.positions, POLISH_CABLES) ?? d.day.plugboard
  return configOf(polishKey(d.day.rotors, cables), d.messageKey)
}

// ---------------------------------------------------------------------------
// polish-card: custom · once · the characteristic from raw indicators (rollback: cycles)
// ---------------------------------------------------------------------------

export interface PolishCardInstance {
  readonly indicators: readonly string[]
}

/** A light day for polish-card: a card row (no characteristic is drawn for more than 4 of 720 days), 6 cables. */
export function polishCardInstance(r: Rng): PolishCardInstance {
  for (;;) {
    const row = pick(r, CARD_ROWS)
    const six = sixPerms(polishKey(row.setting.rotors, randomCables(r, POLISH_CABLES)), row.setting.positions)
    const indicators = coveringIndicators(r, six, INDICATOR_COUNT)
    const p = productsOf(indicators)
    // Copying the lengths in the order the cycles are met must never give the key.
    if (naiveCharacteristic(p) === characteristicOf(p)) continue
    return { indicators }
  }
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
export function cardRollback(p: Products3, answer: unknown): Extract<Rollback, { kind: 'cycles' }> {
  const lists = parseKey(answer) ?? [[], [], []]
  for (const [k, name] of PRODUCTS.entries()) {
    const perm = p[name]
    const expected = cycleSignature(perm)
    const got = lists[k] ?? []
    if (got.join('.') === expected.join('.')) continue
    const sorted = [...got].sort((a, b) => b - a).join('.') === expected.join('.')
    const cycle = sorted ? (cycles(perm).find((c) => c.length < expected[0]!) ?? cycles(perm)[0]!) : missedCycle(perm, got)
    return { kind: 'cycles', perm: [...perm], cycle, expected, got: [...got] }
  }
  return { kind: 'cycles', perm: [...p.AD], cycle: cycles(p.AD)[0]!, expected: cycleSignature(p.AD), got: lists[0] ?? [] }
}

const cycleText = (c: readonly number[]): string => `(${c.map((x) => L(x).toLowerCase()).join('')})`

export function cardFeedback(p: Products3, answer: unknown): string {
  if (!parseKey(answer)) return 'Write each product as its cycle lengths, longest first, for example 10 10 2 2 1 1.'
  const rb = cardRollback(p, answer)
  const name = PRODUCTS.find((n) => sameJson(p[n], rb.perm)) ?? 'AD'
  if ([...rb.got].sort((a, b) => b - a).join('.') === rb.expected.join('.')) {
    return `The lengths of ${name} are right, but the catalogue files them longest first: write ${rb.expected.join(' ')}.`
  }
  return `Recount ${name}: for example the cycle ${cycleText(rb.cycle)} has ${rb.cycle.length} letter${rb.cycle.length === 1 ? '' : 's'}, and every letter is in exactly one cycle (a letter sent to itself is a cycle of 1).`
}

export const polishCard: ItemLogic<PolishCardInstance, string> = {
  id: 'polish-card',
  kind: 'custom',
  rule: ONCE,
  compute: true,
  inPage: false,
  generate: polishCardInstance,
  same: (a, b) => sameJson(a.indicators, b.indicators),
  solve: (i) => characteristicOf(productsOf(i.indicators)),
  check(i, a): CheckResult {
    const p = productsOf(i.indicators)
    const ok = normalizeKey(a) === characteristicOf(p)
    return ok ? verdict(true) : verdict(false, cardRollback(p, a), cardFeedback(p, a))
  },
  sampleAnswer: (_i, r) => keyOf([0, 1, 2].map(() => randomPairedPartition(r, 26))),
  mutate(i, a) {
    const lists = parseKey(a) ?? PRODUCTS.map((n) => cycleSignature(productsOf(i.indicators)[n]))
    const k = lists.findIndex((l) => new Set(l).size > 1)
    if (k === -1) return keyOf(lists.map((l, j) => (j === 0 ? [l[0]! + 1, ...l.slice(1)] : l)))
    return keyOf(lists.map((l, j) => (j === k ? [...l].reverse() : l)))
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------
// polish-key and polish-plugs: set-machine · once · trial preview (rollback: machine)
// ---------------------------------------------------------------------------

const ROTOR_PARTS: readonly PartId[] = ['rotor-left', 'rotor-middle', 'rotor-right']

/** A machine with nothing of the day on it: the learner sets rotors, windows and cables. */
export const POLISH_START: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'A',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

export interface PolishKeyInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'preview'
  readonly maxPlugs: number
  /** The day is rebuilt from this seed on the checking side (polishDay). */
  readonly seed: number
  /** The day's 70 doubled indicators; the first belongs to the message. */
  readonly indicators: readonly string[]
  /** The first message's body (the preview deciphers it from the machine's windows). */
  readonly message: string
  /** Its first letters, known from the traffic's habits. */
  readonly known: string
  /** polish-plugs only: the rotor order and ground setting are given. */
  readonly ground?: string
}

const partsFor = (field: LockKey): readonly PartId[] => (field === 'plugboard' ? ['plugboard'] : ROTOR_PARTS)

/** Why a Polish answer does not read (checked against the day rebuilt from the seed). */
function polishVerdict(i: PolishKeyInstance, cfg: MachineConfig): true | { field: LockKey; message: string; highlight: readonly PartId[] } {
  const d = polishDay(i.seed)
  const out = decryptWith(cfg, i.message)
  if (out === d.plain) return true
  const fail = (field: LockKey, message: string) => ({ field, message, highlight: partsFor(field) })
  const begins = `With your setting the message begins ${out.slice(0, 8)}, not ${i.known}…`
  if (cfg.rotors.join('-') !== d.day.rotors.join('-')) {
    return fail('rotors', `${begins} The rotor order ${cfg.rotors.join('-')} is not the day's.`)
  }
  const windows = cfg.positions.join('')
  if (windows === d.day.positions.join('')) {
    return fail(
      'positions',
      `${begins} The windows stand at the day's ground setting ${windows}, which only unlocks the indicators: read the first indicator there, and set the windows to the message key it gives.`,
    )
  }
  if (windows !== d.messageKey) return fail('positions', `${begins} The windows are not the message key.`)
  return fail(
    'plugboard',
    `Rotor order and message key are right, but with your cables only ${matches(out, d.plain)} of ${d.plain.length} letters read: ${out}.`,
  )
}

export function polishItem(id: string, fallback: boolean): ItemLogic<PolishKeyInstance, MachineConfig> {
  return setMachineItem<PolishKeyInstance>({
    id,
    rule: ONCE,
    lintSeeds: 100,
    generate(r) {
      const seed = drawSeed(r)
      const d = polishDay(seed)
      const base = {
        unlocked: fallback ? (['plugboard'] as LockKey[]) : (['rotors', 'positions', 'plugboard'] as LockKey[]),
        trial: 'preview' as const,
        maxPlugs: POLISH_CABLES,
        seed,
        indicators: d.indicators,
        message: d.cipher,
        known: d.plain.slice(0, KNOWN_LETTERS),
      }
      if (!fallback) return { ...base, setup: { machine: POLISH_START, stage: 'rotors' } }
      const machine = configOf(polishKey(d.day.rotors), d.messageKey)
      return { ...base, setup: { machine, stage: 'plugboard' }, ground: d.day.positions.join('') }
    },
    same: (a, b) => a.seed === b.seed || a.message === b.message,
    predicate: polishVerdict,
    solve: (i) => polishSolution(polishDay(i.seed)),
    sampleAnswer(i, r) {
      const letters = shuffle(r, [...LETTERS])
      const n = int(r, POLISH_CABLES + 1)
      const plugboard = range(n).map((k) => letters[2 * k]! + letters[2 * k + 1]!)
      if (fallback) return normalizeConfig({ ...i.setup.machine, plugboard })
      return normalizeConfig({ ...POLISH_START, rotors: shuffle(r, ['I', 'II', 'III'] as RotorName[]), positions: letters3(r), plugboard })
    },
    mutate(i, a) {
      if (!fallback) {
        const positions = [...a.positions]
        positions[2] = L(idx(positions[2]!) + 1)
        return { ...a, positions }
      }
      // Drop a cable the message needs.
      const d = polishDay(i.seed)
      const drop = a.plugboard.find((p) => decryptWith({ ...a, plugboard: a.plugboard.filter((x) => x !== p) }, i.message) !== d.plain)
      return { ...a, plugboard: a.plugboard.filter((p) => p !== (drop ?? a.plugboard[0])) }
    },
    highlight(i, lastWrong) {
      if (fallback) return [{ part: 'plugboard', tone: 'hint' }]
      const res = lastWrong ? polishVerdict(i, normalizeConfig(lastWrong)) : null
      const parts = res && res !== true ? res.highlight : ROTOR_PARTS
      return parts.map((part) => ({ part, tone: 'hint' as const }))
    },
  })
}

export const polishKeyItem = polishItem('polish-key', false)
export const polishPlugs = polishItem('polish-plugs', true)

/** What the worked example walks through for a Polish day (built from the day itself, never the current one). */
export function polishWalkthrough(seed: number) {
  const d = polishDay(seed)
  const p = productsOf(d.indicators)
  const scores = cardAgreement(d)
  const solution = polishSolution(d)
  const cables = solution.plugboard
  const read = doubledTest([d.indicators[0]!], polishKey(d.day.rotors, cables), d.day.positions.join('')).decrypts[0]!
  return {
    characteristic: characteristicOf(p),
    card: d.row.card.map((s, k) => ({ setting: settingText(s), pairs: scores[k]!, day: sameJson(s, d.row.setting) })),
    total: d.indicators.length * 3,
    ground: d.day.positions.join(''),
    rotors: d.day.rotors,
    cables,
    firstIndicator: d.indicators[0]!,
    firstRead: read,
    messageKey: d.messageKey,
    plain: d.plain,
  }
}

// ---------------------------------------------------------------------------
// The British day (1940 style)
// ---------------------------------------------------------------------------

/** Cribs of 15 or 16 letters: longer than a menu may be (14 links), so a menu is always a choice. */
export const CRIBS: readonly string[] = [
  'WETTERVORHERSAGE',
  'KEINEBESONDEREN',
  'ANDIEGRUPPEXNORD',
  'WETTERXNULLXNULL',
  'FEINDBEIBRUECKE',
  'MELDUNGXNULLEINS',
  'STELLUNGXNORDOST',
  'ANKUNFTXREGIMENT',
  'LAGERUHIGXNACHT',
  'OBERKOMMANDOXOST',
]

/** Wilcox's rule of thumb: at most 13–14 links. */
export const MAX_LINKS = 14
export const BRITISH_CABLES = 10
export const BRITISH_MESSAGE_LENGTH = 50
/** The crib ends by letter 24 of the body, so a message key exists at which the middle rotor stands still until then. */
export const MAX_CRIB_END = 24

/** The 60 rotor orders of the Enigma I (three of I–V). */
export const ORDERS_I_V: readonly (readonly RotorName[])[] = (() => {
  const five: RotorName[] = ['I', 'II', 'III', 'IV', 'V']
  const out: RotorName[][] = []
  for (const a of five) for (const b of five) for (const c of five) if (a !== b && b !== c && a !== c) out.push([a, b, c])
  return out
})()

const I_TO_V: readonly RotorName[] = ['I', 'II', 'III', 'IV', 'V']

/** `n` random cables (letters paired off a shuffled alphabet), in canonical form. */
export function randomCables(r: Rng, n: number): string[] {
  const letters = shuffle(r, [...LETTERS])
  return canonicalCables(range(n).map((k) => letters[2 * k]! + letters[2 * k + 1]!))
}

/**
 * Windows at which the middle rotor stands still for the next `n` presses (n ≤ 25; rotors with one notch): the right
 * rotor starts past its turnover letter far enough not to reach it, the middle rotor off its own.
 */
export function stillMiddle(r: Rng, rotors: readonly RotorName[], n: number): string {
  const right = idx(ROTORS[rotors[2]!].turnovers[0]!)
  const middle = idx(ROTORS[rotors[1]!].turnovers[0]!)
  return randLetter(r) + L(middle + 1 + int(r, 25)) + L(right + 1 + int(r, 26 - n))
}

/** The connected pieces of a list of links (each in position order), largest first. */
export function pieces(edges: readonly MenuEdge[]): MenuEdge[][] {
  const parent = new Map<Letter, Letter>()
  const find = (x: Letter): Letter => {
    while (parent.get(x) !== x) x = parent.get(x)!
    return x
  }
  for (const e of edges) {
    for (const l of [e.a, e.b]) if (!parent.has(l)) parent.set(l, l)
    const [ra, rb] = [find(e.a), find(e.b)]
    if (ra !== rb) parent.set(ra, rb)
  }
  const groups = new Map<Letter, MenuEdge[]>()
  for (const e of [...edges].sort((x, y) => x.pos - y.pos)) groups.set(find(e.a), [...(groups.get(find(e.a)) ?? []), e])
  return [...groups.values()].sort((x, y) => y.length - x.length)
}

/** Links that hang off a piece removed again and again: what is left holds every loop. */
export function twoCore(edges: readonly MenuEdge[]): MenuEdge[] {
  let rest = [...edges]
  for (;;) {
    const degree = new Map<Letter, number>()
    for (const e of rest) for (const l of [e.a, e.b]) degree.set(l, (degree.get(l) ?? 0) + 1)
    const leaf = rest.find((e) => degree.get(e.a) === 1 || degree.get(e.b) === 1)
    if (!leaf) return rest
    rest = rest.filter((e) => e !== leaf)
  }
}

const closuresOf = (edges: readonly MenuEdge[]): number => closures(menuFromEdges(edges))

/** Crib position i + 1 links the crib letter to the cipher letter under it. */
export function cribLinks(cipher: string, crib: string, offset: number): MenuEdge[] {
  return range(crib.length).map((i) => ({ a: crib[i] as Letter, b: cipher[offset + i] as Letter, pos: i + 1 }))
}

/**
 * A menu that works: the loop-holding core of the piece with the most closures (≤ 14 links); null unless it has
 * ≥ 2 closures and no other piece has 2.
 */
export function menuSolution(cipher: string, crib: string, offset: number): number[] | null {
  const cores = pieces(cribLinks(cipher, crib, offset))
    .map(twoCore)
    .sort((x, y) => closuresOf(y) - closuresOf(x) || x.length - y.length)
  const best = cores[0]
  // One piece holds every menu a learner could build (so the checking machine derives the same cables from any).
  if (!best || closuresOf(best) < 2 || best.length > MAX_LINKS || cores.slice(1).some((c) => closuresOf(c) >= 2)) return null
  return best.map((e) => e.pos).sort((a, b) => a - b)
}

/** Whether the crib crashes at `offset` (a letter enciphered to itself), on character codes. */
function crashesAt(cipher: string, crib: string, offset: number): boolean {
  for (let i = 0; i < crib.length; i++) if (cipher.charCodeAt(offset + i) === crib.charCodeAt(i)) return true
  return false
}

/**
 * The crib's window: it starts at one of offsets lo … hi (0-based), and only the true offset is free of crashes.
 * Built from the true offset outwards through up to 3 offsets that crash on each side; null unless at least one
 * offset below the true one crashes and the window holds 3 offsets or more.
 */
function cribWindow(cipher: string, crib: string, offset: number): [number, number] | null {
  const max = cipher.length - crib.length
  if (crashesAt(cipher, crib, offset)) return null
  let lo = offset
  while (lo > 0 && offset - lo < 3 && crashesAt(cipher, crib, lo - 1)) lo--
  let hi = offset
  while (hi < max && hi - offset < 3 && crashesAt(cipher, crib, hi + 1)) hi++
  if (lo === offset || hi - lo < 2) return null
  return [lo, hi]
}

/**
 * A fast screen before menuSolution: exactly one connected piece of the crib's links has 2 closures or more
 * (union-find over letter indices).
 */
function oneLoopPiece(cipher: string, crib: string, offset: number): boolean {
  const parent = range(26)
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!
    return x
  }
  const used = new Array<boolean>(26).fill(false)
  for (let i = 0; i < crib.length; i++) {
    const a = crib.charCodeAt(i) - 65
    const b = cipher.charCodeAt(offset + i) - 65
    used[a] = used[b] = true
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent[ra] = rb
  }
  const E = new Array<number>(26).fill(0)
  const V = new Array<number>(26).fill(0)
  for (let i = 0; i < crib.length; i++) E[find(crib.charCodeAt(i) - 65)]!++
  for (let x = 0; x < 26; x++) if (used[x]) V[find(x)]!++
  let rich = 0
  for (let x = 0; x < 26; x++) if (used[x] && find(x) === x && E[x]! - V[x]! + 1 >= 2) rich++
  return rich === 1
}

export interface BritishCore {
  readonly key: DayKey
  readonly crib: string
  readonly offset: number
  readonly window: readonly [number, number]
  readonly messageKey: string
  readonly plain: string
  readonly cipher: string
  readonly menu: readonly number[]
}

/**
 * A 1940-style day's key and one intercept: a crib somewhere in the first letters of its body (the middle rotor does
 * not move before the crib ends, so every link is usable), a window of offsets in which only the crib's own offset is
 * crash-free, and a menu of ≥ 2 closures within 14 links.
 */
export function britishCore(r: Rng, given?: DayKey): BritishCore {
  // british-menu (the gate's first item, drawn most often) takes a light draw of the same kind of key.
  const key: DayKey = given ?? { rotors: sample(r, I_TO_V, 3), reflector: 'B', rings: 'AAA', plugboard: randomCables(r, BRITISH_CABLES) }
  for (;;) {
    const crib = pick(r, CRIBS)
    // The right rotor must not carry the middle one before the crib ends: at most 25 presses.
    const offset = 2 + int(r, MAX_CRIB_END - crib.length - 1)
    const plain = plaintext(r, offset) + crib + plaintext(r, BRITISH_MESSAGE_LENGTH - offset - crib.length)
    const messageKey = stillMiddle(r, key.rotors, offset + crib.length)
    const cipher = encipherFast(key, messageKey, plain)
    const window = cribWindow(cipher, crib, offset)
    if (!window || !oneLoopPiece(cipher, crib, offset)) continue
    const menu = menuSolution(cipher, crib, offset)
    if (!menu) continue
    return { key, crib, offset, window, messageKey, plain, cipher, menu }
  }
}

export interface BritishDay extends BritishCore {
  /** The three wheel orders intelligence names; the day's is one of them. */
  readonly orders: readonly (readonly RotorName[])[]
  /** The start position the operator sent in clear, and the message key enciphered once there. */
  readonly start: string
  readonly encKey: string
  /** The bombe's true stop: drum positions at the crib's first letter, the test letter and its partner. */
  readonly stop: { readonly positions: string; readonly testLetter: Letter; readonly stecker: Letter }
  /** The cables the checking machine derives from the true stop along the whole crib. */
  readonly checked: readonly string[]
}

/** The stop the bombe finds for a day (drum semantics: rings 01, the windows at the crib's first letter). */
function trueStop(c: BritishCore): BritishDay['stop'] {
  const positions = windowsAfter(c.key.rotors, c.messageKey, c.offset)
  const testLetter = testLetterOf(menuFromEdges(cribLinks(c.cipher, c.crib, c.offset).filter((e) => c.menu.includes(e.pos))))
  const stecker = L(plugPerm(c.key.plugboard)[idx(testLetter)]!)
  return { positions, testLetter, stecker }
}

/**
 * II.7's method on a partial decrypt: where the decrypt shows X and the plaintext has p, try the cable X–p; keep it
 * if more letters read. From `start` cables; the cables once the message reads, or null when it gets stuck.
 */
export function readingCables(k: DayKey, windows: string, cipher: string, plain: string, start: readonly string[], max: number):
  string[] | null {
  let plugs = [...start]
  const run = (p: readonly string[]) => encipherFast({ ...k, plugboard: p }, windows, cipher)
  let out = run(plugs)
  let score = matches(out, plain)
  while (score < plain.length) {
    let moved = false
    const used = new Set(plugs.join(''))
    for (let j = 0; j < out.length && !moved && plugs.length < max; j++) {
      if (out[j] === plain[j]) continue
      const pair = [out[j]!, plain[j]!].sort().join('')
      if (used.has(pair[0]!) || used.has(pair[1]!)) continue
      const next = [...plugs, pair]
      const o = run(next)
      const s = matches(o, plain)
      if (s > score) [plugs, out, score, moved] = [next, o, s, true]
    }
    if (!moved) return null
  }
  return plugs.sort()
}

/** The MISCONCEPTIONS a British day must defeat (each as the machine setting it leads to). */
export function naiveBritishConfigs(d: BritishDay): Record<'drumAsKey' | 'startAsKey' | 'stopOnly' | 'checkedOnly', MachineConfig> {
  const k = d.key
  const rotorsKey = (plugs: readonly string[]) => ({ ...k, plugboard: plugs })
  const stopCable = d.stop.stecker === d.stop.testLetter ? [] : [[d.stop.testLetter, d.stop.stecker].sort().join('')]
  return {
    drumAsKey: configOf(k, d.stop.positions),
    startAsKey: configOf(k, d.start),
    stopOnly: configOf(rotorsKey(stopCable), d.messageKey),
    checkedOnly: configOf(rotorsKey(d.checked), d.messageKey),
  }
}

/**
 * A 1940-style day from a seed: a core, three candidate orders, the start position in clear and the enciphered key,
 * and the true stop. Redrawn until the checking machine's cables leave 1 to 3 cables that matter, those come out of
 * the partial decrypt by II.7's method, and every misconception fails.
 */
export const britishDay = memo((seed: number): BritishDay => {
  const r = createRng(seed)
  for (;;) {
    const base = dayKey(r, { era: '1940', rings: 'AAA' })
    const c = britishCore(r, { rotors: base.rotors, reflector: 'B', rings: 'AAA', plugboard: canonicalCables(base.plugboard) })
    const stop = trueStop(c)
    const check = checkStop(
      { rotors: c.key.rotors, positions: stop.positions, testLetter: stop.testLetter, stecker: stop.stecker, live: 1, reflector: 'B' },
      c.cipher,
      c.crib,
      c.offset,
    )
    if (!check.consistent) continue
    const checked = [...check.steckers]
    const truth = new Set(c.key.plugboard)
    if (checked.some((p) => !truth.has(p))) continue
    const read = readingCables(c.key, c.messageKey, c.cipher, c.plain, checked, BRITISH_CABLES)
    if (!read) continue
    const extra = read.filter((p) => !checked.includes(p))
    if (extra.length < 1 || extra.length > 3) continue
    let start = letters3(r)
    while (start === c.messageKey) start = letters3(r)
    const encKey = encipherFast(c.key, start, c.messageKey)
    const others = sample(
      r,
      ORDERS_I_V.filter((o) => o.join('-') !== c.key.rotors.join('-')),
      2,
    )
    const orders = shuffle(r, [c.key.rotors, ...others])
    const d: BritishDay = { ...c, orders, start, encKey, stop, checked }
    if (Object.values(naiveBritishConfigs(d)).some((cfg) => decryptWith(cfg, c.cipher) === c.plain)) continue
    return d
  }
})

/** The answer the method finds: the day's rotor order, the message key, the checked cables plus the read ones. */
export function britishSolution(d: BritishDay): MachineConfig {
  const cables = readingCables(d.key, d.messageKey, d.cipher, d.plain, d.checked, BRITISH_CABLES) ?? d.key.plugboard
  return configOf({ ...d.key, plugboard: cables }, d.messageKey)
}

/** What the worked example walks through for a British day. */
export function britishWalkthrough(seed: number) {
  const d = britishDay(seed)
  const solution = britishSolution(d)
  const links = cribLinks(d.cipher, d.crib, d.offset).filter((e) => d.menu.includes(e.pos))
  const menu = menuFromEdges(links)
  return {
    crib: d.crib,
    offset: d.offset,
    window: d.window,
    links,
    closures: closures(menu),
    loops: loops(menu),
    rotors: d.key.rotors,
    stop: d.stop,
    checked: d.checked,
    read: solution.plugboard.filter((p) => !d.checked.includes(p)),
    messageKey: d.messageKey,
    start: d.start,
    encKey: d.encKey,
    plain: d.plain,
  }
}

// ---------------------------------------------------------------------------
// british-menu: custom · once · place the crib, build a menu (rollback: crib or menu)
// ---------------------------------------------------------------------------

export interface BritishMenuInstance {
  readonly crib: string
  /** The intercept's body. */
  readonly cipher: string
  /** The crib starts at one of these offsets (0-based, inclusive). */
  readonly window: readonly [number, number]
}

export interface MenuAnswer {
  readonly offset: number
  /** Crib positions (1-based) of the links in the menu. */
  readonly links: readonly number[]
}

/** The one crash-free offset of the window. */
export const cribOffset = (i: BritishMenuInstance): number =>
  range(i.window[1] - i.window[0] + 1)
    .map((k) => i.window[0] + k)
    .find((k) => crashes(i.cipher, i.crib, k).length === 0)!

export function menuCheck(i: BritishMenuInstance, a: unknown): CheckResult {
  const ans = (a ?? {}) as Partial<MenuAnswer>
  const max = i.cipher.length - i.crib.length
  const offset = Number(ans.offset)
  const at = Number.isInteger(offset) ? Math.max(0, Math.min(max, offset)) : 0
  const cribRollback = (): Rollback => ({ kind: 'crib', offset: at, crashes: crashes(i.cipher, i.crib, at) })
  if (!Number.isInteger(offset) || offset < 0 || offset > max) {
    return verdict(false, cribRollback(), 'Slide the crib under the intercept and choose where it starts.')
  }
  const [lo, hi] = i.window
  if (offset < lo || offset > hi) {
    return verdict(false, cribRollback(), `The crib starts somewhere from letter ${lo + 1} to letter ${hi + 1}; you put it at letter ${offset + 1}.`)
  }
  const hits = crashes(i.cipher, i.crib, offset)
  if (hits.length) {
    return verdict(
      false,
      cribRollback(),
      `At letter ${offset + 1} the crib crashes ${hits.length === 1 ? 'once' : `${hits.length} times`}: Enigma never enciphers a letter to itself, so the crib cannot stand there.`,
    )
  }
  const links = cribLinks(i.cipher, i.crib, offset)
  const list = Array.isArray(ans.links) ? ans.links.map(Number) : []
  const valid =
    list.length > 0 && list.every((p) => Number.isInteger(p) && p >= 1 && p <= links.length) && new Set(list).size === list.length
  const menuRollback = (loop: readonly Letter[], breakAt: number): Rollback => ({ kind: 'menu', loop: [...loop], breakAt })
  if (!valid) return verdict(false, menuRollback([], 0), 'The crib is placed; now add links to your menu.')
  const edges = links.filter((e) => list.includes(e.pos))
  const m = menuFromEdges(edges)
  const c = closures(m)
  const loop = loops(m)[0] ?? []
  if (edges.length > MAX_LINKS) {
    return verdict(false, menuRollback(loop, c), `${edges.length} links: keep the menu to at most ${MAX_LINKS}.`)
  }
  const parts = pieces(edges)
  if (parts.length > 1) {
    return verdict(
      false,
      menuRollback(loop, c),
      `Your menu falls into ${parts.length} separate pieces; the bombe feeds its current in at one letter, so keep one connected piece.`,
    )
  }
  if (c < 2) return verdict(false, menuRollback(loop, c), `Your menu has ${c} closure${c === 1 ? '' : 's'}; it needs at least 2.`)
  return verdict(true)
}

export const britishMenu: ItemLogic<BritishMenuInstance, MenuAnswer> = {
  id: 'british-menu',
  kind: 'custom',
  rule: ONCE,
  compute: false,
  inPage: true,
  generate(r) {
    const c = britishCore(r)
    return { crib: c.crib, cipher: c.cipher, window: c.window }
  },
  same: (a, b) => a.cipher === b.cipher && a.crib === b.crib,
  solve(i) {
    const offset = cribOffset(i)
    return { offset, links: menuSolution(i.cipher, i.crib, offset) ?? [] }
  },
  check: menuCheck,
  sampleAnswer(i, r) {
    const offset = int(r, i.cipher.length - i.crib.length + 1)
    const picked = range(i.crib.length)
      .map((k) => k + 1)
      .filter(() => r() < 0.5)
    return { offset, links: picked.length ? picked : [1 + int(r, i.crib.length)] }
  },
  // One letter further along: inside the window it crashes (the window has one crash-free offset), else outside it.
  mutate: (_i, a) => ({ ...a, offset: Number(a.offset) + 1 }),
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------
// british-key and british-plugs: set-machine · once · trial preview (rollback: machine)
// ---------------------------------------------------------------------------

export const BRITISH_START: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

export interface BritishKeyInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'preview'
  readonly maxPlugs: number
  /** The day is rebuilt from this seed on the checking side (britishDay). */
  readonly seed: number
  readonly crib: string
  readonly window: readonly [number, number]
  /** The three wheel orders intelligence names. */
  readonly orders: readonly (readonly RotorName[])[]
  /** The start position sent in clear and the message key enciphered once there. */
  readonly start: string
  readonly encKey: string
  /** The body (the preview deciphers it from the machine's windows). */
  readonly message: string
  /** british-plugs only: where the crib stands and the bombe's stop (the checking machine starts from it). */
  readonly offset?: number
  readonly stop?: BritishDay['stop']
}

function britishVerdict(i: BritishKeyInstance, cfg: MachineConfig): true | { field: LockKey; message: string; highlight: readonly PartId[] } {
  const d = britishDay(i.seed)
  const out = decryptWith(cfg, i.message)
  if (out === d.plain) return true
  const fail = (field: LockKey, message: string) => ({ field, message, highlight: partsFor(field) })
  const begins = `With your setting the message reads ${out.slice(0, 12)}…`
  if (cfg.rotors.join('-') !== d.key.rotors.join('-')) {
    return fail('rotors', `${begins} The rotor order ${cfg.rotors.join('-')} is not the day's.`)
  }
  const windows = cfg.positions.join('')
  if (windows === d.start) {
    return fail(
      'positions',
      `${begins} The windows stand at the start position sent in clear (${d.start}): decipher the enciphered key ${i.encKey} there, and set the windows to the message key it gives.`,
    )
  }
  if (windows === d.stop.positions) {
    return fail(
      'positions',
      `${begins} ${windows} is where the drums stood at the crib's first letter, ${d.offset} letters into the message: turn the right rotor back ${d.offset} places for the message key.`,
    )
  }
  if (windows !== d.messageKey) return fail('positions', `${begins} The windows are not the message key.`)
  return fail(
    'plugboard',
    `Rotor order and message key are right, but with your cables only ${matches(out, d.plain)} of ${d.plain.length} letters read: ${out}.`,
  )
}

export function britishItem(id: string, fallback: boolean): ItemLogic<BritishKeyInstance, MachineConfig> {
  return setMachineItem<BritishKeyInstance>({
    id,
    rule: ONCE,
    lintSeeds: 100,
    generate(r) {
      const seed = drawSeed(r)
      const d = britishDay(seed)
      const base = {
        unlocked: fallback ? (['plugboard'] as LockKey[]) : (['rotors', 'positions', 'plugboard'] as LockKey[]),
        trial: 'preview' as const,
        maxPlugs: BRITISH_CABLES,
        seed,
        crib: d.crib,
        window: d.window,
        orders: d.orders,
        start: d.start,
        encKey: d.encKey,
        message: d.cipher,
      }
      if (!fallback) return { ...base, setup: { machine: BRITISH_START, stage: 'rotors' } }
      return {
        ...base,
        setup: { machine: configOf({ ...d.key, plugboard: [] }, d.messageKey), stage: 'plugboard' },
        offset: d.offset,
        stop: d.stop,
      }
    },
    same: (a, b) => a.seed === b.seed || a.message === b.message,
    predicate: britishVerdict,
    solve: (i) => britishSolution(britishDay(i.seed)),
    sampleAnswer(i, r) {
      const letters = shuffle(r, [...LETTERS])
      const n = int(r, BRITISH_CABLES + 1)
      const plugboard = range(n).map((k) => letters[2 * k]! + letters[2 * k + 1]!)
      if (fallback) return normalizeConfig({ ...i.setup.machine, plugboard })
      return normalizeConfig({ ...BRITISH_START, rotors: [...pick(r, i.orders)], positions: letters3(r), plugboard })
    },
    mutate(i, a) {
      if (!fallback) {
        const positions = [...a.positions]
        positions[2] = L(idx(positions[2]!) + 1)
        return { ...a, positions }
      }
      const d = britishDay(i.seed)
      const drop = a.plugboard.find((p) => decryptWith({ ...a, plugboard: a.plugboard.filter((x) => x !== p) }, i.message) !== d.plain)
      return { ...a, plugboard: a.plugboard.filter((p) => p !== (drop ?? a.plugboard[0])) }
    },
    highlight(i, lastWrong) {
      if (fallback) return [{ part: 'plugboard', tone: 'hint' }]
      const res = lastWrong ? britishVerdict(i, normalizeConfig(lastWrong)) : null
      const parts = res && res !== true ? res.highlight : ROTOR_PARTS
      return parts.map((part) => ({ part, tone: 'hint' as const }))
    },
  })
}

export const britishKey = britishItem('british-key', false)
export const britishPlugs = britishItem('british-plugs', true)

// ---------------------------------------------------------------------------
// read-intercepts: letters(10) · 2/3 · the post-May-1940 procedure (rollback: machine)
// ---------------------------------------------------------------------------

export interface Intercept {
  /** The start position, sent in clear. */
  readonly start: string
  /** The message key, enciphered once at the start position. */
  readonly encKey: string
  readonly body: string
}

export interface ReadInstance {
  readonly length: 10
  /** A broken day key (rings as letters, as the machine stores them; the prompt shows 01–26). */
  readonly key: DayKey
  readonly intercepts: readonly Intercept[]
  /** Which intercept to read (0-based). */
  readonly which: number
}

/** An intercept's plaintext: the enciphered key read at the start position, then the body at the message key. */
export function readIntercept(k: DayKey, m: Intercept): { messageKey: string; plain: string } {
  const messageKey = encipherFast(k, m.start, m.encKey)
  return { messageKey, plain: encipherFast(k, messageKey, m.body) }
}

/** The MISCONCEPTIONS: the body read at the start position; read on from the start position after the key; rings 01. */
export function naiveReads(k: DayKey, m: Intercept): Record<'atStart' | 'runOn' | 'ringsIgnored', string> {
  const flat = { ...k, rings: 'AAA' }
  const flatKey = encipherFast(flat, m.start, m.encKey)
  return {
    atStart: encipherFast(k, m.start, m.body),
    runOn: encipherFast(k, m.start, m.encKey + m.body).slice(3),
    ringsIgnored: encipherFast(flat, flatKey, m.body),
  }
}

export function readInstance(r: Rng): ReadInstance {
  const key: DayKey = { rotors: sample(r, I_TO_V, 3), reflector: 'B', rings: letters3(r), plugboard: randomCables(r, BRITISH_CABLES) }
  const intercepts: Intercept[] = []
  while (intercepts.length < 3) {
    const start = letters3(r)
    const messageKey = letters3(r)
    if (messageKey === start) continue
    const plain = plaintext(r, 24 + int(r, 8))
    const m = { start, encKey: encipherFast(key, start, messageKey), body: encipherFast(key, messageKey, plain) }
    const answer = plain.slice(0, 10)
    if (Object.values(naiveReads(key, m)).some((x) => x.slice(0, 10) === answer)) continue
    intercepts.push(m)
  }
  return { length: 10, key, intercepts, which: int(r, 3) }
}

export const readSolve = (i: ReadInstance): string => readIntercept(i.key, i.intercepts[i.which]!).plain.slice(0, 10)

export const readIntercepts = lettersItem<ReadInstance>({
  id: 'read-intercepts',
  rule: WINDOW,
  generate: readInstance,
  same: (a, b) => sameJson(a.intercepts, b.intercepts),
  solve: readSolve,
  check(i, a) {
    const want = readSolve(i)
    const got = String(a ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
    if (got === want) return verdict(true)
    const m = i.intercepts[i.which]!
    const { messageKey } = readIntercept(i.key, m)
    const naive = naiveReads(i.key, m)
    let message: string
    if (got === naive.atStart.slice(0, 10) || got === naive.runOn.slice(0, 10)) {
      message = `That is the body read from the start position ${m.start}. The start position only unlocks the key: ${m.encKey} deciphers there to the message key ${messageKey}, and the body is read from ${messageKey}.`
    } else if (got === naive.ringsIgnored.slice(0, 10)) {
      message = `That reading ignores the ring settings. With the rings of the key, ${m.encKey} deciphers at ${m.start} to the message key ${messageKey}.`
    } else {
      message = `At ${m.start} the enciphered key ${m.encKey} deciphers to the message key ${messageKey}; from ${messageKey} the body begins ${want}.`
    }
    return verdict(false, { kind: 'machine', field: 'positions', message, highlight: ROTOR_PARTS }, message)
  },
  setup: (i) => ({
    machine: { model: 'I', reflector: 'B', rotors: [...i.key.rotors], rings: i.key.rings, positions: 'AAA', plugboard: [...i.key.plugboard] },
    locks: { model: true, rotors: true, reflector: true, rings: true, plugboard: true, positions: false, keyboard: false, lampsHidden: false },
    stage: 'rotors',
  }),
  highlight: () => ROTOR_PARTS.map((part) => ({ part, tone: 'hint' as const })),
})

// ---------------------------------------------------------------------------

/** Practice days for the tool scenes (fixed; never a gate's day): chosen for a short bombe run. */
export const PRACTICE_POLISH_SEED = 1936
export const PRACTICE_BRITISH_SEED = 1940

export const GATES: ChapterGates = {
  polish: {
    items: [polishCard, polishKeyItem] as ItemLogic[],
    fallback: polishPlugs as ItemLogic,
    puzzle: true,
  },
  british: {
    items: [britishMenu, britishKey, readIntercepts] as ItemLogic[],
    fallback: britishPlugs as ItemLogic,
    puzzle: true,
  },
}
