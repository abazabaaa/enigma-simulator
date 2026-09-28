/**
 * Chapter i2-stepping · gate `stepping` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts and lesson/kinds only.
 *  - windows      letters(9) · 2/3 · the windows after each of three presses; even attempts include a double step
 *  - middle-steps set-machine · 2/3 · set the windows so that the middle rotor steps on the next press
 *  - ring-probe   choice(4) · once · constant answer · the ring moves the wiring, not the window letter
 *  - windows-m3   letters(9) · once · transfer · an M3 with a double-notched rotor (VI–VIII)
 *  - left-steps   the fallback: set-machine, the left rotor steps on the next press
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
 * Three distinct rotors from I–V, random rings, the right rotor 0–2 places before its turnover (so it carries
 * within three presses). On even attempts the three presses include a double step: the middle rotor sits on its
 * turnover (the right rotor one or two places before its own), or one place before it with the right rotor about
 * to carry it there. (The engine flags a double step when the middle rotor steps on its own notch alone.)
 */
export function windowsConfig(r: Rng, attempt: number): MachineConfig {
  const base = randomConfig(r, { plugs: 0, rings: 'random' })
  const [left, middle, right] = base.rotors as [RotorName, RotorName, RotorName]
  const tr = turnoversOf(right)[0]!
  const tm = turnoversOf(middle)[0]!
  const leftWindow = base.positions[0]!
  let positions: Letter[]
  if (attempt % 2 === 0) {
    positions =
      int(r, 3) === 0
        ? [leftWindow, tm as Letter, lettersBefore(tr, 1 + int(r, 2))]
        : [leftWindow, lettersBefore(tm, 1), lettersBefore(tr, int(r, 2))]
  } else {
    positions = [leftWindow, randLetter(r), lettersBefore(tr, int(r, 3))]
  }
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
  generate: (r, ctx) => ({ length: 9, config: windowsConfig(r, ctx.attempt) }),
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
 * Model M3 with one of VI–VIII (turnovers Z and M) in the right or middle slot, starting within two presses of a
 * Z or M turnover: the right rotor 0–1 places before Z or M, or the middle rotor on Z/M or one place before it
 * with the right rotor about to carry it there.
 */
export function m3Config(r: Rng): MachineConfig {
  const naval = pick(r, NAVAL)
  const [a, b] = sample(r, I_TO_VIII.filter((x) => x !== naval), 2) as [RotorName, RotorName]
  const inMiddle = int(r, 3) === 0
  const rotors: RotorName[] = inMiddle ? [a, naval, b] : [a, b, naval]
  const rings = rotors.map(() => randLetter(r))
  const turnover = pick(r, ['Z', 'M'] as const)
  let positions: Letter[]
  if (inMiddle) {
    const tr = pick(r, turnoversOf(b).split(''))
    positions = int(r, 2) === 0 ? [randLetter(r), turnover, randLetter(r)] : [randLetter(r), lettersBefore(turnover, 1), lettersBefore(tr, int(r, 2))]
  } else {
    positions = [randLetter(r), randLetter(r), lettersBefore(turnover, int(r, 2))]
  }
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

export function stepsItem(id: string, target: 'middle' | 'left'): ItemLogic<StepsInstance, MachineConfig> {
  // The rotor whose turnover letter carries the target: the right rotor carries the middle, the middle the left.
  const carrier = target === 'middle' ? 2 : 1
  return setMachineItem<StepsInstance>({
    id,
    rule: WINDOW,
    generate: (r) => ({ setup: { machine: stepsStart(r), stage: 'pawls' }, unlocked: ['positions'], trial: 'locked', target }),
    same: (a, b) => sameJson(a.setup.machine, b.setup.machine) && a.target === b.target,
    predicate(_i, cfg) {
      const s = step(createMachine(cfg))
      if (s.stepped[target]) return true
      const moved = SLOTS.filter((slot) => s.stepped[slot])
      const rotor = cfg.rotors[carrier]!
      const at = positionsToString(createMachine(cfg))
      const window = at[carrier]!
      const who = carrier === 2 ? 'right' : 'middle'
      return {
        field: 'positions',
        message:
          `At ${at} the next press moves ${describeMoved(moved)}, not the ${target} rotor. ` +
          `The ${who} rotor (${rotor}) shows ${window}; it carries the ${target} rotor only from its turnover letter ` +
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
// choice: ring vs position (once, constant answer; the distractor "the ring changes the window letter")
// ---------------------------------------------------------------------------

export const RING_OPTIONS: readonly Choice[] = [
  {
    id: 'wiring',
    label: 'The window still shows the same letter, but the wiring inside has turned four places, so the same key lights a different lamp',
  },
  { id: 'window', label: 'The window letter moves on four places', misconception: true },
  { id: 'turnover', label: 'The middle rotor is now carried at a different window letter', misconception: true },
  { id: 'nothing', label: 'Nothing that matters: the ring only relabels the letters, so every lamp stays the same', misconception: true },
]

const RING_FEEDBACK: Readonly<Record<string, string>> = {
  window:
    'The window letter is printed on the ring itself, and the rotor did not turn: the window still shows the same letter. ' +
    'What moved is the wiring core, four places against the letters.',
  turnover:
    'The notch is fixed to the alphabet ring, so it moves with the letters: the rotor still carries its neighbour at the same ' +
    'turnover letter. Only the wiring moved against the ring.',
  nothing:
    'The ring setting turns the wiring core against the letters, so at the same window the current takes different wires and ' +
    'lights a different lamp.',
}

export const ringProbe = choiceItem<{ options: readonly Choice[] }>({
  id: 'ring-probe',
  rule: ONCE,
  constantAnswer: true,
  generate: (r) => ({ options: shuffle(r, RING_OPTIONS) }),
  same: (a, b) => sameJson(a.options, b.options),
  solve: () => 'wiring',
  check: (_i, a) =>
    verdict(a === 'wiring', { kind: 'none' }, RING_FEEDBACK[String(a)] ?? 'The ring setting turns the wiring against the letters; the window letter stays.'),
  highlight: () => [{ part: 'ring-right', tone: 'hint' }],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  stepping: {
    items: [windows, middleSteps, ringProbe, windowsM3] as ItemLogic[],
    fallback: leftSteps as ItemLogic,
  },
}
