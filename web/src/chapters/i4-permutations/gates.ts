/**
 * Chapter i4-permutations · gate `keypress` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts, lesson/kinds and this
 * chapter's data-keypress.ts.
 *  - keypress        code · 2/3 · enigmaKeypress(state, key, parts) from the provided, instrumented parts; the
 *                    prediction (the letter leaving the middle rotor on the way back) varies with the instance
 *  - which-wrong     ghost-pick · 2/3 · a buggy press's path, hop by hop: the part where it first goes wrong
 *  - hop-chain-full  chain(12) · 2/3 · the windows after the step, then the letter after each of the 11 stages
 *  - which-wrong     is also the fallback (in-page, the same skill as the code item)
 * Rejewski's notation: E = S·H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹·S⁻¹, read left to right, with N, M and L at their offsets.
 */

import type { Letter, MachineConfig } from '../../contracts/core'
import type { CodeAnswer, CodeCase } from '../../contracts/code'
import type { ChapterGates, ItemLogic, Rollback } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import type { Ghost, PartId, PathHop } from '../../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  ROTORS,
  compose,
  createMachine,
  fromPairs,
  identity,
  inverse,
  normalizeConfig,
  positionsToString,
  rotorPermutation,
  step,
  type MachineState,
  type RotorName,
} from '../../engine'
import { createRng, int, pick, randLetter, randomConfig, sample, seedFor, type Rng } from '../../lib/rng'
import { chainItem, codeItem, ghostFromOutputs, ghostPickItem, normalizeProbe, partForStage, verdict } from '../../lesson/kinds'
import {
  BUGS,
  KEYPRESS_PROVIDED,
  PROBE_HOP,
  STAGES,
  claimedHop,
  firstDivergence,
  keypressHops,
  keypressResult,
  referenceHops,
  stateOf,
  type Bug,
  type KeypressState,
} from './data-keypress'

export { BUGS, BUG_LABEL, KEYPRESS_PROVIDED, PROBE_HOP, STAGES, claimedHop, firstDivergence, keypressHops, referenceHops, stateOf } from './data-keypress'
export type { Bug, KeypressState } from './data-keypress'

const WINDOW = { kind: 'window' } as const
const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------
// The chapter's machines and Rejewski's notation
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

/** The notation scenes: four cables, so S does something, and rings 02 05 11. */
export const NOTATION_START: MachineConfig = normalizeConfig({
  ...START,
  rings: 'BEK',
  positions: 'QEV',
  plugboard: ['AV', 'BS', 'CG', 'DL'],
})

/** The key the Play reveal of the symbols scene presses first. */
export const SYMBOLS_KEY: Letter = 'K'

export const FIXED: MachineLocks = { model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true }
export const READ_ONLY: MachineLocks = { ...FIXED, keyboard: true, lampsHidden: true }

export type ComponentSym = 'S' | 'H' | 'N' | 'M' | 'L' | 'U'

/** The six components in the order the current meets them on the way in. */
export const COMPONENTS: readonly ComponentSym[] = ['S', 'H', 'N', 'M', 'L', 'U']

export const COMPONENT_PART: Readonly<Record<ComponentSym, PartId>> = {
  S: 'plugboard',
  H: 'etw',
  N: 'rotor-right',
  M: 'rotor-middle',
  L: 'rotor-left',
  U: 'reflector',
}

export const COMPONENT_NAME: Readonly<Record<ComponentSym, string>> = {
  S: 'plugboard',
  H: 'entry wheel',
  N: 'right rotor',
  M: 'middle rotor',
  L: 'left rotor',
  U: 'reflector',
}

export interface Factor {
  readonly sym: ComponentSym
  readonly inv: boolean
}

/** E = S·H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹·S⁻¹: the 11 factors, one per hop of the trace, in order. */
export const FACTORS: readonly Factor[] = [
  ...COMPONENTS.map((sym) => ({ sym, inv: false })),
  ...(['L', 'M', 'N', 'H', 'S'] as const).map((sym) => ({ sym, inv: true })),
]

const SLOT_OF: Readonly<Record<'N' | 'M' | 'L', number>> = { N: 2, M: 1, L: 0 }

