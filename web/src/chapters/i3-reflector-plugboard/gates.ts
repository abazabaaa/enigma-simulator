/**
 * Chapter i3-reflector-plugboard · gate `reflector` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts and
 * lesson/kinds only.
 *  - plug-to-hit      set-machine · 2/3 · at most 2 cables so that key K lights T; the unplugged scrambler E₀ is shown
 *  - why-no-self      choice(4) · once · constant answer · the reflector pairs its contacts
 *  - compose-inverse  code · 2/3 · compose(p, q) and inverse(p), paired with a typed prediction that varies per instance
 *  - plug-one         the fallback: plug-to-hit with one cable
 * The scene Views import the machines and helpers below, so the scenes, the prompts and the gate agree.
 */

import type { Choice, Letter, MachineConfig, MachineConfigInput } from '../../contracts/core'
import type { CodeCase } from '../../contracts/code'
import type { ChapterGates, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { StageRef } from '../../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  compose,
  createMachine,
  encodeLetter,
  fromPairs,
  identity,
  inverse,
  machinePermutation,
  normalizeConfig,
  pressKey,
  step,
  withPositions,
  type ReflectorName,
} from '../../engine'
import { createRng, int, pick, randLetter, randomConfig, randomInvolution, randomPerm, sample, shuffle, type Rng } from '../../lib/rng'
import { choiceItem, codeItem, setMachineItem, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------
// The chapter's machines
// ---------------------------------------------------------------------------

/** Enigma I, UKW-B, rotors I II III, rings 01 01 01, windows AAA, no cables. */
export const START: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

/** Every setting locked; the keyboard stays the learner's. */
export const FIXED: MachineLocks = { model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true }

/** Every control locked, the keyboard included, and the lamps hidden (read-only scenes and prediction items). */
export const READ_ONLY: MachineLocks = { ...FIXED, keyboard: true, lampsHidden: true }

/** The 13 wires of a reflector as letter pairs, alphabetical: ['AY', 'BR', …] for UKW-B. */
export function reflectorPairs(name: ReflectorName = 'B'): string[] {
  const perm = REFLECTOR_PERMS[name]
  const out: string[] = []
  perm.forEach((j, i) => {
    if (i < j) out.push(L(i) + L(j))
  })
  return out
}

/** The pairs of an involution on 26 letters (fixed letters left out), alphabetical. */
export function pairsOf(perm: readonly number[]): string[] {
  const out: string[] = []
  perm.forEach((j, i) => {
    if (i < j) out.push(L(i) + L(j))
  })
  return out
}

/** The key of the plugboard scene's bet and reveal. */
export const DEMO_KEY: Letter = 'A'

/**
 * Two cables for the plugboard scene: pressing A at AAA crosses a cable on the way in (A is plugged) and another
 * one on the way out (the letter reaching the plugboard from the entry wheel is plugged too). Found once from the
 * engine, so the scene's bet truth is the machine's own behaviour.
 */
export const DEMO_CABLES: readonly string[] = (() => {
  const e0 = machinePermutation(step(createMachine(START)).state)
  for (const partner of 'QWERTZUIOPSDFGHJKLXCVBNMY') {
    const back = L(e0[idx(partner)]!)
    if (back === DEMO_KEY || back === partner) continue
    const other = [...'ZYXWVUTSRPONMLKJIHGFEDCB'].find((z) => ![DEMO_KEY, partner, back].includes(z as Letter))!
    return [DEMO_KEY + partner, back + other]
  }
  throw new Error('no demo cables')
})()

/** The plugboard scene: START with the two demo cables. */
export const PLUG_START: MachineConfig = normalizeConfig({ ...START, plugboard: DEMO_CABLES })

/** Letters the demo cables leave free, for more cables in later scenes. */
const FREE = LETTERS.filter((l) => !DEMO_CABLES.join('').includes(l))

/** The reciprocity scene: four cables. */
export const RECIPROCITY_START: MachineConfig = normalizeConfig({
  ...START,
  plugboard: [...DEMO_CABLES, FREE[0]! + FREE[5]!, FREE[2]! + FREE[9]!],
})

/** The self-search scene: three cables and rings 01 05 12; the windows are the learner's. */
export const SEARCH_START: MachineConfig = normalizeConfig({
  ...START,
  rings: 'AEL',
  plugboard: [...DEMO_CABLES, FREE[1]! + FREE[7]!],
})

/** All 26³ rotor positions. */
export const POSITIONS_TOTAL = 17_576

/** The window letters of position number n (0 … 17,575): n = left·676 + middle·26 + right. */
export const positionAt = (n: number): [number, number, number] => [Math.floor(n / 676) % 26, Math.floor(n / 26) % 26, n % 26]

/**
 * How many of the positions [from, to) encipher `key` to itself (encodeLetter at each position, no stepping),
 * with the rotors, rings, reflector and cables of `config`. Always 0 for a real Enigma.
 */
export function selfHits(config: MachineConfigInput, from: number, to: number, key: Letter = 'A'): number {
  const base = createMachine(config)
  let hits = 0
  for (let n = from; n < to; n++) {
    if (encodeLetter(withPositions(base, positionAt(n)), key).output === key) hits++
  }
  return hits
}

// ---------------------------------------------------------------------------
// plug-to-hit and plug-one: set-machine, at most 2 (or 1) cables so that K lights T (rollback: machine)
// ---------------------------------------------------------------------------

export interface PlugInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked'
  readonly maxPlugs: number
  /** Press this key … */
  readonly k: Letter
  /** … so that this lamp lights. */
  readonly t: Letter
}

