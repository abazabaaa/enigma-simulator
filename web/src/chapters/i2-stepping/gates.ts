/**
 * Chapter i2-stepping · gate `stepping` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts and lesson/kinds only.
 *  - windows      letters(9) · 2/3 · the windows after each of three presses; every instance holds a double step
 *  - middle-steps set-machine · 2/3 · set the windows so that the middle rotor steps on the next press
 *  - first-letter choice(4) · once · the first letter is enciphered after the step (review m5)
 *  - ring-probe   choice(4) · once · a ring change or a turn by hand: the window and the turnover letter after it
 *  - windows-m3   letters(9) · once · transfer · an M3 with a double-notched rotor (VI–VIII)
 *  - left-steps   the fallback: set-machine, the left rotor steps next with the right rotor left alone (double step)
 * The scene Views import the machines and the step helpers below, so the scenes and the gate agree.
 */

import type { Choice, Letter, MachineConfig, MachineConfigInput, RotorName, RotorSlot } from '../../contracts/core'
import type { ChapterGates, ItemLogic, ItemSetup } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { Highlight, PartId, StageRef } from '../../contracts/stage'
import { LETTERS, ROTORS, createMachine, normalizeConfig, positionsToString, step } from '../../engine'
import { int, pick, randLetter, randomConfig, sample, shuffle, type Rng } from '../../lib/rng'
import { choiceItem, lettersItem, setMachineItem, splitWindows, verdict, windowsAfterPresses, windowsRollback } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
const idx = (l: string): number => LETTERS.indexOf(l as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const SLOTS = ['left', 'middle', 'right'] as const

/** The letter k places before `l` on the ring. */
export const lettersBefore = (l: string, k: number): Letter => L(idx(l) - k)

// ---------------------------------------------------------------------------
// The chapter's machines (scenes) and the stepping facts every View and prompt shows
// ---------------------------------------------------------------------------

/** Enigma I, UKW-B, rotors I II III, rings 01 01 01, windows AAA, no plugs (G14: the plugboard comes in I.3). */
export const START: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

/** The double-step start: the verified sequence ADU → ADV → AEW → BFX (research notes, Wikipedia). */
export const DOUBLE_START: MachineConfig = normalizeConfig({ ...START, positions: 'ADU' })

/** Every control locked, the keyboard included, and the lamps hidden (prediction items and read-only scenes). */
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

/** The window letter(s) before the carry: 'Q' for I … 'ZM' for VI–VIII. */
export const turnoversOf = (rotor: RotorName): string => ROTORS[rotor].turnovers

/** Ring settings as the course always shows them: 01–26, never letters. */
export const ringNumber = (ring: string): string => String(idx(ring) + 1).padStart(2, '0')

/** Which rotors move on one press. */
export type Moved = 'none' | 'right' | 'right-middle' | 'all'

export interface StepFacts {
  readonly before: string
  readonly after: string
  readonly moved: readonly RotorSlot[]
  readonly doubleStep: boolean
}

/** The bet option that names what moved. */
export function movedChoice(s: Pick<StepFacts, 'moved'>): Moved {
  const m = new Set(s.moved)
  if (m.has('left')) return 'all'
  if (m.has('middle')) return 'right-middle'
  return m.has('right') ? 'right' : 'none'
}

/** The first `presses` steps from a configuration's start windows (stepping does not depend on the key). */
export function stepsFrom(config: MachineConfigInput, presses: number): StepFacts[] {
  let state = createMachine(config)
  const out: StepFacts[] = []
  for (let k = 0; k < presses; k++) {
    const s = step(state)
    out.push({
      before: positionsToString(state),
      after: positionsToString(s.state),
      moved: SLOTS.filter((slot) => s.stepped[slot]),
      doubleStep: s.doubleStep,
    })
    state = s.state
  }
  return out
}

/** Whether the first `presses` presses from `config` include a double step. */
export const includesDoubleStep = (config: MachineConfigInput, presses: number): boolean =>
  stepsFrom(config, presses).some((s) => s.doubleStep)

// ---------------------------------------------------------------------------
// windows: letters(9), the windows after each of three presses (rollback: windows)
// ---------------------------------------------------------------------------

export interface WindowsInstance {
  readonly length: 9
  readonly config: MachineConfig
}

const I_TO_V: readonly RotorName[] = ['I', 'II', 'III', 'IV', 'V']
const NAVAL: readonly RotorName[] = ['VI', 'VII', 'VIII']
const I_TO_VIII: readonly RotorName[] = [...I_TO_V, ...NAVAL]

/**
 * Three distinct rotors from I–V, random rings, and a double step within the three presses, so an "odometer"
 * answer (the middle rotor moves only when the right one carries it) is always wrong (review B1). Where the double
 * step falls varies: on press 1 (the middle rotor already on its turnover letter, the right rotor one or two places
 * before its own), or on press 2 or 3 (the middle rotor one place before its turnover, the right rotor about to
 * carry it there). The right rotor always carries within the three presses. (The engine flags a double step when
 * the middle rotor steps on its own notch while the right rotor is not at its turnover.)
 */
export function windowsConfig(r: Rng): MachineConfig {
  const base = randomConfig(r, { plugs: 0, rings: 'random' })
  const [left, middle, right] = base.rotors as [RotorName, RotorName, RotorName]
  const tr = turnoversOf(right)[0]!
  const tm = turnoversOf(middle)[0]!
  const leftWindow = base.positions[0]!
  const press = int(r, 3)
  const positions: Letter[] =
    press === 0
      ? [leftWindow, tm as Letter, lettersBefore(tr, 1 + int(r, 2))]
      : [leftWindow, lettersBefore(tm, 1), lettersBefore(tr, press - 1)]
  return normalizeConfig({ ...base, rotors: [left, middle, right], positions })
}

function windowsCheck(i: WindowsInstance, a: string) {
  const expected = windowsAfterPresses(i.config, 3)
  const got = splitWindows(String(a ?? '').toUpperCase().replace(/[^A-Z]/g, ''), 3)
  return verdict(got.join('') === expected.join(''), windowsRollback(i.config, expected, got))
}

const WINDOWS_HINT: readonly Highlight[] = [
  { part: 'notch-right', tone: 'hint' },
  { part: 'pawl-middle', tone: 'hint' },
  { part: 'notch-middle', tone: 'hint' },
]

export const windows = lettersItem<WindowsInstance>({
  id: 'windows',
  rule: WINDOW,
  generate: (r) => ({ length: 9, config: windowsConfig(r) }),
  same: (a, b) => sameJson(a.config, b.config),
  solve: (i) => windowsAfterPresses(i.config, 3).join(''),
  check: windowsCheck,
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'pawls' }),
  highlight: () => WINDOWS_HINT,
})

