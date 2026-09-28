/**
 * The Turing–Welchman bombe (PLAN §3.11, §4.4 III.11–III.12). PURE.
 *
 * Wires. For every letter x of the alphabet the bombe has a bank (a 26-wire cable); wire w of bank x is live when
 * the current hypotheses imply "x is steckered to w". A menu edge a–b at crib position p is a scrambler Z_p (the
 * machine without its plugboard, drums at the run's position with the fast drum advanced p steps): if a↔w then
 * b↔Z_p(w), and symmetrically, so the scrambler joins wire w of bank a with wire Z_p(w) of bank b. Welchman's
 * diagonal board adds the plugboard's reciprocity: wire w of bank x is joined to wire x of bank w.
 *
 * The test register is the bank of the menu's test letter T. Voltage on one of its wires (the input hypothesis)
 * spreads through every joined wire. At a wrong position the whole register goes live (26: every hypothesis for
 * T is refuted, so no stop). At the right position a TRUE hypothesis lights exactly 1 wire of the register and a
 * false one lights 25 (all but the true partner: the true stecker wires form a closed set), so the machine stops.
 * The diagonal board only adds joins, so it can only light more wires: it never adds stops, it only removes them.
 */

import {
  createMachine,
  letterToIndex,
  mod,
  step,
  type Letter,
  type MachineConfig,
  type ReflectorName,
  type RotorName,
  LETTERS,
} from '../engine'
import { int, sample, shuffle } from '../lib/rng'
import type { Menu, MenuEdge } from './menu'
import { POSITIONS_PER_ORDER, positionIndex, positionString, scramblerTables } from './tables'
import type { Rng } from './types'

/** The wire state after propagation: live[bank][wire] (bank and wire are letter indices), and the order of events. */
export interface WireState {
  readonly n: number
  readonly live: readonly (readonly boolean[])[]
  /** Every wire in the order it went live; `via` is the menu edge's pos, the diagonal board, or the hypothesis. */
  readonly order: readonly { readonly bank: number; readonly wire: number; readonly via: number | 'hypothesis' | 'diagonal' }[]
}

/**
 * The bombe scrambler for crib position `pos`: rotors LEFT → RIGHT, rings AAA, no plugboard, drums at `start`
 * (3 letters) with only the fast (right) drum advanced `pos` steps; the middle and left drums never move (bombe
 * drum semantics). Equals the machine's permutation at the pos-th key press after `start` when the middle rotor
 * does not step in between. An involution without fixed points.
 */
export function scramblerAt(rotors: readonly RotorName[], reflector: ReflectorName, start: string, pos: number):
  number[] {
  const i = positionIndex(start)
  const out = new Array<number>(26)
  scramblerTables(rotors, reflector).perm(Math.floor(i / 676), Math.floor(i / 26) % 26, mod(i + pos), out)
  return out
}

/** scramblers[pos − 1] = scramblerAt(…, pos) for pos = 1 … the menu's largest pos (the array `propagate` takes). */
export function menuScramblers(menu: Menu, rotors: readonly RotorName[], reflector: ReflectorName, start: string):
  number[][] {
  const max = Math.max(0, ...menu.edges.map((e) => e.pos))
  return Array.from({ length: max }, (_, k) => scramblerAt(rotors, reflector, start, k + 1))
}

/**
 * Spread the hypothesis "hyp.bank is steckered to hyp.wire" through the menu (breadth first).
 * `scramblers[pos − 1]` is the scrambler of the menu edge at crib position pos (see menuScramblers; for a
 * toyBombe, its `scramblers`). `n` is the alphabet size (26, or 8 for the toy). With `diagonal`, wire w of bank x
 * also lights wire x of bank w.
 */
export function propagate(menu: Menu, scramblers: readonly (readonly number[])[], hyp: { bank: Letter; wire: Letter },
  o: { n: number; diagonal: boolean }): WireState {
  const { n, diagonal } = o
  const idx = (l: Letter) => {
    const i = letterToIndex(l)
    if (i >= n) throw new RangeError(`Letter ${l} is outside the first ${n} letters`)
    return i
  }
  const adj: { to: number; pos: number }[][] = Array.from({ length: n }, () => [])
  for (const e of menu.edges) {
    const z = scramblers[e.pos - 1]
    if (!z || z.length !== n) throw new RangeError(`No ${n}-letter scrambler for menu position ${e.pos}`)
    const a = idx(e.a)
    const b = idx(e.b)
    adj[a]!.push({ to: b, pos: e.pos })
    if (a !== b) adj[b]!.push({ to: a, pos: e.pos })
  }
  const live = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const order: { bank: number; wire: number; via: number | 'hypothesis' | 'diagonal' }[] = []
  const queue: [number, number][] = []
  const light = (bank: number, wire: number, via: number | 'hypothesis' | 'diagonal') => {
    if (live[bank]![wire]) return
    live[bank]![wire] = true
    order.push({ bank, wire, via })
    queue.push([bank, wire])
  }
  light(idx(hyp.bank), idx(hyp.wire), 'hypothesis')
  for (let qi = 0; qi < queue.length; qi++) {
    const [bank, wire] = queue[qi]!
    for (const { to, pos } of adj[bank]!) light(to, scramblers[pos - 1]![wire]!, pos)
    if (diagonal) light(wire, bank, 'diagonal')
  }
  return { n, live, order }
}

