/**
 * L1 generators (PLAN §3.13) over every item of every chapter, the fixture and the recall pool, for
 * `lintSeeds` seeds (default 300, minimum 50).
 */

import { describe, expect, it } from 'vitest'
import type { GateKey, ItemKey, ModelName } from '../contracts/core'
import type { GenCtx, ItemLogic } from '../contracts/lesson'
import { ALL_PARTS } from '../contracts/stage'
import { createRng, seedFor } from '../lib/rng'
import { allItemLogics, gateSources } from './__tests__/sources'
import {
  currentItem,
  ensureCurrent,
  hintHighlights,
  shownInstance,
  submitAnswer,
  wrongAnswerOf,
  type GateCtx,
} from './gateEngine'
import { codeTaskOf } from './kinds'

const MAX_BYTES = 16 * 1024
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function seedsOf(l: ItemLogic): number {
  const n = l.lintSeeds ?? 300
  if (n < 50) throw new Error(`${l.id}: lintSeeds ${n} is below the minimum of 50`)
  return n
}

describe('L1 generators', () => {
  const items = allItemLogics()

  it('covers the fixture and the recall pool', () => {
    const ids = items.map((x) => x.logic.id)
    expect(ids).toEqual(expect.arrayContaining(['toy-lamp', 'double', 'left-steps', 'r-windows', 'r-plug-one']))
  })

  describe.each(items.map((x) => [`${x.owner}/${x.logic.id}`, x.logic] as const))('%s', (_name, l) => {
    const n = seedsOf(l)
    const key = `lab-fixture/lint/${l.id}` as ItemKey
    const ctxOf = (s: number): GenCtx => ({ key, attempt: (s % 4) + 1, purpose: 'instance', previous: [] })
    const gen = (s: number) => l.generate(createRng(seedFor('lint', l.id, s)), ctxOf(s))

    it(`is deterministic, JSON-safe (≤ 16 kB), same(i, i), and solve(i) passes check (${n} seeds)`, () => {
      for (let s = 0; s < n; s++) {
        const i = gen(s)
        expect(JSON.stringify(gen(s)), `seed ${s}: generate is not deterministic`).toBe(JSON.stringify(i))
        const json = JSON.stringify(i)
        expect(json.length, `seed ${s}: instance is ${json.length} bytes`).toBeLessThanOrEqual(MAX_BYTES)
        expect(clone(i), `seed ${s}: instance does not survive a JSON round trip`).toEqual(i)
        expect(l.same(i, i), `seed ${s}: same(i, i)`).toBe(true)
        const solution = l.solve(i)
        expect(l.check(i, solution).correct, `seed ${s}: check(i, solve(i))`).toBe(true)
        // The answer and the instance both cross JSON (window.__course, Node-side e2e): still correct.
        expect(l.check(i, clone(solution)).correct, `seed ${s}: the solution does not survive JSON`).toBe(true)
        expect(JSON.stringify(l.solve(clone(i))), `seed ${s}: solve(JSON(i)) differs`).toBe(JSON.stringify(solution))
        expect(JSON.stringify(l.check(i, solution)), `seed ${s}: the check result is not JSON-safe`).toBeTruthy()
      }
    })

    it('mutate(solve(i)) is wrong for at least 95% of seeds', () => {
      let wrong = 0
      for (let s = 0; s < n; s++) {
        const i = gen(s)
        const a = l.mutate(i, l.solve(i), createRng(seedFor('mutate', l.id, s)))
        const res = l.check(i, a)
        if (!res.correct) wrong++
        expect(JSON.stringify(res.rollback), `seed ${s}: rollback not JSON-safe`).toBeTruthy()
      }
      expect(wrong / n).toBeGreaterThanOrEqual(0.95)
    })

    it(l.constantAnswer ? 'has a constant answer (declared)' : 'has at least 2 distinct solutions', () => {
      // A code item's answer that varies is its probe: the run summary always differs by the instance seed.
      const task = codeTaskOf(l)
      const solutions = new Set<string>()
      for (let s = 0; s < n; s++) {
        const i = gen(s)
        solutions.add(task ? task.probe(i).expected : JSON.stringify(l.solve(i)))
      }
      if (l.constantAnswer) expect(solutions.size).toBe(1)
      else
        expect(solutions.size, 'a constant answer must be declared constantAnswer (and once)').toBeGreaterThanOrEqual(2)
    })

    if (l.kind === 'ghost-pick') {
      it('the question carries no divergence (ghost.divergeAt < 0): the fault is the answer', () => {
        for (let s = 0; s < n; s++) {
          const ghost = (gen(s) as { ghost?: { divergeAt?: number } }).ghost
          expect(ghost?.divergeAt ?? -1, `seed ${s}`).toBeLessThan(0)
        }
      })
    }

    it('sampleAnswer is well formed (checkable, JSON-safe)', () => {
      for (let s = 0; s < Math.min(n, 100); s++) {
        const i = gen(s)
        const a = l.sampleAnswer(i, createRng(seedFor('sample', l.id, s)))
        expect(() => l.check(i, clone(a))).not.toThrow()
      }
    })
  })
})