// ---------------------------------------------------------------------------
// windows-m3: the transfer to the naval M3 and its double-notched rotors VI–VIII (rollback: windows)
// ---------------------------------------------------------------------------

/**
 * Model M3 with one of VI–VIII (turnovers Z and M) in the right or middle slot, and always a double step within
 * two presses (review B1): the middle rotor on its turnover letter with the right rotor one place before its own
 * (double step on press 1), or the middle rotor one place before its turnover with the right rotor on its own
 * (double step on press 2). Either way a double-notched rotor sits on Z or M within two presses.
 */
export function m3Config(r: Rng): MachineConfig {
  const naval = pick(r, NAVAL)
  const [a, b] = sample(r, I_TO_VIII.filter((x) => x !== naval), 2) as [RotorName, RotorName]
  const rotors: RotorName[] = int(r, 3) === 0 ? [a, naval, b] : [a, b, naval]
  const rings = rotors.map(() => randLetter(r))
  const tm = pick(r, turnoversOf(rotors[1]!).split(''))
  const tr = pick(r, turnoversOf(rotors[2]!).split(''))
  const positions: Letter[] =
    int(r, 2) === 0 ? [randLetter(r), tm as Letter, lettersBefore(tr, 1)] : [randLetter(r), lettersBefore(tm, 1), tr as Letter]
  return normalizeConfig({ model: 'M3', reflector: pick(r, ['B', 'C'] as const), rotors, rings, positions, plugboard: [] })
}

export const windowsM3 = lettersItem<WindowsInstance>({
  id: 'windows-m3',
  rule: ONCE,
  transfer: true,
  generate: (r) => ({ length: 9, config: m3Config(r) }),
  same: (a, b) => sameJson(a.config, b.config),
  solve: (i) => windowsAfterPresses(i.config, 3).join(''),
  check: windowsCheck,
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'pawls' }),
  highlight: () => WINDOWS_HINT,
})

// ---------------------------------------------------------------------------
// set-machine: the middle (or, as the fallback, the left) rotor steps on the next press (rollback: machine)
// ---------------------------------------------------------------------------

export interface StepsInstance {
  readonly setup: ItemSetup & { readonly machine: MachineConfig; readonly stage: StageRef }
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked'
  readonly target: 'middle' | 'left'
}

const STEPS_HINT: Readonly<Record<StepsInstance['target'], readonly Highlight[]>> = {
  middle: [
    { part: 'notch-right', tone: 'hint' },
    { part: 'notch-middle', tone: 'hint' },
  ],
  left: [
    { part: 'notch-middle', tone: 'hint' },
    { part: 'pawl-left', tone: 'hint' },
  ],
}

