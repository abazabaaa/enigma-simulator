/**
 * The keypress task's machine, twice (PURE; L4 allows a chapter's data*.ts):
 *  - KEYPRESS_PROVIDED: the JavaScript the code runner prepends to the learner's source. It defines
 *    `runKeypress(state, key)`, which calls the learner's `enigmaKeypress(state, key, parts)` with instrumented parts:
 *    every part call records a PathHop through the worker's `__recordHop`, with the engine's stage names.
 *  - keypressHops(config, key, bug): the same press in TypeScript, correct (bug null) or with one of six seeded bugs,
 *    as the 11 hops a buggy enigmaKeypress would record, each labelled with the stage the correct press has at that
 *    place. which-wrong's ghosts come from here; the unit tests hold both against the engine.
 */

import type { Letter, MachineConfig, TraceStage } from '../../contracts/core'
import type { PathHop } from '../../contracts/stage'
import {
  LETTERS,
  REFLECTORS,
  REFLECTOR_PERMS,
  ROTORS,
  ROTOR_PERMS,
  createMachine,
  fromPairs,
  mod,
  pressKey,
  step,
  type ReflectorName,
  type RotorName,
  type TraceStep,
} from '../../engine'

const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const L = (i: number): Letter => LETTERS[mod(i)]!

/** The state the learner's function receives: plain data, windows and rings as letters. */
export interface KeypressState {
  readonly rotors: readonly RotorName[]
  readonly rings: string
  readonly positions: string
  readonly plugboard: readonly string[]
  readonly reflector: ReflectorName
}

export const stateOf = (c: MachineConfig): KeypressState => ({
  rotors: [...c.rotors],
  rings: c.rings.join(''),
  positions: c.positions.join(''),
  plugboard: [...c.plugboard],
  reflector: c.reflector,
})

export const configOf = (s: KeypressState): MachineConfig => ({
  model: 'I',
  reflector: s.reflector,
  rotors: [...s.rotors],
  rings: [...s.rings] as Letter[],
  positions: [...s.positions] as Letter[],
  plugboard: [...s.plugboard],
})

/** What one press returns: the lamp and the windows after the step. */
export interface KeypressResult {
  readonly output: Letter
  readonly positions: string
}

/** The engine's answer for one press. */
export function keypressResult(s: KeypressState, key: Letter): KeypressResult {
  const r = pressKey(createMachine(configOf(s)), key)
  return { output: r.output, positions: r.state.positions.map(L).join('') }
}

/** The engine's trace for one press (after the step), as plain PathHops. */
export function referenceHops(s: KeypressState, key: Letter): PathHop[] {
  return pressKey(createMachine(configOf(s)), key).trace.map(plainHop)
}

function plainHop(t: TraceStep): PathHop {
  const hop: PathHop = { kind: t.kind, stage: t.stage, input: t.input, output: t.output, inputIndex: t.inputIndex, outputIndex: t.outputIndex }
  return t.kind === 'rotor' ? { ...hop, slotIndex: t.slotIndex } : hop
}

/** The 11 stages of a three-rotor press, in order. */
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

/** The hop the keypress prediction asks about: the letter leaving the middle rotor on the way back. */
export const PROBE_HOP = STAGES.indexOf('rotor-middle-bwd')

// ---------------------------------------------------------------------------
// The provided parts (JavaScript, run in the worker)
// ---------------------------------------------------------------------------

const ENIGMA_I_ROTORS: readonly RotorName[] = ['I', 'II', 'III', 'IV', 'V']
const ROTOR_DATA = Object.fromEntries(ENIGMA_I_ROTORS.map((n) => [n, { wiring: ROTORS[n].wiring, turnovers: ROTORS[n].turnovers }]))
const REFLECTOR_DATA = Object.fromEntries((['A', 'B', 'C'] as const).map((n) => [n, REFLECTORS[n].wiring]))

/**
 * Prepended to the learner's code. Only `runKeypress` is a top-level name. Parts take and return letters; `step`
 * takes the state and returns the state after the rotors turn (windows in `positions`), and the rotor parts use the
 * windows of the last state `step` returned (the state passed in, if step was never called).
 */
