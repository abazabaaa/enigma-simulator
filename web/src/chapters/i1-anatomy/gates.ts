/**
 * Chapter i1-anatomy · gate `anatomy` (PLAN §4.4). PURE (L4): engine, lib/rng, lib/toy, contracts and lesson/kinds.
 * Disclosure (G14): the rotors are held (no stepping), rings 01, no plugboard cables. No generator uses plugs,
 * rings other than AAA, or stepping.
 *  - toy-lamp      letter(6) · 2/3 · a held two-rotor toy on A–F and a key, every table shown → the lamp.
 *                  Rollback: the reference path in gold and, in red, the path that leaves it at the hop where a
 *                  single slip (a skipped part, a table read the wrong way, the neighbouring column) explains the
 *                  learner's lamp; the rest of the red path follows the true wiring to that lamp.
 *  - hop-chain     chain(11) · 2/3 · three rotors from I–V, rings AAA, random windows, no cables, held; the
 *                  strips at their offsets → the letter after each of the 11 stages.
 *  - path-order    order(11) · once · constant answer · the stages of a key press, by component.
 *  - path-order-m4 order(13) · once · transfer · the same on the navy's M4 (Greek rotor, thin reflector).
 *  - toy-set       the fallback: custom, in-page · turn a held two-rotor toy's rotors so that C lights E.
 * The scene Views import the machines and helpers below, so the scenes and the gate agree.
 */

import type { Choice, Letter, MachineConfig, TraceStage } from '../../contracts/core'
import type { ChapterGates, CheckResult, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { MachineLocks, ToySpec } from '../../contracts/machine'
import type { Ghost, Highlight, PartId, PathHop, StageRef } from '../../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  createMachine,
  encodeLetter,
  normalizeConfig,
  rotorPermutation,
  type RotorName,
} from '../../engine'
import { int, randLetter, sample, shuffle, type Rng } from '../../lib/rng'
import { randomToy, toyPress, toySlots } from '../../lib/toy'
import {
  chainItem,
  firstDiff,
  ghostFromOutputs,
  letterItem,
  orderItem,
  partForStage,
  verdict,
} from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[i]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const mod = (x: number, n: number) => ((x % n) + n) % n
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const invert = (p: readonly number[]): number[] => {
  const q: number[] = []
  p.forEach((v, i) => (q[v] = i))
  return q
}
const isIdentity = (p: readonly number[]) => p.every((v, i) => v === i)

// ---------------------------------------------------------------------------
// Locks and stages
// ---------------------------------------------------------------------------

/** The machine fixed and held (rotors never step); the keyboard is the learner's. */
export const HELD: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: true,
  plugboard: true,
  hold: true,
}

/** Prediction items and the gate scene: every control locked, the keyboard too, and the lamps hidden. */
export const READ_ONLY: MachineLocks = { ...HELD, keyboard: true, lampsHidden: true }

/** The toy stage with its keys disabled (no trial presses on a prediction). */
export const TOY_STAGE: StageRef = { preset: 'toy', with: { interactive: false } }

/** The 26-letter wiring stage (plugboard hidden: I.1 has no cables) with its keys disabled. */
export const WIRE_STAGE: StageRef = { preset: 'wire-noplug', with: { interactive: false } }

// ---------------------------------------------------------------------------
// The chapter's machines
// ---------------------------------------------------------------------------

/** toy-wire: six letters, one rotor and a reflector (A–F, F–A… pairs), held. C lights B. */
export const TOY_ONE: ToySpec = {
  n: 6,
  rotors: [[3, 5, 0, 4, 1, 2]],
  notches: [0],
  reflector: [5, 3, 4, 1, 2, 0],
  plugs: [0, 1, 2, 3, 4, 5],
  positions: [0],
  stepping: false,
}

/** toy-trace and the gate scene: two rotors (middle, right) and a reflector, held. A goes A F E | B A D. */
export const TOY_TWO: ToySpec = {
  n: 6,
  rotors: [
    [1, 5, 3, 0, 2, 4],
    [5, 4, 1, 0, 2, 3],
  ],
  notches: [0, 0],
  reflector: [2, 4, 0, 5, 1, 3],
  plugs: [0, 1, 2, 3, 4, 5],
  positions: [0, 0],
  stepping: false,
}

/** The key of toy-wire's bet and reveal. */
export const TOY_WIRE_KEY: Letter = 'C'
/** The key of toy-trace's bet and reveal. */
export const TOY_TRACE_KEY: Letter = 'A'

