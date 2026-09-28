import { describe, expect, it } from 'vitest'
import { createMachine, mod, pressKey, slotNames, type MachineConfigInput, type RotorSlot } from '../engine'
import { createRng, int, randomConfig } from '../lib/rng'
import { randomToy, toyPress, toySlots } from '../lib/toy'
import {
  AXIS_Y,
  AXIS_Z,
  ROTOR,
  WINDOW_ANGLE,
  contactPoint,
  keyPosition,
  lampPosition,
  makeLayout,
  pathPoints,
  socketPosition,
  type ContactPart,
  type Layout,
  type Vec3,
} from './layout'

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const close = (a: Vec3, b: Vec3) => expect(dist(a, b)).toBeLessThan(1e-9)

const machineLayout = (slots: readonly RotorSlot[] = ['left', 'middle', 'right']) =>
  makeLayout({ n: 26, slots, toy: false })

const LAYOUTS: readonly Layout[] = [
  machineLayout(),
  machineLayout(['greek', 'left', 'middle', 'right']),
  makeLayout({ n: 8, slots: toySlots(3), toy: true }),
  makeLayout({ n: 6, slots: toySlots(2), toy: true }),
]

const ringParts = (l: Layout): ContactPart[] => ['etw', 'reflector', ...l.slots]

