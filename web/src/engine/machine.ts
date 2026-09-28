/**
 * The Enigma machine: an immutable, data-driven core.
 *
 * Every function takes a `MachineState` and returns a NEW state; nothing is mutated, so the
 * state can live in React/Zustand stores, be diffed, replayed or animated freely.
 *
 * Conventions (verified against every published vector in __fixtures__/vectors.json):
 *   - `config.rotors`, `config.rings`, `config.positions` and `state.positions` are listed
 *     LEFT → RIGHT as the operator sees them. The RIGHTMOST rotor is the fast rotor. On the
 *     M4 the leftmost entry is the Greek rotor (Beta/Gamma), which never steps.
 *   - A key press first STEPS the rotors, then the current flows (see `TraceStage`).
 *   - Ring setting r and window position p give the core an offset o = (p − r) mod 26:
 *       forward(x)  = (W[(x + o) mod 26] − o) mod 26,  backward uses W⁻¹.
 *     The ring moves the wiring AND the notch relative to the alphabet ring; the turnover test
 *     uses the window letter p because the notch is fixed to the alphabet ring.
 *   - Stepping (with R, M, L the three rightmost rotors):
 *       middle steps if R is at its turnover OR M is at its turnover (the double step);
 *       left steps if M is at its turnover; R always steps.
 */

import { type Letter, LETTERS, SIZE, indexToLetter, isLetter, letterToIndex, mod } from './alphabet'
import { fromPairs, type Perm } from './permutation'
import {
  MODELS,
  MODEL_NAMES,
  REFLECTORS,
  REFLECTOR_PERMS,
  ROTORS,
  ROTOR_PERMS,
  type ModelName,
  type ReflectorName,
  type RotorName,
} from './wiring'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A validated, normalised machine configuration (what `createMachine` stores). */
export interface MachineConfig {
  readonly model: ModelName
  readonly reflector: ReflectorName
  /** Walzenlage, LEFT → RIGHT. 3 rotors, or 4 on the M4 (Greek rotor first). Rightmost = fast. */
  readonly rotors: readonly RotorName[]
  /** Ringstellung per rotor, LEFT → RIGHT, as letters ('A' = 01, 'B' = 02, …). */
  readonly rings: readonly Letter[]
  /** Start window letters (Grundstellung / message key), LEFT → RIGHT. */
  readonly positions: readonly Letter[]
  /** Steckerverbindungen as two-letter pairs, e.g. ['AV', 'BS']. At most 13, no letter twice. */
  readonly plugboard: readonly string[]
}

/**
 * What callers may pass to `createMachine` / `validateConfig`. Rings and positions may be a
 * string ('AAA') or an array; the plugboard may be 'AV BS CG' or ['AV', 'BS', 'CG'] or omitted.
 * Letters are case-insensitive. A `MachineConfig` is always a valid input.
 */
export interface MachineConfigInput {
  readonly model: ModelName
  readonly reflector: ReflectorName
  readonly rotors: readonly RotorName[]
  readonly rings: string | readonly string[]
  readonly positions: string | readonly string[]
  readonly plugboard?: string | readonly string[]
}

export interface MachineState {
  readonly config: MachineConfig
  /** CURRENT window positions as indices (A = 0), LEFT → RIGHT. `config.positions` is the start. */
  readonly positions: readonly number[]
}

/** Physical slot of a rotor. 'greek' exists only on the M4. */
export type RotorSlot = 'greek' | 'left' | 'middle' | 'right'

export interface Stepped {
  readonly left: boolean
  readonly middle: boolean
  readonly right: boolean
}

export interface StepResult {
  readonly state: MachineState
  readonly stepped: Stepped
  /**
   * True when the middle rotor advanced because its OWN notch was engaged, without a carry from
   * the right rotor — the double-step anomaly (e.g. AEW → BFX in ADU → ADV → AEW → BFX).
   */
  readonly doubleStep: boolean
}

export type RotorDirection = 'fwd' | 'bwd'

/**
 * Signal-path stages, in order. A 3-rotor machine produces 11 stages (no 'greek' ones),
 * the M4 produces 13:
 *   plugboard-in, etw-in,
 *   rotor-right-fwd, rotor-middle-fwd, rotor-left-fwd, [rotor-greek-fwd],
 *   reflector,
 *   [rotor-greek-bwd], rotor-left-bwd, rotor-middle-bwd, rotor-right-bwd,
 *   etw-out, plugboard-out
 */
