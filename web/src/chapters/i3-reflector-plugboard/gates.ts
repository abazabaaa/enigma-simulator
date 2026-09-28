/**
 * Chapter i3-reflector-plugboard · gate `reflector` (PLAN §4.4). PURE (L4): engine, lib/rng, lib/toy, contracts and
 * lesson/kinds only.
 *  - plug-to-hit      set-machine · 2/3 · at most 2 cables so that key K lights T, K keeping its socket empty (so the
 *                     way-out crossing of the plugboard is always needed); the unplugged scrambler E₀ is shown
 *  - why-no-self      choice(4) · once · constant answer, varied wording · the reflector pairs its contacts
 *  - compose-inverse  code · 2/3 · compose(p, q) and inverse(p), paired with a typed prediction that varies per instance
 *  - hands-on         the in-page fallback, adapted to the item that triggered it: plug-one (one cable), compose(p, q)
 *                     built cell by cell, or a toy reflector with self-wired contacts
 * The scene Views import the machines and helpers below, so the scenes, the prompts and the gate agree.
 */

import type { Choice, Letter, MachineConfig, MachineConfigInput } from '../../contracts/core'
import type { CodeCase } from '../../contracts/code'
import type { ChapterGates, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { LockKey, MachineLocks, ToySpec } from '../../contracts/machine'
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
import { toyPress } from '../../lib/toy'
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

/**
 * Every key at the positions [from, to): the machine's whole substitution at each position (machinePermutation, the
 * same signal as encodeLetter without the trace), counting the keys that light themselves. Always 0.
 */
export function selfHitsAllKeys(config: MachineConfigInput, from: number, to: number): { tried: number; hits: number } {
  const base = createMachine(config)
  let hits = 0
  for (let n = from; n < to; n++) {
    const e = machinePermutation(withPositions(base, positionAt(n)))
    for (let x = 0; x < 26; x++) if (e[x] === x) hits++
  }
  return { tried: 26 * Math.max(0, to - from), hits }
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
 * K keeps its socket empty (every instance), so K enters E₀ as itself and leaves as E₀(K): only the plugboard's second
 * crossing, on the way out, can turn that letter into T, with the cable E₀(K)–T. (E₀(K) ≠ T by construction and
 * E₀(K) ≠ K since E₀ has no fixed points, so it is a real pair that avoids K.) A learner who thinks the current
 * crosses the plugboard only on the way in, or who joins K to T, can never light T.
 */
export const wayOutCable = (i: Pick<PlugInstance, 'setup' | 'k' | 't'>): string => L(scrambler(i.setup.machine)[idx(i.k)]!) + i.t

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
      const onKey = cfg.plugboard.find((c) => c.includes(i.k))
      if (onKey) {
        return {
          field: 'plugboard',
          message: `Key ${i.k} must keep its socket empty, but the cable ${onKey} is plugged into it.`,
          highlight: ['plugboard'],
        }
      }
      const lamp = lampFor(cfg, i.k)
      if (lamp === i.t) return true
      const cables = cfg.plugboard.length ? `With the cables ${cfg.plugboard.join(' ')}` : 'With no cables'
      return {
        field: 'plugboard',
        message: `${cables}, ${i.k} lights ${lamp}, not ${i.t}.`,
        highlight: ['plugboard'],
      }
    },
    solve: (i) => ({ ...i.setup.machine, plugboard: [wayOutCable(i)] }),
    sampleAnswer(i, r) {
      const n = int(r, i.maxPlugs + 1)
      const letters = sample(r, LETTERS, 2 * n)
      return { ...i.setup.machine, plugboard: Array.from({ length: n }, (_, j) => letters[2 * j]! + letters[2 * j + 1]!) }
    },
    // The cable to T moved one letter on (never onto K): then E₀(K) reaches the lamps unchanged, never T.
    mutate(i, a) {
      const cable = a.plugboard.find((c) => c.includes(i.t)) ?? wayOutCable(i)
      const other = cable[0] === i.t ? cable[1]! : cable[0]!
      let next = (idx(other) + 1) % 26
      while (L(next) === i.k || L(next) === i.t) next = (next + 1) % 26
      return { ...a, plugboard: [L(next) + i.t] }
    },
    highlight: () => [{ part: 'plugboard', tone: 'hint' }],
  })
}

export const plugToHit = plugItem('plug-to-hit', 2)
export const plugOne = plugItem('plug-one', 1)

// ---------------------------------------------------------------------------
// why-no-self: choice(4), once, constant answer, varied per instance (rollback: none)
// ---------------------------------------------------------------------------

