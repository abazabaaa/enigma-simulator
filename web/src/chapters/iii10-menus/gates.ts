/**
 * Chapter iii10-menus · gate `menus` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts, lesson/kinds and crypto only.
 *  - build-menu   custom (MenuGraph) · inPage · 2/3 · a 12–16-letter crib enciphered on a 1940 key whose middle rotor
 *                 steps inside the crib (flagged): choose links forming ≥ 2 closures, in one piece, ≤ 14 links, none at
 *                 or after the turnover. The links before the turnover always fall into ≥ 2 pieces.
 *  - closures     numbers(1) · 2/3 · a 6–10-link menu in 2 or 3 pieces → E − V + C
 *  - loop-return  letter(8) · 2/3 · a toy loop of 3–4 scramblers and a hypothesis → the letter that comes back
 *  - fallback build-menu
 * Scene data: vector 14's menu (the menu-builder scene) and the toy loop A–T–L–K (the loop scene).
 */

import type { Letter } from '../../contracts/core'
import type { ChapterGates, CheckResult, ItemLogic, Rollback } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { liveCount, propagate, toyBombe } from '../../crypto/bombe'
import { dayKey } from '../../crypto/generators'
import { scramblerTables } from '../../crypto/tables'
import { closures, loops, menuFromCrib, menuFromEdges, turnoverWithin, type MenuEdge } from '../../crypto/menu'
import {
  LETTERS,
  ROTORS,
  createMachine,
  encipher,
  mod,
  normalizeConfig,
  positionsToString,
  step,
  type MachineConfig,
  type RotorName,
} from '../../engine'
import { createRng, int, pick, randLetter, randomInvolution, sample, seedFor, shuffle, type Rng } from '../../lib/rng'
import { letterItem, numbersItem, numbersMatch, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const range = (n: number): number[] => Array.from({ length: n }, (_, k) => k)
const L = (i: number): Letter => LETTERS[mod(i)]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)

// ---------------------------------------------------------------------------
// Menus: pieces and the part of a piece that holds its loops
// ---------------------------------------------------------------------------

/** The connected pieces of a list of links (each piece's links in position order), largest first. */
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

/** Links that hang off a piece (a letter with one link) removed again and again: what is left holds every loop. */
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

const closuresOf = (edges: readonly MenuEdge[]) => closures(menuFromEdges(edges))

/**
 * The gate engine regenerates an instance from its seed several times (the draw, the view, the repeat check), and
 * these generators search. This cache keys on the seed's first draw and rebuilds the instance from a generator seeded
 * by it, so the result is still a pure function of the seed.
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

// ---------------------------------------------------------------------------
// Scene data: vector 14 (PLAN §4.3 F21)
// ---------------------------------------------------------------------------

export const V14 = { cipher: 'WSNPNLKLSTCS', crib: 'ATTACKATDAWN' } as const
export const V14_MENU = menuFromCrib(V14.cipher, V14.crib, 0)
/** The menu-builder bet's truth: the closures of all twelve links. */
export const V14_CLOSURES = closures(V14_MENU)
/** The three loops as the Bombe article names them (F21), each in order around its loop. */
export const V14_NAMED_LOOPS: readonly (readonly Letter[])[] = [
  ['A', 'T', 'L', 'K'],
  ['T', 'N', 'S'],
  ['T', 'A', 'W', 'C', 'N'],
]

/** Every control locked, the keyboard included, and the lamps hidden (the chapter works on paper). */
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

/** The machine the chapter's scenes leave in place (an Enigma I with a wartime-style key; never used for a press). */
export const PARKED: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['III', 'I', 'IV'],
  rings: 'CQH',
  positions: 'MXA',
  plugboard: ['AP', 'BJ', 'CT', 'DY', 'EQ', 'GM', 'HW', 'KR', 'LX', 'SV'],
})

// ---------------------------------------------------------------------------
// Scene data: the toy loop A–T–L–K (vector 14's links 10, 8, 6 and 7) on eight letters
// ---------------------------------------------------------------------------

