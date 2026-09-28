import { describe, expect, it } from 'vitest'
import type { MachineConfig } from '../../contracts/core'
import { createRng } from '../../lib/rng'
import { toyPress } from '../../lib/toy'
import { GATES, middleSteps, toyLamp, toyStagePerms } from '../fixture/gates'
import {
  backwardGhost,
  ghostFromOutputs,
  metaOf,
  nextProbeToken,
  normalizeProbe,
  numbersMatch,
  partForStage,
  partitions,
  randomPairedPartition,
  randomProbeToken,
  setMachineLocks,
  splitWindows,
  windowsAfterPresses,
  windowsRollback,
} from '../kinds'

describe('builder defaults (§3.6)', () => {
  it('compute and inPage by kind', () => {
    const byKind = Object.fromEntries(
      [...GATES.main!.items, GATES.main!.fallback].map((l) => [l.kind, { compute: l.compute, inPage: l.inPage }]),
    )
    expect(byKind).toMatchObject({
      letter: { compute: true, inPage: false },
      letters: { compute: true, inPage: false },
      numbers: { compute: true, inPage: false },
      choice: { compute: false, inPage: false },
      order: { compute: false, inPage: false },
      chain: { compute: true, inPage: false },
      'set-machine': { compute: true, inPage: true },
      'ghost-pick': { compute: false, inPage: true },
      code: { compute: true, inPage: false },
      custom: { compute: false, inPage: true },
    })
    expect(metaOf(toyLamp)).toEqual({ alphabet: 6 })
  })

  it('numbers: order, multisets and tolerance', () => {
    expect(numbersMatch([3, 3, 1, 1], [1, 3, 1, 3], { multiset: true })).toBe(true)
    expect(numbersMatch([3, 3, 1, 1], [1, 3, 1, 3])).toBe(false)
    expect(numbersMatch([10], [11], { tolerance: 1 })).toBe(true)
    expect(numbersMatch([100], [111], { tolerance: { relative: 0.1 } })).toBe(false)
    expect(numbersMatch([1], [Number.NaN])).toBe(false)
  })

  it('paired partitions: 11 for n = 12, every sample paired', () => {
    expect(partitions(6)).toHaveLength(11)
    expect(partitions(13)).toHaveLength(101)
    const r = createRng(3)
    for (let k = 0; k < 200; k++) {
      const p = randomPairedPartition(r, 14)
      expect(p.reduce((a, b) => a + b, 0)).toBe(14)
      for (let j = 0; j < p.length; j += 2) expect(p[j]).toBe(p[j + 1])
    }
  })

  it('probe tokens: normalised, sampled by shape, bumped by mutate', () => {
    expect(normalizeProbe('  "q"  ')).toBe('Q')
    expect(normalizeProbe('4  2')).toBe('4 2')
    const r = createRng(1)
    expect(randomProbeToken('Q', r)).toMatch(/^[A-Z]$/)
    expect(randomProbeToken('42', r)).toMatch(/^-?\d+$/)
    expect(randomProbeToken('true', r)).toMatch(/^(true|false)$/)
    expect(nextProbeToken('42')).toBe('43')
    expect(nextProbeToken('z')).toBe('A')
  })
})

describe('set-machine (G8)', () => {
  const inst = middleSteps.generate(createRng(5), { key: 'lab-fixture/main/middle-steps', attempt: 1, purpose: 'instance', previous: [] })

  it('locks the keyboard, hides the lamps and unlocks only the listed controls', () => {
    expect(setMachineLocks(['positions'])).toEqual({
      model: true,
      rotors: true,
      reflector: true,
      rings: true,
      positions: false,
      plugboard: true,
      keyboard: true,
      lampsHidden: true,
    })
    expect(middleSteps.setup!(inst).locks).toMatchObject({ keyboard: true, lampsHidden: true, positions: false, rotors: true })
  })

  it('checks the predicate on the submitted config, and rejects changes to locked fields', () => {
    const good = middleSteps.solve(inst) as MachineConfig
    expect(middleSteps.check(inst, good).correct).toBe(true)
    const swapped = { ...good, rotors: [...good.rotors].reverse() }
    expect(middleSteps.check(inst, swapped)).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'rotors' } })
    expect(middleSteps.check(inst, { nope: true } as unknown as MachineConfig)).toMatchObject({ correct: false, rollback: { kind: 'machine' } })
    const wrong = middleSteps.mutate(inst, good, createRng(1)) as MachineConfig
    expect(middleSteps.check(inst, wrong)).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'positions' } })
  })
})

describe('rollback helpers', () => {
  it('ghostFromOutputs follows the learner’s letters and marks the first wrong hop', () => {
    const ref = toyPress({ n: 6, rotors: [[1, 2, 0, 4, 5, 3]], notches: [0], reflector: [1, 0, 3, 2, 5, 4], plugs: [0, 1, 2, 3, 4, 5], positions: [0], stepping: false }, 'A').hops
    const outputs = ref.map((h) => h.output as string)
    expect(ghostFromOutputs(ref, outputs).divergeAt).toBe(ref.length)
    const wrong = [...outputs]
    wrong[2] = wrong[2] === 'A' ? 'B' : 'A'
    const g = ghostFromOutputs(ref, wrong)
    expect(g.divergeAt).toBe(2)
    expect(g.hops[3]!.input).toBe(wrong[2])
  })

  it('backwardGhost traces the wrong lamp back to a component on the path (never an empty plugboard)', () => {
    for (let s = 0; s < 200; s++) {
      const i = toyLamp.generate(createRng(s), { key: 'lab-fixture/main/toy-lamp', attempt: 1, purpose: 'instance', previous: [] }) as {
        spec: Parameters<typeof toyPress>[0]
        key: 'A'
      }
      const press = toyPress(i.spec, i.key)
      const wrong = (press.hops.at(-1)!.outputIndex + 1) % 6
      const g = backwardGhost(press.hops, toyStagePerms(i.spec), wrong)
      expect(g.hops.at(-1)!.outputIndex).toBe(wrong)
      expect(g.hops[g.divergeAt]!.kind).not.toBe('plugboard')
      expect(partForStage(g.hops[g.divergeAt]!.stage)).toMatch(/^(rotor-|reflector)/)
    }
  })

  it('windows: presses from a start, and the first wrong press', () => {
    const from = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: ['A', 'A', 'A'], positions: ['A', 'D', 'U'], plugboard: [] } as MachineConfig
    const expected = windowsAfterPresses(from, 3)
    expect(expected).toEqual(['ADV', 'AEW', 'BFX'])
    expect(splitWindows('ADVAEWBFX')).toEqual(expected)
    expect(windowsRollback(from, expected, ['ADV', 'ADW', 'BFX'])).toMatchObject({ kind: 'windows', firstWrong: 1 })
  })
})