/** A component's permutation at the machine's CURRENT windows (N, M and L at their offsets window − ring). */
export function componentPerm(state: MachineState, sym: ComponentSym): number[] {
  const c = state.config
  switch (sym) {
    case 'S':
      return [...fromPairs(c.plugboard)]
    case 'H':
      return [...identity(26)]
    case 'U':
      return [...REFLECTOR_PERMS[c.reflector]]
    default: {
      const i = SLOT_OF[sym]
      return [...rotorPermutation(c.rotors[i]!, c.rings[i]!, state.positions[i]!)]
    }
  }
}

export const factorPerm = (state: MachineState, f: Factor): number[] =>
  f.inv ? [...inverse(componentPerm(state, f.sym))] : componentPerm(state, f.sym)

/** The product of the first k factors, left to right (k = 0: the identity; k = 11: E itself). */
export function partialProduct(state: MachineState, k: number): number[] {
  let p: readonly number[] = identity(26)
  for (const f of FACTORS.slice(0, k)) p = compose(p, factorPerm(state, f))
  return [...p]
}

/** The permutation each of the 11 hops applies on the next press of `config` (after its step). */
export function hopTables(config: MachineConfig): number[][] {
  const state = step(createMachine(config)).state
  return FACTORS.map((f) => factorPerm(state, f))
}

/** The windows after the next press's step, e.g. 'ADV'. */
export const windowsAfterStep = (config: MachineConfig): string => {
  let w = windowsCache.get(config)
  if (w === undefined) windowsCache.set(config, (w = positionsToString(step(createMachine(config)).state)))
  return w
}
const windowsCache = new WeakMap<MachineConfig, string>()

/** The same machine with its windows moved on by one press's step (the stage's reference path is drawn there). */
export const steppedConfig = (config: MachineConfig): MachineConfig =>
  normalizeConfig({ ...config, positions: windowsAfterStep(config) })

/**
 * Windows near a turnover: 0 the right rotor on its turnover letter (this press carries the middle rotor), 1 one
 * place before it (the next press carries), 2 the middle rotor on its own turnover letter (a double step now);
 * anything else leaves the windows as they are.
 */
export function nearTurnover(r: Rng, c: MachineConfig, mode: number): MachineConfig {
  const [, middle, right] = c.rotors as [RotorName, RotorName, RotorName]
  const tr = idx(ROTORS[right].turnovers[0]!)
  const tm = idx(ROTORS[middle].turnovers[0]!)
  const p = [...c.positions]
  if (mode === 0) p[2] = L(tr)
  else if (mode === 1) p[2] = L(tr - 1)
  else if (mode === 2) {
    p[1] = L(tm)
    p[2] = L(tr + 1 + int(r, 20))
  } else return c
  return normalizeConfig({ ...c, positions: p })
}

// ---------------------------------------------------------------------------
// keypress: code, the learner's enigmaKeypress from the provided parts (rollback: path)
// ---------------------------------------------------------------------------

export interface KeypressInstance {
  readonly seed: number
  /** The prediction's press: this state, this key. */
  readonly state: KeypressState
  readonly key: Letter
}

export const KEYPRESS_REFERENCE = [
  'function enigmaKeypress(state, key, parts) {',
  '  const next = parts.step(state)',
  '  let c = parts.etwIn(parts.plugIn(key))',
  "  for (const slot of ['right', 'middle', 'left']) c = parts.rotorFwd(slot, c)",
  '  c = parts.reflect(c)',
  "  for (const slot of ['left', 'middle', 'right']) c = parts.rotorBwd(slot, c)",
  '  c = parts.plugOut(parts.etwOut(c))',
  '  return { output: c, positions: next.positions }',
  '}',
  '',
].join('\n')

/**
 * The misconceptions a prediction of M⁻¹ can catch: every seeded bug that acts before the middle rotor's way back
 * (plug-once acts after it, so the chain item catches that one).
 */
export const PROBE_BUGS: readonly Bug[] = ['no-step', 'swap-middle-left', 'backward-forward', 'ring-sign', 'no-reflector']

/** Every misconception in PROBE_BUGS predicts a different letter at M⁻¹ than the engine. */
export function probeSeparates(config: MachineConfig, key: Letter): boolean {
  const truth = keypressHops(config, key, null)[PROBE_HOP]!.output
  return PROBE_BUGS.every((b) => keypressHops(config, key, b)[PROBE_HOP]!.output !== truth)
}

/** The prediction: the letter leaving the middle rotor on the way back. */
export const keypressProbe = (i: Pick<KeypressInstance, 'state' | 'key'>): Letter => referenceHops(i.state, i.key)[PROBE_HOP]!.output