/** The toy's eight letters, in table order. */
export const TOY_ALPHABET: readonly Letter[] = ['A', 'C', 'K', 'L', 'N', 'S', 'T', 'W']
/** The loop's letters in order, and the crib position of each link: A–T is 10, T–L 8, L–K 6, K–A 7. */
export const TOY_BANKS: readonly Letter[] = ['A', 'T', 'L', 'K']
export const TOY_LINKS: readonly number[] = [10, 8, 6, 7]

interface LoopToy {
  /** Link j's scrambler as the images of TOY_ALPHABET, in that order. */
  readonly tables: readonly string[]
  /** The three hypotheses for A's partner the bet offers, in alphabetical order. */
  readonly options: readonly Letter[]
  /** The second loop T–N–S's scramblers (links 3, 12, 2), as the images of TOY_ALPHABET. */
  readonly tables2: readonly string[]
}

function toyWalk(tables: readonly string[], x: Letter): Letter[] {
  const out = [x]
  for (const table of tables) out.push(table[TOY_ALPHABET.indexOf(out.at(-1)!)] as Letter)
  return out
}

/** A fixed-point-free involution on n letters that pairs x with y (a toy scrambler). */
function scramblerWith(r: Rng, n: number, x: number, y: number): number[] {
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

/** The second loop, T → N → S → T, and its links in vector 14 (T–N is 3, N–S 12, S–T 2). */
export const TOY_BANKS2: readonly Letter[] = ['T', 'N', 'S']
export const TOY_LINKS2: readonly number[] = [3, 12, 2]

/** The toy's letters as the kit's internal letters A–H (TOY_ALPHABET[i] is LETTERS[i]), for propagate. */
const internalOf = (l: Letter): Letter => LETTERS[TOY_ALPHABET.indexOf(l)]!
const loopEdges = (banks: readonly Letter[], first: number) =>
  banks.map((b, j) => ({ a: internalOf(b), b: internalOf(banks[(j + 1) % banks.length]!), pos: first + j }))
const TOY_MENU = menuFromEdges(loopEdges(TOY_BANKS, 1))
/** Both loops as one menu (ATLK at internal positions 1–4, TNS at 5–7). */
const TOY_MENU2 = menuFromEdges([...loopEdges(TOY_BANKS, 1), ...loopEdges(TOY_BANKS2, 5)])

/**
 * The loop scene's toy: a hidden plugboard on the eight letters (A steckered), and for each link a scrambler that
 * pairs the partners of its two letters, so the true assumption survives every loop (as toyBombe builds its toys).
 * Chosen deterministically so that exactly one false assumption survives the loop A–T–L–K too, the second loop
 * T–N–S throws it out, and A is not its own partner. The three bet options are both survivors of the first loop and
 * one assumption that does not survive it.
 */
export const LOOP_TOY: LoopToy & { readonly scramblers: readonly (readonly number[])[] } = (() => {
  const index = (banks: readonly Letter[]) => banks.map((b) => TOY_ALPHABET.indexOf(b))
  const tablesOf = (zs: readonly (readonly number[])[]) => zs.map((z) => z.map((i) => TOY_ALPHABET[i]!).join(''))
  for (let seed = 1; ; seed++) {
    const r = createRng(seedFor('iii10-loop-toy', seed))
    const S = randomInvolution(r, 8, 1 + int(r, 3))
    if (S[0] === 0) continue
    const loopScramblers = (banks: number[]) =>
      banks.map((b, j) => scramblerWith(r, 8, S[b]!, S[banks[(j + 1) % banks.length]!]!))
    const first = loopScramblers(index(TOY_BANKS))
    const second = loopScramblers(index(TOY_BANKS2))
    const tables = tablesOf(first)
    const tables2 = tablesOf(second)
    const truth = TOY_ALPHABET[S[0]!]!
    const survivors = TOY_ALPHABET.filter((x) => toyWalk(tables, x).at(-1) === x)
    if (survivors.length !== 2 || survivors.includes('A') || !survivors.includes(truth)) continue
    // T's partner under each survivor, taken round T–N–S: only the true one comes back.
    const back = (x: Letter) => {
      const t = toyWalk(tables, x)[1]!
      return toyWalk(tables2, t).at(-1) === t
    }
    if (!back(truth) || survivors.some((x) => x !== truth && back(x))) continue
    const moved = TOY_ALPHABET.filter((x) => x !== 'A' && !survivors.includes(x))
    return { tables, tables2, options: [...survivors, pick(r, moved)].sort(), scramblers: [...first, ...second] }
  }
})()

/** The partners of A, T, L, K and A again, going round the toy loop from "A ↔ x" (direct table look-ups). */
export const loopWalk = (x: Letter): Letter[] => toyWalk(LOOP_TOY.tables, x)

/** The partners of T, N, S and T again round the second loop, starting from T's partner under "A ↔ x". */
export const loopWalk2 = (x: Letter): Letter[] => toyWalk(LOOP_TOY.tables2, loopWalk(x)[1]!)

/** A's live wires after propagating "A ↔ x" through the kit (one loop, or both). */
function aWires(x: Letter, both: boolean): number {
  const bank = internalOf('A')
  const menu = both ? TOY_MENU2 : TOY_MENU
  const scramblers = both ? LOOP_TOY.scramblers : LOOP_TOY.scramblers.slice(0, TOY_BANKS.length)
  return liveCount(propagate(menu, scramblers, { bank, wire: internalOf(x) }, { n: 8, diagonal: false }), bank)
}

/**
 * Whether "A ↔ x" contradicts itself, from the bombe kit: propagate the assumption through the toy's menu (the loop
 * A–T–L–K, or with `both` the two loops); a contradiction anywhere leaves A's bank with more than one live wire.
 */
export function contradicts(x: Letter, both = false): boolean {
  return aWires(x, both) > 1
}

// ---------------------------------------------------------------------------
// build-menu · custom (MenuGraph) · inPage · 2/3 (rollback: menu)
// ---------------------------------------------------------------------------

/** Cribs of 15–16 letters (within the plan's 12–16), from the words of the kit's filler text (X separates words). */
export const MENU_CRIBS: readonly string[] = [
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

/** Wilcox's rule of thumb (F19): at most 13–14 links. */
export const MAX_LINKS = 14

export interface MenuInstance {
  readonly crib: string
  /** The cipher letters under the crib (the crib sits at offset 0). */
  readonly cipher: string
  /** The crib position (1-based) at whose key press the middle rotor steps: links from here on are flagged. */
  readonly turnover: number
  /** The rotor order (left to right), and the windows just before and just after the turnover's key press. */
  readonly rotors: readonly RotorName[]
  readonly windows: readonly [string, string]
}

/** Rotor windows before the crib such that the middle rotor steps exactly at crib position t (rotors I–V). */
export function startFor(r: Rng, rotors: readonly RotorName[], t: number): string {
  const middle = rotors[1]!
  const right = rotors[2]!
  let m: Letter
  do m = randLetter(r)
  while (ROTORS[middle].turnovers.includes(m))
  return [randLetter(r), m, L(idx(ROTORS[right].turnovers[0]!) - (t - 1))].join('')
}

const allLinks = (i: Pick<MenuInstance, 'crib' | 'cipher'>): readonly MenuEdge[] => menuFromCrib(i.cipher, i.crib, 0).edges
/** The links before the turnover. */
export const usableLinks = (i: MenuInstance): MenuEdge[] => allLinks(i).filter((e) => e.pos < i.turnover)
/** The flagged crib positions: the turnover and after. */
export const flagged = (i: MenuInstance): number[] => range(i.crib.length + 1).filter((p) => p >= i.turnover && p >= 1)

interface FastDay {
  readonly tables: ReturnType<typeof scramblerTables>
  /** The plugboard as a permutation of letter indices. */
  readonly S: readonly number[]
  readonly rings: readonly number[]
}

function fastDay(day: MachineConfig): FastDay {
  const S = range(26)
  for (const pair of day.plugboard) {
    S[idx(pair[0]!)] = idx(pair[1]!)
    S[idx(pair[1]!)] = idx(pair[0]!)
  }
  return { tables: scramblerTables(day.rotors, day.reflector), S, rings: day.rings.map(idx) }
}

/** The indices of the cipher letters of crib positions 1 … t − 1 (see cipherBeforeTurnover). */
function fastCipher(f: FastDay, start: readonly number[], crib: readonly number[], t: number): number[] {
  const { tables, S, rings } = f
  const inner = (mod(start[0]! - rings[0]!) * 26 + mod(start[1]! - rings[1]!)) * 26
  const or = start[2]! - rings[2]!
  const out: number[] = []
  for (let j = 1; j < t && j <= crib.length; j++) {
    const ro = mod(or + j) * 26
    out.push(S[tables.right.bwd[ro + tables.inner[inner + tables.right.fwd[ro + S[crib[j - 1]!]!]!]!]!]!)
  }
  return out
}

/**
 * The cipher letters of crib positions 1 … t − 1 (before the middle rotor steps), fast: the plugboard, then the kit's
 * scrambler tables at the core offsets (window − ring) with only the right rotor advancing. The unit tests check it
 * against the engine; the instance itself is always enciphered by the engine.
 */
export function cipherBeforeTurnover(day: MachineConfig, start: string, crib: string, t: number): string {
  return fastCipher(fastDay(day), [...start].map(idx), [...crib].map(idx), t)
    .map(L)
    .join('')
}

/**
 * Whether links a[j]–b[j] (letter indices) make a good exercise: ≥ 2 pieces, one of them with ≥ 2 closures. A fast
 * union-find over the 26 letters (the generator tries many settings); `pieces` and `closures` say the same in tests.
 */
export function goodExercise(a: readonly number[], b: readonly number[]): boolean {
  const parent = Array.from({ length: 26 }, (_, k) => k)
  const used = new Array<boolean>(26).fill(false)
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!
    return x
  }
  a.forEach((x, j) => {
    used[x] = used[b[j]!] = true
    const [rx, ry] = [find(x), find(b[j]!)]
    if (rx !== ry) parent[rx] = ry
  })
  const E = new Array<number>(26).fill(0)
  const V = new Array<number>(26).fill(0)
  a.forEach((x) => E[find(x)]!++)
  let roots = 0
  for (let x = 0; x < 26; x++) {
    if (!used[x]) continue
    V[find(x)]!++
    if (find(x) === x) roots++
  }
  return roots >= 2 && range(26).some((x) => used[x] && find(x) === x && E[x]! - V[x]! + 1 >= 2)
}

export function menuInstance(r: Rng): MenuInstance {
  for (;;) {
    const day = dayKey(r, { era: '1940' })
    const crib = pick(r, MENU_CRIBS)
    const f = fastDay(day)
    const plain = [...crib].map(idx)
    for (let tries = 0; tries < 300; tries++) {
      const t = 12 + int(r, Math.min(crib.length, 15) - 11)
      const start = startFor(r, day.rotors, t)
      const early = fastCipher(f, [...start].map(idx), plain, t)
      if (!goodExercise(plain.slice(0, early.length), early)) continue
      if (turnoverWithin(day.rotors, start, 1, crib.length) !== t) continue
      const cipher = encipher(createMachine({ ...day, positions: start }), crib).output
      let state = createMachine({ ...day, positions: start })
      for (let k = 1; k < t; k++) state = step(state).state
      const windows = [positionsToString(state), positionsToString(step(state).state)] as const
      const i: MenuInstance = { crib, cipher, turnover: t, rotors: [...day.rotors], windows }
      const parts = pieces(usableLinks(i))
      if (cipher.startsWith(early.map(L).join('')) && parts.length >= 2 && parts.some((p) => closuresOf(p) >= 2)) return i
    }
  }
}

/** A menu that works: the loop-holding core of the piece with the most closures, before the turnover. */
export function menuSolution(i: MenuInstance): number[] {
  const best = pieces(usableLinks(i))
    .map(twoCore)
    .sort((x, y) => closuresOf(y) - closuresOf(x) || x.length - y.length)[0]!
  return best.map((e) => e.pos).sort((a, b) => a - b)
}

function menuRollback(loop: readonly Letter[], breakAt: number): Rollback {
  return { kind: 'menu', loop: [...loop], breakAt }
}

export function menuCheck(i: MenuInstance, a: unknown): CheckResult {
  const links = allLinks(i)
  const list = Array.isArray(a) ? a.map(Number) : []
  const valid =
    list.length > 0 &&
    list.every((p) => Number.isInteger(p) && p >= 1 && p <= links.length) &&
    new Set(list).size === list.length
  if (!valid) return verdict(false, menuRollback([], 0), 'Add links to your menu, then submit it.')
  const edges = links.filter((e) => list.includes(e.pos))
  const late = edges.find((e) => e.pos >= i.turnover)
  if (late) {
    return verdict(
      false,
      menuRollback([late.a, late.b], late.pos),
      `Link ${late.pos} (${late.a}–${late.b}) comes at or after the turnover at position ${i.turnover}: by then the middle ` +
        'rotor had moved, so the bombe’s scramblers do not match it.',
    )
  }
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
      `Your menu falls into ${parts.length} separate pieces. The bombe feeds its current in at one letter, and a piece it ` +
        'cannot reach tests nothing: keep one connected piece.',
    )
  }
  if (c < 2) return verdict(false, menuRollback(loop, c), `Your menu has ${c} closure${c === 1 ? '' : 's'}; it needs at least 2.`)
  return { correct: true, rollback: { kind: 'none' } }
}

