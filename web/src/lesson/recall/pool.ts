/**
 * The recall pool (PLAN §4.2). PURE and generic: it never imports a chapter. Act recall scenes (II.5,
 * III.9, the capstone, and the fixture) and the return-visit check draw their items from here. Every
 * item is `once`, with the full hint ladder.
 */

import type { AnyChapterId, Letter, MachineConfig } from '../../contracts/core'
import type { ChapterGates, GateLogic, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { PathHop } from '../../contracts/stage'
import {
  LETTERS,
  ROTORS,
  compose,
  createMachine,
  cycles,
  cycleSignature,
  inverse,
  normalizeConfig,
  pressKey,
  rotorPermutation,
  type RotorName,
} from '../../engine'
import {
  createRng,
  int,
  pick,
  randLetter,
  randomConfig,
  randomInvolution,
  randomPerm,
  sample,
  seedFor,
} from '../../lib/rng'
import {
  firstDiff,
  ghostFromOutputs,
  lettersItem,
  numbersItem,
  numbersMatch,
  setMachineItem,
  splitWindows,
  verdict,
  windowsAfterPresses,
  windowsRollback,
} from '../kinds'

export type RecallAct = 'I' | 'II' | 'III'
export type RecallId = 'r-windows' | 'r-plug-to-hit' | 'r-hop-trio' | 'r-compose' | 'r-lengths' | 'r-crashes' | 'r-loop'

const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[i]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Everything locked, keyboard included, lamps hidden: the learner reads the prompt, never tries presses. */
const READ_ONLY: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: true,
  plugboard: true,
  keyboard: true,
  lampsHidden: true,
}

// ---------------------------------------------------------------------------
// r-windows · letters(9) · Act I
// ---------------------------------------------------------------------------

export interface WindowsInstance {
  readonly length: 9
  readonly config: MachineConfig
}

export const rWindows = lettersItem<WindowsInstance>({
  id: 'r-windows',
  rule: ONCE,
  generate(r) {
    const base = randomConfig(r, { plugs: 0 })
    const right = base.rotors[2]!
    const turnover = ROTORS[right].turnovers[0]!
    // Start within 3 presses of the right rotor's turnover, so the carry happens during the three presses.
    const start = L((idx(turnover) - int(r, 3) + 26) % 26)
    const positions = [base.positions[0]!, base.positions[1]!, start]
    return { length: 9, config: normalizeConfig({ ...base, positions }) }
  },
  same: (a, b) => sameJson(a.config, b.config),
  solve: (i) => windowsAfterPresses(i.config, 3).join(''),
  check(i, a) {
    const expected = windowsAfterPresses(i.config, 3)
    const got = splitWindows(String(a ?? '').toUpperCase(), 3)
    const ok = got.join('') === expected.join('')
    return verdict(ok, windowsRollback(i.config, expected, got))
  },
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'rotors' }),
  highlight: () => [
    { part: 'notch-right', tone: 'hint' },
    { part: 'pawl-middle', tone: 'hint' },
    { part: 'notch-middle', tone: 'hint' },
  ],
})

// ---------------------------------------------------------------------------
// r-plug-to-hit · set-machine · Act I (and its fallback r-plug-one)
// ---------------------------------------------------------------------------

export interface PlugInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked'
  readonly maxPlugs: number
  /** Press this key … */
  readonly k: Letter
  /** … so that this lamp lights. */
  readonly t: Letter
  /** The unplugged scrambler for the next key press: table[x] is the lamp for key x. */
  readonly table: string
}

function lampFor(cfg: MachineConfig, key: Letter): Letter {
  return pressKey(createMachine(cfg), key).output
}