/** Live wires in `bank`. */
export function liveCount(ws: WireState, bank: Letter): number {
  return ws.live[letterToIndex(bank)]!.filter(Boolean).length
}

/**
 * The menu's test letter: in the connected piece of the menu with the most closures (ties: more edges, then the
 * alphabetically first letter), the letter with the most edges (ties: alphabetical). Vector 14 gives A.
 */
export function testLetterOf(menu: Menu): Letter {
  if (menu.edges.length === 0) throw new RangeError('An empty menu has no test letter')
  const degree = new Map<Letter, number>()
  const parent = new Map<Letter, Letter>()
  const find = (x: Letter): Letter => {
    while (parent.get(x) !== x) x = parent.get(x)!
    return x
  }
  for (const e of menu.edges) {
    for (const l of [e.a, e.b]) if (!parent.has(l)) parent.set(l, l)
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1)
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1)
    const [ra, rb] = [find(e.a), find(e.b)]
    if (ra !== rb) parent.set(ra, rb)
  }
  const pieces = new Map<Letter, { letters: Letter[]; edges: number }>()
  for (const l of [...parent.keys()].sort()) {
    const root = find(l)
    const piece = pieces.get(root) ?? { letters: [], edges: 0 }
    piece.letters.push(l)
    pieces.set(root, piece)
  }
  for (const e of menu.edges) pieces.get(find(e.a))!.edges++
  const score = (p: { letters: Letter[]; edges: number }) => p.edges - p.letters.length + 1
  const best = [...pieces.values()].sort(
    (x, y) => score(y) - score(x) || y.edges - x.edges || x.letters[0]!.localeCompare(y.letters[0]!),
  )[0]!
  return best.letters.reduce((a, b) => (degree.get(b)! > degree.get(a)! ? b : a))
}

/**
 * A bombe stop: drum positions (rings AAA), the test letter, its deduced stecker partner and the live wires the
 * test register showed. `stecker`: the live wire when 1 wire was live, the dead wire when 25 were, otherwise the dead
 * wire whose own hypothesis lights the fewest register wires. `reflector` is filled in by runBombe (checkStop
 * assumes 'B' without it).
 */
export interface Stop {
  readonly rotors: readonly RotorName[]
  readonly positions: string
  readonly testLetter: Letter
  readonly stecker: Letter
  readonly live: number
  readonly reflector?: ReflectorName
}

export interface RunBombeOptions {
  readonly menu: Menu
  readonly rotors: readonly RotorName[]
  readonly reflector: ReflectorName
  readonly diagonal: boolean
  /** First drum position (default 'AAA'); the scan runs with the right drum fastest and wraps after 'ZZZ'. */
  readonly from?: string
  /** Positions to scan (default 17,576: the whole wheel order). */
  readonly limit?: number
  onProgress?(d: number, t: number): void
  /** The test register's letter (default testLetterOf(menu)). */
  readonly testLetter?: Letter
  /** The wire of the test register that receives the voltage (default 'A'). */
  readonly inputWire?: Letter
}

/**
 * Run the bombe over one wheel order: at each drum position apply the voltage to the input wire of the test
 * register and stop when the register is not fully live (live ≠ 26). Returns the stops in scan order. One
 * propagation per position; it ends early as soon as all 26 register wires are live. About 0.1–0.3 s per wheel
 * order; the browser runs it in a worker through runBombeAsync (bombeClient.ts).
 */
