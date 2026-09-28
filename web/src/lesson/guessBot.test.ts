/**
 * L2 guess bot and L3 CC learner (PLAN §3.13), through the same gate engine the UI uses.
 *  - Guess bot: 1,000 runs per gate. Every instance is answered with sampleAnswer, the ladder's L3 is
 *    revealed, at most 6 attempts per item. P(the gate passes) must stay below 1%. Covers every chapter
 *    gate, the fixture, every recall set the rotation can draw and every return-check pair.
 *  - CC learner: an always-correct learner passes every gate, using at most 2 instances per window item
 *    and 1 per once item, and is shown every item (transfer items included).
 */

import { describe, expect, it } from 'vitest'
import type { GateRecord } from '../contracts/lesson'
import { createRng, seedFor } from '../lib/rng'
import { gateSources } from './__tests__/sources'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from './gateEngine'
import { hintLevel } from './rules'

const RUNS = 1000
const MAX_ATTEMPTS = 6
const STEP_MS = 10_000
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function botPasses(ctx: GateCtx, run: number): boolean {
  const r = createRng(seedFor('bot', ctx.key, run))
  let rec: GateRecord = EMPTY_GATE
  let now = 1
  for (;;) {
    rec = ensureCurrent(ctx, rec, now)
    const item = currentItem(ctx.logic, rec)
    if (!item) return true
    const it = rec.items[item.id]!
    if (it.attempt > MAX_ATTEMPTS) return false
    now += STEP_MS
    if (hintLevel(it, !!ctx.logic.puzzle) === 3) {
      rec = revealCurrent(ctx, rec, item.id, now).gate
    } else {
      const shown = shownInstance(ctx, item, it)
      rec = submitAnswer(ctx, rec, item.id, clone(shown.logic.sampleAnswer(shown.instance, r)), now).gate
    }
  }
}

const sources = gateSources()

describe('L2 guess bot: P(pass) < 1% over 1,000 runs', () => {
  it('enumerates the fixture, every recall set and every return-check pair', () => {
    const names = sources.map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['lab-fixture/main', 'lab-fixture/puzzle', 'recall/ii5-indicators:0']))
    expect(names.filter((n) => n.startsWith('recall/iv-capstone')).length).toBeGreaterThanOrEqual(1)
    expect(names.filter((n) => n.startsWith('return/')).length).toBeGreaterThanOrEqual(10)
  })

  it.each(sources.map((s) => [s.name, s] as const))('%s', (_name, s) => {
    const ctx: GateCtx = { key: s.key as GateCtx['key'], logic: s.logic, salt: `bot:${s.name}` }
    let passes = 0
    for (let run = 0; run < RUNS; run++) {
      if (botPasses({ ...ctx, salt: `${ctx.salt}:${run}` }, run)) passes++
    }
    expect(passes / RUNS).toBeLessThan(0.01)
  })
})

describe('L3 CC learner', () => {
  it.each(sources.map((s) => [s.name, s] as const))('%s', (_name, s) => {
    for (const salt of ['cc-1', 'cc-2', 'cc-3']) {
      const ctx: GateCtx = { key: s.key as GateCtx['key'], logic: s.logic, salt }
      const used = new Map<string, number>()
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      for (let guard = 0; guard < 1000; guard++) {
        rec = ensureCurrent(ctx, rec, now)
        const item = currentItem(ctx.logic, rec)
        if (!item) break
        const it = rec.items[item.id]!
        const shown = shownInstance(ctx, item, it)
        // The e2e path: the instance crosses JSON (window.__course.gate()), is solved in Node, answered back.
        const answer = clone(shown.logic.solve(clone(shown.instance)))
        now += STEP_MS
        const res = submitAnswer(ctx, rec, item.id, answer, now)
        expect(res.result.correct, `${item.id}: the solution was judged wrong`).toBe(true)
        rec = res.gate
        used.set(item.id, (used.get(item.id) ?? 0) + 1)
      }
      expect(rec.passed).toBe(true)
      for (const item of s.logic.items) {
        expect(used.get(item.id), `${item.id} was never shown`).toBeGreaterThan(0)
        expect(used.get(item.id)).toBeLessThanOrEqual(item.rule.kind === 'window' ? 2 : 1)
        if (item.transfer) expect(used.get(item.id)).toBe(1)
      }
    }
  })
})