function plugItem(id: string, maxPlugs: number) {
  return setMachineItem<PlugInstance>({
    id,
    rule: ONCE,
    generate(r) {
      const machine = randomConfig(r, { plugs: 0 })
      const table = LETTERS.map((x) => lampFor(machine, x)).join('')
      const k = randLetter(r)
      const others = LETTERS.filter((x) => x !== k && x !== table[idx(k)])
      const t = pick(r, others)
      return { setup: { machine, stage: 'plugboard' }, unlocked: ['plugboard'], trial: 'locked', maxPlugs, k, t, table }
    },
    same: (a, b) => a.k === b.k && a.t === b.t && sameJson(a.setup.machine, b.setup.machine),
    predicate(i, cfg) {
      const lamp = lampFor(cfg, i.k)
      if (lamp === i.t) return true
      return { field: 'plugboard', message: `${i.k} lights ${lamp}, not ${i.t}.`, highlight: ['plugboard'] }
    },
    // A single cable from K to E₀(T): K enters as E₀(T), the scrambler sends it to T, and T is unplugged.
    solve: (i) => ({ ...i.setup.machine, plugboard: [i.k + i.table[idx(i.t)]!] }),
    sampleAnswer(i, r) {
      const n = int(r, i.maxPlugs + 1)
      const letters = sample(r, LETTERS, 2 * n)
      const plugboard = Array.from({ length: n }, (_, j) => letters[2 * j]! + letters[2 * j + 1]!)
      return { ...i.setup.machine, plugboard }
    },
    mutate(i, a) {
      const cable = a.plugboard[0] ?? i.k + 'A'
      const other = cable[0] === i.k ? cable[1]! : cable[0]!
      let next = (idx(other) + 1) % 26
      while (L(next) === i.k) next = (next + 1) % 26
      return { ...a, plugboard: [i.k + L(next)] }
    },
    highlight: () => [{ part: 'plugboard', tone: 'hint' }],
  })
}

export const rPlugToHit = plugItem('r-plug-to-hit', 2)
/** The recall gates' in-page fallback: the same task with one cable. */
export const rPlugOne = plugItem('r-plug-one', 1)

// ---------------------------------------------------------------------------
// r-hop-trio · letters(3) · Act I
// ---------------------------------------------------------------------------

export interface HopTrioInstance {
  readonly length: 3
  /** LEFT → RIGHT. */
  readonly rotors: readonly RotorName[]
  /** Window letters LEFT → RIGHT (rings are 01). */
  readonly positions: string
  readonly input: Letter
  /** The forward substitution of the right, middle and left rotor at their offsets (26 letters each). */
  readonly strips: readonly string[]
}

function trioHops(i: HopTrioInstance): PathHop[] {
  const hops: PathHop[] = []
  let x = idx(i.input)
  const order = [2, 1, 0] as const
  const slots = ['left', 'middle', 'right'] as const
  for (const [k, slot] of order.map((s, k) => [k, s] as const)) {
    const out = idx(i.strips[k]![x]!)
    hops.push({
      kind: 'rotor',
      stage: `rotor-${slots[slot]}-fwd`,
      input: L(x),
      output: L(out),
      inputIndex: x,
      outputIndex: out,
      slotIndex: slot,
      offset: idx(i.positions[slot]!),
    })
    x = out
  }
  return hops
}