describe('contactPoint', () => {
  it.each(LAYOUTS.map((l) => [l.n, l.slots.length, l] as const))(
    'n = %i, %i rotors: n contacts per face, equally spaced on one circle about the axis',
    (_n, _k, l) => {
      const chord = 2 * ROTOR.contactR * Math.sin(Math.PI / l.n)
      for (const part of ringParts(l)) {
        for (const face of ['in', 'out'] as const) {
          const pts = Array.from({ length: l.n }, (_, k) => contactPoint(l, part, face, k, 0))
          for (const p of pts) {
            expect(p.x).toBeCloseTo(pts[0]!.x, 12)
            expect(Math.hypot(p.y - AXIS_Y, p.z - AXIS_Z)).toBeCloseTo(ROTOR.contactR, 12)
          }
          pts.forEach((p, k) => expect(dist(p, pts[(k + 1) % l.n]!)).toBeCloseTo(chord, 12))
          expect(new Set(pts.map((p) => `${p.y.toFixed(6)},${p.z.toFixed(6)}`)).size).toBe(l.n)
        }
      }
    },
  )

  it('rotation shifts contact k to the fixed position k − offset', () => {
    for (const l of LAYOUTS) {
      for (const part of ringParts(l)) {
        for (const face of ['in', 'out'] as const) {
          for (let offset = 0; offset < l.n; offset++) {
            for (let k = 0; k < l.n; k++) {
              close(contactPoint(l, part, face, k, offset), contactPoint(l, part, face, mod(k - offset, l.n), 0))
            }
          }
        }
      }
    }
  })

  it('is deterministic and puts contact A (unrotated) at the window angle', () => {
    for (const l of LAYOUTS) {
      for (const part of [...ringParts(l), 'plugboard', 'keyboard', 'lampboard'] as ContactPart[]) {
        for (let k = 0; k < l.n; k++)
          expect(contactPoint(l, part, 'in', k, 3)).toEqual(contactPoint(l, part, 'in', k, 3))
      }
    }
    const p = contactPoint(machineLayout(), 'right', 'in', 0, 0)
    expect(p.y).toBeCloseTo(AXIS_Y + ROTOR.contactR * Math.cos(WINDOW_ANGLE), 12)
    expect(p.z).toBeCloseTo(AXIS_Z + ROTOR.contactR * Math.sin(WINDOW_ANGLE), 12)
  })

  it('separates the faces: rotor pins right of the plates, rotors ordered left to right', () => {
    const l = machineLayout(['greek', 'left', 'middle', 'right'])
    const xs = ['reflector', ...l.slots, 'etw'].map((p) => contactPoint(l, p as ContactPart, 'out', 0, 0).x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    for (const slot of l.slots) {
      expect(contactPoint(l, slot, 'in', 0, 0).x).toBeGreaterThan(contactPoint(l, slot, 'out', 0, 0).x)
    }
  })

  it('keys, lamps and sockets: one distinct place per letter, keys in front of lamps', () => {
    for (const l of LAYOUTS) {
      for (const at of [keyPosition, lampPosition, socketPosition]) {
        const pts = Array.from({ length: l.n }, (_, k) => at(l, k))
        expect(new Set(pts.map((p) => `${p.x},${p.y},${p.z}`)).size).toBe(l.n)
      }
      for (let k = 0; k < l.n; k++) expect(keyPosition(l, k).z).toBeGreaterThan(lampPosition(l, k).z)
    }
    // QWERTZ: Q is the first key of the back row, P the first of the front row.
    const l = machineLayout()
    expect(keyPosition(l, 16).z).toBeLessThan(keyPosition(l, 15).z)
    expect(keyPosition(l, 16).x).toBe(keyPosition(l, 15).x)
  })

  it('rejects impossible layouts', () => {
    expect(() => makeLayout({ n: 1, slots: ['right'], toy: true })).toThrow(RangeError)
    expect(() => makeLayout({ n: 27, slots: ['right'], toy: false })).toThrow(RangeError)
    expect(() => makeLayout({ n: 26, slots: [], toy: false })).toThrow(RangeError)
    expect(() => makeLayout({ n: 26, slots: ['left', 'left'], toy: false })).toThrow(RangeError)
    expect(() => contactPoint(machineLayout(['middle', 'right']), 'left', 'in', 0, 0)).toThrow(RangeError)
  })
})

describe('pathPoints', () => {
  const configs: MachineConfigInput[] = [
    { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU', plugboard: 'AV BS CG' },
    {
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'II', 'IV', 'I'],
      rings: 'AAAV',
      positions: 'VJNA',
      plugboard: 'AT',
    },
  ]

  it('has exactly 2 + 2·hops points, from the pressed key to the lit lamp (machine traces)', () => {
    const r = createRng(7)
    for (const config of [...configs, randomConfig(r), randomConfig(r, { model: 'M3' })]) {
      let state = createMachine(config)
      const l = machineLayout(slotNames(state.positions.length))
      for (let i = 0; i < 40; i++) {
        const key = String.fromCharCode(65 + int(r, 26))
        const press = pressKey(state, key)
        state = press.state
        const pts = pathPoints(press.trace, l)
        expect(pts).toHaveLength(2 + 2 * press.trace.length)
        close(pts[0]!, keyPosition(l, key.charCodeAt(0) - 65))
        close(pts[pts.length - 1]!, lampPosition(l, press.output.charCodeAt(0) - 65))
        for (const p of pts) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true)
      }
    }
  })

  it('a rotor hop enters at its core contact under the offset, i.e. at the fixed input letter', () => {
    const r = createRng(11)
    let state = createMachine(randomConfig(r))
    const l = machineLayout()
    for (let i = 0; i < 60; i++) {
      const press = pressKey(state, String.fromCharCode(65 + int(r, 26)))
      state = press.state
      const pts = pathPoints(press.trace, l)
      press.trace.forEach((h, j) => {
        if (h.kind !== 'rotor') return
        const [entryFace, exitFace] = h.direction === 'fwd' ? (['in', 'out'] as const) : (['out', 'in'] as const)
        close(pts[1 + 2 * j]!, contactPoint(l, h.slot, entryFace, h.inputIndex, 0))
        close(pts[2 + 2 * j]!, contactPoint(l, h.slot, exitFace, h.outputIndex, 0))
        close(pts[1 + 2 * j]!, contactPoint(l, h.slot, entryFace, h.entryContact, h.offset))
      })
    }
  })

  it('works for the 6- and 8-letter toys', () => {
    const r = createRng(3)
    for (const n of [6, 8] as const) {
      for (const k of [1, 2, 3] as const) {
        let spec = randomToy(r, n, k, { plugs: 1 })
        const l = makeLayout({ n, slots: toySlots(k), toy: true })
        for (let i = 0; i < 10; i++) {
          const key = String.fromCharCode(65 + int(r, n))
          const press = toyPress(spec, key as 'A')
          spec = press.spec
          const pts = pathPoints(press.hops, l)
          expect(pts).toHaveLength(2 + 2 * press.hops.length)
          close(pts[pts.length - 1]!, lampPosition(l, press.lamp.charCodeAt(0) - 65))
        }
      }
    }
  })

  it('is empty without hops', () => {
    expect(pathPoints([], machineLayout())).toEqual([])
  })
})