const STEPS_PARTS: Readonly<Record<StepsInstance['target'], readonly PartId[]>> = {
  middle: ['notch-right', 'pawl-middle'],
  left: ['notch-middle', 'pawl-left'],
}

/** A random order from I–V with random rings and no plugs, at windows where neither the middle nor the left rotor steps. */
export function stepsStart(r: Rng): MachineConfig {
  for (;;) {
    const machine = randomConfig(r, { plugs: 0, rings: 'random' })
    const s = step(createMachine(machine))
    if (!s.stepped.middle && !s.stepped.left) return machine
  }
}

const describeMoved = (moved: readonly RotorSlot[]): string =>
  moved.length === 1 ? `only the ${moved[0]} rotor` : `the ${moved.join(' and ')} rotors`

/**
 * middle-steps: the middle rotor steps on the next press (the right rotor on its turnover letter, or the middle
 * rotor on its own). left-steps, the fallback, keeps the right rotor where it is, so the only way is the middle
 * rotor on its own turnover letter: the double step, the same idea the windows items test (review B1).
 */
export function stepsItem(id: string, target: 'middle' | 'left'): ItemLogic<StepsInstance, MachineConfig> {
  // The rotor whose turnover letter carries the target: the right rotor carries the middle, the middle the left.
  const carrier = target === 'middle' ? 2 : 1
  return setMachineItem<StepsInstance>({
    id,
    rule: WINDOW,
    generate: (r) => ({ setup: { machine: stepsStart(r), stage: 'pawls' }, unlocked: ['positions'], trial: 'locked', target }),
    same: (a, b) => sameJson(a.setup.machine, b.setup.machine) && a.target === b.target,
    predicate(i, cfg) {
      const at = positionsToString(createMachine(cfg))
      const right = i.setup.machine.positions[2]!
      if (target === 'left' && at[2] !== right) {
        return {
          field: 'positions',
          message: `Leave the right rotor at ${right}: turn only the left and middle rotors.`,
          highlight: ['rotor-right'],
        }
      }
      const s = step(createMachine(cfg))
      if (s.stepped[target]) return true
      const moved = SLOTS.filter((slot) => s.stepped[slot])
      const rotor = cfg.rotors[carrier]!
      const who = carrier === 2 ? 'right' : 'middle'
      return {
        field: 'positions',
        message:
          `At ${at} the next press moves ${describeMoved(moved)}, not the ${target} rotor. ` +
          `The ${who} rotor (${rotor}) shows ${at[carrier]}; it carries the ${target} rotor only from its turnover letter ` +
          `${turnoversOf(rotor).split('').join(' or ')} in the window, whatever its ring setting.`,
        highlight: STEPS_PARTS[target],
      }
    },
    solve(i) {
      const m = i.setup.machine
      const positions = [...m.positions]
      positions[carrier] = turnoversOf(m.rotors[carrier]!)[0]! as Letter
      return { ...m, positions }
    },
    sampleAnswer: (i, r) => ({ ...i.setup.machine, positions: [randLetter(r), randLetter(r), randLetter(r)] }),
    mutate(_i, a) {
      const positions = [...a.positions]
      positions[carrier] = L(idx(positions[carrier]!) + 1)
      return { ...a, positions }
    },
    highlight: (i) => STEPS_HINT[i.target],
  })
}

export const middleSteps = stepsItem('middle-steps', 'middle')
export const leftSteps = stepsItem('left-steps', 'left')

// ---------------------------------------------------------------------------
// first-letter: at which windows is the first letter enciphered? (choice, once; review m5)
// ---------------------------------------------------------------------------

export interface FirstLetterInstance {
  readonly options: readonly Choice[]
  readonly config: MachineConfig
}

const shiftWindows = (w: string, by: readonly number[]): string => [...w].map((c, k) => L(idx(c) + by[k]!)).join('')

/**
 * A machine at some windows (a third of them one press before a carry, a third before a double step). Options:
 * the windows after the step (right), the windows before it (the misconception "encipher, then step"), after two
 * steps, and every rotor one on (or the right rotor one back when that coincides with the answer).
 */
export function firstLetterConfig(r: Rng): MachineConfig {
  const base = randomConfig(r, { plugs: 0, rings: 'random' })
  const [, middle, right] = base.rotors as [RotorName, RotorName, RotorName]
  const kind = int(r, 3)
  const positions = [...base.positions]
  if (kind === 1) positions[2] = turnoversOf(right)[0]! as Letter
  if (kind === 2) {
    positions[1] = turnoversOf(middle)[0]! as Letter
    positions[2] = lettersBefore(turnoversOf(right)[0]!, 1 + int(r, 20))
  }
  return normalizeConfig({ ...base, positions })
}