/** The random machines the hidden tests draw from: 240 machines and keys, pressed once by the engine (built on first use). */
let bank: CodeCase[] | null = null
function machineBank(): CodeCase[] {
  if (bank) return bank
  const r = createRng(seedFor('i4-permutations', 'keypress-bank'))
  bank = Array.from({ length: 240 }, (_, k) => {
    const c = stateOf(nearTurnover(r, randomConfig(r, { plugs: [0, 10], rings: 'random' }), k % 4))
    const key = randLetter(r)
    return { label: '', fn: 'runKeypress', args: [c, key], expect: keypressResult(c, key) }
  })
  return bank
}

/** The BDZGO sequence: rotors I II III, rings 01 01 01, AAA, A pressed five times lights B D Z G O. */
let bdzgo: CodeCase[] | null = null
function bdzgoCases(): CodeCase[] {
  if (bdzgo) return bdzgo
  const out: CodeCase[] = []
  let s = stateOf(START)
  for (let k = 0; k < 5; k++) {
    const res = keypressResult(s, 'A')
    out.push({ label: `BDZGO, press ${k + 1}`, fn: 'runKeypress', args: [s, 'A'], expect: res })
    s = { ...s, positions: res.positions }
  }
  return (bdzgo = out)
}

/**
 * 36 cases: the BDZGO sequence; 30 random machines picked by the instance's seed from the bank (random rings, 0–10
 * cables, windows near a turnover in three of every four, double steps included), each comparing {output, positions};
 * and the prediction's own press, hop by hop against the engine's trace (compare 'hops': the parts must be called in
 * the order the current flows).
 */
export function keypressCases(i: KeypressInstance): CodeCase[] {
  const picks = sample(createRng(i.seed), machineBank(), 30)
  return [
    ...bdzgoCases(),
    ...picks.map((c, k) => ({ ...c, label: `random machine #${k + 1}` })),
    {
      label: 'the predicted press, hop by hop',
      fn: 'runKeypress',
      args: [i.state, i.key],
      expect: referenceHops(i.state, i.key).map((h) => ({ stage: h.stage, input: h.input, output: h.output })),
      compare: 'hops',
    },
  ]
}

/**
 * G5 'path' for the keypress: the hops the learner's code recorded, drawn against the engine's trace from the first
 * hop that differs. When the recorded path agrees (or nothing was recorded), the prediction is drawn instead: the
 * engine's path with the predicted letter leaving the middle rotor.
 */
export function keypressRollback(i: KeypressInstance, a: CodeAnswer): Rollback {
  const ref = referenceHops(i.state, i.key)
  const hops = a?.run?.hops
  if (hops && hops.length) {
    const k = hops.findIndex((h, j) => h.output !== ref[j]?.output || h.stage !== ref[j]?.stage)
    if (k !== -1 || hops.length !== ref.length) {
      return { kind: 'path', ghost: { hops: [...hops], divergeAt: k === -1 ? Math.min(hops.length, ref.length) : k } }
    }
  }
  const guess = normalizeProbe(a?.probe)
  const outputs = ref.map((h) => h.output as string)
  if (/^[A-Z]$/.test(guess)) outputs[PROBE_HOP] = guess
  return { kind: 'path', ghost: ghostFromOutputs(ref, outputs) }
}

