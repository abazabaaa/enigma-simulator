// @vitest-environment happy-dom
/**
 * Review round 3: hint L1 highlights come from the instance the wrong answer belonged to. submitAnswer moves
 * the item on and G3 draws a fresh instance, so highlight(fresh, wrong) would diff the learner's answer
 * against an instance they never answered.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { GateKey } from '../../contracts/core'
import type { CheckResult, GateLogic, ItemLogic } from '../../contracts/lesson'
import { createRng } from '../../lib/rng'
import { updateConfig } from '../config'
import { GATES } from '../fixture/gates'
import { createGateController } from '../gateController'
import { hintHighlights, type Shown } from '../gateEngine'
import { useProgress } from '../progress'

const KEY = 'lab-fixture/lab:hints' as GateKey

/** The fixture's main gate with a spy on the first item's highlight (toy-lamp: the part where the ghost left). */
function spied(): { logic: GateLogic; item: ItemLogic; calls: unknown[][] } {
  const base = GATES.main!
  const item = base.items[0]!
  const calls: unknown[][] = []
  const spy: ItemLogic = {
    ...item,
    // The runtime passes the answer's CheckResult as an optional third argument (additive, no contract change).
    highlight: (i: unknown, a: unknown, r?: CheckResult) => {
      calls.push([i, a, r])
      return item.highlight(i, a)
    },
  }
  return { logic: { ...base, items: [spy, ...base.items.slice(1)] }, item, calls }
}

beforeEach(() => {
  useProgress.getState().reset(Date.now())
  updateConfig({ rules: { minLatencyMs: 0, burstMs: 0 } })
})

describe('gate controller: hint L1 highlights', () => {
  it('pass the answered instance, the wrong answer and its check to highlight, not the fresh instance', () => {
    const { logic, item, calls } = spied()
    const c = createGateController({ key: KEY, logic })
    let differed = 0
    let rounds = 0
    for (let k = 0; k < 12; k++) {
      c.ensure()
      const before = c.view().current!
      expect(before.itemId).toBe(item.id)
      // Two "Got it" reveals switch to the gate's fallback (gaming: reveals): enough rounds by then.
      if (before.fallback) break
      const answered = before.instance
      const good = item.solve(answered)
      const wrong = item.mutate(answered, good, createRng(1000 + k))
      if (item.check(answered, wrong).correct) continue
      c.submit(item.id, wrong)
      // The feedback shows the rollback; no hint highlights yet.
      expect(c.hints()).toEqual([])
      c.continue()
      const now = c.view().current!
      expect(now.hintLevel).toBeGreaterThanOrEqual(1)
      // G3: the learner is now answering a fresh instance.
      expect(now.instance).not.toEqual(answered)
      rounds++
      calls.length = 0
      const hints = c.hints()
      expect(calls).toEqual([[answered, wrong, item.check(answered, wrong)]])
      expect(hints).toEqual(item.highlight(answered, wrong))
      if (JSON.stringify(item.highlight(now.instance, wrong)) !== JSON.stringify(hints)) differed++
      // At L3 "Got it" draws the next instance with no wrong answer on record: the hint is gone.
      if (now.hintLevel === 3) {
        c.continue()
        expect(c.view().current!.hintLevel).toBe(0)
        expect(c.hints()).toEqual([])
      }
    }
    // The bug this guards against is visible on this item: the fresh instance often names another part.
    expect(rounds).toBeGreaterThanOrEqual(5)
    expect(differed).toBeGreaterThan(0)
  })

  it('hintHighlights: the answered instance after a wrong answer, the current one (with null) otherwise', () => {
    const { item } = spied()
    const shown = (seed: number): Shown => ({
      logic: item,
      fallback: false,
      instance: item.generate(createRng(seed), { key: `${KEY}/x`, attempt: 1, purpose: 'instance', previous: [] }),
    })
    const answered = shown(1)
    const current = shown(2)
    const wrong = item.mutate(answered.instance, item.solve(answered.instance), createRng(3))
    const result = item.check(answered.instance, wrong)
    expect(hintHighlights(current, { shown: answered, answer: wrong, result })).toEqual(
      item.highlight(answered.instance, wrong),
    )
    expect(hintHighlights(current, null)).toEqual(item.highlight(current.instance, null))
    const throwing: ItemLogic = {
      ...item,
      highlight: () => {
        throw new Error('broken highlight')
      },
    }
    expect(hintHighlights({ ...current, logic: throwing }, null)).toEqual([])
  })
})
