/**
 * The 3D machine's geometry as numbers (PLAN §3.10). PURE: no three.js, no React, so unit tests and
 * Playwright (in Node) import it. 1 unit = 1 cm. Axes: x to the operator's right, y up, z towards
 * the operator. Every rotor turns about an axis parallel to x.
 *
 * Angles around a rotor axis are measured from +y towards +z (three.js rotation.x adds to them).
 * Contact j of a fixed part (and alphabet-ring letter j) sits at WINDOW_ANGLE − j·Δ with Δ = 2π/n,
 * so the letter shown in the window is the one at WINDOW_ANGLE. A rotor's ring turns by
 * window·Δ and its wiring core by offset·Δ (offset = window − ring), so core contact k faces the
 * fixed contact k − offset (engine: README "Trace stages").
 *
 * The layout is n-parametric: n = 26 for the machine, 6 or 8 for the toys (PLAN §3.2).
 */

import type { PathHop } from '../contracts/stage'
import { KEYBOARD_ROWS, type RotorSlot } from '../engine'

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Layout {
  readonly n: number
  /** Rotor slots LEFT → RIGHT (greek, left, middle, right on the M4; the last k for a toy). */
  readonly slots: readonly RotorSlot[]
  readonly toy: boolean
}

export type ContactPart = 'plugboard' | 'etw' | RotorSlot | 'reflector' | 'keyboard' | 'lampboard'

const TAU = Math.PI * 2
const mod = (x: number, n: number): number => ((x % n) + n) % n

// ---------------------------------------------------------------------------
// Dimensions (cm)
// ---------------------------------------------------------------------------

/** The window sits 55° from the top of the ring towards the operator. */
export const WINDOW_ANGLE = (55 * Math.PI) / 180
/**
 * The stepping pawls touch the notch rings 8 letters (of 26) behind the window: on every rotor the
 * notch letter is the turnover letter + 8 (I: Q/Y, II: E/M, III: V/D …; engine/wiring.ts).
 */
export const PAWL_ANGLE = WINDOW_ANGLE - 8 * (TAU / 26)

export const AXIS_Y = 1.2
export const AXIS_Z = -10.6
/** Rotor centre-to-centre distance along the axis. */
export const ROTOR_PITCH = 3.6

/** A rotor, along x relative to its slot centre, and radially. */
export const ROTOR = {
  /** Notch ring (part of the alphabet ring), left edge. */
  notchX0: -1.6,
  notchX1: -1.3,
  notchR: 5.05,
  /** Serrated thumbwheel (part of the rotor body, turns with the core). */
  wheelX0: -1.3,
  wheelX1: -0.95,
  wheelR: 5.5,
  /** Alphabet band: letters, and ring numbers 01–26 beside them. */
  bandX0: -0.95,
  bandX1: 0.55,
  bandR: 5.0,
  innerR: 4.3,
  /** Letter and number columns on the band. */
  letterX: -0.42,
  numberX: 0.2,
  /** Wiring core: body, contact faces (left 'out' plates, right 'in' pins) and contact radius. */
  coreX0: -1.05,
  coreX1: 1.15,
  coreR: 4.05,
  outFaceX: -1.08,
  inFaceX: 1.32,
  contactR: 2.9,
  /** Ratchet teeth on the right, pushed by this rotor's pawl. */
  ratchetX0: 0.55,
  ratchetX1: 0.95,
  ratchetR: 4.55,
} as const

export const ETW = { width: 1.2, r: 4.4, gap: 3.2 } as const
export const REFLECTOR = { width: 1.2, thinWidth: 0.6, r: 4.6, gap: 3.0 } as const

/** Keys, lamps and plugboard sockets. */
export const DECK = {
  keyPitch: 3.2,
  keyR: 1.15,
  keyTopY: 1.4,
  keyRowsZ: [6.6, 9.6, 12.6],
  lampR: 1.05,
  lampTopY: 0.35,
  lampRowsZ: [-2.4, 0.3, 3.0],
  panelZ: 15.6,
  socketRowsY: [-3.4, -6.4, -9.4],
  /** The two holes of a socket: 'in' (keys/lamps side) above, 'out' (entry-wheel side) below. */
  socketHoleDy: 0.45,
} as const