export const firstLetter = choiceItem<FirstLetterInstance>({
  id: 'first-letter',
  rule: ONCE,
  generate(r) {
    const config = firstLetterConfig(r)
    const now = config.positions.join('')
    const [one, two] = stepsFrom(config, 2).map((x) => x.after) as [string, string]
    const all = shiftWindows(now, [1, 1, 1])
    const fourth = all === one ? shiftWindows(now, [0, 0, -1]) : all
    const options: Choice[] = [
      { id: one, label: one },
      { id: now, label: now, misconception: true },
      { id: two, label: two },
      { id: fourth, label: fourth },
    ]
    return { options: shuffle(r, options), config }
  },
  same: (a, b) => sameJson(a.config, b.config),
  solve: (i) => stepsFrom(i.config, 1)[0]!.after,
  check: (i, a) =>
    verdict(
      a === stepsFrom(i.config, 1)[0]!.after,
      { kind: 'none' },
      a === i.config.positions.join('')
        ? 'The rotors step before the current flows, even for the first letter of a message: the letter is enciphered after the step.'
        : 'One key press steps the rotors once, as the pawls allow, and then the current flows.',
    ),
  setup: (i) => ({ machine: i.config, locks: READ_ONLY, stage: 'pawls' }),
  highlight: () => [{ part: 'pawl-right', tone: 'hint' }],
})

// ---------------------------------------------------------------------------
// ring-probe: ring setting versus position, with numbers (choice, once; review m10)
// ---------------------------------------------------------------------------

export interface RingProbeInstance {
  readonly options: readonly Choice[]
  readonly rotor: RotorName
  readonly window: Letter
  readonly ring: Letter
  /** What the operator changes: the ring setting, or the rotor's position (turned by hand). */
  readonly change: 'ring' | 'position'
  /** How many places forward. */
  readonly by: number
}

const probeOption = (window: string, carry: string, misconception = false): Choice => ({
  id: `${window}${carry}`,
  label: `The window shows ${window}, and the rotor carries the middle rotor from ${carry}`,
  ...(misconception ? { misconception: true as const } : {}),
})

/** The correct outcome: a ring change leaves the window; a turn moves it; the turnover letter never moves. */
export function ringProbeAnswer(i: Pick<RingProbeInstance, 'rotor' | 'window' | 'change' | 'by'>): string {
  const window = i.change === 'ring' ? i.window : L(idx(i.window) + i.by)
  return `${window}${turnoversOf(i.rotor)[0]}`
}

export const ringProbe = choiceItem<RingProbeInstance>({
  id: 'ring-probe',
  rule: ONCE,
  generate(r) {
    const rotor = pick(r, I_TO_V)
    const window = randLetter(r)
    const ring = randLetter(r)
    const change = int(r, 3) < 2 ? 'ring' : 'position'
    const by = 1 + int(r, 12)
    const t = turnoversOf(rotor)[0]!
    const moved = L(idx(window) + by)
    const shifted = L(idx(t) + by)
    // Ring change: the distractor "the ring changes the window letter" (§4.4), and "the notch moves".
    // Position change: "the window stays", and "the turnover letter moves with the rotor".
    const options =
      change === 'ring'
        ? [probeOption(window, t), probeOption(moved, t, true), probeOption(window, shifted, true), probeOption(moved, shifted, true)]
        : [probeOption(moved, t), probeOption(window, t, true), probeOption(moved, shifted, true), probeOption(window, shifted, true)]
    return { options: shuffle(r, options), rotor, window, ring, change, by }
  },
  same: (a, b) => sameJson([a.rotor, a.window, a.ring, a.change, a.by], [b.rotor, b.window, b.ring, b.change, b.by]),
  solve: ringProbeAnswer,
  check(i, a) {
    const right = ringProbeAnswer(i)
    const got = String(a ?? '')
    let feedback: string
    if (got[1] !== right[1]) {
      feedback = 'The notch is fixed to the alphabet ring: the rotor carries its neighbour from the same window letter, whatever the ring setting or the position.'
    } else if (i.change === 'ring') {
      feedback = 'The letters in the window are printed on the ring, and the rotor did not turn: a ring setting turns the wiring core against the letters, not the window.'
    } else {
      feedback = 'Turning the rotor by hand moves its letters past the window, one letter per place.'
    }
    return verdict(got === right, { kind: 'none' }, feedback)
  },
  highlight: () => [{ part: 'ring-right', tone: 'hint' }],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  stepping: {
    items: [windows, middleSteps, firstLetter, ringProbe, windowsM3] as ItemLogic[],
    fallback: leftSteps as ItemLogic,
  },
}