/**
 * E₀: the scrambler without cables for the NEXT key press (the rotors step first), as images: E₀[x] is the lamp
 * key x would light with no cables. An involution without fixed points.
 */
export function scrambler(machine: MachineConfigInput): number[] {
  return [...machinePermutation(step(createMachine({ ...machine, plugboard: [] })).state)]
}

/** The lamp `key` lights on the next press of `cfg` (cables included). */
export const lampFor = (cfg: MachineConfigInput, key: Letter): Letter => pressKey(createMachine(cfg), key).output

/**
 * One cable always suffices: K joined to E₀(T) enters the scrambler as E₀(T), which the scrambler (an involution)
 * sends to T; T is not plugged, so T lights. (E₀(T) ≠ K because E₀(K) ≠ T, and E₀(T) ≠ T because E₀ has no fixed
 * points.)
 */
export const oneCable = (i: Pick<PlugInstance, 'setup' | 'k' | 't'>): string => i.k + L(scrambler(i.setup.machine)[idx(i.t)]!)

function plugItem(id: string, maxPlugs: number): ItemLogic<PlugInstance, MachineConfig> {
  return setMachineItem<PlugInstance>({
    id,
    rule: WINDOW,
    generate(r) {
      const machine = randomConfig(r, { plugs: 0, rings: 'random' })
      const e0 = scrambler(machine)
      const k = randLetter(r)
      const t = pick(
        r,
        LETTERS.filter((x) => x !== k && x !== L(e0[idx(k)]!)),
      )
      return { setup: { machine, stage: 'plugboard' }, unlocked: ['plugboard'], trial: 'locked', maxPlugs, k, t }
    },
    same: (a, b) => a.k === b.k && a.t === b.t && sameJson(a.setup.machine, b.setup.machine),
    predicate(i, cfg) {
      const lamp = lampFor(cfg, i.k)
      if (lamp === i.t) return true
      const cables = cfg.plugboard.length ? `With the cables ${cfg.plugboard.join(' ')}` : 'With no cables'
      return {
        field: 'plugboard',
        message: `${cables}, ${i.k} lights ${lamp}, not ${i.t}.`,
        highlight: ['plugboard'],
      }
    },
    solve: (i) => ({ ...i.setup.machine, plugboard: [oneCable(i)] }),
    sampleAnswer(i, r) {
      const n = int(r, i.maxPlugs + 1)
      const letters = sample(r, LETTERS, 2 * n)
      return { ...i.setup.machine, plugboard: Array.from({ length: n }, (_, j) => letters[2 * j]! + letters[2 * j + 1]!) }
    },
    // The cable from K moved one letter on: never right (only K–E₀(T) or T–E₀(K) work with one cable).
    mutate(i, a) {
      const cable = a.plugboard[0] ?? oneCable(i)
      const other = cable[0] === i.k ? cable[1]! : cable[0]!
      let next = (idx(other) + 1) % 26
      while (L(next) === i.k) next = (next + 1) % 26
      return { ...a, plugboard: [i.k + L(next)] }
    },
    highlight: () => [{ part: 'plugboard', tone: 'hint' }],
  })
}