/** worked-chain and path-26: Enigma I, UKW-B, rotors I II III, rings 01 01 01, windows SUN, no cables (held). */
export const MACHINE: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'SUN',
  plugboard: [],
})

/** The key the worked chain follows. */
export const CHAIN_KEY: Letter = 'K'
/** The key of path-26's bet and reveal. */
export const PATH_KEY: Letter = 'Q'

/** The gate scene's machine (each item sets its own). */
export const GATE_MACHINE: MachineConfig = normalizeConfig({ ...MACHINE, positions: 'AAA' })

/** The trace of `key` on a held machine (no stepping). */
export const traceOf = (config: MachineConfig, key: Letter) => encodeLetter(createMachine(config), key).trace

/** The index of the reflector hop in a press's hops. */
export const reflectorHop = (hops: readonly PathHop[]): number => hops.findIndex((h) => h.kind === 'reflector')

/**
 * The scenes' truths, constant and computed once from lib/toy and the engine at each scene's fixed setup, so the
 * bets, the scenes' explanations and the tests agree (a revisit may fire a reveal again).
 */
export const TOY_WIRE_PRESS = toyPress(TOY_ONE, TOY_WIRE_KEY)
export const TOY_TRACE_PRESS = toyPress(TOY_TWO, TOY_TRACE_KEY)
/** toy-trace's bet: the letter that enters the reflector. */
export const TOY_TRACE_REFLECTOR = TOY_TRACE_PRESS.hops[reflectorHop(TOY_TRACE_PRESS.hops)]!
/** worked-chain: K through the held machine, 11 hops. */
export const CHAIN = traceOf(MACHINE, CHAIN_KEY)
/** path-26's bet: the lamp of Q. */
export const PATH_TRACE = traceOf(MACHINE, PATH_KEY)
export const PATH_LAMP: Letter = PATH_TRACE.at(-1)!.output
/** Hops at which the letter actually changes (with no cables the plugboard and entry wheel pass it through). */
export const changesOf = (hops: readonly PathHop[]): number => hops.filter((h) => h.input !== h.output).length

// ---------------------------------------------------------------------------
// Toy helpers (shown in prompts and scenes)
// ---------------------------------------------------------------------------

/**
 * The permutation each hop of a toy press applies at the toy's positions, in hop order: plugboard, rotors right →
 * left, reflector, rotors left → right, plugboard.
 */
export function toyStagePerms(spec: ToySpec): number[][] {
  const { n } = spec
  const rotor = (i: number, dir: 'fwd' | 'bwd') => {
    const o = spec.positions[i]!
    const w = dir === 'fwd' ? spec.rotors[i]! : invert(spec.rotors[i]!)
    return Array.from({ length: n }, (_, x) => mod(w[mod(x + o, n)]! - o, n))
  }
  const k = spec.rotors.length
  const perms: number[][] = [[...spec.plugs]]
  for (let i = k - 1; i >= 0; i--) perms.push(rotor(i, 'fwd'))
  perms.push([...spec.reflector])
  for (let i = 0; i < k; i++) perms.push(rotor(i, 'bwd'))
  perms.push([...spec.plugs])
  return perms
}

/** Each toy rotor's forward table at its window, RIGHT → LEFT (the order the current meets them), and the reflector. */
export function toyTables(spec: ToySpec): { slot: string; perm: number[] }[] {
  const perms = toyStagePerms(spec)
  const k = spec.rotors.length
  const slots = toySlots(k)
  const out = Array.from({ length: k }, (_, j) => ({ slot: slots[k - 1 - j]!, perm: perms[1 + j]! }))
  return [...out, { slot: 'reflector', perm: perms[1 + k]! }]
}

// ---------------------------------------------------------------------------
// toy-lamp: letter(6), rollback 'path' (a single-slip ghost)
// ---------------------------------------------------------------------------

export interface ToyLampInstance {
  readonly spec: ToySpec
  readonly key: Letter
}

/** How a single slip explains a wrong lamp. */
export type Slip = 'skip' | 'direction' | 'neighbour' | 'unknown'

export interface LampExplanation {
  readonly ghost: Ghost
  readonly slip: Slip
  /** The letters the learner's lamp needs after each hop (traced backwards through the true wiring). */
  readonly needed: readonly number[]
}

