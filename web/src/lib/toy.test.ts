import { describe, expect, it } from 'vitest'
import type { ToySpec } from '../contracts/machine'
import { createRng, seedFor } from './rng'
import { randomToy, toyPermutation, toyPress, toySlots, toyStep, toyWindows } from './toy'

const isFixedPointFreeInvolution = (p: readonly number[]) => p.every((v, i) => v !== i && p[v] === i)

describe('toyPermutation', () => {
  for (const n of [6, 8] as const) {
    it(`is a fixed-point-free involution for n = ${n} (1,000 specs × every start position)`, () => {
      const r = createRng(seedFor('toy', n))
      for (let s = 0; s < 1000; s++) {
        const rotors = ((s % 3) + 1) as 1 | 2 | 3
        const spec = randomToy(r, n, rotors, { plugs: s % (n / 2 + 1) })
        expect(isFixedPointFreeInvolution(toyPermutation(spec))).toBe(true)
        // Walk the positions: the right rotor through every window.
        for (let p = 0; p < n; p++) {
          const positions = [...spec.positions]
          positions[positions.length - 1] = p
          expect(isFixedPointFreeInvolution(toyPermutation({ ...spec, positions }))).toBe(true)
        }
      }
    })
  }

  it('agrees with toyPress on a held toy', () => {
    const spec = randomToy(createRng(4), 8, 3, { plugs: 2, stepping: false })
    const perm = toyPermutation(spec)
    for (let i = 0; i < 8; i++) {
      const key = String.fromCharCode(65 + i) as 'A'
      expect(toyPress(spec, key).lamp.charCodeAt(0) - 65).toBe(perm[i])
    }
  })
})

describe('toy stepping', () => {
  const spec = (positions: number[], notches: number[], stepping = true): ToySpec => ({
    n: 6,
    rotors: positions.map(() => [0, 1, 2, 3, 4, 5]),
    notches,
    reflector: [1, 0, 3, 2, 5, 4],
    plugs: [0, 1, 2, 3, 4, 5],
    positions,
    stepping,
  })

  it('advances like an odometer: carries only from a rotor that steps off its notch', () => {
    let s = spec([0, 0, 0], [5, 5, 5])
    const seen: string[] = []
    for (let i = 0; i < 37; i++) {
      s = toyStep(s).spec
      seen.push(s.positions.join(''))
    }
    // 36 presses = one full turn of the middle rotor: exactly base-6 counting with carries at 5 → 0.
    expect(seen[0]).toBe('001')
    expect(seen[5]).toBe('010')
    expect(seen[35]).toBe('100')
    seen.forEach((w, i) => expect(Number.parseInt(w, 6)).toBe((i + 1) % 216))
  })

  it('reports stepped slots and never a double step', () => {
    const { stepping } = toyStep(spec([0, 2, 5], [0, 2, 5]))
    expect(stepping.stepped).toEqual({ left: true, middle: true, right: true })
    expect(stepping.doubleStep).toBe(false)
    expect(stepping.before).toEqual([0, 2, 5])
    expect(stepping.after).toEqual([1, 3, 0])
    expect(toyStep(spec([4], [0])).stepping.stepped).toEqual({ left: false, middle: false, right: true })
  })

  it('does not step a held toy', () => {
    const held = spec([1, 2, 3], [1, 2, 3], false)
    const press = toyPress(held, 'A')
    expect(press.spec.positions).toEqual([1, 2, 3])
    expect(press.stepping.stepped).toEqual({ left: false, middle: false, right: false })
    expect(press.stepping.before).toEqual(press.stepping.after)
  })
})

describe('toyPress hops', () => {
  it('has plugboard-in, k forward rotors right → left, reflector, k backward, plugboard-out (no ETW)', () => {
    const spec = randomToy(createRng(8), 8, 3, { plugs: 2 })
    const { hops, lamp } = toyPress(spec, 'C')
    expect(hops.map((h) => h.stage)).toEqual([
      'plugboard-in',
      'rotor-right-fwd',
      'rotor-middle-fwd',
      'rotor-left-fwd',
      'reflector',
      'rotor-left-bwd',
      'rotor-middle-bwd',
      'rotor-right-bwd',
      'plugboard-out',
    ])
    expect(hops[0]!.input).toBe('C')
    expect(hops.at(-1)!.output).toBe(lamp)
    for (let i = 1; i < hops.length; i++) expect(hops[i]!.inputIndex).toBe(hops[i - 1]!.outputIndex)
    expect(toyPress(randomToy(createRng(1), 6, 1), 'A').hops.map((h) => h.stage)).toEqual([
      'plugboard-in',
      'rotor-right-fwd',
      'reflector',
      'rotor-right-bwd',
      'plugboard-out',
    ])
  })

  it('rejects keys beyond the toy alphabet', () => {
    expect(() => toyPress(randomToy(createRng(1), 6, 2), 'G')).toThrow(RangeError)
    expect(() => toySlots(4)).toThrow(RangeError)
  })

  it('steps before encoding and reports the windows', () => {
    const spec = { ...randomToy(createRng(2), 6, 2), positions: [0, 5], notches: [0, 5] }
    const press = toyPress(spec, 'A')
    expect(toyWindows(press.spec)).toBe('BA')
    expect(press.hops[1]!.offset).toBe(0) // the right rotor already stepped 5 → 0
  })
})