const menuGenerate = memoised(menuInstance)

export function buildMenuItem(id: string): ItemLogic<MenuInstance, number[]> {
  return {
    id,
    kind: 'custom',
    rule: WINDOW,
    compute: false,
    inPage: true,
    generate: menuGenerate,
    same: (a, b) => a.crib === b.crib && a.cipher === b.cipher && a.turnover === b.turnover && a.windows[0] === b.windows[0],
    solve: menuSolution,
    check: menuCheck,
    sampleAnswer(i, r) {
      const picked = range(i.crib.length)
        .map((k) => k + 1)
        .filter(() => r() < 0.5)
      return picked.length ? picked : [1 + int(r, i.crib.length)]
    },
    // A link at the turnover added to the menu: always wrong.
    mutate: (i, a) => [...new Set([...(Array.isArray(a) ? a : []), i.turnover])],
    setup: () => ({ stage: null }),
    highlight: () => [],
  }
}

export const buildMenu = buildMenuItem('build-menu')

// ---------------------------------------------------------------------------
// closures · numbers(1) · 2/3 (rollback: menu)
// ---------------------------------------------------------------------------

export interface ClosuresInstance {
  readonly count: 1
  readonly edges: readonly MenuEdge[]
}

/**
 * 6–10 links in 2 or 3 pieces, with 0–4 closures: each piece a random tree plus extra links (a second link between the
 * same two letters is a loop too). With C ≥ 2 pieces, E − V and E − V + 1 are always wrong.
 */
