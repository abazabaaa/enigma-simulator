import { describe, expect, it } from 'vitest'
import { LETTERS, createMachine, isAtTurnover, pressKey, withPositions, type MachineConfigInput } from '../engine'
import { createRng } from '../lib/rng'
import { randomToy, toyPress } from '../lib/toy'
import { machineView, toyView, turnAt } from './view'

const I: MachineConfigInput = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU' }
const END = { t: 1e9, hops: 11 }

describe('turnAt', () => {
  it('eases from before to after over the stepping phase and wraps at n', () => {
    expect(turnAt(3, 4, 0, 26)).toBe(3)
    expect(turnAt(3, 4, 0.5, 26)).toBeCloseTo(3.5, 12)
    expect(turnAt(25, 0, 0.5, 26)).toBeCloseTo(25.5, 12)
    expect(turnAt(25, 0, 1, 26)).toBe(0)
    expect(turnAt(7, 7, 0.4, 26)).toBe(7)
    const samples = [0, 0.1, 0.3, 0.6, 0.9, 0.999].map((t) => turnAt(5, 6, t, 26))
    expect([...samples].sort((a, b) => a - b)).toEqual(samples)
  })
})

describe('machineView', () => {
  it('shows the windows, ring and core offsets of the current state', () => {
    const machine = createMachine({ ...I, rings: 'BCD' })
    const v = machineView({ machine, last: null, lampsHidden: false }, { t: 0, hops: 0 })
    expect(v.windows).toBe('ADU')
    expect(v.rotors.map((r) => r.slot)).toEqual(['left', 'middle', 'right'])
    expect(v.rotors.map((r) => [r.window, r.ringTurn, r.ring, r.coreTurn])).toEqual([
      [0, 0, 1, -1],
      [3, 3, 2, 1],
      [20, 20, 3, 17],
    ])
    expect(v.litLamp).toBeNull()
    expect(v.pressedKey).toBeNull()
    expect(v.hops).toEqual([])
    expect(v.layout).toMatchObject({ n: 26, slots: ['left', 'middle', 'right'], toy: false })
  })

  it('during the stepping phase shows the windows before the step and turns the rotors between', () => {
    const before = createMachine(I)
    const last = pressKey(before, 'A')
    const mid = machineView({ machine: last.state, last, lampsHidden: false }, { t: 0.5, hops: 11 })
    expect(mid.windows).toBe('ADU')
    expect(mid.rotors[2]!.ringTurn).toBeCloseTo(20.5, 12)
    expect(mid.rotors[1]!.ringTurn).toBe(3)
    expect(mid.litLamp).toBeNull()
    expect(mid.pressedKey).toBe(0)
    expect(mid.hop).toBe(-1)
    const end = machineView({ machine: last.state, last, lampsHidden: false }, { t: 12, hops: 11 })
    expect(end.windows).toBe('ADV')
    expect(end.rotors[2]!.ringTurn).toBe(21)
    expect(end.litLamp).toBe(LETTERS.indexOf(last.output))
    expect(end.pressedKey).toBeNull()
    expect(end.hop).toBe(10)
    const hidden = machineView({ machine: last.state, last, lampsHidden: true }, { t: 12, hops: 11 })
    expect(hidden.litLamp).toBeNull()
  })

  it('pawl engagement equals isAtTurnover for all 26 positions of rotor II', () => {
    for (let p = 0; p < 26; p++) {
      const machine = withPositions(createMachine(I), ['A', LETTERS[p]!, 'A'])
      const v = machineView({ machine, last: null, lampsHidden: false }, END)
      // the left pawl rests on the middle rotor's (II) notch ring
      expect(v.rotors[0]!.engaged).toBe(isAtTurnover('II', p))
      expect(v.rotors[2]!.engaged).toBe(true)
    }
    for (let p = 0; p < 26; p++) {
      const machine = withPositions(createMachine(I), ['A', 'A', LETTERS[p]!])
      const v = machineView({ machine, last: null, lampsHidden: false }, END)
      expect(v.rotors[1]!.engaged).toBe(isAtTurnover('III', p))
    }
  })

  it('the M4 has four rotors and no pawl for the Greek rotor', () => {
    const machine = createMachine({
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'II', 'IV', 'I'],
      rings: 'AAAV',
      positions: 'VJNA',
    })
    const v = machineView({ machine, last: null, lampsHidden: false }, END)
    expect(v.rotors.map((r) => [r.slot, r.name, r.pawl, r.turnovers.length])).toEqual([
      ['greek', 'Beta', false, 0],
      ['left', 'II', true, 1],
      ['middle', 'IV', true, 1],
      ['right', 'I', true, 1],
    ])
    expect(v.rotors[0]!.engaged).toBe(false)
    expect(v.rotors[1]!.engaged).toBe(isAtTurnover('IV', 'N'))
    expect(v.windows).toBe('VJNA')
    expect(v.reflector.name).toBe('B-thin')
  })

  it('reads the plugboard as an involution', () => {
    const machine = createMachine({ ...I, plugboard: 'AV BS' })
    const { plugs } = machineView({ machine, last: null, lampsHidden: false }, END)
    expect(plugs[0]).toBe(21)
    expect(plugs[21]).toBe(0)
    expect(plugs[1]).toBe(18)
    expect(plugs[2]).toBe(2)
  })
})

describe('toyView', () => {
  it('shows a toy on n letters, with its windows, lamp and pawls', () => {
    const spec = randomToy(createRng(5), 8, 3)
    const last = toyPress(spec, 'C')
    const v = toyView({ spec: last.spec, last, lampsHidden: false }, { t: 1 + last.hops.length, hops: last.hops.length })
    expect(v.layout).toMatchObject({ n: 8, slots: ['left', 'middle', 'right'], toy: true })
    expect(v.letters).toEqual(LETTERS.slice(0, 8))
    expect(v.windows).toBe(last.spec.positions.map((p) => LETTERS[p]).join(''))
    expect(v.litLamp).toBe(LETTERS.indexOf(last.lamp))
    expect(v.rotors[2]!.engaged).toBe(true)
    expect(v.rotors[1]!.engaged).toBe(last.spec.positions[2] === last.spec.notches[2])
    expect(v.reflector.name).toBeNull()
  })
})
