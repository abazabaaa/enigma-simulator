/**
 * Chapter iii11-bombe · gate `bombe` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts, lesson/kinds and crypto only.
 *  - click-through  chain · 2/3 · a toyBombe loop (8 letters, 3–4 scramblers) and a hypothesis → the partner after each
 *                   scrambler round the loop, then the verdict token (C consistent, X contradiction). The truth is
 *                   computed at check time from the tables. The hypothesis is the true partner on every third attempt
 *                   only, so "every loop is consistent" never passes.
 *  - live-count     numbers(2) · 2/3 · the toy at the day's true position and two hypotheses for the test letter → the
 *                   live wires of the test register for each (1 for the true partner, 7 for a false one, verified with
 *                   propagate). Every instance holds a false hypothesis, so "a false hypothesis lights every wire"
 *                   (8) never passes.
 *  - board-myth     choice(4) · once · constant answer · Victory had no diagonal board (Welchman's, Agnus Dei).
 *  - grid-probe     the fallback, custom inPage, per trigger: after click-through the learner marks the wires one trip
 *                   round the loop lights; otherwise the live wires of the test register (true or wrong position).
 * Scene data: the eight-letter toy (wire-8), the ATTACKATDAWN day (wire-26 and diagonal).
 */

import type { Choice, Letter } from '../../contracts/core'
import type { ChapterGates, CheckResult, GenCtx, ItemLogic, Rollback } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { liveCount, propagate, testLetterOf, toyBombe, trueBombePosition, menuScramblers, type WireState } from '../../crypto/bombe'
import { cribbedMessage, dayKey } from '../../crypto/generators'
import { menuFromCrib, menuFromEdges, type Menu } from '../../crypto/menu'
import { positionIndex, positionString } from '../../crypto/tables'
import { LETTERS, fromPairs, normalizeConfig, type MachineConfig } from '../../engine'
import { createRng, int, pick, sample, seedFor, shuffle, type Rng } from '../../lib/rng'
import { chainItem, choiceItem, firstDiff, numbersItem, numbersMatch, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const N8 = 8
const L = (i: number): Letter => LETTERS[i]!
const idx = (l: string): number => LETTERS.indexOf(l.toUpperCase() as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const range = (n: number): number[] => Array.from({ length: n }, (_, k) => k)
/** The toy's alphabet, A–H. */
export const TOY_LETTERS: readonly Letter[] = LETTERS.slice(0, N8) as Letter[]

/** Every control locked, the keyboard included, and the lamps hidden: the chapter works on the bombe, not the machine. */
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

/** The machine the chapter's scenes leave in place (never pressed). */
export const PARKED: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['IV', 'II', 'I'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

// ---------------------------------------------------------------------------
// The eight-letter toy bombe (Ellsbury's reduction): one loop of scramblers on A–H
// ---------------------------------------------------------------------------

/** A toy loop: loop[j] and loop[j + 1] (the last back to loop[0]) are joined by scrambler j, whose images of A–H are tables[j]. */
export interface Toy {
  readonly loop: readonly Letter[]
  readonly tables: readonly string[]
}

/** The toy's menu: link j joins loop[j] and loop[j + 1] at crib position j + 1 (as toyBombe draws it). */
export function toyMenu(t: Pick<Toy, 'loop'>): Menu {
  const k = t.loop.length
  return menuFromEdges(t.loop.map((a, j) => ({ a, b: t.loop[(j + 1) % k]!, pos: j + 1 })))
}

export const toyScramblers = (t: Pick<Toy, 'tables'>): number[][] => t.tables.map((s) => [...s].map(idx))

/** The test letter of a toy loop (where the voltage goes in): its first letter. */
export const testOf = (t: Pick<Toy, 'loop'>): Letter => t.loop[0]!

/** Propagate "test letter ↔ wire" through the toy (no diagonal board). */
export function toyState(t: Toy, wire: Letter, diagonal = false): WireState {
  return propagate(toyMenu(t), toyScramblers(t), { bank: testOf(t), wire }, { n: N8, diagonal })
}

/** Live wires of the toy's test register for the hypothesis "test letter ↔ wire". */
export const toyLive = (t: Toy, wire: Letter): number => liveCount(toyState(t, wire), testOf(t))

/** The register's live wires (letters) for a hypothesis. */
export function registerWires(t: Toy, wire: Letter): Letter[] {
  const row = toyState(t, wire).live[idx(testOf(t))]!
  return TOY_LETTERS.filter((_, w) => row[w])
}

/** The partners after each link, going once round the loop from "loop[0] ↔ h": [partner of loop[1], …, of loop[0]]. */
export function tripChain(t: Pick<Toy, 'tables'>, h: Letter): Letter[] {
  const out: Letter[] = []
  let x = h
  for (const table of t.tables) {
    x = table[idx(x)] as Letter
    out.push(x)
  }
  return out
}

/**
 * The voltage walked round the loop scrambler by scramblers, in one direction, until it is back on the wire it
 * started from: the wire state of propagate (the same live wires), with the events in walking order so a Step
 * can replay it one scrambler at a time.
 */
export function walkState(t: Toy, h: Letter): WireState {
  const k = t.loop.length
  const live = range(N8).map(() => new Array<boolean>(N8).fill(false))
  const order: { bank: number; wire: number; via: number | 'hypothesis' | 'diagonal' }[] = []
  let bank = idx(testOf(t))
  let wire = idx(h)
  live[bank]![wire] = true
  order.push({ bank, wire, via: 'hypothesis' })
  const z = toyScramblers(t)
  for (let guard = 0; guard < N8 * k + 1; guard++) {
    const j = guard % k
    const nextBank = idx(t.loop[(j + 1) % k]!)
    const nextWire = z[j]![wire]!
    bank = nextBank
    wire = nextWire
    if (live[bank]![wire]) break
    live[bank]![wire] = true
    order.push({ bank, wire, via: j + 1 })
  }
  return { n: N8, live, order }
}

/** A fixed-point-free involution on n letters that pairs x with y. */
function pairedInvolution(r: Rng, n: number, x: number, y: number): number[] {
  const z = new Array<number>(n).fill(-1)
  z[x] = y
  z[y] = x
  const rest = shuffle(
    r,
    range(n).filter((i) => i !== x && i !== y),
  )
  for (let i = 0; i < rest.length; i += 2) {
    z[rest[i]!] = rest[i + 1]!
    z[rest[i + 1]!] = rest[i]!
  }
  return z
}

const tablesOf = (zs: readonly (readonly number[])[]): string[] => zs.map((z) => z.map(L).join(''))

/**
 * A toyBombe loop of k scramblers at the day's true position, verified with propagate: the true partner lights 1
 * register wire and every other hypothesis lights 7. Returns the toy and its test letter's true partner.
 */
export function trueToy(r: Rng, k: 3 | 4): { toy: Toy; partner: Letter } {
  for (;;) {
    const b = toyBombe(r, { n: N8, scramblers: k })
    const toy: Toy = { loop: b.menu.edges.map((e) => e.a), tables: tablesOf(b.scramblers) }
    const ok = TOY_LETTERS.every((w) => toyLive(toy, w) === (w === b.truth.wire ? 1 : N8 - 1))
    if (ok) return { toy, partner: b.truth.wire }
  }
}

/** Random scramblers for the same loop at a wrong drum position: every hypothesis lights all 8 register wires. */
export function wrongToy(r: Rng, loop: readonly Letter[]): Toy {
  for (;;) {
    const zs = loop.map(() => pairedInvolution(r, N8, 0, 1 + int(r, N8 - 1)))
    const toy: Toy = { loop, tables: tablesOf(zs) }
    if (TOY_LETTERS.every((w) => toyLive(toy, w) === N8)) return toy
  }
}

/** The scene's toy (wire-8): four scramblers, the test letter's partner off the loop. */
export const TOY8 = (() => {
  for (let k = 1; ; k++) {
    const r = createRng(seedFor('iii11-toy8', k))
    const found = trueToy(r, 4)
    if (found.toy.loop.includes(found.partner)) continue
    const wrong = wrongToy(r, found.toy.loop)
    return { ...found, wrong }
  }
})()

/** The wire-8 bet's hypothesis: the first letter that is neither the test letter nor its partner (a false one). */
export const TOY8_FIRST_WIRE: Letter = TOY_LETTERS.find((w) => w !== testOf(TOY8.toy) && w !== TOY8.partner)!
/** The bet's truth: the live register wires for that hypothesis at the true position (7). */
export const TOY8_FIRST_LIVE = toyLive(TOY8.toy, TOY8_FIRST_WIRE)

// ---------------------------------------------------------------------------
// The 26-wire bombe: a fixed day with a cribbed message over ATTACKATDAWN (wire-26, diagonal)
// ---------------------------------------------------------------------------

export const B26_CRIB = 'ATTACKATDAWN'

/**
 * Seed 71: a 1940 day (rotors IV II I, 10 cables) and a 36-letter message with the crib at offset 10. Its menu has
 * 11 letters and 3 closures; without the diagonal board the whole wheel order gives 20 stops, with it only the
 * true one (unit-tested against runBombe).
 */
export const B26 = (() => {
  const r = createRng(71)
  const day = dayKey(r, { era: '1940' })
  const m = cribbedMessage(r, { day, crib: B26_CRIB, length: 36 })
  const menu = menuFromCrib(m.cipher, B26_CRIB, m.offset)
  const test = testLetterOf(menu)
  const truth = trueBombePosition(day, m.start, m.offset)
  const S = fromPairs(day.plugboard)
  const partner = L(S[idx(test)]!)
  const firstWire = LETTERS.find((w) => w !== test && w !== partner)!
  const scr = (p: string) => menuScramblers(menu, day.rotors, day.reflector, p)
  // A wrong position nearby where the first hypothesis floods the register (no stop).
  let wrong = truth
  for (let k = 1; k < 200; k++) {
    const p = positionString(positionIndex(truth) + 101 * k)
    if (liveCount(propagate(menu, scr(p), { bank: test, wire: firstWire }, { n: 26, diagonal: false }), test) === 26) {
      wrong = p
      break
    }
  }
  return { day, cipher: m.cipher, offset: m.offset, menu, test, truth, partner, firstWire, wrong }
})()

/** The 26-wire state for a hypothesis at drum positions `positions`. */
export function b26State(positions: string, wire: Letter, diagonal: boolean): WireState {
  const scr = menuScramblers(B26.menu, B26.day.rotors, B26.day.reflector, positions)
  return propagate(B26.menu, scr, { bank: B26.test, wire }, { n: 26, diagonal })
}

/** Stops of the whole wheel order (IV II I) with the board off and on (runBombe, unit-tested); the diagonal bet's truth. */
export const DIAG_STOPS = { off: 20, on: 1 } as const
export const diagTruth = (off: number, on: number): 'fewer' | 'same' | 'more' => (on < off ? 'fewer' : on === off ? 'same' : 'more')
/** A stop without the board that the board removes (the diagonal scene's close-up; unit-tested). */
export const DIAG_FALSE_STOP = 'BXX'

// ---------------------------------------------------------------------------
// click-through · chain · 2/3 (rollback: wires)
// ---------------------------------------------------------------------------

export interface ClickInstance extends Toy {
  readonly alphabet: 8
  /** The hypothesis: loop[0] is steckered to this letter. */
  readonly hypothesis: Letter
  /** One stage per link (the partner of the next loop letter), then the verdict (C or X). */
  readonly stages: readonly { id: string; label: string }[]
}

export const VERDICT_STAGE = 'verdict'

export function clickStages(loop: readonly Letter[]): { id: string; label: string }[] {
  const k = loop.length
  return [
    ...loop.map((a, j) => ({
      id: `s${j + 1}`,
      label: `Scrambler ${j + 1} (${a}–${loop[(j + 1) % k]}): partner of ${loop[(j + 1) % k]}`,
    })),
    { id: VERDICT_STAGE, label: 'Verdict: C (consistent) or X (contradiction)' },
  ]
}

/** The answer tokens: the partner after each scrambler, then C when the loop gives back the hypothesis, else X. */
export function clickSolution(i: Pick<ClickInstance, 'tables' | 'hypothesis'>): string[] {
  const chain = tripChain(i, i.hypothesis)
  return [...chain, chain.at(-1) === i.hypothesis ? 'C' : 'X']
}

/** The hypothesis is the true partner on every third attempt, otherwise a false one (never the only case seen). */
export const consistentAttempt = (attempt: number): boolean => attempt % 3 === 0

export function clickInstance(r: Rng, ctx: Pick<GenCtx, 'attempt'>): ClickInstance {
  const k = (3 + int(r, 2)) as 3 | 4
  const { toy, partner } = trueToy(r, k)
  const hypothesis = consistentAttempt(ctx.attempt) ? partner : pick(r, TOY_LETTERS.filter((w) => w !== partner))
  return { alphabet: 8, ...toy, hypothesis, stages: clickStages(toy.loop) }
}

const tokens = (a: unknown): string[] => (Array.isArray(a) ? a.map((t) => String(t ?? '').trim().toUpperCase()) : [])

function wiresRollback(scrambler: number, expected: readonly string[], got: readonly string[]): Rollback {
  const letters = (xs: readonly string[]) => xs.map((x) => (LETTERS.includes(x as Letter) ? (x as Letter) : ('?' as Letter)))
  return { kind: 'wires', scrambler, expected: letters(expected), got: letters(got) }
}

export function clickCheck(i: ClickInstance, a: unknown): CheckResult {
  const expected = clickSolution(i)
  const got = tokens(a)
  const k = firstDiff(expected, got)
  if (k === -1) return verdict(true)
  const at = Math.min(k, expected.length - 1)
  const feedback =
    at < i.loop.length
      ? `Scrambler ${at + 1} turns the partner ${at === 0 ? i.hypothesis : expected[at - 1]} into ${expected[at]}, not ${got[at] || 'nothing'}.`
      : expected.at(-1) === 'C'
        ? `The loop brings back ${expected.at(-2)}, the partner you started from: no contradiction.`
        : `The loop brings back ${expected.at(-2)}, but you started from ${i.hypothesis}: a contradiction.`
  return verdict(false, wiresRollback(at, expected, got), feedback)
}

export const clickThrough = chainItem<ClickInstance>({
  id: 'click-through',
  rule: WINDOW,
  generate: (r, ctx) => clickInstance(r, ctx),
  same: (a, b) => a.hypothesis === b.hypothesis && sameJson([a.loop, a.tables], [b.loop, b.tables]),
  solve: clickSolution,
  check: clickCheck,
  sampleAnswer: (i, r) => [...i.loop.map(() => L(int(r, N8))), pick(r, ['C', 'X'])],
  mutate(_i, a, r) {
    const out = [...tokens(a)]
    const k = int(r, out.length)
    out[k] = k === out.length - 1 ? (out[k] === 'C' ? 'X' : 'C') : L((idx(out[k] ?? 'A') + 1) % N8)
    return out
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// live-count · numbers(2) · 2/3 (rollback: wires)
// ---------------------------------------------------------------------------

export interface LiveInstance extends Toy {
  readonly count: 2
  readonly alphabet: 8
  /** Two hypotheses for the test letter (loop[0]), tested in turn at the day's true position. */
  readonly hypotheses: readonly [Letter, Letter]
}

export const LIVE_RANGE: readonly number[] = [1, 7, 8]

/** Two out of three instances hold the true partner (in a random slot) and a false one; the rest two false ones. */
export function liveInstance(r: Rng): LiveInstance {
  const k = (3 + int(r, 2)) as 3 | 4
  const { toy, partner } = trueToy(r, k)
  const falses = TOY_LETTERS.filter((w) => w !== partner)
  const pair: Letter[] = int(r, 3) < 2 ? shuffle(r, [partner, pick(r, falses)]) : sample(r, falses, 2)
  return { count: 2, alphabet: 8, ...toy, hypotheses: [pair[0]!, pair[1]!] }
}

export const liveSolution = (i: LiveInstance): number[] => i.hypotheses.map((h) => toyLive(i, h))

export function liveCheck(i: LiveInstance, a: unknown): CheckResult {
  const expected = liveSolution(i)
  const got = Array.isArray(a) ? a.map(Number) : []
  if (numbersMatch(expected, got)) return verdict(true)
  const k = Math.max(0, expected.findIndex((e, j) => e !== got[j]))
  const h = i.hypotheses[k]!
  const wires = registerWires(i, h)
  const feedback =
    expected[k] === 1
      ? `With the voltage on wire ${h.toLowerCase()} the loop gives back ${h}: the current goes nowhere else, and only 1 register wire is live.`
      : `With the voltage on wire ${h.toLowerCase()} the loop keeps changing the partner, and every register wire but one goes live: ${expected[k]} of 8.`
  return verdict(false, wiresRollback(k, wires, [h]), feedback)
}

export const liveCountItem = numbersItem<LiveInstance>({
  id: 'live-count',
  rule: WINDOW,
  range: LIVE_RANGE,
  generate: (r) => liveInstance(r),
  same: (a, b) => sameJson([a.loop, a.tables, a.hypotheses], [b.loop, b.tables, b.hypotheses]),
  solve: liveSolution,
  check: liveCheck,
  mutate: (_i, a) => {
    const out = Array.isArray(a) ? a.map(Number) : [1, 1]
    out[0] = out[0] === 1 ? 7 : out[0] === 7 ? 8 : 1
    return out
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// board-myth · choice(4) · once · constant answer (rollback: none)
// ---------------------------------------------------------------------------

/** The question and options (the dates come from facts.ts F13, F14). */
export const BOARD_MYTH_QUESTION =
  'The first bombe, Victory, was delivered to Bletchley Park on 18 March 1940. Did it have a diagonal board?'

export const BOARD_MYTH_OPTIONS: readonly Choice[] = [
  {
    id: 'no-welchman',
    label:
      'No. The board was Gordon Welchman’s idea; the first bombe built with it was Agnus Dei, delivered on 8 August 1940',
  },
  { id: 'turing-1939', label: 'Yes. The diagonal board was part of Turing’s 1939 design from the start', misconception: true },
  { id: 'yes-welchman', label: 'Yes. Welchman’s board was fitted to Victory before it was delivered', misconception: true },
  { id: 'never', label: 'No. No wartime bombe had a diagonal board; it came after the war', misconception: true },
]

const MYTH_FEEDBACK: Readonly<Record<string, string>> = {
  'turing-1939':
    'That is the popular story, but Turing’s 1939 design had no diagonal board. Gordon Welchman showed the idea early in 1940, too late for Victory; Agnus Dei (8 August 1940) was the first bombe with it.',
  'yes-welchman':
    'Welchman showed his idea early in 1940, but Victory was delivered without it. Agnus Dei, delivered on 8 August 1940, was the first bombe with the board.',
  never:
    'The board went into service during the war: Agnus Dei had it from 8 August 1940, and it was then built into the bombes that followed.',
}

export const boardMyth = choiceItem<{ options: readonly Choice[] }>({
  id: 'board-myth',
  rule: ONCE,
  constantAnswer: true,
  generate: (r) => ({ options: shuffle(r, BOARD_MYTH_OPTIONS) }),
  same: (a, b) => sameJson(a.options, b.options),
  solve: () => 'no-welchman',
  check: (_i, a) =>
    verdict(a === 'no-welchman', { kind: 'none' }, MYTH_FEEDBACK[String(a)] ?? 'Victory had no diagonal board: it was Welchman’s addition.'),
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// grid-probe · the fallback · custom inPage (rollback: wires)
// ---------------------------------------------------------------------------

export interface ProbeInstance extends Toy {
  readonly alphabet: 8
  /** 'trip': mark the wires one trip round the loop lights; 'register': mark the live wires of the test register. */
  readonly mode: 'trip' | 'register'
  /** Whether the drums are at the day's true position ('register' mode only says so; 'trip' is always true). */
  readonly position: 'true' | 'wrong'
  readonly hypothesis: Letter
}

/** A cell of the wire grid: bank letter then wire letter ('CF': wire f of cable C). */
export const cell = (bank: Letter | number, wire: Letter | number): string =>
  (typeof bank === 'number' ? L(bank) : bank) + (typeof wire === 'number' ? L(wire) : wire)

/** The cells the answer is judged on: the loop's cables ('trip'), or the test register only ('register'). */
export function probeBanks(i: Pick<ProbeInstance, 'mode' | 'loop'>): Letter[] {
  return i.mode === 'trip' ? [...i.loop].sort() : [testOf(i)]
}

/** The hypothesis cell, already live when the item starts. */
export const probeStart = (i: Pick<ProbeInstance, 'loop' | 'hypothesis'>): string => cell(testOf(i), i.hypothesis)

export function probeSolution(i: ProbeInstance): string[] {
  if (i.mode === 'register') return registerWires(i, i.hypothesis).map((w) => cell(testOf(i), w))
  const chain = tripChain(i, i.hypothesis)
  const k = i.loop.length
  const cells = [probeStart(i), ...chain.map((x, j) => cell(i.loop[(j + 1) % k]!, x))]
  return [...new Set(cells)].sort()
}

export function probeInstance(r: Rng, ctx: Pick<GenCtx, 'key'>): ProbeInstance {
  const trigger = String(ctx.key).split('/').at(-1)
  if (trigger === 'click-through') {
    const { toy, partner } = trueToy(r, (3 + int(r, 2)) as 3 | 4)
    const hypothesis = int(r, 3) === 0 ? partner : pick(r, TOY_LETTERS.filter((w) => w !== partner))
    return { alphabet: 8, ...toy, mode: 'trip', position: 'true', hypothesis }
  }
  const { toy, partner } = trueToy(r, 3)
  if (int(r, 3) === 0) return { alphabet: 8, ...wrongToy(r, toy.loop), mode: 'register', position: 'wrong', hypothesis: pick(r, TOY_LETTERS) }
  const hypothesis = int(r, 3) === 0 ? partner : pick(r, TOY_LETTERS.filter((w) => w !== partner))
  return { alphabet: 8, ...toy, mode: 'register', position: 'true', hypothesis }
}

const cellsOf = (a: unknown): string[] =>
  Array.isArray(a) ? [...new Set(a.map((c) => String(c ?? '').toUpperCase()).filter((c) => /^[A-H]{2}$/.test(c)))].sort() : []

export function probeCheck(i: ProbeInstance, a: unknown): CheckResult {
  const banks = new Set(probeBanks(i))
  const got = [...new Set([...cellsOf(a).filter((c) => banks.has(c[0] as Letter)), probeStart(i)])].sort()
  const expected = probeSolution(i)
  if (sameJson(got, expected)) return verdict(true)
  const missing = expected.filter((c) => !got.includes(c))
  const extra = got.filter((c) => !expected.includes(c))
  const name = (c: string) => `${c[0]}${c[1]!.toLowerCase()}`
  const feedback = [
    missing.length ? `Live but not marked: ${missing.map(name).join(', ')}.` : '',
    extra.length ? `Marked but dead: ${extra.map(name).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return verdict(false, wiresRollback(0, expected, got), feedback)
}

export const gridProbe: ItemLogic<ProbeInstance, string[]> = {
  id: 'grid-probe',
  kind: 'custom',
  rule: WINDOW,
  compute: true,
  inPage: true,
  generate: (r, ctx) => probeInstance(r, ctx),
  same: (a, b) => a.mode === b.mode && a.hypothesis === b.hypothesis && sameJson([a.loop, a.tables], [b.loop, b.tables]),
  solve: probeSolution,
  check: probeCheck,
  sampleAnswer(i, r) {
    const out: string[] = []
    for (const b of probeBanks(i)) for (const w of TOY_LETTERS) if (r() < 0.5) out.push(cell(b, w))
    return out
  },
  mutate(i, a) {
    const cells = cellsOf(a)
    const start = probeStart(i)
    const drop = cells.find((c) => c !== start)
    if (drop) return cells.filter((c) => c !== drop)
    const bank = probeBanks(i)[0]!
    return [...cells, cell(bank, TOY_LETTERS.find((w) => !cells.includes(cell(bank, w)))!)]
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
}

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  bombe: {
    items: [clickThrough, liveCountItem, boardMyth] as ItemLogic[],
    fallback: gridProbe as ItemLogic,
  },
}