export function runBombe(o: RunBombeOptions): Stop[] {
  const N = 26
  const rotors = [...o.rotors]
  const tables = scramblerTables(rotors, o.reflector)
  const test = letterToIndex(o.testLetter ?? testLetterOf(o.menu))
  const input = letterToIndex(o.inputWire ?? 'A')
  const from = positionIndex(o.from ?? 'AAA')
  const limit = o.limit ?? POSITIONS_PER_ORDER
  const edges = o.menu.edges.map((e) => ({ a: letterToIndex(e.a), b: letterToIndex(e.b), pos: e.pos }))
  if (!edges.some((e) => e.a === test || e.b === test)) throw new RangeError('The test letter is not on the menu')

  // adjacency in flat arrays: for bank x, entries adjStart[x] … adjStart[x + 1]
  const lists: { to: number; pos: number }[][] = Array.from({ length: N }, () => [])
  for (const e of edges) {
    lists[e.a]!.push({ to: e.b, pos: e.pos })
    if (e.a !== e.b) lists[e.b]!.push({ to: e.a, pos: e.pos })
  }
  const adjStart = new Int32Array(N + 1)
  lists.forEach((l, x) => (adjStart[x + 1] = adjStart[x]! + l.length))
  const adjTo = new Int32Array(adjStart[N]!)
  const adjPos = new Int32Array(adjStart[N]!)
  lists.forEach((l, x) =>
    l.forEach((a, k) => {
      adjTo[adjStart[x]! + k] = a.to
      adjPos[adjStart[x]! + k] = a.pos
    }),
  )

  // the 26 scramblers of the current (left, middle) pair, by right-drum offset
  const perms = Array.from({ length: N }, () => new Uint8Array(N))
  let cachedLM = -1
  const live = new Uint8Array(N * N)
  const queue = new Int32Array(N * N)
  let right = 0

  /** Lit wires of the register from `wire`; stops counting at 26. */
  const run = (wire: number): number => {
    live.fill(0)
    let head = 0
    let tail = 0
    let register = 0
    const light = (bank: number, w: number) => {
      const node = bank * N + w
      if (live[node]) return
      live[node] = 1
      queue[tail++] = node
      if (bank === test) register++
    }
    light(test, wire)
    while (head < tail && register < N) {
      const node = queue[head++]!
      const bank = (node / N) | 0
      const w = node - bank * N
      for (let k = adjStart[bank]!; k < adjStart[bank + 1]!; k++) {
        light(adjTo[k]!, perms[(right + adjPos[k]!) % N]![w]!)
      }
      if (o.diagonal) light(w, bank)
    }
    return register
  }

  const stops: Stop[] = []
  for (let k = 0; k < limit; k++) {
    const pi = (from + k) % POSITIONS_PER_ORDER
    const lm = Math.floor(pi / 26)
    if (lm !== cachedLM) {
      cachedLM = lm
      for (let r = 0; r < N; r++) tables.perm(Math.floor(lm / 26), lm % 26, r, perms[r]!)
    }
    right = pi % 26
    const count = run(input)
    if (count !== N) {
      let stecker: number
      if (count === 1) stecker = input
      else {
        const dead: number[] = []
        for (let w = 0; w < N; w++) if (!live[test * N + w]) dead.push(w)
        if (count === N - 1) stecker = dead[0]!
        else {
          stecker = dead[0]!
          let best = N + 1
          for (const w of dead) {
            const c = run(w)
            if (c < best) {
              best = c
              stecker = w
            }
          }
        }
      }
      stops.push({
        rotors,
        positions: positionString(pi),
        testLetter: LETTERS[test]!,
        stecker: LETTERS[stecker]!,
        live: count,
        reflector: o.reflector,
      })
    }
    if (o.onProgress && ((k + 1) % 676 === 0 || k + 1 === limit)) o.onProgress(k + 1, limit)
  }
  return stops
}

/**
 * The checking machine: from the stop's hypothesis (testLetter ↔ stecker) derive steckers along the whole crib at
 * the stop's drum positions (scramblerAt semantics, the stop's reflector or 'B'), repeating until nothing new
 * follows. A letter that would need two partners is a contradiction: the stop is false. `steckers` lists the
 * derived cables ('AB', a < b, sorted; letters found to be unsteckered are not listed).
 */