export const plugToHit = plugItem('plug-to-hit', 2)
export const plugOne = plugItem('plug-one', 1)

// ---------------------------------------------------------------------------
// why-no-self: choice(4), once, constant answer (rollback: none, with an explanation)
// ---------------------------------------------------------------------------

export const SELF_OPTIONS: readonly Choice[] = [
  {
    id: 'reflector',
    label: 'The reflector joins its contacts in pairs, so the current always comes back on a different wire from the one it went in on',
  },
  { id: 'plugboard', label: 'The plugboard prevents it: every letter is swapped for another one', misconception: true },
  {
    id: 'stepping',
    label: 'The rotors step before every letter, so a letter never meets the same wiring twice',
    misconception: true,
  },
  { id: 'rare', label: 'It does happen, but only about once in 26 letters', misconception: true },
]

const SELF_FEEDBACK: Readonly<Record<string, string>> = {
  plugboard:
    'The plugboard cannot be the reason: most letters have no cable at all, and an unplugged letter passes straight through. ' +
    'The reflector is: it joins every contact to a different one, so the current never returns on its own wire.',
  stepping:
    'Stepping changes the wiring from one letter to the next, but at any one position the current still goes in and comes back out. ' +
    'It comes back on a different wire because the reflector pairs every contact with another one.',
  rare:
    'The search found no letter that lit itself in all 17,576 positions. It never happens: the reflector pairs every contact with a ' +
    'different one, so the way back is always a different wire.',
}

export const whyNoSelf = choiceItem<{ options: readonly Choice[] }>({
  id: 'why-no-self',
  rule: ONCE,
  constantAnswer: true,
  generate: (r) => ({ options: shuffle(r, SELF_OPTIONS) }),
  same: (a, b) => sameJson(a.options, b.options),
  solve: () => 'reflector',
  check: (_i, a) =>
    verdict(
      a === 'reflector',
      { kind: 'none' },
      SELF_FEEDBACK[String(a)] ?? 'The reflector pairs every contact with a different one, so no letter comes back as itself.',
    ),
  // The reflector on the stage (its hint highlights it); nothing to press.
  setup: () => ({ locks: READ_ONLY, stage: 'reflector' }),
  highlight: () => [{ part: 'reflector', tone: 'hint' }],
})

// ---------------------------------------------------------------------------
// compose-inverse: code, paired with the in-page plug-to-hit (V8); the prediction varies with p and q
// ---------------------------------------------------------------------------

export interface ComposeInstance {
  readonly seed: number
  /** The prediction's permutations of A–F, as the letters A…F go to (e.g. 'CAEBFD'). */
  readonly p: string
  readonly q: string
}

/** The letter the prediction asks about: D. */
export const PROBE_LETTER = 3

const permOf = (s: string): number[] => [...s].map(idx)
const lettersOf = (p: readonly number[]): string => p.map(L).join('')

/** Where compose(p, q) sends D (p first, then q). */
export const composeProbe = (i: Pick<ComposeInstance, 'p' | 'q'>): Letter => {
  const p = permOf(i.p)
  const q = permOf(i.q)
  return L(q[p[PROBE_LETTER]!]!)
}

/**
 * Random p and q on A–F where the order of composition matters for D: q after p, p after q, p alone and q alone all
 * send D somewhere different, so the prediction separates "p first" from its misreadings.
 */
function probePerms(r: Rng): { p: string; q: string } {
  for (;;) {
    const p = randomPerm(r, 6)
    const q = randomPerm(r, 6)
    const d = PROBE_LETTER
    const right = q[p[d]!]!
    const wrong = new Set([p[q[d]!]!, p[d]!, q[d]!, d])
    if (!wrong.has(right)) return { p: lettersOf(p), q: lettersOf(q) }
  }
}

export const COMPOSE_REFERENCE = [
  'function compose(p, q) {',
  '  return p.map((x) => q[x])',
  '}',
  '',
  'function inverse(p) {',
  '  const out = []',
  '  for (let i = 0; i < p.length; i++) out[p[i]] = i',
  '  return out',
  '}',
  '',
].join('\n')