/** Three wordings of the one right explanation (its id is always 'reflector'). */
const SELF_RIGHT: readonly string[] = [
  'The reflector joins its contacts in pairs, so the current always comes back on a different wire from the one it went in on',
  'Each reflector wire joins two different contacts, so the current can never return on the wire it arrived on',
  'No reflector contact is wired to itself, so the way back always ends on another letter',
]

/**
 * The distractors. Every instance shows 'plugboard' (PLAN §4.4's distractor) and 'reflector-shift' (so the right option
 * is not the only one that names the reflector), plus one of the others.
 */
export const SELF_DISTRACTORS: readonly Choice[] = [
  { id: 'plugboard', label: 'The plugboard prevents it: every letter is swapped for another one', misconception: true },
  {
    id: 'reflector-shift',
    label: 'The reflector moves every letter one place on in the alphabet, so it can never come back unchanged',
    misconception: true,
  },
  { id: 'stepping', label: 'The rotors step before every letter, so a letter never meets the same wiring twice', misconception: true },
  { id: 'rare', label: 'It does happen, but only about once in 26 letters', misconception: true },
  { id: 'rings', label: 'The ring settings shift every letter away from itself', misconception: true },
  { id: 'entry', label: 'The entry wheel sends every letter to a different contact', misconception: true },
]

/** Why each distractor is wrong, never naming the right option (the next instance asks again). */
const SELF_FEEDBACK: Readonly<Record<string, string>> = {
  plugboard:
    'Most letters have no cable at all and pass the plugboard unchanged, and an unplugged letter never lights itself either: ' +
    'the plugboard is not the reason.',
  stepping:
    'The search tried key A at each position without stepping in between, and it still never lit A: stepping is not the reason.',
  'reflector-shift':
    "Look at the reflector's table in the first scene: A goes to Y and B goes to R, not one place on. A shift is not what " +
    'it does.',
  rare: 'The search tried every key at all 17,576 positions and not one lit itself: it never happens.',
  rings: 'With every ring at 01 no letter lights itself either: the ring settings are not the reason.',
  entry: 'The entry wheel of this machine leaves every letter where it is (A to A, B to B): it is not the reason.',
}

export interface SelfInstance {
  readonly options: readonly Choice[]
  /** A press to anchor the question: at these windows this key lights this lamp. */
  readonly windows: string
  readonly key: Letter
  readonly lamp: Letter
}