export type TraceStage =
  | 'plugboard-in'
  | 'etw-in'
  | `rotor-${RotorSlot}-${RotorDirection}`
  | 'reflector'
  | 'etw-out'
  | 'plugboard-out'

interface TraceStepBase {
  readonly stage: TraceStage
  /** Letter entering this stage, in the fixed frame of the machine (the ETW contact it faces). */
  readonly input: Letter
  /** Letter leaving this stage, in the fixed frame of the machine. */
  readonly output: Letter
  readonly inputIndex: number
  readonly outputIndex: number
}

export interface PlugboardTraceStep extends TraceStepBase {
  readonly kind: 'plugboard'
  readonly stage: 'plugboard-in' | 'plugboard-out'
  /** True if a cable is plugged into this letter's socket (input ≠ output). */
  readonly plugged: boolean
}

export interface EtwTraceStep extends TraceStepBase {
  readonly kind: 'etw'
  readonly stage: 'etw-in' | 'etw-out'
}

export interface RotorTraceStep extends TraceStepBase {
  readonly kind: 'rotor'
  readonly stage: `rotor-${RotorSlot}-${RotorDirection}`
  readonly direction: RotorDirection
  readonly slot: RotorSlot
  /** Index into `config.rotors` (LEFT → RIGHT). */
  readonly slotIndex: number
  readonly rotor: RotorName
  /** Letter showing in the window at the moment of encoding (i.e. after stepping). */
  readonly window: Letter
  /** Window position as an index (A = 0). */
  readonly position: number
  /** Ring setting as an index (A/01 = 0). */
  readonly ring: number
  /** Rotation of the wiring core relative to the fixed contacts: (position − ring) mod 26. */
  readonly offset: number
  /**
   * Core contact the current enters, in the core's own frame (an index into the rotor's wiring
   * table): (inputIndex + offset) mod 26. Forward it is on the core's right face, backward on
   * its left face. Core contact k faces the fixed contact (k − offset) mod 26.
   */
  readonly entryContact: number
  /**
   * Core contact the current leaves from (core frame). Forward: wiring[entry] on the left face;
   * backward: wiring⁻¹[entry] on the right face. outputIndex = (exitContact − offset) mod 26.
   */
  readonly exitContact: number
}

export interface ReflectorTraceStep extends TraceStepBase {
  readonly kind: 'reflector'
  readonly stage: 'reflector'
  readonly reflector: ReflectorName
}

export type TraceStep = PlugboardTraceStep | EtwTraceStep | RotorTraceStep | ReflectorTraceStep

export interface EncodeResult {
  readonly output: Letter
  readonly trace: readonly TraceStep[]
}

export interface StepInfo {
  readonly stepped: Stepped
  readonly doubleStep: boolean
  /** Window positions (indices, LEFT → RIGHT) before and after stepping. */
  readonly before: readonly number[]
  readonly after: readonly number[]
}

export interface PressResult {
  readonly state: MachineState
  readonly output: Letter
  readonly trace: readonly TraceStep[]
  readonly stepping: StepInfo
}

export interface EncipherOptions {
  /**
   * What to do with characters other than A–Z / a–z (spaces, digits, punctuation):
   * false (default) drops them — they are not enciphered and do not step the rotors, as on the
   * real keyboard, which has only 26 keys; true copies them to the output unchanged, still
   * without stepping (handy for keeping 5-letter groups).
   */
  readonly keepNonLetters?: boolean
}

export class EnigmaConfigError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`Invalid Enigma configuration: ${problems.join('; ')}`)
    this.name = 'EnigmaConfigError'
    this.problems = problems
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** The canonical default key: Enigma I, UKW-B, rotors I II III, rings AAA, start AAA, no plugs. */
export const DEFAULT_CONFIG: MachineConfig = Object.freeze({
  model: 'I',
  reflector: 'B',
  rotors: Object.freeze(['I', 'II', 'III']),
  rings: Object.freeze(['A', 'A', 'A']),
  positions: Object.freeze(['A', 'A', 'A']),
  plugboard: Object.freeze([]),
}) as MachineConfig

const has = (obj: object, key: unknown): boolean => typeof key === 'string' && Object.hasOwn(obj, key)

