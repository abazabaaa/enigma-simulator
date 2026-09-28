import { describe, expect, it } from 'vitest'
import type { GateRecord } from '../../contracts/lesson'
import { createRng } from '../../lib/rng'
import { GATES } from '../fixture/gates'
import {
  EMPTY_GATE,
  currentItem,
  ensureCurrent,
  gateView,
  revealCurrent,
  shownInstance,
  submitAnswer,
  workedFor,
  type GateCtx,
} from '../gateEngine'
import { instanceSeed } from '../rules'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const ctx: GateCtx = {
  key: 'lab-fixture/main',
  logic: GATES.main!,
  salt: 'engine',
  cfg: { minLatencyMs: 2000, burstMs: 5000 },
}
const SLOW = 10_000

function answerCurrent(rec: GateRecord, correct: boolean, now: number, c: GateCtx = ctx) {
  const item = currentItem(c.logic, rec)!
  const shown = shownInstance(c, item, rec.items[item.id]!)
  const good = shown.logic.solve(shown.instance)
  const a = correct ? good : shown.logic.mutate(shown.instance, good, createRng(now))
  return submitAnswer(c, rec, item.id, clone(a), now)
}

describe('gate engine', () => {
  it('creates the current item on first show and exposes no answers in the view', () => {
    const rec = ensureCurrent(ctx, undefined, 1)
    expect(Object.keys(rec.items)).toEqual(['toy-lamp'])
    const v = gateView(ctx, rec)
    expect(v.current).toMatchObject({
      itemId: 'toy-lamp',
      kind: 'letter',
      attempt: 1,
      hintLevel: 0,
      fallback: false,
      passed: false,
    })
    expect(v.current!.seed).toBe(instanceSeed('engine', 'lab-fixture/main/toy-lamp', 1, 0))
    expect(v.items.map((i) => i.itemId)).toEqual(GATES.main!.items.map((i) => i.id))
    expect(v.items[1]).toMatchObject({ attempt: 0, instance: null })
  })

  it('a reload (JSON round trip of the record) keeps the seed, the redraw and the instance', () => {
    let rec = ensureCurrent(ctx, undefined, 1)
    for (let k = 0; k < 6; k++) rec = answerCurrent(rec, false, (k + 1) * SLOW).gate
    const item = currentItem(ctx.logic, rec)!
    const before = gateView(ctx, rec).current!
    const reloaded = clone(rec)
    const after = gateView(ctx, reloaded).current!
    expect(after.seed).toBe(before.seed)
    expect(reloaded.items[item.id]!.redraw).toBe(rec.items[item.id]!.redraw)
    expect(after.instance).toEqual(before.instance)
  })

  it('redraws an instance that repeats one of the last three (G3)', () => {
    let rec = ensureCurrent({ ...ctx, logic: GATES.main! }, undefined, 1)
    const seen: string[] = []
    let redraws = 0
    for (let k = 0; k < 40; k++) {
      const item = currentItem(ctx.logic, rec)!
      const it = rec.items[item.id]!
      const inst = JSON.stringify(shownInstance(ctx, item, it).instance)
      expect(seen.slice(-3)).not.toContain(inst)
      seen.push(inst)
      redraws += it.redraw
      rec = answerCurrent(rec, false, (k + 1) * SLOW).gate
      if (k % 4 === 3) rec = revealCurrent(ctx, rec, item.id, (k + 1) * SLOW + 1).gate
    }
    expect(redraws).toBeGreaterThanOrEqual(0)
  })

  it('emits submit, passed and gate events in order', () => {
    const one: GateCtx = { ...ctx, key: 'lab-fixture/puzzle', logic: GATES.puzzle! }
    let rec = ensureCurrent(one, undefined, 1)
    const r1 = answerCurrent(rec, true, SLOW, one)
    expect(r1.events).toEqual([
      expect.objectContaining({ type: 'item.submit', attempt: 1, correct: true, ms: SLOW - 1, rollback: 'none' }),
    ])
    rec = r1.gate
    const r2 = answerCurrent(rec, true, 2 * SLOW, one)
    expect(r2.events.map((e) => e.type)).toEqual(['item.submit', 'item.passed', 'gate.passed'])
    expect(r2.gate.passed).toBe(true)
    expect(() => submitAnswer(one, r2.gate, 'puzzle-lamps', 'AAA', 3 * SLOW)).toThrow(/not the current item/)
  })

  it('refuses answers to an item that is not current', () => {
    const rec = ensureCurrent(ctx, undefined, 1)
    expect(() => submitAnswer(ctx, rec, 'windows', 'AAAAAAAAA', 2)).toThrow(/not the current item/)
  })

  it('gaming → a fallback instance from the gate fallback, recorded on the item, then back to normal', () => {
    let rec = ensureCurrent(ctx, undefined, 1)
    rec = answerCurrent(rec, false, 100).gate
    const gamed = answerCurrent(rec, false, 200)
    expect(gamed.events).toContainEqual({ type: 'gaming', item: 'lab-fixture/main/toy-lamp', reason: 'fast' })
    const v = gateView(ctx, gamed.gate).current!
    expect(v).toMatchObject({ itemId: 'toy-lamp', fallback: true, kind: 'set-machine' })
    const shown = shownInstance(ctx, GATES.main!.items[0]!, gamed.gate.items['toy-lamp']!)
    expect(shown.logic.id).toBe('left-steps')
    const back = answerCurrent(gamed.gate, true, 200 + SLOW)
    expect(back.gate.items['toy-lamp']!.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(gateView(ctx, back.gate).current).toMatchObject({ itemId: 'toy-lamp', fallback: false, kind: 'letter' })
  })

  it('the L2 worked example differs from the current and the next instance', () => {
    let rec = ensureCurrent(ctx, undefined, 1)
    rec = answerCurrent(rec, false, SLOW).gate
    rec = answerCurrent(rec, false, 2 * SLOW).gate
    const item = currentItem(ctx.logic, rec)!
    const it = rec.items[item.id]!
    const w = workedFor(ctx, item, it)
    const current = shownInstance(ctx, item, it).instance
    expect(item.same(w.instance, current)).toBe(false)
    expect(w.seed).not.toBe(it.seed)
    const next = answerCurrent(rec, false, 3 * SLOW).gate
    const nextInst = shownInstance(ctx, item, next.items[item.id]!).instance
    expect(item.same(w.instance, nextInst)).toBe(false)
    expect(w.solution).toEqual(item.solve(w.instance))
  })

  it('an empty gate record is a valid view', () => {
    expect(gateView(ctx, EMPTY_GATE).current).toMatchObject({ itemId: 'toy-lamp', attempt: 0, instance: null })
  })
})