export const whyNoSelf = choiceItem<SelfInstance>({
  id: 'why-no-self',
  rule: ONCE,
  constantAnswer: true,
  generate(r) {
    const windows = sample(r, LETTERS, 3).join('')
    const key = randLetter(r)
    const lamp = lampFor({ ...SEARCH_START, positions: windows }, key)
    const right: Choice = { id: 'reflector', label: pick(r, SELF_RIGHT) }
    const always = SELF_DISTRACTORS.filter((d) => d.id === 'plugboard' || d.id === 'reflector-shift')
    const other = pick(r, SELF_DISTRACTORS.filter((d) => !always.includes(d)))
    return { options: shuffle(r, [right, ...always, other]), windows, key, lamp }
  },
  same: (a, b) => sameJson(a, b),
  solve: () => 'reflector',
  check: (_i, a) =>
    verdict(a === 'reflector', { kind: 'none' }, SELF_FEEDBACK[String(a)] ?? 'That is not the reason: look again at what happens on the way back.'),
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
// hands-on: the in-page fallback, testing the skill of the item that triggered it (its outcome counts there)
//  - after plug-to-hit:      plug-one, the same task with a single cable (set-machine semantics)
//  - after compose-inverse:  build compose(p, q) on A–F cell by cell (rollback: perm)
//  - after why-no-self:      a toy whose reflector has two contacts wired to themselves: turn the rotor so that a
//                            key lights itself (it can only through such a contact; rollback: machine)
// ---------------------------------------------------------------------------

/** The toy stage with the canvas keys disabled: no trial presses. */
export const TOY_STAGE: StageRef = { preset: 'toy', with: { interactive: false } }

export interface ComposeBuildInstance {
  readonly variant: 'compose'
  readonly p: string
  readonly q: string
}

export interface SelfToyInstance {
  readonly variant: 'self'
  /** One rotor, held; the reflector has two contacts wired to themselves. */
  readonly spec: ToySpec
  readonly key: Letter
}

export type HandsOnInstance = ({ readonly variant: 'plug' } & PlugInstance) | ComposeBuildInstance | SelfToyInstance
export type HandsOnAnswer = MachineConfig | string | number

/** The contacts of a toy reflector that are wired to themselves. */
export const selfWired = (spec: Pick<ToySpec, 'reflector'>): number[] => spec.reflector.flatMap((v, i) => (v === i ? [i] : []))

/** The lamp `key` lights with the toy's rotor at window `p`. */
export const toyLamp = (i: Pick<SelfToyInstance, 'spec' | 'key'>, p: number): Letter =>
  toyPress({ ...i.spec, positions: [((p % 6) + 6) % 6] }, i.key).lamp

/** The windows at which the key lights itself: where the rotor carries it onto a self-wired reflector contact. */
export const selfPositions = (i: Pick<SelfToyInstance, 'spec' | 'key'>): number[] =>
  [0, 1, 2, 3, 4, 5].filter((p) => toyLamp(i, p) === i.key)

function selfToy(r: Rng): SelfToyInstance {
  for (;;) {
    const order = shuffle(r, [0, 1, 2, 3, 4, 5])
    const reflector = [0, 1, 2, 3, 4, 5]
    for (const [a, b] of [
      [order[0]!, order[1]!],
      [order[2]!, order[3]!],
    ] as const) {
      reflector[a] = b
      reflector[b] = a
    }
    const spec: ToySpec = {
      n: 6,
      rotors: [randomPerm(r, 6)],
      notches: [0],
      reflector,
      plugs: [0, 1, 2, 3, 4, 5],
      positions: [0],
      stepping: false,
    }
    const i: SelfToyInstance = { variant: 'self', spec, key: randLetter(r, 6) }
    // Exactly one window works: a guess is right one time in six.
    if (selfPositions(i).length === 1) return i
  }
}

const composeBuilt = (i: Pick<ComposeBuildInstance, 'p' | 'q'>): string => lettersOf(compose(permOf(i.p), permOf(i.q)))

export const handsOn: ItemLogic<HandsOnInstance, HandsOnAnswer> = {
  id: 'hands-on',
  kind: 'custom',
  rule: WINDOW,
  compute: true,
  inPage: true,
  generate(r, ctx) {
    const from = ctx.key.split('/').at(-1)
    const variant = from === 'plug-to-hit' ? 0 : from === 'compose-inverse' ? 1 : from === 'why-no-self' ? 2 : int(r, 3)
    if (variant === 0) return { variant: 'plug', ...plugOne.generate(r, ctx) }
    if (variant === 1) return { variant: 'compose', ...probePerms(r) }
    return selfToy(r)
  },
  same: (a, b) => sameJson(a, b),
  check(i, a) {
    if (i.variant === 'plug') return plugOne.check(i, a as MachineConfig)
    if (i.variant === 'compose') {
      const want = composeBuilt(i)
      const got = String(a ?? '').toUpperCase()
      const wrongCells = [...want].flatMap((w, k) => (got[k] === w ? [] : [k]))
      return verdict(wrongCells.length === 0, { kind: 'perm', wrongCells }, 'Look each letter up in p first, then look the result up in q.')
    }
    const p = Number(a)
    if (!Number.isInteger(p) || p < 0 || p > 5) {
      return verdict(false, { kind: 'machine', field: 'positions', message: 'Turn the rotor to a window A–F.', highlight: ['rotor-right'] })
    }
    const lamp = toyLamp(i, p)
    return verdict(lamp === i.key, {
      kind: 'machine',
      field: 'positions',
      message: `At window ${L(p)}, key ${i.key} lights ${lamp}, not ${i.key}.`,
      highlight: ['reflector'],
    })
  },
  solve(i) {
    if (i.variant === 'plug') return plugOne.solve(i)
    if (i.variant === 'compose') return composeBuilt(i)
    return selfPositions(i)[0]!
  },
  sampleAnswer(i, r) {
    if (i.variant === 'plug') return plugOne.sampleAnswer(i, r)
    if (i.variant === 'compose') return lettersOf(randomPerm(r, 6))
    return int(r, 6)
  },
  mutate(i, a, r) {
    if (i.variant === 'plug') return plugOne.mutate(i, a as MachineConfig, r)
    if (i.variant === 'compose') {
      const s = String(a)
      return s[1]! + s[0]! + s.slice(2)
    }
    return (Number(a) + 1) % 6
  },
  setup(i) {
    if (i.variant === 'plug') return plugOne.setup!(i)
    if (i.variant === 'compose') return { locks: READ_ONLY, stage: 'reflector' }
    return { toy: i.spec, locks: READ_ONLY, stage: TOY_STAGE }
  },
  highlight: (i) =>
    i.variant === 'plug' ? [{ part: 'plugboard', tone: 'hint' }] : i.variant === 'self' ? [{ part: 'reflector', tone: 'hint' }] : [],
}

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  reflector: {
    items: [plugToHit, whyNoSelf, composeInverse] as ItemLogic[],
    fallback: handsOn as ItemLogic,
  },
}