export const CASE = {
  x0: -17,
  x1: 17,
  zBack: -17.8,
  zFront: DECK.panelZ,
  yBottom: -12.5,
  yDeck: 0,
  deckZ0: -4.8,
  wellFloorY: -4.4,
  lidTopY: 7.5,
} as const

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function makeLayout(o: { n: number; slots: readonly RotorSlot[]; toy: boolean }): Layout {
  if (!Number.isInteger(o.n) || o.n < 2 || o.n > 26) throw new RangeError(`n must be 2…26, got ${o.n}`)
  if (o.slots.length < 1 || o.slots.length > 4 || new Set(o.slots).size !== o.slots.length) {
    throw new RangeError(`1–4 distinct rotor slots expected, got ${o.slots.join(',')}`)
  }
  return Object.freeze({ n: o.n, slots: Object.freeze([...o.slots]), toy: o.toy })
}

/** Angle step between neighbouring contacts or letters. */
export const stepAngle = (l: Layout): number => TAU / l.n

/** Angle (fixed frame) of fixed contact / window-relative letter j. */
export const contactAngle = (l: Layout, j: number): number => WINDOW_ANGLE - mod(j, l.n) * stepAngle(l)

/** rotation.x of an alphabet ring showing `window` (fractional while stepping). */
export const ringAngle = (l: Layout, window: number): number => window * stepAngle(l)

/** rotation.x of a wiring core at `offset` = window − ring (fractional while stepping). */
export const coreAngle = (l: Layout, offset: number): number => offset * stepAngle(l)

/** Centre x of rotor slot i (0 = leftmost). */
export function slotX(l: Layout, i: number): number {
  return (i - (l.slots.length - 1) / 2) * ROTOR_PITCH
}

export function slotIndex(l: Layout, slot: RotorSlot): number {
  const i = l.slots.indexOf(slot)
  if (i < 0) throw new RangeError(`No ${slot} rotor in this layout`)
  return i
}

/** Centre x of the entry wheel (right of the right rotor). */
export const etwX = (l: Layout): number => slotX(l, l.slots.length - 1) + ETW.gap

/** The reflector is thin on the M4 (it shares its space with the Greek rotor). */
export const reflectorWidth = (l: Layout): number => (l.slots.includes('greek') ? REFLECTOR.thinWidth : REFLECTOR.width)

/** Centre x of the reflector (left of the left rotor). */
export const reflectorX = (l: Layout): number => slotX(l, 0) - REFLECTOR.gap + (REFLECTOR.width - reflectorWidth(l)) / 2

/** Keyboard/lampboard/socket grid position (column x, row index) of letter k. */
function gridCell(l: Layout, k: number): { x: number; row: number } {
  if (l.toy || l.n !== 26) return { x: (mod(k, l.n) - (l.n - 1) / 2) * DECK.keyPitch, row: 1 }
  const letter = String.fromCharCode(65 + mod(k, 26))
  for (let row = 0; row < KEYBOARD_ROWS.length; row++) {
    const keys = KEYBOARD_ROWS[row]!
    const c = keys.indexOf(letter as (typeof keys)[number])
    if (c >= 0) return { x: (c - (keys.length - 1) / 2) * DECK.keyPitch, row }
  }
  throw new RangeError(`No key for ${letter}`)
}

/** Top centre of key k. */
export function keyPosition(l: Layout, k: number): Vec3 {
  const { x, row } = gridCell(l, k)
  return { x, y: DECK.keyTopY, z: DECK.keyRowsZ[row]! }
}

/** Top centre of lamp k. */
export function lampPosition(l: Layout, k: number): Vec3 {
  const { x, row } = gridCell(l, k)
  return { x, y: DECK.lampTopY, z: DECK.lampRowsZ[row]! }
}

/** Centre of the socket of letter k on the front panel. */
export function socketPosition(l: Layout, k: number): Vec3 {
  const { x, row } = gridCell(l, k)
  return { x, y: DECK.socketRowsY[row]!, z: DECK.panelZ }
}