function splitLetters(value: unknown): string[] {
  if (typeof value === 'string') return value.replace(/\s+/g, '').toUpperCase().split('')
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toUpperCase())
  return []
}

function splitPairs(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const list: unknown[] = typeof value === 'string' ? value.split(/[\s,]+/) : Array.isArray(value) ? value : []
  return list.map((p) => String(p).trim().toUpperCase()).filter((p) => p !== '')
}

/** Rotor slot names for a machine with `count` rotors, LEFT → RIGHT. */
export function slotNames(count: number): readonly RotorSlot[] {
  return count === 4 ? ['greek', 'left', 'middle', 'right'] : ['left', 'middle', 'right']
}

/**
 * Check a configuration against the historical rules of its model. Returns a list of
 * human-readable problems (empty when valid). Never throws.
 */
export function validateConfig(input: MachineConfigInput): string[] {
  const problems: string[] = []
  if (typeof input !== 'object' || input === null) return ['The configuration must be an object']
  if (!has(MODELS, input.model)) {
    return [`Unknown model ${JSON.stringify(input.model)} (expected ${MODEL_NAMES.join(', ')})`]
  }
  const model = MODELS[input.model]

  if (!has(REFLECTORS, input.reflector)) {
    problems.push(`Unknown reflector ${JSON.stringify(input.reflector)}`)
  } else if (!model.reflectors.includes(input.reflector)) {
    problems.push(`Reflector ${input.reflector} does not fit the ${model.label} (use ${model.reflectors.join(', ')})`)
  }

  const rotors: unknown[] = Array.isArray(input.rotors) ? input.rotors : []
  if (rotors.length !== model.slots) {
    problems.push(`The ${model.label} takes ${model.slots} rotors, got ${rotors.length}`)
  }
  rotors.forEach((name, i) => {
    if (!has(ROTORS, name)) {
      problems.push(`Unknown rotor ${JSON.stringify(name)}`)
      return
    }
    const rotor = name as RotorName
    const greekSlot = model.slots === 4 && i === 0
    const allowed = greekSlot ? model.greekRotors : model.rotors
    if (!allowed.includes(rotor)) {
      problems.push(
        greekSlot
          ? `The M4's leftmost slot takes a Greek rotor (${model.greekRotors.join(' or ')}), got ${rotor}`
          : `Rotor ${rotor} cannot go in slot ${i + 1} of the ${model.label} (use ${model.rotors.join(', ')})`,
      )
    }
  })
  if (new Set(rotors).size !== rotors.length) {
    problems.push(`Each rotor exists only once per machine; got ${rotors.join(' ')}`)
  }

  for (const [field, value] of [
    ['rings', input.rings],
    ['positions', input.positions],
  ] as const) {
    const letters = splitLetters(value)
    if (letters.length !== rotors.length) {
      problems.push(`${field} needs one letter per rotor (${rotors.length}), got ${JSON.stringify(value)}`)
    } else if (!letters.every(isLetter)) {
      problems.push(`${field} must be letters A–Z, got ${JSON.stringify(value)}`)
    }
  }

  const pairs = splitPairs(input.plugboard)
  if (pairs.length > model.maxPlugPairs) {
    problems.push(`At most ${model.maxPlugPairs} plugboard cables fit (26 sockets), got ${pairs.length}`)
  }
  const used = new Set<string>()
  for (const pair of pairs) {
    if (pair.length !== 2 || !isLetter(pair[0]) || !isLetter(pair[1])) {
      problems.push(`Plugboard pair ${JSON.stringify(pair)} must be two letters`)
      continue
    }
    if (pair[0] === pair[1]) problems.push(`Plugboard pair ${pair} connects a letter to itself`)
    for (const letter of new Set(pair)) {
      if (used.has(letter)) problems.push(`Letter ${letter} is plugged more than once`)
      used.add(letter)
    }
  }
  return problems
}

/** Validate and normalise (uppercase letters, arrays, frozen). Throws `EnigmaConfigError`. */
export function normalizeConfig(input: MachineConfigInput): MachineConfig {
  const problems = validateConfig(input)
  if (problems.length) throw new EnigmaConfigError(problems)
  return Object.freeze({
    model: input.model,
    reflector: input.reflector,
    rotors: Object.freeze([...input.rotors]),
    rings: Object.freeze(splitLetters(input.rings) as Letter[]),
    positions: Object.freeze(splitLetters(input.positions) as Letter[]),
    plugboard: Object.freeze(splitPairs(input.plugboard)),
  })
}

