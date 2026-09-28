/**
 * The fixture chapter's gates ('lab-fixture', #/lab/fixture). PURE (L4): one item of every generic kind in
 * gate `main` (letter, letters, numbers, choice, order, chain, set-machine, ghost-pick, code, custom), with
 * an in-page set-machine fallback, plus a puzzle gate. It is the model chapter builders copy.
 */

import type { Choice, Letter, MachineConfig } from '../../contracts/core'
import type { ChapterGates, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { LockKey, MachineLocks, ToySpec } from '../../contracts/machine'
import type { Ghost, PartId, PathHop, StageRef } from '../../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  ROTORS,
  compose,
  createMachine,
  cycles,
  cycleSignature,
  encodeLetter,
  normalizeConfig,
  rotorPermutation,
  step,
  type TraceStep,
} from '../../engine'
import { createRng, int, randLetter, randomConfig, randomInvolution, sample, shuffle } from '../../lib/rng'
import { randomToy, toyPress, toySlots } from '../../lib/toy'
import { rPlugOne, rPlugToHit, rWindows } from '../recall/pool'
import {
  backwardGhost,
  chainItem,
  choiceItem,
  codeItem,
  firstDiff,
  ghostFromOutputs,
  ghostPickItem,
  letterItem,
  lettersItem,
  numbersItem,
  numbersMatch,
  orderItem,
  orderRollback,
  partForStage,
  setMachineItem,
  splitWindows,
  verdict,
  windowsAfterPresses,
  windowsRollback,
} from '../kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[i]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const mod = (x: number, n: number) => ((x % n) + n) % n

/** The toy stage with the canvas keys disabled: no trial presses on a prediction item. */
export const TOY_STAGE: StageRef = { preset: 'toy', with: { interactive: false } }

/** Everything locked (keyboard included) and the lamps hidden. */
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
// Toy helpers (shown in prompts; the tables make every toy item solvable from the screen)
// ---------------------------------------------------------------------------

/** The permutation each hop of a toy press applies, in hop order (plugboard, rotors R→L, reflector, L→R, plugboard). */
export function toyStagePerms(spec: ToySpec): number[][] {
  const { n } = spec
  const rotor = (i: number, dir: 'fwd' | 'bwd') => {
    const o = spec.positions[i]!
    const w = spec.rotors[i]!
    const inv: number[] = []
    w.forEach((v, k) => (inv[v] = k))
    const wiring = dir === 'fwd' ? w : inv
    return Array.from({ length: n }, (_, x) => mod(wiring[mod(x + o, n)]! - o, n))
  }
  const k = spec.rotors.length
  const perms: number[][] = [[...spec.plugs]]
  for (let i = k - 1; i >= 0; i--) perms.push(rotor(i, 'fwd'))
  perms.push([...spec.reflector])
  for (let i = 0; i < k; i++) perms.push(rotor(i, 'bwd'))
  perms.push([...spec.plugs])
  return perms
}

/** A permutation on n letters as a string of its images ('BADC…'). */
export const permString = (p: readonly number[]): string => p.map(L).join('')

export interface ToyLampInstance {
  readonly spec: ToySpec
  readonly key: Letter
}

const toySetup = (spec: ToySpec): ItemSetup => ({ toy: spec, stage: TOY_STAGE })

function heldToy(r: () => number, rotors: 1 | 2): ToySpec {
  return randomToy(r, 6, rotors, { stepping: false })
}

// ---------------------------------------------------------------------------
// letter: the toy lamp (rollback: the learner's lamp traced backwards as a ghost)
// ---------------------------------------------------------------------------

export function toyLampGhost(i: ToyLampInstance, answer: string): Ghost {
  const press = toyPress(i.spec, i.key)
  const wrong = idx(String(answer).toUpperCase())
  if (wrong < 0 || wrong >= i.spec.n) return { hops: press.hops, divergeAt: 0 }
  return backwardGhost(press.hops, toyStagePerms(i.spec), wrong)
}