export const rHopTrio = lettersItem<HopTrioInstance>({
  id: 'r-hop-trio',
  rule: ONCE,
  generate(r) {
    const rotors = sample(r, ['I', 'II', 'III', 'IV', 'V'] as const, 3) as RotorName[]
    const positions = [randLetter(r), randLetter(r), randLetter(r)]
    const strips = [2, 1, 0].map((s) => rotorPermutation(rotors[s]!, 'A', positions[s]!).map(L).join(''))
    return { length: 3, rotors, positions: positions.join(''), input: randLetter(r), strips }
  },
  same: (a, b) => a.input === b.input && a.positions === b.positions && sameJson(a.rotors, b.rotors),
  solve: (i) =>
    trioHops(i)
      .map((h) => h.output)
      .join(''),
  check(i, a) {
    const ref = trioHops(i)
    const got = String(a ?? '')
      .toUpperCase()
      .split('')
    return verdict(got.join('') === ref.map((h) => h.output).join(''), {
      kind: 'path',
      ghost: ghostFromOutputs(ref, got),
    })
  },
  setup: (i) => ({
    machine: { model: 'I', reflector: 'B', rotors: i.rotors, rings: 'AAA', positions: i.positions, plugboard: [] },
    locks: READ_ONLY,
    stage: 'rotors',
  }),
  highlight(i, lastWrong) {
    const ref = trioHops(i)
    const k = lastWrong
      ? firstDiff(
          ref.map((h) => h.output),
          String(lastWrong).toUpperCase().split(''),
        )
      : 0
    const slot = (['right', 'middle', 'left'] as const)[Math.max(0, Math.min(2, k))]!
    return [{ part: `rotor-${slot}`, tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------
// r-compose · letters(4) · Act II
// ---------------------------------------------------------------------------

export interface ComposeInstance {
  readonly length: 4
  readonly alphabet: 6
  readonly p: readonly number[]
  readonly q: readonly number[]
  readonly xs: readonly Letter[]
}

export const rCompose = lettersItem<ComposeInstance>({
  id: 'r-compose',
  rule: ONCE,
  generate(r) {
    const p = randomPerm(r, 6)
    const q = randomPerm(r, 6)
    const xs = sample(r, LETTERS.slice(0, 6), 4)
    return { length: 4, alphabet: 6, p, q, xs }
  },
  same: (a, b) => sameJson([a.p, a.q, a.xs], [b.p, b.q, b.xs]),
  solve: (i) => i.xs.map((x) => L(compose(i.p, i.q)[idx(x)]!)).join(''),
  check(i, a) {
    const pq = compose(i.p, i.q)
    const got = String(a ?? '').toUpperCase()
    const wrongCells = i.xs.flatMap((x, k) => (got[k] === L(pq[idx(x)]!) ? [] : [idx(x)]))
    return verdict(wrongCells.length === 0 && got.length === 4, { kind: 'perm', wrongCells })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// r-lengths · numbers (multiset) · Act II
// ---------------------------------------------------------------------------

export interface LengthsInstance {
  readonly count: 'any'
  /** 12 or 14 letters. */
  readonly n: number
  /** Two fixed-point-free involutions on n letters; the product is compose(a, b) (a first). */
  readonly a: readonly number[]
  readonly b: readonly number[]
}

export const rLengths = numbersItem<LengthsInstance>({
  id: 'r-lengths',
  rule: ONCE,
  range: [0, 26],
  multiset: true,
  generate(r) {
    const n = pick(r, [12, 14])
    return { count: 'any', n, a: randomInvolution(r, n, n / 2), b: randomInvolution(r, n, n / 2) }
  },
  same: (x, y) => sameJson([x.a, x.b], [y.a, y.b]),
  solve: (i) => cycleSignature(compose(i.a, i.b)),
  check(i, got) {
    const perm = compose(i.a, i.b)
    const expected = cycleSignature(perm)
    const ok = numbersMatch(expected, got, { multiset: true })
    const counted = Array.isArray(got) ? [...got].sort((x, y) => y - x) : []
    // The first cycle whose length the learner did not count.
    const pool = [...counted]
    const cyc = cycles(perm).find((c) => {
      const k = pool.indexOf(c.length)
      if (k === -1) return true
      pool.splice(k, 1)
      return false
    })
    return verdict(ok, { kind: 'cycles', perm, cycle: cyc ?? cycles(perm)[0]!, expected, got: counted })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// r-crashes · numbers (any) · Act III
// ---------------------------------------------------------------------------

export interface CrashesInstance {
  readonly count: 'any'
  readonly cipher: string
  readonly crib: string
  readonly offset: number
}

export function crashIndices(cipher: string, crib: string, offset: number): number[] {
  return [...crib].flatMap((c, k) => (cipher[offset + k] === c ? [k] : []))
}

export const rCrashes = numbersItem<CrashesInstance>({
  id: 'r-crashes',
  rule: ONCE,
  range: [0, 25],
  multiset: true,
  generate(r) {
    const cribLength = 8 + int(r, 5)
    const crib = Array.from({ length: cribLength }, () => randLetter(r)).join('')
    const cipherLength = cribLength + 6 + int(r, 9)
    const cipher: string[] = Array.from({ length: cipherLength }, () => randLetter(r))
    const offset = int(r, cipherLength - cribLength + 1)
    for (const k of sample(
      r,
      [...crib].map((_, j) => j),
      1 + int(r, 3),
    ))
      cipher[offset + k] = crib[k]!
    return { count: 'any', cipher: cipher.join(''), crib, offset }
  },
  same: (a, b) => a.cipher === b.cipher && a.crib === b.crib && a.offset === b.offset,
  solve: (i) => crashIndices(i.cipher, i.crib, i.offset),
  check(i, got) {
    const crashes = crashIndices(i.cipher, i.crib, i.offset)
    return verdict(numbersMatch(crashes, got, { multiset: true }), { kind: 'crib', offset: i.offset, crashes })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// r-loop · letters(4) · Act III
// ---------------------------------------------------------------------------

export interface LoopInstance {
  readonly length: 4
  readonly alphabet: 8
  /** Three scrambler tables on A–H (fixed-point-free involutions), applied in order. */
  readonly scramblers: readonly (readonly number[])[]
  readonly hypotheses: readonly Letter[]
}

function loopPath(i: LoopInstance, h: Letter): Letter[] {
  const out: Letter[] = [h]
  let x = idx(h)
  for (const s of i.scramblers) {
    x = s[x]!
    out.push(L(x))
  }
  return out
}

export const rLoop = lettersItem<LoopInstance>({
  id: 'r-loop',
  rule: ONCE,
  generate(r) {
    const scramblers = [0, 1, 2].map(() => randomInvolution(r, 8, 4))
    const hypotheses = sample(r, LETTERS.slice(0, 8), 4)
    return { length: 4, alphabet: 8, scramblers, hypotheses }
  },
  same: (a, b) => sameJson([a.scramblers, a.hypotheses], [b.scramblers, b.hypotheses]),
  solve: (i) => i.hypotheses.map((h) => loopPath(i, h).at(-1)!).join(''),
  check(i, a) {
    const expected = i.hypotheses.map((h) => loopPath(i, h).at(-1)!)
    const got = String(a ?? '')
      .toUpperCase()
      .split('')
    const k = Math.max(0, firstDiff(expected, got))
    return verdict(got.join('') === expected.join(''), {
      kind: 'menu',
      loop: loopPath(i, i.hypotheses[k]!),
      breakAt: 3,
    })
  },
  setup: () => ({ stage: null }),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// Pool, act recall rotation and the return-visit check
// ---------------------------------------------------------------------------

export const RECALL_POOL: Readonly<Record<RecallId, ItemLogic>> = Object.freeze({
  'r-windows': rWindows as ItemLogic,
  'r-plug-to-hit': rPlugToHit as ItemLogic,
  'r-hop-trio': rHopTrio as ItemLogic,
  'r-compose': rCompose as ItemLogic,
  'r-lengths': rLengths as ItemLogic,
  'r-crashes': rCrashes as ItemLogic,
  'r-loop': rLoop as ItemLogic,
})

export const RECALL_IDS = Object.keys(RECALL_POOL) as RecallId[]

export const RECALL_ACT: Readonly<Record<RecallId, RecallAct>> = Object.freeze({
  'r-windows': 'I',
  'r-plug-to-hit': 'I',
  'r-hop-trio': 'I',
  'r-compose': 'II',
  'r-lengths': 'II',
  'r-crashes': 'III',
  'r-loop': 'III',
})

/** The in-page fallback of every recall gate and return check (set-machine, one cable). */
export const RECALL_FALLBACK: ItemLogic = rPlugOne as ItemLogic

/** Every logic a recall or return-check gate can show, by item id (e2e solveInNode resolves through this). */
export const RECALL_LOGIC: Readonly<Record<string, ItemLogic>> = Object.freeze({
  ...RECALL_POOL,
  [RECALL_FALLBACK.id]: RECALL_FALLBACK,
})

/** How many items of each act a chapter's recall scene draws; II.5 is fixed. */
const RECALL_PLAN: Partial<Record<AnyChapterId, Partial<Record<RecallAct, number>> | readonly RecallId[]>> = {
  'ii5-indicators': ['r-windows', 'r-hop-trio', 'r-plug-to-hit'],
  'iii9-cribs': { II: 2, I: 1 },
  'iv-capstone': { I: 1, II: 1, III: 1 },
}
/** Chapters without an entry (the fixture included) draw one item per act, like the capstone. */
const DEFAULT_PLAN: Partial<Record<RecallAct, number>> = { I: 1, II: 1, III: 1 }

function combinations<T>(xs: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (xs.length < k) return []
  const [head, ...tail] = xs as [T, ...T[]]
  return [...combinations(tail, k - 1).map((c) => [head, ...c]), ...combinations(tail, k)]
}

const ACT_ORDER: readonly RecallAct[] = ['I', 'II', 'III']

/**
 * Every item set a chapter's recall scene can draw: the per-act counts of the plan, with three distinct item
 * kinds (§4.2), ordered by act. II.5's set is fixed.
 */
export function recallSets(chapter: AnyChapterId): RecallId[][] {
  const plan = RECALL_PLAN[chapter] ?? DEFAULT_PLAN
  if (Array.isArray(plan)) return [[...(plan as readonly RecallId[])]]
  let sets: RecallId[][] = [[]]
  for (const act of ACT_ORDER) {
    const k = (plan as Partial<Record<RecallAct, number>>)[act] ?? 0
    const ids = RECALL_IDS.filter((id) => RECALL_ACT[id] === act)
    sets = sets.flatMap((s) => combinations(ids, k).map((c) => [...s, ...c]))
  }
  const distinct = sets.filter((s) => new Set(s.map((id) => RECALL_POOL[id].kind)).size === s.length)
  return distinct.length ? distinct : sets
}

/** The seeded rotation: which set this learner (salt) sees in this chapter. */
export function recallSet(chapter: AnyChapterId, salt: string): RecallId[] {
  const sets = recallSets(chapter)
  return sets[seedFor(salt, chapter, 'recall') % sets.length]!
}

export function recallGateOf(ids: readonly string[]): GateLogic {
  return { items: ids.map((id) => RECALL_LOGIC[id]!), fallback: RECALL_FALLBACK }
}

/** The recall scene's gate ('<chapter>/recall'). */
export function recallGate(chapter: AnyChapterId, salt: string): GateLogic {
  return recallGateOf(recallSet(chapter, salt))
}

/** Items a return-visit check may show: set-the-machine items are left to the act recalls. */
export const RETURN_IDS: readonly RecallId[] = RECALL_IDS.filter((id) => RECALL_POOL[id].kind !== 'set-machine')

/**
 * The return-visit check's two items (§4.2): one from the act seen least recently (by recall lastSeen; acts
 * never seen count as oldest) and one from another eligible act. With a single eligible act, two of its items.
 */
export function returnCheckItems(
  acts: readonly RecallAct[],
  recall: Readonly<Record<string, { readonly lastSeen: number }>>,
  seed: number,
): RecallId[] {
  const eligible = ACT_ORDER.filter((a) => acts.includes(a))
  if (eligible.length === 0) return []
  const r = createRng(seed)
  const seen = (act: RecallAct) =>
    Math.max(0, ...RETURN_IDS.filter((id) => RECALL_ACT[id] === act).map((id) => recall[id]?.lastSeen ?? 0))
  const oldest = [...eligible].sort((a, b) => seen(a) - seen(b) || ACT_ORDER.indexOf(a) - ACT_ORDER.indexOf(b))[0]!
  const from = (act: RecallAct) => RETURN_IDS.filter((id) => RECALL_ACT[id] === act)
  const first = pick(r, from(oldest))
  const others = eligible.filter((a) => a !== oldest)
  const second = others.length
    ? pick(r, from(pick(r, others)))
    : pick(
        r,
        from(oldest).filter((id) => id !== first),
      )
  return [first, second]
}

/** Every pair the return-visit rotation can produce (for the guess-bot bound). */
export function returnCheckPairs(): [RecallId, RecallId][] {
  const pairs: [RecallId, RecallId][] = []
  for (const a of RETURN_IDS) {
    for (const b of RETURN_IDS) {
      if (a !== b) pairs.push([a, b])
    }
  }
  return pairs
}

/** The recall gates of every chapter plan, keyed '<chapter>:<n>' (validate, lint and the guess bot). */
export function allRecallGates(): ChapterGates {
  const out: Record<string, GateLogic> = {}
  for (const chapter of ['ii5-indicators', 'iii9-cribs', 'iv-capstone', 'lab-fixture'] as const) {
    recallSets(chapter).forEach((ids, n) => (out[`${chapter}:${n}`] = recallGateOf(ids)))
  }
  return out
}

/** The inverse of a scrambler table string (prompts show both directions). */
export function tableInverse(table: string): string {
  return inverse(table.split('').map(idx)).map(L).join('')
}