export const keypress = codeItem<KeypressInstance>(
  {
    fnNames: ['enigmaKeypress', 'runKeypress'],
    signature: 'enigmaKeypress(state, key, parts): { output, positions }',
    brief:
      'Assemble one key press from the machine’s parts. parts.step(state) turns the rotors and returns the new state (its ' +
      'positions are the windows, e.g. "AAB"). Each other part takes the letter arriving at it and returns the letter that leaves ' +
      'it: plugIn, etwIn, rotorFwd(slot, c) and rotorBwd(slot, c) with slot "right", "middle" or "left", reflect, etwOut and ' +
      'plugOut. Call them in the order the current flows and return { output, positions } with the windows after the step. The ' +
      'tests call runKeypress(state, key), which hands your function the parts for that state and records every part you call. ' +
      'In a state the rotors are listed left to right, and the rings and windows are letters: ring "A" is 01, "B" is 02 and ' +
      'so on, so "rings":"AAA" means 01 01 01.',
    starter:
      'function enigmaKeypress(state, key, parts) {\n  // 1. turn the rotors: parts.step(state)\n  // 2. send the letter through every part, in order\n' +
      '  // 3. return { output, positions }\n}\n',
    provided: KEYPRESS_PROVIDED,
    maxLines: 12,
    reference: KEYPRESS_REFERENCE,
    instrument: 'keypress-parts',
    cases: keypressCases,
    probe: (i) => ({ call: `the letter leaving the middle rotor on the way back (M⁻¹) for key ${i.key}`, expected: keypressProbe(i) }),
  },
  {
    id: 'keypress',
    rule: WINDOW,
    generate(r) {
      const seed = int(r, 2 ** 31)
      for (;;) {
        const config = randomConfig(r, { plugs: [2, 6], rings: 'random' })
        const key = randLetter(r)
        if (probeSeparates(config, key)) return { seed, state: stateOf(config), key }
      }
    },
    same: (a, b) => a.seed === b.seed || (a.key === b.key && sameJson(a.state, b.state)),
    // The stage shows this press's machine after its step, so the reference path is the engine's trace.
    setup: (i) => ({ machine: steppedConfig(configOfState(i.state)), locks: READ_ONLY, stage: 'symbols' }),
    rollback: keypressRollback,
    highlight: () => [{ part: 'rotor-middle', tone: 'hint' }],
  },
)

function configOfState(s: KeypressState): MachineConfig {
  return normalizeConfig({ model: 'I', reflector: s.reflector, rotors: s.rotors, rings: s.rings, positions: s.positions, plugboard: s.plugboard })
}

// ---------------------------------------------------------------------------
// which-wrong: ghost-pick, the part where a buggy press first goes wrong (rollback: path)
// ---------------------------------------------------------------------------

export const PATH_PARTS: readonly PartId[] = ['plugboard', 'etw', 'rotor-right', 'rotor-middle', 'rotor-left', 'reflector']

export interface WhichWrongInstance {
  readonly options: readonly PartId[]
  /**
   * The buggy press as its code recorded it, hop k labelled with the stage the correct press has there. divergeAt is
   * always −1: where it goes wrong is the answer, derived in solve() against the engine and drawn only in the rollback.
   */
  readonly ghost: Ghost
  /** The machine before the press. */
  readonly config: MachineConfig
  readonly key: Letter
}

/** The first hop of the instance's path that differs from the engine's press. */
export function faultyHop(i: Pick<WhichWrongInstance, 'ghost' | 'config' | 'key'>): number {
  return firstDivergence(i.ghost.hops, keypressHops(i.config, i.key, null))
}

/** Draw a configuration and key on which `bug` first bends the path exactly at its claimed hop. */
export function drawWhichWrong(r: Rng, bug: (typeof BUGS)[number]): WhichWrongInstance {
  for (;;) {
    const config = randomConfig(r, { plugs: [2, 6], rings: 'random' })
    const key = randLetter(r)
    const hops = keypressHops(config, key, bug)
    const claim = claimedHop(bug, config)
    if (claim !== null && firstDivergence(hops, keypressHops(config, key, null)) === claim) {
      return { options: PATH_PARTS, ghost: { hops, divergeAt: -1 }, config, key }
    }
  }
}

const PART_NAME: Readonly<Partial<Record<PartId, string>>> = {
  plugboard: 'plugboard',
  etw: 'entry wheel',
  'rotor-right': 'right rotor',
  'rotor-middle': 'middle rotor',
  'rotor-left': 'left rotor',
  reflector: 'reflector',
}

/** The parts a fault can be in (the entry wheel is never one: its hops are wires straight through). */
export const FAULT_PARTS: readonly PartId[] = ['plugboard', 'rotor-right', 'rotor-middle', 'rotor-left', 'reflector']

/**
 * An instance whose answer is `part`, so answers are uniform over the five parts. The rotors' faults come from a bug
 * that bends the path at that rotor first: no step or a flipped ring sign for the right rotor; middle and left swapped,
 * or a flipped ring sign with the right ring at 01 or 14 (where p + r = p − r), for the middle; forward wiring on the
 * way back, or a flipped ring sign with the right and middle rings at 01 or 14, for the left.
 */