const composeCase = (label: string, p: readonly number[], q: readonly number[]): CodeCase => ({
  label,
  fn: 'compose',
  args: [[...p], [...q]],
  expect: [...compose(p, q)],
})
const inverseCase = (label: string, p: readonly number[]): CodeCase => ({ label, fn: 'inverse', args: [[...p]], expect: [...inverse(p)] })

/**
 * ≥ 50 cases from the instance's seed: three small visible ones; the identity; 10 random compose and 10 random
 * inverse cases at n = 6 and at n = 26; compose(inverse(p), p) and compose(p, inverse(p)) = identity; the reflectors
 * B and C as involutions (their own inverse, squaring to the identity); random fixed-point-free involutions and a
 * plugboard with fixed letters; and the prediction's own p and q.
 */
export function composeCases(i: ComposeInstance): CodeCase[] {
  const r = createRng(i.seed)
  const cases: CodeCase[] = [
    composeCase('p first, then q', [1, 2, 0], [0, 2, 1]),
    inverseCase('inverse of a 3-cycle', [1, 2, 0]),
    composeCase('p, then its inverse', [1, 2, 0], [2, 0, 1]),
  ]
  const p6 = randomPerm(r, 6)
  cases.push(composeCase('identity first', identity(6), p6), composeCase('identity last', p6, identity(6)))
  cases.push(inverseCase('inverse of the identity', identity(26)))
  for (const n of [6, 26]) {
    for (let k = 0; k < 10; k++) cases.push(composeCase(`random compose #${k + 1} on ${n} letters`, randomPerm(r, n), randomPerm(r, n)))
    for (let k = 0; k < 10; k++) cases.push(inverseCase(`random inverse #${k + 1} on ${n} letters`, randomPerm(r, n)))
    const p = randomPerm(r, n)
    cases.push(composeCase(`compose(inverse(p), p) on ${n} letters`, inverse(p), p))
    cases.push(composeCase(`compose(p, inverse(p)) on ${n} letters`, p, inverse(p)))
  }
  for (const name of ['B', 'C'] as const) {
    const u = REFLECTOR_PERMS[name]
    cases.push(inverseCase(`reflector ${name} is its own inverse`, u), composeCase(`reflector ${name} twice`, u, u))
  }
  for (let k = 0; k < 3; k++) {
    const v = randomInvolution(r, 26, 13)
    const w = randomInvolution(r, 26, 13)
    cases.push(inverseCase(`fixed-point-free involution #${k + 1}`, v), composeCase(`two fixed-point-free involutions #${k + 1}`, v, w))
  }
  cases.push(inverseCase('a plugboard with 6 unplugged letters', fromPairs(sample(r, LETTERS, 20).join('').match(/../g)!)))
  cases.push(composeCase('the prediction’s p and q', permOf(i.p), permOf(i.q)))
  return cases
}

export const composeInverse = codeItem<ComposeInstance>(
  {
    fnNames: ['compose', 'inverse'],
    signature: 'compose(p: number[], q: number[]): number[] · inverse(p: number[]): number[]',
    brief:
      'A permutation of n letters is an array of images: p[i] is the letter p sends letter i to (A = 0, B = 1, …). ' +
      'Write compose(p, q), the permutation that applies p first and then q (Rejewski wrote products left to right), ' +
      'and inverse(p), the permutation that undoes p. The hidden tests include the reflector, which is its own inverse.',
    starter: 'function compose(p, q) {\n  // p first, then q\n}\n\nfunction inverse(p) {\n  // undo p\n}\n',
    provided: '',
    maxLines: 8,
    reference: COMPOSE_REFERENCE,
    cases: composeCases,
    probe: (i) => ({ call: 'compose(p, q)(D)', expected: composeProbe(i) }),
  },
  {
    id: 'compose-inverse',
    rule: WINDOW,
    generate: (r) => ({ seed: int(r, 2 ** 31), ...probePerms(r) }),
    same: (a, b) => a.seed === b.seed || (a.p === b.p && a.q === b.q),
    setup: () => ({ locks: READ_ONLY, stage: 'reflector' }),
    highlight: () => [],
  },
)

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  reflector: {
    items: [plugToHit, whyNoSelf, composeInverse] as ItemLogic[],
    fallback: plugOne as ItemLogic,
  },
}
