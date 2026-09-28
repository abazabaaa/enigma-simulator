import { describe, expect, it } from 'vitest'
import type { GenCtx } from '../../contracts/lesson'
import { createRng } from '../../lib/rng'
import { faultyHop, puzzleLamps, whichWrong, type GhostInstance, type LampsInstance } from '../fixture/gates'
import { partForStage } from '../kinds'

const ctx = (key: string): GenCtx => ({ key: key as GenCtx['key'], attempt: 1, purpose: 'instance', previous: [] })

describe('which-wrong (ghost-pick): the question never carries the fault (review B1)', () => {
  it('the instance has divergeAt −1; the fault is found from the tables and drawn only in the rollback', () => {
    const at = new Set<number>()
    for (let s = 0; s < 300; s++) {
      const i = whichWrong.generate(createRng(s), ctx('lab-fixture/main/which-wrong')) as GhostInstance
      expect(i.ghost.divergeAt).toBe(-1)
      expect(JSON.stringify(i)).not.toMatch(/"divergeAt":\d/)
      const k = faultyHop(i)
      expect(k).toBeGreaterThanOrEqual(0)
      at.add(k)
      expect(whichWrong.solve(i)).toBe(partForStage(i.ghost.hops[k]!.stage))
      const wrong = whichWrong.mutate(i, whichWrong.solve(i), createRng(s))
      const res = whichWrong.check(i, wrong)
      expect(res.correct).toBe(false)
      expect(res.rollback).toMatchObject({ kind: 'path', ghost: { divergeAt: k } })
    }
    expect(at.size).toBeGreaterThan(5)
  })
})

describe('puzzle-lamps: the rollback traces the wrong lamp backwards (review M3)', () => {
  it('the divergence varies and never sits on the toy’s empty plugboard', () => {
    const at = new Set<number>()
    for (let s = 0; s < 500; s++) {
      const i = puzzleLamps.generate(createRng(s), ctx('lab-fixture/puzzle/puzzle-lamps')) as LampsInstance
      const good = puzzleLamps.solve(i) as string
      const wrong = puzzleLamps.mutate(i, good, createRng(s)) as string
      const res = puzzleLamps.check(i, wrong)
      if (res.correct || res.rollback.kind !== 'path') throw new Error('expected a path rollback')
      const hop = res.rollback.ghost.hops[res.rollback.ghost.divergeAt]!
      expect(hop.kind).not.toBe('plugboard')
      at.add(res.rollback.ghost.divergeAt)
      // The ghost ends on the learner's wrong lamp.
      const k = [...good].findIndex((c, j) => c !== wrong[j])
      expect(res.rollback.ghost.hops.at(-1)!.output).toBe(wrong[k])
    }
    expect(at.size).toBeGreaterThanOrEqual(2)
  })
})