/**
 * Hint L1 through the runtime path (review round 3): submitAnswer → ensureCurrent draws a fresh instance, and
 * the hint must still come from highlight(answered instance, wrong answer). For every item of every gate, over
 * a few salts: the submit keeps the answered instance, hintHighlights uses it, highlight does not throw, and
 * every highlighted part is a real part id.
 */
describe('L1 hints through submitAnswer → ensureCurrent', () => {
  const PARTS = new Set<string>((['I', 'M3', 'M4'] as ModelName[]).flatMap((m) => ALL_PARTS(m)))
  const SALTS = 12

  describe.each(gateSources().map((g) => [g.name, g] as const))('%s', (_name, g) => {
    it(`highlight(answered instance, wrong answer) on every item (${SALTS} salts)`, () => {
      for (let s = 0; s < SALTS; s++) {
        const ctx: GateCtx = {
          key: g.key as GateKey,
          logic: g.logic,
          salt: `hints-${s}`,
          cfg: { minLatencyMs: 0, burstMs: 0 },
        }
        let t = 0
        let rec = ensureCurrent(ctx, undefined, t)
        const seen = new Set<string>()
        for (let guard = 0; guard < 3 * g.logic.items.length && !rec.passed; guard++) {
          const item = currentItem(ctx.logic, rec)
          if (!item || seen.has(item.id)) break
          seen.add(item.id)
          const answered = shownInstance(ctx, item, rec.items[item.id]!)
          const good = answered.logic.solve(answered.instance)
          const bad = clone(answered.logic.mutate(answered.instance, good, createRng(seedFor('hint', item.id, s))))
          const res = submitAnswer(ctx, rec, item.id, bad, (t += 10_000))
          rec = ensureCurrent(ctx, res.gate, t)
          const wrong = wrongAnswerOf(res, bad)
          if (wrong) {
            const where = `${g.name} salt ${s}: ${item.id}`
            expect(wrong.shown.instance, `${where}: the submit lost the answered instance`).toEqual(answered.instance)
            const direct = answered.logic.highlight(answered.instance, bad)
            const fresh = shownInstance(ctx, item, rec.items[item.id]!)
            expect(hintHighlights(fresh, wrong), `${where}: L1 is not from the answered instance`).toEqual(direct)
            for (const h of direct) expect(PARTS.has(h.part), `${where}: unknown part '${h.part}'`).toBe(true)
          }
          // Pass the item with correct answers and go on to the next.
          for (let k = 0; k < 4 && !rec.items[item.id]!.passed; k++) {
            const cur = shownInstance(ctx, item, rec.items[item.id]!)
            const ok = submitAnswer(ctx, rec, item.id, clone(cur.logic.solve(cur.instance)), (t += 10_000))
            rec = ensureCurrent(ctx, ok.gate, t)
          }
        }
      }
    })
  })
})