export function drawWhichWrongFor(r: Rng, part: PartId): WhichWrongInstance {
  const neutral = () => pick(r, ['A', 'N'] as const)
  const shifted = () => pick(r, LETTERS.filter((l) => l !== 'A' && l !== 'N'))
  const ringSign = (slot: number) => (c: MachineConfig): MachineConfig => {
    const rings = [...c.rings]
    for (let i = 2; i > slot; i--) rings[i] = neutral()
    rings[slot] = shifted()
    return normalizeConfig({ ...c, rings })
  }
  const options: Readonly<Record<string, readonly [Bug, (c: MachineConfig) => MachineConfig][]>> = {
    'rotor-right': [
      ['no-step', (c) => c],
      ['ring-sign', ringSign(2)],
    ],
    'rotor-middle': [
      ['swap-middle-left', (c) => c],
      ['ring-sign', ringSign(1)],
    ],
    'rotor-left': [
      ['backward-forward', (c) => c],
      ['ring-sign', ringSign(0)],
    ],
    plugboard: [['plug-once', (c) => c]],
    reflector: [['no-reflector', (c) => c]],
  }
  const [bug, shape] = pick(r, options[part]!)
  for (;;) {
    const config = shape(randomConfig(r, { plugs: [2, 6], rings: 'random' }))
    const key = randLetter(r)
    const hops = keypressHops(config, key, bug)
    const claim = claimedHop(bug, config)
    if (claim !== null && firstDivergence(hops, keypressHops(config, key, null)) === claim) {
      return { options: PATH_PARTS, ghost: { hops, divergeAt: -1 }, config, key }
    }
  }
}

export const whichWrong = ghostPickItem<WhichWrongInstance>({
  id: 'which-wrong',
  rule: WINDOW,
  generate: (r) => drawWhichWrongFor(r, pick(r, FAULT_PARTS)),
  same: (a, b) => a.key === b.key && sameJson(a.ghost, b.ghost),
  solve: (i) => partForStage(STAGES[faultyHop(i)]!),
  check(i, a) {
    const k = faultyHop(i)
    const part = partForStage(STAGES[k]!)
    const ref = keypressHops(i.config, i.key, null)[k]!
    const got = i.ghost.hops[k]!
    // The shared rollback already says which part was picked and which is at fault: this adds the evidence only.
    return verdict(
      a === part,
      { kind: 'path', ghost: { hops: i.ghost.hops, divergeAt: k } },
      `Hop ${k + 1} (${STAGE_LABEL[STAGES[k]!]}) is the first that disagrees with its table: ${ref.input} should leave ` +
        `as ${ref.output}, the path shows ${got.output}. Every hop before it matches.`,
    )
  },
  // The machine after the press's step: the rollback draws the buggy path against the engine's.
  setup: (i) => ({ machine: steppedConfig(i.config), locks: READ_ONLY, stage: 'wire' }),
  // L1 is the Prompt's text on the instance on screen (whichWrongHint). The runtime draws stage highlights from the
  // instance the last wrong answer belonged to, and a part of that path would mislead on the new one: none here.
  highlight: () => [],
})

/** The part of the last hop that still matches its table (the fault is in a later hop, never this part's). */
export const lastRightPart = (i: Pick<WhichWrongInstance, 'ghost' | 'config' | 'key'>): PartId =>
  partForStage(STAGES[Math.max(0, faultyHop(i) - 1)]!)

/** Which pass of the current a hop index is on: before the reflector, the reflector itself, or after it. */
const passOf = (k: number): string => (k < 5 ? ' on the way in' : k === 5 ? '' : ' on the way back')

/**
 * The L1 hint the Prompt shows (hint level ≥ 1) for the instance on screen: where the path is still right, never
 * where it goes wrong. "Every hop up to and including the entry wheel on the way back matches its table; …"
 */
export function whichWrongHint(i: Pick<WhichWrongInstance, 'ghost' | 'config' | 'key'>): string {
  const k = Math.max(0, faultyHop(i) - 1)
  const name = PART_NAME[partForStage(STAGES[k]!)]!
  return (
    `Every hop up to and including the ${name}${passOf(k)} matches its table. The fault comes later along the path, so ` +
    'check the hops after it against their tables, one at a time.'
  )
}

// ---------------------------------------------------------------------------
// hop-chain-full: chain(12), the windows after the step and then the 11 letters (rollback: path)
// ---------------------------------------------------------------------------