export const KEYPRESS_PROVIDED = `const runKeypress = (() => {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const ROTORS = ${JSON.stringify(ROTOR_DATA)}
  const REFLECTORS = ${JSON.stringify(REFLECTOR_DATA)}
  const SLOT = { left: 0, middle: 1, right: 2 }
  const at = (c) => ABC.indexOf(c)
  const mod = (x) => ((x % 26) + 26) % 26
  const letter = (part, c) => {
    if (typeof c !== 'string' || c.length !== 1 || at(c) < 0) throw new TypeError(part + ' takes one letter A-Z, not ' + JSON.stringify(c))
    return c
  }
  const slotOf = (part, slot) => {
    if (!Object.hasOwn(SLOT, slot)) throw new TypeError(part + " takes a slot 'right', 'middle' or 'left', not " + JSON.stringify(slot))
    return SLOT[slot]
  }
  function stepped(state) {
    const p = [...state.positions].map(at)
    const turnover = (i) => ROTORS[state.rotors[i]].turnovers.includes(ABC[p[i]])
    const middle = turnover(1)
    const right = turnover(2)
    const q = [...p]
    q[2] = mod(p[2] + 1)
    if (right || middle) q[1] = mod(p[1] + 1)
    if (middle) q[0] = mod(p[0] + 1)
    return { ...state, positions: q.map((i) => ABC[i]).join('') }
  }
  function makeParts(state) {
    let now = state
    const hop = (kind, stage, input, output, extra) => {
      __recordHop({ kind, stage, input, output, inputIndex: at(input), outputIndex: at(output), ...extra })
      return output
    }
    const plug = (c) => {
      for (const pair of now.plugboard) {
        if (pair[0] === c) return pair[1]
        if (pair[1] === c) return pair[0]
      }
      return c
    }
    const rotor = (i, c, back) => {
      const w = ROTORS[now.rotors[i]].wiring
      const o = mod(at(now.positions[i]) - at(now.rings[i]))
      const x = mod(at(c) + o)
      return ABC[mod((back ? w.indexOf(ABC[x]) : at(w[x])) - o)]
    }
    return {
      step: (s) => (now = stepped(s)),
      plugIn: (c) => hop('plugboard', 'plugboard-in', letter('plugIn', c), plug(c)),
      etwIn: (c) => hop('etw', 'etw-in', letter('etwIn', c), c),
      rotorFwd: (slot, c) => {
        const i = slotOf('rotorFwd', slot)
        return hop('rotor', 'rotor-' + slot + '-fwd', letter('rotorFwd', c), rotor(i, c, false), { slotIndex: i })
      },
      reflect: (c) => hop('reflector', 'reflector', letter('reflect', c), REFLECTORS[now.reflector][at(c)]),
      rotorBwd: (slot, c) => {
        const i = slotOf('rotorBwd', slot)
        return hop('rotor', 'rotor-' + slot + '-bwd', letter('rotorBwd', c), rotor(i, c, true), { slotIndex: i })
      },
      etwOut: (c) => hop('etw', 'etw-out', letter('etwOut', c), c),
      plugOut: (c) => hop('plugboard', 'plugboard-out', letter('plugOut', c), plug(c)),
    }
  }
  return function runKeypress(state, key) {
    const r = enigmaKeypress(state, key, makeParts(state))
    return r !== null && typeof r === 'object' ? { output: r.output, positions: r.positions } : r
  }
})()
`

// ---------------------------------------------------------------------------
// The same press in TypeScript, with six seeded bugs (which-wrong)
// ---------------------------------------------------------------------------

export type Bug = 'no-step' | 'swap-middle-left' | 'backward-forward' | 'ring-sign' | 'plug-once' | 'no-reflector'

/** The six bugs of PLAN §4.4 which-wrong. */
export const BUGS: readonly Bug[] = ['no-step', 'swap-middle-left', 'backward-forward', 'ring-sign', 'plug-once', 'no-reflector']

export const BUG_LABEL: Readonly<Record<Bug, string>> = {
  'no-step': 'it encodes before stepping the rotors',
  'swap-middle-left': 'it swaps the middle and the left rotor',
  'backward-forward': 'on the way back it uses the rotors’ forward wiring',
  'ring-sign': 'it adds the ring setting instead of subtracting it',
  'plug-once': 'it applies the plugboard only on the way in',
  'no-reflector': 'it skips the reflector',
}

/**
 * One press of `key` on `config` as a (buggy) enigmaKeypress records it: 11 hops, hop k labelled with STAGES[k]
 * (the stage the correct press has there), the letters those of the buggy press. A skipped part passes its letter
 * through unchanged.
 */