export function closuresInstance(r: Rng): ClosuresInstance {
  for (;;) {
    const E = 6 + int(r, 5)
    const C = 2 + int(r, 2)
    const t = int(r, 5)
    const V = E + C - t
    if (V < 2 * C) continue
    const sizes = Array.from({ length: C }, () => 2)
    for (let k = 0; k < V - 2 * C; k++) sizes[int(r, C)]!++
    // Extra links go to pieces of three letters or more when there are any (fewer doubled links).
    const roomy = range(C).filter((j) => sizes[j]! >= 3)
    const extras = Array.from({ length: C }, () => 0)
    for (let k = 0; k < t; k++) extras[roomy.length ? pick(r, roomy) : int(r, C)]!++
    const letters = sample(r, LETTERS, V)
    const pairs: [Letter, Letter][] = []
    const key = (a: Letter, b: Letter) => [a, b].sort().join('')
    let at = 0
    sizes.forEach((size, j) => {
      const own = letters.slice(at, (at += size))
      for (let k = 1; k < own.length; k++) pairs.push([own[k]!, own[int(r, k)]!])
      for (let x = 0; x < extras[j]!; x++) {
        const used = new Set(pairs.map(([a, b]) => key(a, b)))
        const fresh = own.flatMap((a, i) => own.slice(i + 1).map((b) => [a, b] as [Letter, Letter])).filter(([a, b]) => !used.has(key(a, b)))
        pairs.push(fresh.length ? pick(r, fresh) : (sample(r, own, 2) as [Letter, Letter]))
      }
    })
    const edges = shuffle(r, pairs).map(([a, b], k) => (r() < 0.5 ? { a, b, pos: k + 1 } : { a: b, b: a, pos: k + 1 }))
    return { count: 1, edges }
  }
}