/** Stage names as the learner reads them (never the raw stage ids). */
export const STAGE_LABEL: Readonly<Record<string, string>> = {
  'plugboard-in': 'plugboard',
  'etw-in': 'entry wheel',
  'rotor-right-fwd': 'right rotor',
  'rotor-middle-fwd': 'middle rotor',
  'rotor-left-fwd': 'left rotor',
  reflector: 'reflector',
  'rotor-left-bwd': 'left rotor, back',
  'rotor-middle-bwd': 'middle rotor, back',
  'rotor-right-bwd': 'right rotor, back',
  'etw-out': 'entry wheel, back',
  'plugboard-out': 'plugboard, back',
}

export const CHAIN_STAGES: readonly { id: string; label: string }[] = [
  { id: 'windows', label: 'windows after the step' },
  ...STAGES.map((s) => ({ id: s, label: STAGE_LABEL[s]! })),
]

export interface ChainFullInstance {
  readonly stages: readonly { id: string; label: string }[]
  /** The machine before the press (rings not all 01, 2–6 cables). */
  readonly config: MachineConfig
  readonly key: Letter
}

/** The 12 tokens a learner holding misconception `bug` would type (null: the right chain). */
export function misconceptionChain(config: MachineConfig, key: Letter, bug: Bug | null): string[] {
  const windows = bug === 'no-step' ? config.positions.join('') : windowsAfterStep(config)
  return [windows, ...keypressHops(config, key, bug).map((h) => h.output as string)]
}

const tokensOf = (a: unknown): string[] => (Array.isArray(a) ? a.map((t) => String(t ?? '').toUpperCase().replace(/[^A-Z]/g, '')) : [])

const chainReference = (i: ChainFullInstance): PathHop[] => referenceHops(stateOf(i.config), i.key)

/** The first wrong token (0 = the windows, k = the letter after stage k − 1), −1 when all are right. */
export function firstWrongToken(i: ChainFullInstance, a: unknown): number {
  const want = [windowsAfterStep(i.config), ...chainReference(i).map((h) => h.output as string)]
  const got = tokensOf(a)
  return want.findIndex((w, k) => got[k] !== w)
}

export const hopChainFull = chainItem<ChainFullInstance>({
  id: 'hop-chain-full',
  rule: WINDOW,
  generate(r) {
    for (;;) {
      const base = randomConfig(r, { plugs: [2, 6], rings: 'random' })
      if (base.rings.every((x) => x === 'A')) continue
      // Half of the instances start within two presses of a turnover (0: carry now, 1: next press, 2: double step).
      const config = int(r, 2) === 0 ? nearTurnover(r, base, int(r, 3)) : base
      const key = randLetter(r)
      // Every seeded misconception gives a different chain (plug-once only when the letter coming back is plugged).
      const truth = misconceptionChain(config, key, null).join()
      if (BUGS.every((b) => misconceptionChain(config, key, b).join() !== truth)) return { stages: CHAIN_STAGES, config, key }
    }
  },
  same: (a, b) => a.key === b.key && sameJson(a.config, b.config),
  // Stepping first: the windows after the step, then the trace at those windows.
  solve: (i) => [windowsAfterStep(i.config), ...chainReference(i).map((h) => h.output as string)],
  check(i, a) {
    const got = tokensOf(a)
    const k = firstWrongToken(i, a)
    const windows = windowsAfterStep(i.config)
    const feedback =
      got[0] !== windows
        ? `The windows after the step are ${windows}, not ${got[0] || '—'}: the rotors turn before the current flows, and every ` +
          'rotor hop uses the stepped windows.'
        : undefined
    return verdict(k === -1, { kind: 'path', ghost: ghostFromOutputs(chainReference(i), got.slice(1)) }, feedback)
  },
  sampleAnswer: (i, r) => [
    Array.from({ length: 3 }, () => randLetter(r)).join(''),
    ...i.stages.slice(1).map(() => randLetter(r) as string),
  ],
  mutate(_i, a, r) {
    const k = int(r, 12)
    return a.map((t, j) => (j !== k ? t : j === 0 ? t.slice(0, 2) + L(idx(t.at(-1) ?? 'A') + 1) : L(idx(t || 'A') + 1)))
  },
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'symbols' }),
  highlight(i, lastWrong) {
    const k = lastWrong ? firstWrongToken(i, lastWrong) : 0
    return [{ part: k <= 0 ? 'rotor-right' : partForStage(STAGES[k - 1]!), tone: 'hint' }]
  },
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  keypress: {
    items: [keypress, whichWrong, hopChainFull] as ItemLogic[],
    fallback: whichWrong as ItemLogic,
  },
}