export function checkStop(stop: Stop, cipher: string, crib: string, offset: number):
  { consistent: boolean; steckers: readonly string[]; contradiction?: { letter: Letter; partners: readonly Letter[] } } {
  const c = cipher.toUpperCase()
  const p = crib.toUpperCase()
  if (!Number.isInteger(offset) || offset < 0 || offset + p.length > c.length) {
    throw new RangeError(`Offset ${offset} does not fit a ${p.length}-letter crib under ${c.length} letters`)
  }
  const reflector = stop.reflector ?? 'B'
  const scramblers = Array.from({ length: p.length }, (_, i) => scramblerAt(stop.rotors, reflector, stop.positions, i + 1))
  const S = new Array<number>(26).fill(-1)
  let contradiction: { letter: Letter; partners: Letter[] } | undefined
  const assign = (x: number, y: number): boolean => {
    if (S[x] === y) return true
    if (S[x] !== -1) {
      contradiction = { letter: LETTERS[x]!, partners: [LETTERS[S[x]!]!, LETTERS[y]!] }
      return false
    }
    if (S[y] !== -1) {
      contradiction = { letter: LETTERS[y]!, partners: [LETTERS[S[y]!]!, LETTERS[x]!] }
      return false
    }
    S[x] = y
    S[y] = x
    return true
  }
  let ok = assign(letterToIndex(stop.testLetter), letterToIndex(stop.stecker))
  let changed = true
  while (ok && changed) {
    changed = false
    for (let i = 0; i < p.length && ok; i++) {
      const a = letterToIndex(p[i]!)
      const b = letterToIndex(c[offset + i]!)
      const z = scramblers[i]!
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as const) {
        if (!ok || S[from] === -1) continue
        const want = z[S[from]!]!
        if (S[to] === want) continue
        ok = assign(to, want)
        changed = true
      }
    }
  }
  const steckers: string[] = []
  for (let x = 0; x < 26; x++) if (S[x]! > x) steckers.push(LETTERS[x]! + LETTERS[S[x]!]!)
  return contradiction ? { consistent: false, steckers, contradiction } : { consistent: true, steckers }
}

/**
 * The drum positions (rings AAA) at which the bombe's TRUE stop lies for a message enciphered on `day` from windows
 * `start` with the crib at `offset`: the windows after `offset` key presses, minus the ring settings.
 */
export function trueBombePosition(day: MachineConfig, start: string, offset: number): string {
  let state = createMachine({ ...day, positions: start })
  for (let i = 0; i < offset; i++) state = step(state).state
  const rings = day.rings.map(letterToIndex)
  return state.positions.map((p, i) => LETTERS[mod(p - rings[i]!)]!).join('')
}

function fixedPointFreeWith(r: Rng, n: number, x: number, y: number): number[] {
  const z = new Array<number>(n).fill(-1)
  z[x] = y
  z[y] = x
  const rest = shuffle(
    r,
    Array.from({ length: n }, (_, i) => i).filter((i) => i !== x && i !== y),
  )
  for (let i = 0; i < rest.length; i += 2) {
    z[rest[i]!] = rest[i + 1]!
    z[rest[i + 1]!] = rest[i]!
  }
  return z
}

/**
 * Ellsbury's reduced bombe: an 8-letter loop menu of `scramblers` edges (pos 1…k, letters among A…H) whose random
 * scramblers (fixed-point-free involutions on 8 letters) are consistent with a hidden plugboard. `truth` is the
 * test letter (the loop's first letter) and its true partner: from it the test register lights 1 wire; the
 * generator retries until every false hypothesis lights the other 7 (without the diagonal board).
 */
export function toyBombe(r: Rng, o: { n: 8; scramblers: 3 | 4 | 5 }): { menu: Menu; scramblers: number[][]
  truth: { bank: Letter; wire: Letter } } {
  const n = o.n
  const k = o.scramblers
  const pairs = 1 + int(r, 3)
  const S = Array.from({ length: n }, (_, i) => i)
  const pts = sample(r, S, pairs * 2)
  for (let i = 0; i < pairs; i++) {
    S[pts[2 * i]!] = pts[2 * i + 1]!
    S[pts[2 * i + 1]!] = pts[2 * i]!
  }
  const loop = sample(
    r,
    Array.from({ length: n }, (_, i) => i),
    k,
  )
  const edges: MenuEdge[] = loop.map((a, i) => ({ a: LETTERS[a]!, b: LETTERS[loop[(i + 1) % k]!]!, pos: i + 1 }))
  const menu: Menu = { edges, letters: [...new Set(edges.flatMap((e) => [e.a, e.b]))].sort() }
  const truth = { bank: LETTERS[loop[0]!]!, wire: LETTERS[S[loop[0]!]!]! }
  let scramblers: number[][] = []
  for (let attempt = 0; attempt < 500; attempt++) {
    scramblers = loop.map((a, i) => fixedPointFreeWith(r, n, S[a]!, S[loop[(i + 1) % k]!]!))
    const falseWire = LETTERS[(S[loop[0]!]! + 1) % n]!
    const ws = propagate(menu, scramblers, { bank: truth.bank, wire: falseWire }, { n, diagonal: false })
    if (liveCount(ws, truth.bank) === n - 1) break
  }
  return { menu, scramblers, truth }
}
