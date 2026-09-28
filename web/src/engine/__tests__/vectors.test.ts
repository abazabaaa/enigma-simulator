/**
 * Every published test vector, exported from the Python oracle by tools/export_vectors.py.
 * Regenerate the fixture with `python3 tools/export_vectors.py` (never edit it by hand).
 */

import { describe, expect, it } from 'vitest'
import vectorsJson from '../__fixtures__/vectors.json'
import { LETTERS, type Letter } from '../alphabet'
import {
  createMachine,
  encipher,
  encodeLetter,
  machinePermutation,
  positionsToString,
  pressKey,
  rotorPermutation,
  step,
  type MachineConfig,
  type MachineState,
} from '../machine'
import { fixedPoints, inverse, isInvolution } from '../permutation'
import type { RotorName } from '../wiring'

interface CaseBase {
  id: string
  title: string
  source: string
  notes?: string
}

type VectorCase = CaseBase &
  (
    | {
        kind: 'message'
        config: MachineConfig
        plaintext: string
        ciphertext: string
        finalPositions: string
      }
    | {
        kind: 'stepping'
        config: MachineConfig
        plaintext: string
        ciphertext: string
        positionsAfterEachKey: string[]
      }
    | {
        kind: 'rotor'
        rotor: RotorName
        ring: Letter
        position: Letter
        direction: 'forward' | 'backward'
        input: Letter
        output: Letter
      }
    | { kind: 'equivalence'; configs: MachineConfig[]; plaintext: string; ciphertext: string }
    | { kind: 'property'; property: 'no-self-encryption'; config: MachineConfig; keypresses: number }
    | { kind: 'property'; property: 'period'; config: MachineConfig; expected: number }
  )

const vectors = vectorsJson as unknown as VectorCase[]

/** Type every letter with pressKey (the traced path) and collect lamps + windows. */
function typeKeys(state: MachineState, text: string) {
  let s = state
  let output = ''
  const windows: string[] = []
  for (const ch of text) {
    const r = pressKey(s, ch)
    expect(r.trace.at(-1)!.output).toBe(r.output)
    expect(r.trace[0]!.input).toBe(ch)
    s = r.state
    output += r.output
    windows.push(positionsToString(s))
  }
  return { output, windows, state: s }
}

describe('published test vectors (web/src/engine/__fixtures__/vectors.json)', () => {
  it('contains every required vector', () => {
    const ids = vectors.map((v) => v.id)
    for (const id of [
      'wikipedia-default-key',
      'wikipedia-rings-bbb',
      'wikipedia-rotor-I-ring-B',
      'wikipedia-double-step',
      'rijmenants-double-step',
      'manual-1930-indicator',
      'manual-1930-body',
      'barbarossa-part-1',
      'barbarossa-part-2',
      'py-enigma-message-key',
      'py-enigma-body',
      'u264-m4',
      'scharnhorst',
      'm4-beta-bthin-equals-m3-b',
      'no-self-encryption-sweep',
    ]) {
      expect(ids).toContain(id)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const v of vectors) {
    const name = `${v.id}: ${v.title}`
    switch (v.kind) {
      case 'message':
        it(name, () => {
          const start = createMachine(v.config)
          const enc = encipher(start, v.plaintext)
          expect(enc.output).toBe(v.ciphertext)
          expect(positionsToString(enc.state)).toBe(v.finalPositions)
          // Self-reciprocal: the same start state deciphers.
          expect(encipher(start, v.ciphertext).output).toBe(v.plaintext)
          // The traced key-by-key path agrees with the fast path.
          expect(typeKeys(start, v.plaintext).output).toBe(v.ciphertext)
        })
        break
      case 'stepping':
        it(name, () => {
          const { output, windows } = typeKeys(createMachine(v.config), v.plaintext)
          expect(windows).toEqual(v.positionsAfterEachKey)
          expect(output).toBe(v.ciphertext)
        })
        break
      case 'rotor':
        it(name, () => {
          const perm = rotorPermutation(v.rotor, v.ring, v.position)
          const map = v.direction === 'forward' ? perm : inverse(perm)
          expect(LETTERS[map[LETTERS.indexOf(v.input)]!]).toBe(v.output)
        })
        break
      case 'equivalence':
        it(name, () => {
          for (const config of v.configs) {
            expect(encipher(createMachine(config), v.plaintext).output).toBe(v.ciphertext)
          }
        })
        break
      case 'property':
        if (v.property === 'no-self-encryption') {
          it(name, () => {
            let s = createMachine(v.config)
            for (let k = 0; k < v.keypresses; k++) {
              s = step(s).state
              const perm = machinePermutation(s)
              expect(fixedPoints(perm)).toEqual([])
              expect(isInvolution(perm)).toBe(true)
              if (k % 97 === 0) {
                // Spot-check the traced path too.
                for (const letter of LETTERS) expect(encodeLetter(s, letter).output).not.toBe(letter)
              }
            }
          })
        } else {
          it(name, () => {
            const start = createMachine(v.config)
            const home = positionsToString(start)
            let s = step(start).state
            let n = 1
            while (positionsToString(s) !== home && n < 20000) {
              s = step(s).state
              n++
            }
            expect(n).toBe(v.expected)
          })
        }
        break
    }
  }
})