/**
 * Explain a wrong lamp (PLAN §4.1 G5 'path', hop by hop). Trace the learner's lamp backwards through every hop's
 * true table: `needed[k]` is the letter that must leave hop k for that lamp to light. The ghost follows the
 * reference up to one hop d, leaves it there (its output is needed[d] instead of the reference's), and follows
 * the true wiring from there to the learner's lamp. d is the first hop (in path order, pass-through hops skipped)
 * where a single slip explains the lamp, trying in turn:
 *  - skip: the letter passed hop d unchanged (a forgotten rotor, or a reflector that did not swap);
 *  - direction: hop d's table read the wrong way (down instead of up on the way back, or up on the way in);
 *  - neighbour: the column next to the right one read in hop d's table;
 * and, when no slip explains it, the reflector.
 */
export function explainToyLamp(spec: ToySpec, key: Letter, lamp: string): LampExplanation {
  const reference = toyPress(spec, key).hops
  const perms = toyStagePerms(spec)
  const n = spec.n
  const wrong = idx(String(lamp).toUpperCase())
  const last = reference.length - 1
  if (wrong < 0 || wrong >= n)
    return {
      ghost: { hops: [...reference], divergeAt: 0 },
      slip: 'unknown',
      needed: reference.map((h) => h.outputIndex),
    }
  const needed: number[] = []
  needed[last] = wrong
  for (let k = last - 1; k >= 0; k--) needed[k] = perms[k + 1]!.indexOf(needed[k + 1]!)
  const candidates = reference.map((_, k) => k).filter((k) => !isIdentity(perms[k]!))
  const at = (k: number) => reference[k]!.inputIndex
  const tests: [Slip, (k: number) => boolean][] = [
    ['skip', (k) => needed[k] === at(k)],
    ['direction', (k) => reference[k]!.kind === 'rotor' && needed[k] === perms[k]!.indexOf(at(k))],
    ['neighbour', (k) => needed[k] === perms[k]![mod(at(k) + 1, n)] || needed[k] === perms[k]![mod(at(k) - 1, n)]],
  ]
  let divergeAt = Math.max(0, reflectorHop(reference))
  let slip: Slip = 'unknown'
  if (wrong !== reference[last]!.outputIndex) {
    found: for (const [name, test] of tests) {
      for (const k of candidates) {
        if (test(k)) {
          divergeAt = k
          slip = name
          break found
        }
      }
    }
  }
  const hops: PathHop[] = reference.map((ref, k) => {
    if (k < divergeAt) return ref
    const inputIndex = k === divergeAt ? ref.inputIndex : needed[k - 1]!
    const outputIndex = needed[k]!
    const hop: PathHop = { ...ref, input: L(inputIndex), output: L(outputIndex), inputIndex, outputIndex }
    if (ref.kind !== 'rotor' || ref.offset === undefined) return hop
    const entryContact = mod(inputIndex + ref.offset, n)
    const i = ref.slotIndex ?? 0
    const exitContact = ref.stage.endsWith('-fwd')
      ? spec.rotors[i]![entryContact]!
      : invert(spec.rotors[i]!)[entryContact]!
    return { ...hop, entryContact, exitContact }
  })
  return { ghost: { hops, divergeAt }, slip, needed }
}

const PART_TEXT: Readonly<Record<string, string>> = {
  'rotor-right': 'right rotor',
  'rotor-middle': 'middle rotor',
  'rotor-left': 'left rotor',
  reflector: 'reflector',
  plugboard: 'plugboard',
}

/** The feedback line for a wrong lamp: the slip that explains it. */
export function slipText(i: ToyLampInstance, lamp: string, e: LampExplanation): string {
  const hop = e.ghost.hops[e.ghost.divergeAt]!
  const ref = toyPress(i.spec, i.key).hops[e.ghost.divergeAt]!
  const part = PART_TEXT[partForStage(hop.stage)] ?? 'part'
  const way = hop.stage.endsWith('-bwd') ? 'on the way back' : 'on the way in'
  const W = String(lamp).toUpperCase()
  switch (e.slip) {
    case 'skip':
      return ref.kind === 'reflector'
        ? `Lamp ${W} is what you get if ${ref.input} came back from the reflector unchanged. The reflector always swaps a pair: ${ref.input} comes back as ${ref.output}.`
        : `Lamp ${W} is what you get if the current skipped the ${part} ${way}. The current crosses every rotor twice.`
    case 'direction':
      return hop.stage.endsWith('-bwd')
        ? `Lamp ${W} is what you get if the ${part}'s table was read downwards ${way}. On the way back, find ${ref.input} in the lower row and read the letter above it: ${ref.output}.`
        : `Lamp ${W} is what you get if the ${part}'s table was read upwards ${way}. On the way in, find ${ref.input} in the upper row and read the letter below it: ${ref.output}.`
    case 'neighbour':
      return `Lamp ${W} is what you get if the column next to ${ref.input} was read in the ${part}'s table. ${ref.input} goes to ${ref.output} there.`
    default:
      return `Lamp ${W} is where the red path ends. Follow the gold path hop by hop and compare.`
  }
}