export const closuresItem = numbersItem<ClosuresInstance>({
  id: 'closures',
  rule: WINDOW,
  range: [0, 10],
  generate: (r) => closuresInstance(r),
  same: (a, b) => JSON.stringify(a.edges) === JSON.stringify(b.edges),
  solve: (i) => [closures(menuFromEdges(i.edges))],
  check(i, a) {
    const m = menuFromEdges(i.edges)
    const c = closures(m)
    return verdict(numbersMatch([c], a), menuRollback(loops(m)[0] ?? [], c), 'Count the links, the letters and the separate pieces.')
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// loop-return · letter(8) · 2/3 (rollback: menu)
// ---------------------------------------------------------------------------

export interface LoopReturnInstance {
  /** The loop's letters in order (3 or 4 of A–H); link j joins loop[j] and loop[j + 1], the last back to loop[0]. */
  readonly loop: readonly Letter[]
  /** Link j's scrambler: the images of A–H. */
  readonly tables: readonly string[]
  /** The hypothesis: loop[0] is steckered to this letter. */
  readonly hypothesis: Letter
}

/** Direct composition: the partner after each link, starting from the hypothesis. */
export function loopChain(i: Pick<LoopReturnInstance, 'tables' | 'hypothesis'>, reverse = false): Letter[] {
  const tables = reverse ? [...i.tables].reverse() : i.tables
  const out = [i.hypothesis]
  for (const t of tables) out.push(t[idx(out.at(-1)!)] as Letter)
  return out
}

/**
 * The letter that comes back, the bombe's way: the loop opened out at its first letter (the last link leads to a
 * spare letter's bank), the hypothesis propagated through the kit, and the one live wire of that bank read.
 */
export function loopReturn(i: LoopReturnInstance): Letter {
  const k = i.loop.length
  const end = LETTERS.slice(0, 8).find((l) => !i.loop.includes(l))!
  const edges = i.loop.map((a, j) => ({ a, b: j + 1 < k ? i.loop[j + 1]! : end, pos: j + 1 }))
  const scramblers = i.tables.map((t) => [...t].map(idx))
  const ws = propagate(menuFromEdges(edges), scramblers, { bank: i.loop[0]!, wire: i.hypothesis }, { n: 8, diagonal: false })
  return L(ws.live[idx(end)]!.findIndex(Boolean))
}

/**
 * A toyBombe loop of 3–4 scramblers on A–H and a hypothesis whose returning letter differs from the hypothesis
 * itself, from the letter reached going round the wrong way, and from the letter one link short: those misreadings
 * are always wrong.
 */
export function loopReturnInstance(r: Rng): LoopReturnInstance {
  for (;;) {
    const k = (3 + int(r, 2)) as 3 | 4
    const toy = toyBombe(r, { n: 8, scramblers: k })
    const i: LoopReturnInstance = {
      loop: toy.menu.edges.map((e) => e.a),
      tables: toy.scramblers.map((z) => z.map(L).join('')),
      hypothesis: randLetter(r, 8),
    }
    const chain = loopChain(i)
    const back = chain[k]!
    if (back === i.hypothesis || back === loopChain(i, true)[k] || back === chain[k - 1]) continue
    return i
  }
}

export const loopReturnItem = letterItem<LoopReturnInstance>({
  id: 'loop-return',
  rule: WINDOW,
  alphabet: 8,
  generate: memoised(loopReturnInstance),
  same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  solve: loopReturn,
  check: (i, a) =>
    verdict(
      String(a ?? '').toUpperCase() === loopReturn(i),
      menuRollback(i.loop, i.loop.length),
      'Follow the partner through each link’s table in turn, in the order of the loop.',
    ),
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  menus: {
    items: [buildMenu, closuresItem, loopReturnItem] as ItemLogic[],
    fallback: buildMenu as ItemLogic,
  },
}