export const toyLamp = letterItem<ToyLampInstance>({
  id: 'toy-lamp',
  rule: WINDOW,
  alphabet: 6,
  generate: (r) => ({ spec: heldToy(r, 2), key: randLetter(r, 6) }),
  same: (a, b) => a.key === b.key && sameJson(a.spec, b.spec),
  solve: (i) => toyPress(i.spec, i.key).lamp,
  check: (i, a) => verdict(a === toyPress(i.spec, i.key).lamp, { kind: 'path', ghost: toyLampGhost(i, a) }),
  setup: (i) => toySetup(i.spec),
  highlight(i, lastWrong) {
    if (!lastWrong) return [{ part: 'reflector', tone: 'hint' }]
    const g = toyLampGhost(i, lastWrong)
    return [{ part: partForStage(g.hops[g.divergeAt]!.stage), tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------
// letters: the windows after three presses (rollback: windows)
// ---------------------------------------------------------------------------

export interface WindowsInstance {
  readonly length: 9
  readonly config: MachineConfig
}

export const windows = lettersItem<WindowsInstance>({
  id: 'windows',
  rule: WINDOW,
  generate(r) {
    const base = randomConfig(r, { plugs: 0 })
    const turnover = ROTORS[base.rotors[2]!].turnovers[0]!
    const right = L(mod(idx(turnover) - int(r, 3), 26))
    return {
      length: 9,
      config: normalizeConfig({ ...base, positions: [base.positions[0]!, base.positions[1]!, right] }),
    }
  },
  same: (a, b) => sameJson(a.config, b.config),
  solve: (i) => windowsAfterPresses(i.config, 3).join(''),
  check(i, a) {
    const expected = windowsAfterPresses(i.config, 3)
    const got = splitWindows(String(a).toUpperCase(), 3)
    return verdict(got.join('') === expected.join(''), windowsRollback(i.config, expected, got))
  },
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'rotors' }),
  highlight: () => [
    { part: 'notch-right', tone: 'hint' },
    { part: 'pawl-middle', tone: 'hint' },
    { part: 'notch-middle', tone: 'hint' },
  ],
})

// ---------------------------------------------------------------------------
// numbers: cycle lengths of a product (rollback: cycles, with an ITEM_UI Feedback)
// ---------------------------------------------------------------------------

export interface LengthsInstance {
  readonly count: 'any'
  readonly n: number
  readonly a: readonly number[]
  readonly b: readonly number[]
}

export const lengths = numbersItem<LengthsInstance>({
  id: 'lengths',
  rule: WINDOW,
  range: [0, 26],
  multiset: true,
  generate(r) {
    const n = [8, 10][int(r, 2)]!
    return { count: 'any', n, a: randomInvolution(r, n, n / 2), b: randomInvolution(r, n, n / 2) }
  },
  same: (x, y) => sameJson([x.a, x.b], [y.a, y.b]),
  solve: (i) => cycleSignature(compose(i.a, i.b)),
  check(i, got) {
    const perm = compose(i.a, i.b)
    const expected = cycleSignature(perm)
    const counted = Array.isArray(got) ? [...got].sort((x, y) => y - x) : []
    const left = [...counted]
    const missed = cycles(perm).find((c) => {
      const k = left.indexOf(c.length)
      if (k === -1) return true
      left.splice(k, 1)
      return false
    })
    return verdict(numbersMatch(expected, got, { multiset: true }), {
      kind: 'cycles',
      perm,
      cycle: missed ?? cycles(perm)[0]!,
      expected,
      got: counted,
    })
  },
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// choice: once, constant answer (rollback: none, with an explanation)
// ---------------------------------------------------------------------------

export const SELF_OPTIONS: readonly Choice[] = [
  { id: 'no-reflector', label: 'No: the reflector pairs contacts, so the current never returns on its own wire' },
  { id: 'no-plugboard', label: 'No: the plugboard prevents it', misconception: true },
  { id: 'yes-rarely', label: 'Yes, about once in 26 letters', misconception: true },
  { id: 'yes-unplugged', label: 'Yes, but only for unplugged letters', misconception: true },
]

export const selfChoice = choiceItem<{ options: readonly Choice[] }>({
  id: 'self',
  rule: ONCE,
  constantAnswer: true,
  generate: (r) => ({ options: shuffle(r, SELF_OPTIONS) }),
  same: (a, b) => sameJson(a.options, b.options),
  solve: () => 'no-reflector',
  check: (_i, a) =>
    verdict(
      a === 'no-reflector',
      { kind: 'none' },
      a === 'no-plugboard'
        ? 'The plugboard swaps letters in pairs on the way in and out; it cannot stop a letter coming back to itself. The reflector can: it pairs every contact with a different one.'
        : 'The reflector sends the current back along a different wire every time, so no letter can ever encipher to itself.',
    ),
  highlight: () => [{ part: 'reflector', tone: 'hint' }],
})

// ---------------------------------------------------------------------------
// order: once, constant answer (rollback: order)
// ---------------------------------------------------------------------------

export const PRESS_BLOCKS: readonly Choice[] = [
  { id: 'key', label: 'A key closes the circuit' },
  { id: 'rotors-in', label: 'The current crosses the rotors, right to left' },
  { id: 'reflector', label: 'The reflector turns it back' },
  { id: 'rotors-out', label: 'It crosses the rotors again, left to right' },
  { id: 'lamp', label: 'A lamp lights' },
]
const PRESS_ORDER = PRESS_BLOCKS.map((b) => b.id)

export const pressOrder = orderItem<{ blocks: readonly Choice[] }>({
  id: 'press-order',
  rule: ONCE,
  constantAnswer: true,
  generate(r) {
    let blocks = shuffle(r, PRESS_BLOCKS)
    while (
      sameJson(
        blocks.map((b) => b.id),
        PRESS_ORDER,
      )
    )
      blocks = shuffle(r, PRESS_BLOCKS)
    return { blocks }
  },
  same: (a, b) => sameJson(a.blocks, b.blocks),
  solve: () => [...PRESS_ORDER],
  check: (_i, a) => verdict(sameJson(a, PRESS_ORDER), orderRollback(PRESS_ORDER, Array.isArray(a) ? a : [])),
  highlight: () => [],
})

// ---------------------------------------------------------------------------
// chain: the letter after each stage of a toy press (rollback: path)
// ---------------------------------------------------------------------------

export interface ChainInstance {
  readonly alphabet: 6
  readonly spec: ToySpec
  readonly key: Letter
  readonly stages: readonly { id: string; label: string }[]
}

const chainHops = (i: ChainInstance): PathHop[] => toyPress(i.spec, i.key).hops.filter((h) => h.kind !== 'plugboard')

export const toyChain = chainItem<ChainInstance>({
  id: 'toy-chain',
  rule: WINDOW,
  generate(r) {
    const spec = heldToy(r, 2)
    const key = randLetter(r, 6)
    const stages = toyPress(spec, key)
      .hops.filter((h) => h.kind !== 'plugboard')
      .map((h) => ({ id: h.stage, label: h.stage.replace(/-/g, ' ') }))
    return { alphabet: 6, spec, key, stages }
  },
  same: (a, b) => a.key === b.key && sameJson(a.spec, b.spec),
  solve: (i) => chainHops(i).map((h) => h.output),
  check(i, a) {
    const ref = chainHops(i)
    const got = Array.isArray(a) ? a.map((t) => String(t).toUpperCase()) : []
    return verdict(
      sameJson(
        got,
        ref.map((h) => h.output),
      ),
      { kind: 'path', ghost: ghostFromOutputs(ref, got) },
    )
  },
  setup: (i) => toySetup(i.spec),
  highlight(i, lastWrong) {
    const ref = chainHops(i)
    const k = lastWrong
      ? firstDiff(
          ref.map((h) => h.output),
          lastWrong,
        )
      : 0
    return [{ part: partForStage(ref[Math.max(0, Math.min(ref.length - 1, k))]!.stage), tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------
// set-machine: the middle (or, as the fallback, the left) rotor steps on the next press (rollback: machine)
// ---------------------------------------------------------------------------

export interface StepsInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked'
  readonly target: 'middle' | 'left'
}

function stepsItem(id: string, target: 'middle' | 'left') {
  return setMachineItem<StepsInstance>({
    id,
    rule: WINDOW,
    generate(r) {
      // A start at which the target does not step yet.
      for (;;) {
        const machine = randomConfig(r, { plugs: [0, 3] })
        const s = step(createMachine(machine))
        if (!s.stepped.middle && !s.stepped.left) {
          return { setup: { machine, stage: 'pawls' }, unlocked: ['positions'], trial: 'locked', target }
        }
      }
    },
    same: (a, b) => sameJson(a.setup.machine, b.setup.machine) && a.target === b.target,
    predicate(i, cfg) {
      const s = step(createMachine(cfg))
      if (s.stepped[i.target]) return true
      const moved = (['left', 'middle', 'right'] as const).filter((slot) => s.stepped[slot]).join(' and ') || 'nothing'
      return {
        field: 'positions',
        message: `On the next press the ${moved} rotor moves, not the ${i.target}.`,
        highlight: i.target === 'middle' ? ['notch-right', 'notch-middle'] : ['notch-middle', 'pawl-left'],
      }
    },
    solve(i) {
      const m = i.setup.machine
      const positions = [...m.positions]
      if (i.target === 'middle') positions[2] = ROTORS[m.rotors[2]!].turnovers[0]! as Letter
      else positions[1] = ROTORS[m.rotors[1]!].turnovers[0]! as Letter
      return { ...m, positions }
    },
    sampleAnswer: (i, r) => ({ ...i.setup.machine, positions: [randLetter(r), randLetter(r), randLetter(r)] }),
    mutate(i, a) {
      const positions = [...a.positions]
      const k = i.target === 'middle' ? 2 : 1
      positions[k] = L(mod(idx(positions[k]!) + 1, 26))
      return { ...a, positions }
    },
    highlight: (i) =>
      i.target === 'middle'
        ? [
            { part: 'notch-right', tone: 'hint' },
            { part: 'notch-middle', tone: 'hint' },
          ]
        : [
            { part: 'notch-middle', tone: 'hint' },
            { part: 'pawl-left', tone: 'hint' },
          ],
  })
}

export const middleSteps = stepsItem('middle-steps', 'middle')
export const leftSteps = stepsItem('left-steps', 'left')

// ---------------------------------------------------------------------------
// ghost-pick: the part where a seeded bug first bends the path (rollback: path)
// ---------------------------------------------------------------------------

export interface GhostInstance {
  readonly options: readonly PartId[]
  /**
   * The faulty path as shown in the question. Its divergeAt is always −1: where the path goes wrong is the
   * answer, so the question never carries it (solve() finds it from the tables; the rollback draws it).
   */
  readonly ghost: Ghost
  readonly config: MachineConfig
  readonly key: Letter
  /** The correct substitution of each hop, in hop order (26 letters each). */
  readonly tables: readonly string[]
}

/** The first hop whose output does not match its table (the seeded fault). */
export function faultyHop(i: GhostInstance): number {
  return i.ghost.hops.findIndex((h, k) => i.tables[k]![h.inputIndex] !== h.output)
}

const PATH_PARTS: readonly PartId[] = ['plugboard', 'etw', 'rotor-right', 'rotor-middle', 'rotor-left', 'reflector']

/** The permutation each engine trace stage applies, at the positions of the press. */
function stagePerm(config: MachineConfig, stepSnap: TraceStep): number[] {
  const identity = LETTERS.map((_, k) => k)
  if (stepSnap.kind === 'plugboard') {
    const p = [...identity]
    for (const pair of config.plugboard) {
      p[idx(pair[0]!)] = idx(pair[1]!)
      p[idx(pair[1]!)] = idx(pair[0]!)
    }
    return p
  }
  if (stepSnap.kind === 'etw') return identity
  if (stepSnap.kind === 'reflector') return [...REFLECTOR_PERMS[config.reflector]]
  const fwd = rotorPermutation(stepSnap.rotor, stepSnap.ring, stepSnap.position)
  if (stepSnap.direction === 'fwd') return [...fwd]
  const inv: number[] = []
  fwd.forEach((v, k) => (inv[v] = k))
  return inv
}

export const whichWrong = ghostPickItem<GhostInstance>({
  id: 'which-wrong',
  rule: WINDOW,
  generate(r) {
    const config = randomConfig(r, { plugs: [2, 6], rings: 'AAA' })
    const key = randLetter(r)
    const state = createMachine(config)
    const trace = encodeLetter(state, key).trace
    const perms = trace.map((t) => stagePerm(config, t))
    const d = int(r, trace.length)
    const hops: PathHop[] = []
    let x = idx(key)
    trace.forEach((t, k) => {
      let out = perms[k]![x]!
      if (k === d) out = mod(out + 1 + int(r, 25), 26)
      hops.push({
        kind: t.kind,
        stage: t.stage,
        input: L(x),
        output: L(out),
        inputIndex: x,
        outputIndex: out,
        ...(t.kind === 'rotor' ? { slotIndex: t.slotIndex, offset: t.offset } : {}),
      })
      x = out
    })
    return { options: PATH_PARTS, ghost: { hops, divergeAt: -1 }, config, key, tables: perms.map(permString) }
  },
  same: (a, b) => a.key === b.key && sameJson(a.ghost, b.ghost),
  solve: (i) => partForStage(i.ghost.hops[faultyHop(i)]!.stage),
  // The divergence is drawn only in the rollback, after the answer.
  check: (i, a) =>
    verdict(a === partForStage(i.ghost.hops[faultyHop(i)]!.stage), {
      kind: 'path',
      ghost: { hops: i.ghost.hops, divergeAt: faultyHop(i) },
    }),
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'wire' }),
  // The last hop that is still right: the fault is after it.
  highlight: (i) => [{ part: partForStage(i.ghost.hops[Math.max(0, faultyHop(i) - 1)]!.stage), tone: 'hint' }],
})

// ---------------------------------------------------------------------------
// code: double(x), paired with the in-page items above (V8)
// ---------------------------------------------------------------------------

export const DOUBLE_REFERENCE = 'function double(x) {\n  return x * 2\n}\n'

export const double = codeItem<{ seed: number }>(
  {
    fnNames: ['double'],
    signature: 'double(x: number): number',
    brief: 'Write double(x), which returns twice its argument. Before you run it, predict what double(21) returns.',
    starter: 'function double(x) {\n  // your code here\n}\n',
    provided: '',
    maxLines: 3,
    reference: DOUBLE_REFERENCE,
    cases(i) {
      const r = createRng(i.seed)
      const xs = [0, 1, -1, 0.5, 1e6, ...Array.from({ length: 20 }, () => int(r, 2001) - 1000)]
      return xs.map((x, k) => ({ label: `#${k + 1} double(${x})`, fn: 'double', args: [x], expect: x * 2 }))
    },
    probe: () => ({ call: 'double(21)', expected: '42' }),
  },
  {
    id: 'double',
    // The probe is the literal double(21): the same answer every time, so a single right answer passes (V9).
    rule: ONCE,
    constantAnswer: true,
    generate: (r) => ({ seed: int(r, 2 ** 31) }),
    same: (a, b) => a.seed === b.seed,
    highlight: () => [],
  },
)

// ---------------------------------------------------------------------------
// custom (constructive, in-page): turn the toy rotor so that a key lights a target
// ---------------------------------------------------------------------------

export interface ToySetInstance {
  readonly spec: ToySpec
  readonly key: Letter
  readonly target: Letter
}

export const toyLampAt = (i: ToySetInstance, p: number): Letter =>
  toyPress({ ...i.spec, positions: [mod(p, i.spec.n)] }, i.key).lamp

export function toySetItem(id: string): ItemLogic<ToySetInstance, number> {
  return {
    id,
    kind: 'custom',
    rule: WINDOW,
    compute: false,
    inPage: true,
    generate(r) {
      for (;;) {
        const spec = { ...heldToy(r, 1), positions: [0] }
        const key = randLetter(r, 6)
        const lamps = Array.from({ length: 6 }, (_, p) => toyPress({ ...spec, positions: [p] }, key).lamp)
        // A target that exactly one position produces: the answer is unique.
        const unique = lamps.filter((l) => lamps.indexOf(l) === lamps.lastIndexOf(l))
        if (unique.length) return { spec, key, target: unique[int(r, unique.length)]! }
      }
    },
    same: (a, b) => a.key === b.key && a.target === b.target && sameJson(a.spec, b.spec),
    solve: (i) => Array.from({ length: 6 }, (_, p) => p).find((p) => toyLampAt(i, p) === i.target)!,
    check(i, p) {
      const pos = Number(p)
      if (!Number.isInteger(pos) || pos < 0 || pos >= i.spec.n) {
        return verdict(false, {
          kind: 'machine',
          field: 'positions',
          message: 'Pick a rotor position.',
          highlight: ['rotor-right'],
        })
      }
      const lamp = toyLampAt(i, pos)
      return verdict(lamp === i.target, {
        kind: 'machine',
        field: 'positions',
        message: `At ${L(pos)}, ${i.key} lights ${lamp}, not ${i.target}.`,
        highlight: ['rotor-right'],
      })
    },
    sampleAnswer: (_i, r) => int(r, 6),
    mutate: (_i, a) => mod(Number(a) + 1, 6),
    setup: (i) => toySetup(i.spec),
    highlight: () => [{ part: 'rotor-right', tone: 'hint' }],
  }
}

export const toySet = toySetItem('toy-set')

// ---------------------------------------------------------------------------
// Puzzle gate: three lamps of a held toy (first hint at attempt 3)
// ---------------------------------------------------------------------------

export interface LampsInstance {
  readonly length: 3
  readonly alphabet: 6
  readonly spec: ToySpec
  readonly keys: readonly Letter[]
}

export const puzzleLamps = lettersItem<LampsInstance>({
  id: 'puzzle-lamps',
  rule: WINDOW,
  generate(r) {
    const spec = heldToy(r, 1)
    return { length: 3, alphabet: 6, spec, keys: sample(r, LETTERS.slice(0, 6), 3) }
  },
  same: (a, b) => sameJson([a.spec, a.keys], [b.spec, b.keys]),
  solve: (i) => i.keys.map((k) => toyPress(i.spec, k).lamp).join(''),
  check(i, a) {
    const expected = i.keys.map((k) => toyPress(i.spec, k).lamp)
    const got = String(a).toUpperCase().split('')
    const k = Math.max(0, firstDiff(expected, got))
    // The first wrong lamp, traced backwards through the toy (as toy-lamp does).
    return verdict(got.join('') === expected.join(''), {
      kind: 'path',
      ghost: toyLampGhost({ spec: i.spec, key: i.keys[k]! }, got[k] ?? ''),
    })
  },
  setup: (i) => toySetup(i.spec),
  highlight: () => [{ part: 'reflector', tone: 'hint' }],
})

export const puzzleSet = toySetItem('puzzle-set')

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  main: {
    items: [
      toyLamp,
      windows,
      lengths,
      selfChoice,
      pressOrder,
      toyChain,
      middleSteps,
      whichWrong,
      double,
      toySet,
    ] as ItemLogic[],
    fallback: leftSteps as ItemLogic,
  },
  puzzle: { items: [puzzleLamps as ItemLogic], fallback: puzzleSet as ItemLogic, puzzle: true },
  // Gate lab only (no scene): a plugboard-only set-machine item, where the locked keyboard comes before the
  // item's own controls (focus test, review round 3), then a windows item.
  plugs: { items: [rPlugToHit, rWindows] as ItemLogic[], fallback: rPlugOne as ItemLogic },
}

/** Toy slot names, re-exported for the fixture's prompts. */
export { toySlots }