// ---------------------------------------------------------------------------
// Compiled form (cached per config object)
// ---------------------------------------------------------------------------

interface Compiled {
  readonly slots: readonly RotorSlot[]
  readonly rings: readonly number[]
  readonly forward: readonly Perm[]
  readonly backward: readonly Perm[]
  readonly turnovers: readonly (readonly number[])[]
  readonly reflector: Perm
  readonly plugboard: Perm
}

const compiledCache = new WeakMap<MachineConfig, Compiled>()

function compile(config: MachineConfig): Compiled {
  let c = compiledCache.get(config)
  if (!c) {
    c = {
      slots: slotNames(config.rotors.length),
      rings: config.rings.map(letterToIndex),
      forward: config.rotors.map((r) => ROTOR_PERMS[r].forward),
      backward: config.rotors.map((r) => ROTOR_PERMS[r].backward),
      turnovers: config.rotors.map((r) => ROTORS[r].turnovers.split('').map(letterToIndex)),
      reflector: REFLECTOR_PERMS[config.reflector],
      plugboard: fromPairs(config.plugboard),
    }
    compiledCache.set(config, c)
  }
  return c
}

function toIndex(value: Letter | number): number {
  return typeof value === 'number' ? mod(value) : letterToIndex(value)
}

function freezeState(config: MachineConfig, positions: number[]): MachineState {
  return Object.freeze({ config, positions: Object.freeze(positions) })
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

/** Build a machine at its start positions. Throws `EnigmaConfigError` for invalid configs. */
export function createMachine(config: MachineConfigInput): MachineState {
  const normalized = normalizeConfig(config)
  return freezeState(normalized, normalized.positions.map(letterToIndex))
}

/** The same machine with its rotors turned by hand to new window positions (no stepping). */
export function withPositions(state: MachineState, positions: string | readonly (Letter | number)[]): MachineState {
  const list = typeof positions === 'string' ? positions.split('') : positions
  if (list.length !== state.positions.length) {
    throw new EnigmaConfigError([`Expected ${state.positions.length} positions, got ${list.length}`])
  }
  return freezeState(
    state.config,
    list.map((p) => (typeof p === 'number' ? mod(p) : letterToIndex(p))),
  )
}

/** Whether `rotor` showing `position` in its window will carry its left neighbour on the next key press. */
export function isAtTurnover(rotor: RotorName, position: Letter | number): boolean {
  return ROTORS[rotor].turnovers.includes(indexToLetter(toIndex(position)))
}

/** Advance the rotors as one key press does (before the current flows). */
export function step(state: MachineState): StepResult {
  const { turnovers } = compile(state.config)
  const p = state.positions
  const R = p.length - 1
  const M = R - 1
  const L = R - 2
  const rightAt = turnovers[R]!.includes(p[R]!)
  const middleAt = turnovers[M]!.includes(p[M]!)
  const stepped: Stepped = { right: true, middle: rightAt || middleAt, left: middleAt }
  const next = [...p]
  next[R] = mod(p[R]! + 1)
  if (stepped.middle) next[M] = mod(p[M]! + 1)
  if (stepped.left) next[L] = mod(p[L]! + 1)
  // On the M4 the Greek rotor (index 0) is never touched.
  return { state: freezeState(state.config, next), stepped, doubleStep: middleAt && !rightAt }
}

/** Send current for `input` (0..25) through the machine at `positions`; optionally record the trace. */
function signal(config: MachineConfig, c: Compiled, positions: readonly number[], input: number, trace?: TraceStep[]): number {
  const n = positions.length
  let x = input

  const plugIn = c.plugboard[x]!
  trace?.push(plainStep('plugboard', 'plugboard-in', x, plugIn, { plugged: plugIn !== x }))
  x = plugIn
  trace?.push(plainStep('etw', 'etw-in', x, x, {}))

  const through = (i: number, direction: RotorDirection) => {
    const offset = mod(positions[i]! - c.rings[i]!)
    const entry = mod(x + offset)
    const exit = (direction === 'fwd' ? c.forward : c.backward)[i]![entry]!
    const out = mod(exit - offset)
    if (trace) {
      const slot = c.slots[i]!
      trace.push({
        kind: 'rotor',
        stage: `rotor-${slot}-${direction}`,
        direction,
        slot,
        slotIndex: i,
        rotor: config.rotors[i]!,
        window: indexToLetter(positions[i]!),
        position: positions[i]!,
        ring: c.rings[i]!,
        offset,
        entryContact: entry,
        exitContact: exit,
        input: indexToLetter(x),
        output: indexToLetter(out),
        inputIndex: x,
        outputIndex: out,
      })
    }
    x = out
  }

  for (let i = n - 1; i >= 0; i--) through(i, 'fwd') // right → left (→ Greek on the M4)
  const reflected = c.reflector[x]!
  trace?.push(plainStep('reflector', 'reflector', x, reflected, { reflector: config.reflector }))
  x = reflected
  for (let i = 0; i < n; i++) through(i, 'bwd') // (Greek →) left → right

  trace?.push(plainStep('etw', 'etw-out', x, x, {}))
  const plugOut = c.plugboard[x]!
  trace?.push(plainStep('plugboard', 'plugboard-out', x, plugOut, { plugged: plugOut !== x }))
  return plugOut
}

function plainStep<K extends 'plugboard' | 'etw' | 'reflector', S extends TraceStage, E extends object>(
  kind: K,
  stage: S,
  input: number,
  output: number,
  extra: E,
) {
  return {
    kind,
    stage,
    input: indexToLetter(input),
    output: indexToLetter(output),
    inputIndex: input,
    outputIndex: output,
    ...extra,
  } as TraceStep
}

/**
 * Encipher one letter at the CURRENT positions, WITHOUT stepping, and return the full signal
 * trace. A real key press is `pressKey` (step, then encode).
 */
export function encodeLetter(state: MachineState, letter: string): EncodeResult {
  const input = letterToIndex(letter)
  const trace: TraceStep[] = []
  const out = signal(state.config, compile(state.config), state.positions, input, trace)
  return { output: indexToLetter(out), trace }
}

/** One key press: step the rotors, then encode. Throws RangeError (without stepping) for a non-letter. */
export function pressKey(state: MachineState, letter: string): PressResult {
  letterToIndex(letter) // validate before moving anything
  const { state: next, stepped, doubleStep } = step(state)
  const { output, trace } = encodeLetter(next, letter)
  return {
    state: next,
    output,
    trace,
    stepping: { stepped, doubleStep, before: state.positions, after: next.positions },
  }
}

/**
 * Encipher (or decipher — Enigma is self-reciprocal) a whole text from `state`.
 * Letters are case-insensitive and come out uppercase; see `EncipherOptions` for everything else.
 * Returns the output and the state after the last key press.
 */
export function encipher(
  state: MachineState,
  text: string,
  options: EncipherOptions = {},
): { readonly state: MachineState; readonly output: string } {
  const c = compile(state.config)
  let current = state
  let output = ''
  for (const ch of text) {
    const up = ch.toUpperCase()
    if (isLetter(up)) {
      current = step(current).state
      output += indexToLetter(signal(current.config, c, current.positions, letterToIndex(up)))
    } else if (options.keepNonLetters) {
      output += ch
    }
  }
  return { state: current, output }
}

/**
 * The full 26-letter substitution of a single rotor in the machine frame (forward direction,
 * towards the reflector) at a ring setting and window position. Use `inverse()` for the
 * return path. Equivalent to conjugate(wiring, shift(−offset)) with offset = position − ring.
 */
export function rotorPermutation(rotor: RotorName, ring: Letter | number, position: Letter | number): Perm {
  const w = ROTOR_PERMS[rotor].forward
  const offset = mod(toIndex(position) - toIndex(ring))
  return LETTERS.map((_, i) => mod(w[mod(i + offset)]! - offset))
}

/**
 * The whole machine's substitution at the CURRENT positions (no stepping): keyboard letter →
 * lamp. Always an involution with no fixed points. Rejewski's A…F are these at six successive
 * positions.
 */
export function machinePermutation(state: MachineState): Perm {
  const c = compile(state.config)
  return Array.from({ length: SIZE }, (_, i) => signal(state.config, c, state.positions, i))
}

/** Window letters LEFT → RIGHT, e.g. "ADU". */
export function positionsToString(stateOrPositions: MachineState | readonly number[]): string {
  const positions = 'positions' in stateOrPositions ? stateOrPositions.positions : stateOrPositions
  return positions.map(indexToLetter).join('')
}