export function keypressHops(config: MachineConfig, key: Letter, bug: Bug | null): PathHop[] {
  const { start, stepped, rings, plug } = prepared(config)
  const positions = bug === 'no-step' ? start : stepped
  const offset = (i: number) => mod(positions[i]! + (bug === 'ring-sign' ? rings[i]! : -rings[i]!))
  const rotor = (i: number, x: number, back: boolean): number => {
    const o = offset(i)
    const table = back && bug !== 'backward-forward' ? ROTOR_PERMS[config.rotors[i]!].backward : ROTOR_PERMS[config.rotors[i]!].forward
    return mod(table[mod(x + o)]! - o)
  }
  // Rotor indices (left 0, middle 1, right 2) in the order the (buggy) code calls them.
  const forward = bug === 'swap-middle-left' ? [2, 0, 1] : [2, 1, 0]
  const backward = bug === 'swap-middle-left' ? [1, 0, 2] : [0, 1, 2]
  const through: ((x: number) => number)[] = [
    (x) => plug[x]!,
    (x) => x,
    ...forward.map((i) => (x: number) => rotor(i, x, false)),
    (x) => (bug === 'no-reflector' ? x : REFLECTOR_PERMS[config.reflector][x]!),
    ...backward.map((i) => (x: number) => rotor(i, x, true)),
    (x) => x,
    (x) => (bug === 'plug-once' ? x : plug[x]!),
  ]
  const slotIndex: Partial<Record<TraceStage, number>> = {
    'rotor-right-fwd': 2,
    'rotor-middle-fwd': 1,
    'rotor-left-fwd': 0,
    'rotor-left-bwd': 0,
    'rotor-middle-bwd': 1,
    'rotor-right-bwd': 2,
  }
  let x = idx(key)
  return STAGES.map((stage, k) => {
    const out = through[k]!(x)
    const kind: PathHop['kind'] = stage.startsWith('plugboard') ? 'plugboard' : stage.startsWith('etw') ? 'etw' : stage === 'reflector' ? 'reflector' : 'rotor'
    const hop: PathHop = { kind, stage, input: L(x), output: L(out), inputIndex: x, outputIndex: out }
    x = out
    return slotIndex[stage] === undefined ? hop : { ...hop, slotIndex: slotIndex[stage] }
  })
}

interface Prepared {
  readonly start: readonly number[]
  readonly stepped: readonly number[]
  readonly rings: readonly number[]
  readonly plug: readonly number[]
}

/** What every press of one configuration shares (generators ask for several bugs of the same machine). */
const preparedCache = new WeakMap<MachineConfig, Prepared>()
function prepared(config: MachineConfig): Prepared {
  let p = preparedCache.get(config)
  if (!p) {
    const start = createMachine(config)
    p = { start: start.positions, stepped: step(start).state.positions, rings: config.rings.map(idx), plug: fromPairs(config.plugboard) }
    preparedCache.set(config, p)
  }
  return p
}

/** The first hop whose output differs from the reference's (−1 when the whole path agrees). */
export function firstDivergence(hops: readonly PathHop[], reference: readonly PathHop[]): number {
  const n = Math.max(hops.length, reference.length)
  for (let k = 0; k < n; k++) if (hops[k]?.output !== reference[k]?.output) return k
  return -1
}

/**
 * The hop where each bug first bends the path, as the bug itself dictates: the right rotor without the step, the
 * middle rotor's place when middle and left are swapped, the first rotor on the way back with forward wiring, the
 * first rotor (in path order) whose ring setting is not 01 or 14 (only those have p + r ≠ p − r), the plugboard on
 * the way out, the reflector. null when the bug cannot show on this configuration (all rings 01 or 14).
 */
export function claimedHop(bug: Bug, config: MachineConfig): number | null {
  switch (bug) {
    case 'no-step':
      return STAGES.indexOf('rotor-right-fwd')
    case 'swap-middle-left':
      return STAGES.indexOf('rotor-middle-fwd')
    case 'backward-forward':
      return STAGES.indexOf('rotor-left-bwd')
    case 'ring-sign': {
      const firstRing = [2, 1, 0].findIndex((i) => mod(2 * idx(config.rings[i]!)) !== 0)
      return firstRing === -1 ? null : STAGES.indexOf('rotor-right-fwd') + firstRing
    }
    case 'plug-once':
      return STAGES.indexOf('plugboard-out')
    case 'no-reflector':
      return STAGES.indexOf('reflector')
  }
}