/**
 * The lamps the misconceptions predict (the misconception bot's answers): stopping before or after the reflector,
 * reading every table downwards on the way back, a reflector that does not swap, forgetting one rotor, and every
 * table read the wrong way round. The generator draws only toys where none of them is the true lamp, so every
 * instance needs the whole round trip.
 */
export function naiveLamps(spec: ToySpec, key: Letter): Letter[] {
  const perms = toyStagePerms(spec)
  const k = spec.rotors.length
  const ident = perms[0]!.map((_, x) => x)
  const refl = 1 + k
  const run = (ps: readonly (readonly number[])[], upTo = ps.length) => {
    let x = idx(key)
    for (let j = 0; j < upTo; j++) x = ps[j]![x]!
    return L(x)
  }
  const fwdOf = (j: number) => perms[refl - (j - refl)]! // the forward table of the rotor a return hop crosses
  const out: Letter[] = [
    run(perms, refl), // stops before the reflector
    run(perms, refl + 1), // stops after the reflector (no way back)
    run(perms.map((p, j) => (j > refl && j < perms.length - 1 ? fwdOf(j) : p))), // tables read downwards on the way back
    run(perms.map((p, j) => (j === refl ? ident : p))), // the reflector passes the letter straight back
    run(perms.map((p, j) => (j > 0 && j < perms.length - 1 && j !== refl ? invert(p) : p))), // every table the wrong way
  ]
  // One rotor forgotten, both ways.
  for (let i = 0; i < k; i++) {
    const fwd = refl - 1 - i // the way in crosses the rotors right to left
    const bwd = refl + 1 + i // the way back, left to right
    out.push(run(perms.map((p, j) => (j === fwd || j === bwd ? ident : p))))
  }
  return out
}