function onCircle(x: number, angle: number, r: number): Vec3 {
  return { x, y: AXIS_Y + r * Math.cos(angle), z: AXIS_Z + r * Math.sin(angle) }
}

/**
 * Where the current touches `part` through `contact`, on `face`:
 *  - rotors: 'in' is the right face (pins, towards the entry wheel), 'out' the left face (plates);
 *    `contact` is a core contact and `rotation` the core offset, so contact k sits at the fixed
 *    position k − rotation;
 *  - etw: 'in' faces the plugboard cables, 'out' the right rotor;
 *  - reflector: both faces are its contact face towards the rotors;
 *  - plugboard: socket `contact`, 'in' hole (keys/lamps side) or 'out' hole (entry-wheel side);
 *  - keyboard, lampboard: the key or lamp top (face ignored).
 * `rotation` is ignored for the keyboard, lampboard and plugboard.
 */
export function contactPoint(l: Layout, part: ContactPart, face: 'in' | 'out', contact: number, rotation: number): Vec3 {
  switch (part) {
    case 'keyboard':
      return keyPosition(l, contact)
    case 'lampboard':
      return lampPosition(l, contact)
    case 'plugboard': {
      const s = socketPosition(l, contact)
      return { x: s.x, y: s.y + (face === 'in' ? DECK.socketHoleDy : -DECK.socketHoleDy), z: s.z + 0.2 }
    }
    case 'etw': {
      const x = etwX(l) + (face === 'in' ? 1 : -1) * (ETW.width / 2 + 0.02)
      return onCircle(x, contactAngle(l, contact - rotation), ROTOR.contactR)
    }
    case 'reflector':
      return onCircle(reflectorX(l) + reflectorWidth(l) / 2 + 0.02, contactAngle(l, contact - rotation), ROTOR.contactR)
    default: {
      const x = slotX(l, slotIndex(l, part)) + (face === 'in' ? ROTOR.inFaceX : ROTOR.outFaceX)
      return onCircle(x, contactAngle(l, contact - rotation), ROTOR.contactR)
    }
  }
}

/** Entry and exit points of one hop (fixed-frame letters; rotor hops use their core contacts). */
function hopPoints(l: Layout, h: PathHop): [Vec3, Vec3] {
  switch (h.kind) {
    case 'plugboard': {
      const inward = h.stage === 'plugboard-in'
      return [
        contactPoint(l, 'plugboard', inward ? 'in' : 'out', h.inputIndex, 0),
        contactPoint(l, 'plugboard', inward ? 'out' : 'in', h.outputIndex, 0),
      ]
    }
    case 'etw': {
      const inward = h.stage === 'etw-in'
      return [
        contactPoint(l, 'etw', inward ? 'in' : 'out', h.inputIndex, 0),
        contactPoint(l, 'etw', inward ? 'out' : 'in', h.outputIndex, 0),
      ]
    }
    case 'reflector':
      return [contactPoint(l, 'reflector', 'in', h.inputIndex, 0), contactPoint(l, 'reflector', 'out', h.outputIndex, 0)]
    case 'rotor': {
      const [, slot, dir] = h.stage.split('-') as [string, RotorSlot, 'fwd' | 'bwd']
      const fwd = dir === 'fwd'
      const offset = h.offset ?? 0
      const entry = h.entryContact ?? mod(h.inputIndex + offset, l.n)
      const exit = h.exitContact ?? mod(h.outputIndex + offset, l.n)
      return [
        contactPoint(l, slot, fwd ? 'in' : 'out', entry, offset),
        contactPoint(l, slot, fwd ? 'out' : 'in', exit, offset),
      ]
    }
  }
}

/**
 * The signal path: the pressed key, entry and exit of every hop, then the lamp. Exactly
 * 2 + 2·hops.length points. An empty path has none.
 */
export function pathPoints(hops: readonly PathHop[], l: Layout): Vec3[] {
  if (hops.length === 0) return []
  const points: Vec3[] = [contactPoint(l, 'keyboard', 'in', hops[0]!.inputIndex, 0)]
  for (const h of hops) points.push(...hopPoints(l, h))
  points.push(contactPoint(l, 'lampboard', 'out', hops[hops.length - 1]!.outputIndex, 0))
  return points
}
