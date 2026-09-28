/**
 * What the 3D machine shows, as plain data: a pure function of (machine or toy store, playback)
 * (PLAN §2.5). The scene renders it; index.tsx reports from it. Unit-tested without WebGL.
 */

import { hopAt, isLit, type ToyPress, type ToySpec } from '../contracts/machine'
import type { PathHop } from '../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  ROTORS,
  isAtTurnover,
  letterToIndex,
  mod,
  positionsToString,
  slotNames,
  type Letter,
  type MachineState,
  type PressResult,
  type ReflectorName,
  type RotorSlot,
  type StepInfo,
} from '../engine'
import { toySlots, toyWindows } from '../lib/toy'
import { makeLayout, type Layout } from './layout'

export interface RotorView {
  readonly slot: RotorSlot
  /** 'III', 'Beta' … on the machine; '' on a toy. */
  readonly name: string
  /** Window position shown (an index; stepping.before while t < 1). */
  readonly window: number
  /** Window position driving the ring angle: fractional while the rotor steps. */
  readonly ringTurn: number
  /** Ring setting index (0 = 01); 0 on a toy, which has no rings. */
  readonly ring: number
  /** Core offset driving the core angle (ringTurn − ring): fractional while the rotor steps. */
  readonly coreTurn: number
  /** Window positions at which this rotor carries its left neighbour (turnover letters). */
  readonly turnovers: readonly number[]
  /** Whether a pawl drives this rotor (the M4's Greek rotor never steps). */
  readonly pawl: boolean
  /**
   * The pawl in the gap to this rotor's right is down: it rests on the right neighbour's notch ring
   * and drops when that ring's notch is under it (the rightmost pawl has no ring and always drops).
   */
  readonly engaged: boolean
}

export interface SceneView {
  readonly source: 'machine' | 'toy'
  readonly layout: Layout
  readonly letters: readonly Letter[]
  readonly rotors: readonly RotorView[]
  /** Window letters LEFT → RIGHT as shown. */
  readonly windows: string
  /** The lamp lit now (index), or null. */
  readonly litLamp: number | null
  /** The key held down while its press plays, or null. */
  readonly pressedKey: number | null
  /** Plugboard as an involution on n (identity = no cables). */
  readonly plugs: readonly number[]
  readonly reflector: { readonly name: ReflectorName | null; readonly wiring: readonly number[] }
  /** Hops of the last press (empty if none). */
  readonly hops: readonly PathHop[]
  /** hopAt(t, hops). */
  readonly hop: number
}

export interface PlaybackInput {
  readonly t: number
  readonly hops: number
}

/** Ease in and out over the stepping phase. */
export function easeStep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** The window position of one rotor during the stepping phase: before → after, wrapping at n. */
export function turnAt(before: number, after: number, t: number, n: number): number {
  if (t >= 1) return after
  return before + mod(after - before, n) * easeStep(t)
}

/** Displayed positions and the fractional turn of each rotor at playback time t. */
function windowsAt(current: readonly number[], stepping: StepInfo | undefined, t: number, n: number) {
  if (!stepping || t >= 1) return { shown: current, turns: current }
  return { shown: stepping.before, turns: stepping.before.map((b, i) => turnAt(b, stepping.after[i]!, t, n)) }
}

function involutionFromPairs(pairs: readonly string[]): number[] {
  const p = Array.from({ length: 26 }, (_, i) => i)
  for (const pair of pairs) {
    const a = letterToIndex(pair[0]!)
    const b = letterToIndex(pair[1]!)
    p[a] = b
    p[b] = a
  }
  return p
}

/** The pawl in the gap right of slot i is down (see RotorView.engaged). */
function engagedAt(i: number, count: number, notchUnder: (j: number) => boolean): boolean {
  return i === count - 1 || notchUnder(i + 1)
}

export function machineView(
  m: { readonly machine: MachineState; readonly last: PressResult | null; readonly lampsHidden: boolean },
  pb: PlaybackInput,
): SceneView {
  const { config } = m.machine
  const slots = slotNames(config.rotors.length)
  const last = m.last
  const { shown, turns } = windowsAt(m.machine.positions, last?.stepping, pb.t, 26)
  const rotors = config.rotors.map((name, i): RotorView => {
    const ring = letterToIndex(config.rings[i]!)
    const greek = slots[i] === 'greek'
    return {
      slot: slots[i]!,
      name,
      window: shown[i]!,
      ringTurn: turns[i]!,
      ring,
      coreTurn: turns[i]! - ring,
      turnovers: ROTORS[name].turnovers.split('').map(letterToIndex),
      pawl: !greek,
      engaged: !greek && engagedAt(i, config.rotors.length, (j) => isAtTurnover(config.rotors[j]!, shown[j]!)),
    }
  })
  const playing = last !== null && pb.t < 1 + pb.hops
  return {
    source: 'machine',
    layout: makeLayout({ n: 26, slots, toy: false }),
    letters: LETTERS,
    rotors,
    windows: positionsToString(shown),
    litLamp: last && !m.lampsHidden && isLit(pb.t, pb.hops) ? letterToIndex(last.output) : null,
    pressedKey: last && playing ? last.trace[0]!.inputIndex : null,
    plugs: involutionFromPairs(config.plugboard),
    reflector: { name: config.reflector, wiring: REFLECTOR_PERMS[config.reflector] },
    hops: last?.trace ?? [],
    hop: hopAt(pb.t, pb.hops),
  }
}

export function toyView(
  toy: { readonly spec: ToySpec; readonly last: ToyPress | null; readonly lampsHidden: boolean },
  pb: PlaybackInput,
): SceneView {
  const { spec, last } = toy
  const slots = toySlots(spec.rotors.length)
  const { shown, turns } = windowsAt(spec.positions, last?.stepping, pb.t, spec.n)
  const rotors = spec.rotors.map(
    (_, i): RotorView => ({
      slot: slots[i]!,
      name: '',
      window: shown[i]!,
      ringTurn: turns[i]!,
      ring: 0,
      coreTurn: turns[i]!,
      turnovers: [spec.notches[i]!],
      pawl: true,
      engaged: engagedAt(i, spec.rotors.length, (j) => shown[j] === spec.notches[j]),
    }),
  )
  const playing = last !== null && pb.t < 1 + pb.hops
  return {
    source: 'toy',
    layout: makeLayout({ n: spec.n, slots, toy: true }),
    letters: LETTERS.slice(0, spec.n),
    rotors,
    windows: last?.stepping && pb.t < 1 ? positionsToString(shown) : toyWindows(spec),
    litLamp: last && !toy.lampsHidden && isLit(pb.t, pb.hops) ? letterToIndex(last.lamp) : null,
    pressedKey: last && playing ? last.hops[0]!.inputIndex : null,
    plugs: spec.plugs,
    reflector: { name: null, wiring: spec.reflector },
    hops: last?.hops ?? [],
    hop: hopAt(pb.t, pb.hops),
  }
}