export const toyLamp = letterItem<ToyLampInstance>({
  id: 'toy-lamp',
  rule: WINDOW,
  alphabet: 6,
  generate(r) {
    for (;;) {
      const spec = randomToy(r, 6, 2, { stepping: false })
      const key = randLetter(r, 6)
      if (!naiveLamps(spec, key).includes(toyPress(spec, key).lamp)) return { spec, key }
    }
  },
  same: (a, b) => a.key === b.key && sameJson(a.spec, b.spec),
  solve: (i) => toyPress(i.spec, i.key).lamp,
  check(i, a) {
    const lamp = toyPress(i.spec, i.key).lamp
    const answer = String(a ?? '').toUpperCase()
    if (answer === lamp) return verdict(true)
    const e = explainToyLamp(i.spec, i.key, answer)
    return verdict(false, { kind: 'path', ghost: e.ghost }, slipText(i, answer, e))
  },
  setup: (i) => ({ toy: i.spec, locks: READ_ONLY, stage: TOY_STAGE }),
  highlight(i, lastWrong) {
    if (lastWrong && String(lastWrong).toUpperCase() !== toyPress(i.spec, i.key).lamp) {
      const e = explainToyLamp(i.spec, i.key, lastWrong)
      const hop = e.ghost.hops[e.ghost.divergeAt]
      if (hop) return [{ part: partForStage(hop.stage), tone: 'hint' }]
    }
    return [{ part: 'reflector', tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------
// hop-chain: chain(11), rollback 'path' (the learner's letters as a ghost)
// ---------------------------------------------------------------------------

/** The 11 stages of a three-rotor press, in signal order. */
export const STAGES: readonly TraceStage[] = [
  'plugboard-in',
  'etw-in',
  'rotor-right-fwd',
  'rotor-middle-fwd',
  'rotor-left-fwd',
  'reflector',
  'rotor-left-bwd',
  'rotor-middle-bwd',
  'rotor-right-bwd',
  'etw-out',
  'plugboard-out',
]

export const STAGE_LABEL: Readonly<Record<string, string>> = {
  'plugboard-in': 'Plugboard',
  'etw-in': 'Entry wheel',
  'rotor-right-fwd': 'Right rotor',
  'rotor-middle-fwd': 'Middle rotor',
  'rotor-left-fwd': 'Left rotor',
  'rotor-greek-fwd': 'Greek rotor',
  reflector: 'Reflector',
  'rotor-greek-bwd': 'Greek rotor, back',
  'rotor-left-bwd': 'Left rotor, back',
  'rotor-middle-bwd': 'Middle rotor, back',
  'rotor-right-bwd': 'Right rotor, back',
  'etw-out': 'Entry wheel, back',
  'plugboard-out': 'Plugboard, back',
}

export interface ChainInstance {
  readonly config: MachineConfig
  readonly key: Letter
  readonly stages: readonly { readonly id: string; readonly label: string }[]
}

const I_TO_V: readonly RotorName[] = ['I', 'II', 'III', 'IV', 'V']

/** Three distinct rotors from I–V, UKW-B, rings AAA, random windows, no cables. */
export function chainConfig(r: Rng): MachineConfig {
  return normalizeConfig({
    model: 'I',
    reflector: 'B',
    rotors: sample(r, I_TO_V, 3),
    rings: 'AAA',
    positions: [randLetter(r), randLetter(r), randLetter(r)],
    plugboard: [],
  })
}

/**
 * The substitution strip of one component at its current offset: plugboard and entry wheel (identity here),
 * each rotor FORWARD (read upwards on the way back), and the reflector.
 */
export function strips(config: MachineConfig): { part: PartId; perm: number[] }[] {
  const plugs = LETTERS.map((_, k) => k)
  const slots = ['left', 'middle', 'right'] as const
  const rotor = (k: number) => [...rotorPermutation(config.rotors[k]!, config.rings[k]!, config.positions[k]!)]
  return [
    { part: 'plugboard', perm: plugs },
    { part: 'etw', perm: [...plugs] },
    ...[2, 1, 0].map((k) => ({ part: `rotor-${slots[k]}` as PartId, perm: rotor(k) })),
    { part: 'reflector', perm: [...REFLECTOR_PERMS[config.reflector]] },
  ]
}

/**
 * The chains the misconceptions predict (the misconception bot's answers): every strip read downwards on the way
 * back, and the rotors crossed left to right on the way in (and right to left on the way back).
 */
export function naiveChains(config: MachineConfig, key: Letter): string[][] {
  const tables = Object.fromEntries(strips(config).map((x) => [x.part, x.perm])) as Record<string, number[]>
  const walk = (order: readonly TraceStage[], read: (stage: TraceStage, x: number) => number) => {
    let x = idx(key)
    return order.map((stage) => L((x = read(stage, x))))
  }
  const part = (stage: TraceStage) => (stage.startsWith('rotor') ? `rotor-${stage.split('-')[1]}` : partForStage(stage))
  const down = (stage: TraceStage, x: number) => tables[part(stage)]![x]!
  const right = (stage: TraceStage, x: number) =>
    stage.endsWith('-bwd') ? tables[part(stage)]!.indexOf(x) : down(stage, x)
  const swapped: TraceStage[] = [...STAGES]
  ;[swapped[2], swapped[4]] = [swapped[4]!, swapped[2]!]
  ;[swapped[6], swapped[8]] = [swapped[8]!, swapped[6]!]
  return [walk(STAGES, down), walk(swapped, right)]
}

export const hopChain = chainItem<ChainInstance>({
  id: 'hop-chain',
  rule: WINDOW,
  generate(r) {
    for (;;) {
      const config = chainConfig(r)
      const key = randLetter(r)
      const truth = traceOf(config, key).map((h) => h.output)
      if (naiveChains(config, key).some((c) => sameJson(c, truth))) continue
      return { config, key, stages: STAGES.map((id) => ({ id, label: STAGE_LABEL[id]! })) }
    }
  },
  same: (a, b) => a.key === b.key && sameJson(a.config, b.config),
  solve: (i) => traceOf(i.config, i.key).map((h) => h.output),
  check(i, a) {
    const ref = traceOf(i.config, i.key)
    const got = Array.isArray(a) ? a.map((t) => String(t ?? '').toUpperCase()) : []
    return verdict(
      sameJson(
        got,
        ref.map((h) => h.output),
      ),
      { kind: 'path', ghost: ghostFromOutputs(ref, got) },
    )
  },
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: WIRE_STAGE }),
  highlight(i, lastWrong) {
    const ref = traceOf(i.config, i.key)
    const k = Array.isArray(lastWrong)
      ? firstDiff(
          ref.map((h) => h.output),
          lastWrong.map((t) => String(t).toUpperCase()),
        )
      : -1
    return [{ part: k >= 0 && k < ref.length ? partForStage(ref[k]!.stage) : 'rotor-right', tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------
// path-order and path-order-m4: order, once (rollback 'order')
// ---------------------------------------------------------------------------

type Component = 'plugboard' | 'etw' | 'right' | 'middle' | 'left' | 'greek' | 'reflector'

const COMPONENT_LABEL: Readonly<Record<Component, string>> = {
  plugboard: 'Plugboard (S)',
  etw: 'Entry wheel (H)',
  right: 'Right rotor (N)',
  middle: 'Middle rotor (M)',
  left: 'Left rotor (L)',
  greek: 'Greek rotor (G)',
  reflector: 'Reflector (U)',
}

/** The components a key press crosses, in order: Enigma I (11) and M4 (13). */
export const PATH_I: readonly Component[] = [
  'plugboard',
  'etw',
  'right',
  'middle',
  'left',
  'reflector',
  'left',
  'middle',
  'right',
  'etw',
  'plugboard',
]
export const PATH_M4: readonly Component[] = [
  'plugboard',
  'etw',
  'right',
  'middle',
  'left',
  'greek',
  'reflector',
  'greek',
  'left',
  'middle',
  'right',
  'etw',
  'plugboard',
]

/** One block per crossing: ids 'plugboard-1', 'plugboard-2', …, 'reflector'; blocks of one component share a label. */
export function pathBlocks(path: readonly Component[], reflector = COMPONENT_LABEL.reflector): Choice[] {
  const seen = new Map<Component, number>()
  return path.map((c) => {
    const k = (seen.get(c) ?? 0) + 1
    seen.set(c, k)
    const twice = path.filter((x) => x === c).length > 1
    return { id: twice ? `${c}-${k}` : c, label: c === 'reflector' ? reflector : COMPONENT_LABEL[c] }
  })
}

const componentOf = (id: string): string => id.replace(/-\d+$/, '')

export interface OrderInstance {
  readonly blocks: readonly Choice[]
}

/**
 * Order the crossings. Blocks of one component are interchangeable (same label), so the check compares the
 * sequence of components; the rollback's firstWrong is the first misplaced component.
 */
function pathOrderItem(
  id: string,
  path: readonly Component[],
  reflector: string,
  transfer: boolean,
): ItemLogic<OrderInstance, string[]> {
  const solution = pathBlocks(path, reflector).map((b) => b.id)
  const want = path as readonly string[]
  return orderItem<OrderInstance>({
    id,
    rule: ONCE,
    constantAnswer: true,
    ...(transfer ? { transfer: true as const } : {}),
    generate(r) {
      let blocks = shuffle(r, pathBlocks(path, reflector))
      while (
        sameJson(
          blocks.map((b) => componentOf(b.id)),
          want,
        )
      )
        blocks = shuffle(r, pathBlocks(path, reflector))
      return { blocks }
    },
    same: (a, b) => sameJson(a.blocks, b.blocks),
    solve: () => [...solution],
    check(_i, a) {
      const ids = Array.isArray(a) ? a.map(String) : []
      const got = ids.map(componentOf)
      const ok =
        ids.length === want.length &&
        new Set(ids).size === ids.length &&
        ids.every((x) => solution.includes(x)) &&
        sameJson(got, want)
      return verdict(ok, { kind: 'order', firstWrong: Math.max(0, firstDiff(want, got)) })
    },
    // A swap of two crossings of the same component changes nothing: swap two different components.
    mutate(_i, a, r) {
      const out = [...a]
      const pairs: [number, number][] = []
      for (let x = 0; x < out.length; x++)
        for (let y = x + 1; y < out.length; y++) if (componentOf(out[x]!) !== componentOf(out[y]!)) pairs.push([x, y])
      if (!pairs.length) return [...out, '?']
      const [x, y] = pairs[int(r, pairs.length)]!
      ;[out[x], out[y]] = [out[y]!, out[x]!]
      return out
    },
    setup: () => ({ stage: null }),
    highlight: () => [],
  })
}

export const pathOrder = pathOrderItem('path-order', PATH_I, COMPONENT_LABEL.reflector, false)
export const pathOrderM4 = pathOrderItem('path-order-m4', PATH_M4, 'Thin reflector (U)', true)

// ---------------------------------------------------------------------------
// toy-set: the fallback (custom, in-page): turn the toy's rotors so that C lights E (rollback 'machine')
// ---------------------------------------------------------------------------

export interface ToySetInstance {
  readonly spec: ToySpec
  readonly key: Letter
  readonly target: Letter
}

export const TOY_SET_KEY: Letter = 'C'
export const TOY_SET_TARGET: Letter = 'E'

/** The lamp `key` lights with the toy's rotors at `positions` (held). */
export const toyLampAt = (spec: ToySpec, key: Letter, positions: readonly number[]): Letter =>
  toyPress({ ...spec, positions: [...positions] }, key).lamp

/** Every setting of the rotors (LEFT → RIGHT window indices) at which `key` lights `target`, in scan order. */
export function toySetSolutions(spec: ToySpec, key: Letter, target: Letter): number[][] {
  const out: number[][] = []
  const k = spec.rotors.length
  const total = spec.n ** k
  for (let code = 0; code < total; code++) {
    const positions = Array.from({ length: k }, (_, j) => Math.floor(code / spec.n ** (k - 1 - j)) % spec.n)
    if (toyLampAt(spec, key, positions) === target) out.push(positions)
  }
  return out
}

const validPositions = (i: ToySetInstance, a: unknown): number[] | null => {
  if (!Array.isArray(a) || a.length !== i.spec.rotors.length) return null
  const p = a.map(Number)
  return p.every((x) => Number.isInteger(x) && x >= 0 && x < i.spec.n) ? p : null
}

const windowsOf = (p: readonly number[]) => p.map(L).join('')

export const toySet: ItemLogic<ToySetInstance, number[]> = {
  id: 'toy-set',
  kind: 'custom',
  rule: WINDOW,
  compute: true,
  inPage: true,
  generate(r) {
    for (;;) {
      const spec = randomToy(r, 6, 2, { stepping: false })
      // A solution exists, and the start is not one of them: the learner must turn something.
      const solutions = toySetSolutions(spec, TOY_SET_KEY, TOY_SET_TARGET)
      if (solutions.length && toyLampAt(spec, TOY_SET_KEY, spec.positions) !== TOY_SET_TARGET) {
        return { spec, key: TOY_SET_KEY, target: TOY_SET_TARGET }
      }
    }
  },
  same: (a, b) => a.key === b.key && a.target === b.target && sameJson(a.spec, b.spec),
  solve: (i) => toySetSolutions(i.spec, i.key, i.target)[0]!,
  check(i, a): CheckResult {
    const p = validPositions(i, a)
    if (!p)
      return verdict(false, {
        kind: 'machine',
        field: 'positions',
        message: 'Set a window for each rotor.',
        highlight: ['rotor-right'],
      })
    const lamp = toyLampAt(i.spec, i.key, p)
    const message = `At windows ${windowsOf(p)}, ${i.key} lights ${lamp}, not ${i.target}.`
    return verdict(lamp === i.target, {
      kind: 'machine',
      field: 'positions',
      message,
      highlight: ['rotor-middle', 'rotor-right'],
    })
  },
  sampleAnswer: (i, r) => i.spec.rotors.map(() => int(r, i.spec.n)),
  // The nearest setting (turning the right rotor on, then the middle one) at which the key lights another lamp.
  mutate(i, a) {
    const p = validPositions(i, a) ?? i.spec.positions.map(() => 0)
    const n = i.spec.n
    for (let step = 1; step < n * n; step++) {
      const q = [mod(p[0]! + Math.floor(step / n), n), mod(p[1]! + step, n)]
      if (toyLampAt(i.spec, i.key, q) !== i.target) return q
    }
    return [...i.spec.positions]
  },
  setup: (i): ItemSetup => ({ toy: i.spec, locks: READ_ONLY, stage: TOY_STAGE }),
  highlight: (): readonly Highlight[] => [{ part: 'rotor-right', tone: 'hint' }],
}

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  anatomy: {
    items: [toyLamp, hopChain, pathOrder, pathOrderM4] as ItemLogic[],
    fallback: toySet as ItemLogic,
  },
}
