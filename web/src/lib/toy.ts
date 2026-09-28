/**
 * Toy Enigmas on 6 or 8 letters (PLAN §3.2), for Act I. PURE.
 * Rotors are listed LEFT → RIGHT and have no ring (offset = window position); there is no ETW.
 * Stepping is an odometer: the right rotor always steps, and a rotor steps when its right-hand
 * neighbour steps from its notch. There is no double step.
 */

import { LETTERS, letterToIndex, type Letter, type RotorSlot, type StepInfo, type TraceStage } from '../engine'
import type { ToyPress, ToySpec } from '../contracts/machine'
import type { PathHop } from '../contracts/stage'
import { int, randomInvolution, randomPerm, type Rng } from './rng'

const mod = (x: number, n: number): number => ((x % n) + n) % n

/** Slot names of the last k of left/middle/right, LEFT → RIGHT. */
export function toySlots(count: number): readonly RotorSlot[] {
  const all: readonly RotorSlot[] = ['left', 'middle', 'right']
  if (count < 1 || count > 3) throw new RangeError(`A toy has 1–3 rotors, got ${count}`)
  return all.slice(3 - count)
}

export function toyLetters(n: 6 | 8): readonly Letter[] {
  return LETTERS.slice(0, n)
}

function invert(p: readonly number[]): number[] {
  const inv = new Array<number>(p.length)
  p.forEach((v, i) => (inv[v] = i))
  return inv
}

/** The toy's rotors stepped once (or unchanged when held). */
export function toyStep(spec: ToySpec): { spec: ToySpec; stepping: StepInfo } {
  const k = spec.rotors.length
  const slots = toySlots(k)
  const before = spec.positions
  const after = [...before]
  const moved = new Array<boolean>(k).fill(false)
  if (spec.stepping) {
    for (let i = k - 1; i >= 0; i--) {
      const carry = i === k - 1 || (moved[i + 1]! && before[i + 1] === spec.notches[i + 1])
      if (!carry) break
      moved[i] = true
      after[i] = mod(before[i]! + 1, spec.n)
    }
  }
  const stepped = { left: false, middle: false, right: false }
  slots.forEach((slot, i) => {
    if (slot !== 'greek') stepped[slot] = moved[i]!
  })
  return {
    spec: { ...spec, positions: after },
    stepping: { stepped, doubleStep: false, before, after },
  }
}

/** Send `input` through the toy at its current positions, recording the hops. */
function signal(spec: ToySpec, input: number): { out: number; hops: PathHop[] } {
  const { n } = spec
  const slots = toySlots(spec.rotors.length)
  const hops: PathHop[] = []
  const L = (i: number): Letter => LETTERS[i]!
  const plainHop = (kind: 'plugboard' | 'reflector', stage: TraceStage, i: number, o: number): PathHop => ({
    kind,
    stage,
    input: L(i),
    output: L(o),
    inputIndex: i,
    outputIndex: o,
  })
  let x = input

  const plugIn = spec.plugs[x]!
  hops.push(plainHop('plugboard', 'plugboard-in', x, plugIn))
  x = plugIn

  const through = (i: number, dir: 'fwd' | 'bwd') => {
    const offset = spec.positions[i]!
    const wiring = dir === 'fwd' ? spec.rotors[i]! : invert(spec.rotors[i]!)
    const entry = mod(x + offset, n)
    const exit = wiring[entry]!
    const out = mod(exit - offset, n)
    hops.push({
      kind: 'rotor',
      stage: `rotor-${slots[i]!}-${dir}`,
      input: L(x),
      output: L(out),
      inputIndex: x,
      outputIndex: out,
      slotIndex: i,
      offset,
      entryContact: entry,
      exitContact: exit,
    })
    x = out
  }

  for (let i = spec.rotors.length - 1; i >= 0; i--) through(i, 'fwd')
  const reflected = spec.reflector[x]!
  hops.push(plainHop('reflector', 'reflector', x, reflected))
  x = reflected
  for (let i = 0; i < spec.rotors.length; i++) through(i, 'bwd')

  const plugOut = spec.plugs[x]!
  hops.push(plainHop('plugboard', 'plugboard-out', x, plugOut))
  return { out: plugOut, hops }
}

/** One key press on the toy: step (unless held), then encode. Throws RangeError for a key outside A…F / A…H. */
export function toyPress(spec: ToySpec, key: Letter): ToyPress {
  const input = letterToIndex(key)
  if (input >= spec.n) throw new RangeError(`Key ${key} is not on a ${spec.n}-letter toy`)
  const { spec: next, stepping } = toyStep(spec)
  const { out, hops } = signal(next, input)
  return { spec: next, lamp: LETTERS[out]!, hops, stepping }
}

/** The toy's current substitution including the plugs, without stepping. A fixed-point-free involution. */
export function toyPermutation(spec: ToySpec): number[] {
  return Array.from({ length: spec.n }, (_, i) => signal(spec, i).out)
}

/** A random toy: random wirings, notches and start, a random fixed-point-free reflector. Stepping by default. */
export function randomToy(r: Rng, n: 6 | 8, rotors: 1 | 2 | 3, o: { plugs?: number; stepping?: boolean } = {}): ToySpec {
  return {
    n,
    rotors: Array.from({ length: rotors }, () => randomPerm(r, n)),
    notches: Array.from({ length: rotors }, () => int(r, n)),
    reflector: randomInvolution(r, n, n / 2),
    plugs: randomInvolution(r, n, o.plugs ?? 0),
    positions: Array.from({ length: rotors }, () => int(r, n)),
    stepping: o.stepping ?? true,
  }
}

/** Window letters of a toy, LEFT → RIGHT. */
export function toyWindows(spec: ToySpec): string {
  return spec.positions.map((p) => LETTERS[p]!).join('')
}
