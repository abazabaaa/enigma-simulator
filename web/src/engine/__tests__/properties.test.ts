/**
 * Property tests over many random (historically valid) configurations, with a seeded PRNG so
 * failures are reproducible: the failing seed/config is in the assertion message.
 */

import { describe, expect, it } from 'vitest'
import { mod } from '../alphabet'
import { createMachine, encipher, machinePermutation, step, type MachineConfig } from '../machine'
import { fixedPoints, isInvolution } from '../permutation'
import { mulberry32, randInt, randomConfig, randomText } from './helpers'

const CONFIGS = 300

describe.each([0x5eed, 0xe141a])('random configurations (seed %i)', (seed) => {
  const rng = mulberry32(seed)
  const cases = Array.from({ length: CONFIGS }, () => ({
    config: randomConfig(rng),
    text: randomText(rng, 20 + randInt(rng, 200)),
  }))

  it('enciphering is an involution: encipher(encipher(x)) === x from the same start', () => {
    for (const { config, text } of cases) {
      const start = createMachine(config)
      const ct = encipher(start, text).output
      expect(encipher(start, ct).output, JSON.stringify(config)).toBe(text)
    }
  })

  it('no letter ever enciphers to itself', () => {
    for (const { config, text } of cases) {
      const ct = encipher(createMachine(config), text).output
      for (let i = 0; i < text.length; i++) expect(ct[i], JSON.stringify(config)).not.toBe(text[i])
    }
  })

  it('every machine permutation is a fixed-point-free involution (13 transpositions)', () => {
    for (const { config } of cases) {
      let s = createMachine(config)
      for (let k = 0; k < 30; k++) {
        s = step(s).state
        const p = machinePermutation(s)
        expect(isInvolution(p) && fixedPoints(p).length === 0, JSON.stringify(config)).toBe(true)
      }
    }
  })
})

describe('equivalences', () => {
  const rng = mulberry32(0x4)

  it('M4 Beta (position = ring) + B-thin == M3 + UKW-B; Gamma + C-thin == UKW-C', () => {
    for (let t = 0; t < 200; t++) {
      const m3 = randomConfig(rng, 'M3')
      const greekRing = randInt(rng, 26)
      const letter = String.fromCharCode(65 + greekRing)
      const thin = m3.reflector === 'B' ? { greek: 'Beta', reflector: 'B-thin' } : { greek: 'Gamma', reflector: 'C-thin' }
      const m4: MachineConfig = {
        ...m3,
        model: 'M4',
        reflector: thin.reflector as MachineConfig['reflector'],
        rotors: [thin.greek as 'Beta' | 'Gamma', ...m3.rotors],
        rings: [letter as MachineConfig['rings'][number], ...m3.rings],
        positions: [letter as MachineConfig['positions'][number], ...m3.positions],
      }
      const text = randomText(rng, 100)
      expect(encipher(createMachine(m4), text).output, JSON.stringify(m4)).toBe(
        encipher(createMachine(m3), text).output,
      )
    }
  })

  it("the left rotor's ring only rotates its wiring: shifting its ring and position together changes nothing", () => {
    for (let t = 0; t < 100; t++) {
      const config = randomConfig(rng, 'I')
      const k = 1 + randInt(rng, 25)
      const shiftLetter = (l: string) => String.fromCharCode(65 + mod(l.charCodeAt(0) - 65 + k)) as MachineConfig['rings'][number]
      const shifted: MachineConfig = {
        ...config,
        rings: [shiftLetter(config.rings[0]!), ...config.rings.slice(1)],
        positions: [shiftLetter(config.positions[0]!), ...config.positions.slice(1)],
      }
      const text = randomText(rng, 120)
      expect(encipher(createMachine(shifted), text).output).toBe(encipher(createMachine(config), text).output)
    }
  })
})
