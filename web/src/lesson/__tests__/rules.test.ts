import { describe, expect, it } from 'vitest'
import type { ItemKey } from '../../contracts/core'
import type { ItemLogic, ItemRecord, OutcomeResult, PassRule } from '../../contracts/lesson'
import { int } from '../../lib/rng'
import { GATES, double, toyLamp } from '../fixture/gates'
import { codeItem } from '../kinds'
import {
  DEFAULT_RULES,
  OUTCOME_CAP,
  drawInstance,
  drawWorked,
  fallbackSeed,
  gatePassed,
  hintLevel,
  instanceSeed,
  isGaming,
  newItemRecord,
  reduceItem,
  windowPassed,
  workedSeed,
} from '../rules'

const KEY = 'lab-fixture/main/toy-lamp' as ItemKey
const SALT = 'salt'
const WINDOW: PassRule = { kind: 'window' }
const ONCE: PassRule = { kind: 'once' }
const SLOW = 10_000

/** Apply a sequence of C / W / R outcomes, each answered `ms` after the instance was shown. */
function run(seq: string, rule: PassRule, o: { ms?: number; puzzle?: boolean } = {}): ItemRecord[] {
  const ms = o.ms ?? SLOW
  let rec = newItemRecord(SALT, KEY, 0)
  const out: ItemRecord[] = []
  let now = 0
  for (const c of seq.replace(/\s+/g, '')) {
    now = rec.shownAt + ms
    rec =
      c === 'R'
        ? reduceItem(rec, { type: 'reveal', now }, rule, { salt: SALT, key: KEY, puzzle: o.puzzle })
        : reduceItem(rec, { type: 'answer', correct: c === 'C', now }, rule, { salt: SALT, key: KEY, puzzle: o.puzzle })
    out.push(rec)
  }
  return out
}

/** The 1-based step after which the item first passes, or null. */
const passAfter = (seq: string, rule: PassRule = WINDOW) => {
  const k = run(seq, rule).findIndex((r) => r.passed)
  return k === -1 ? null : k + 1
}

describe('rule 1: window pass (2 of the last 3, revealed counts as wrong, sticky)', () => {
  it.each([
    ['C C', 2],
    ['C W C', 3],
    ['W C C', 3],
    ['C W W', null],
    ['C W W C', null],
    ['C W W C C', 5],
    ['W W W R C C', 6],
    ['C R C', 3],
  ] as const)('%s → %s', (seq, expected) => {
    expect(passAfter(seq)).toBe(expected)
  })

  it('windowPassed reads only the last three outcomes', () => {
    const o = (r: OutcomeResult) => ({ result: r, ms: 0, seed: 0, fallback: false, hintLevel: 0 as const, at: 0 })
    expect(windowPassed([o('correct'), o('correct'), o('wrong'), o('wrong')])).toBe(false)
    expect(windowPassed([o('wrong'), o('correct'), o('revealed'), o('correct')])).toBe(true)
    expect(windowPassed([o('correct'), o('revealed'), o('revealed')])).toBe(false)
  })

  it('a pass is sticky', () => {
    const recs = run('C C W W W R', WINDOW)
    expect(recs.map((r) => r.passed)).toEqual([false, true, true, true, true, true])
  })
})

describe('rule 2: once pass', () => {
  it.each([
    ['C', 1],
    ['W C', 2],
    ['W W W R C', 5],
    ['W R W', null],
  ] as const)('%s → %s', (seq, expected) => {
    expect(passAfter(seq, ONCE)).toBe(expected)
  })
})

describe('rule 3: every answer or reveal draws a fresh instance', () => {
  it('increments attempt, sets shownAt and stores the next seed', () => {
    const recs = run('W C R', WINDOW)
    recs.forEach((r, k) => {
      expect(r.attempt).toBe(k + 2)
      expect(r.shownAt).toBe((k + 1) * SLOW)
      expect(r.seed).toBe(instanceSeed(SALT, KEY, k + 2, 0))
      expect(r.redraw).toBe(0)
    })
    expect(recs.at(-1)!.outcomes.map((o) => o.seed)).toEqual([
      instanceSeed(SALT, KEY, 1, 0),
      instanceSeed(SALT, KEY, 2, 0),
      instanceSeed(SALT, KEY, 3, 0),
    ])
  })

  it('records ms from shownAt, and caps the outcomes at 20', () => {
    const recs = run('W'.repeat(25), WINDOW, { ms: 7_000 })
    expect(recs.at(-1)!.outcomes).toHaveLength(OUTCOME_CAP)
    expect(recs.at(-1)!.outcomes.every((o) => o.ms === 7_000)).toBe(true)
    expect(recs.at(-1)!.attempt).toBe(26)
  })
})

describe('rule 4: hint ladder', () => {
  const levels = (seq: string, puzzle: boolean) => [
    hintLevel(newItemRecord(SALT, KEY, 0), puzzle),
    ...run(seq, WINDOW, { puzzle }).map((r) => hintLevel(r, puzzle)),
  ]

  it('normal: L0 on attempt 1, L1, L2, L3, then a reveal resets to L0', () => {
    expect(levels('W W W R W', false)).toEqual([0, 1, 2, 3, 0, 1])
  })

  it('normal: a correct answer resets the ladder', () => {
    expect(levels('W W C W', false)).toEqual([0, 1, 2, 0, 1])
  })

  it('puzzle: the first hint arrives at attempt 3', () => {
    expect(levels('W W W W R W W', true)).toEqual([0, 0, 1, 2, 3, 0, 0, 1])
    expect(levels('W W C W W', true)).toEqual([0, 0, 1, 0, 0, 1])
  })

  it('the outcome records the hint level the instance was shown at', () => {
    expect(run('W W W R', WINDOW).at(-1)!.outcomes.map((o) => o.hintLevel)).toEqual([0, 1, 2, 3])
    expect(run('W W W W', WINDOW, { puzzle: true }).at(-1)!.outcomes.map((o) => o.hintLevel)).toEqual([0, 0, 1, 2])
  })
})

describe('rule 5: gaming', () => {
  it('fast: the last two answers were both quicker than minLatencyMs', () => {
    const fast = run('W W', WINDOW, { ms: 500 })
    expect(isGaming(fast[0]!)).toBe(false)
    expect(isGaming(fast[1]!)).toBe('fast')
    expect(fast[1]!.fallbackNext).toBe(true)
    expect(fast[1]!.seed).toBe(fallbackSeed(SALT, KEY, 3))
    expect(isGaming(run('C W', WINDOW, { ms: 1_999 })[1]!)).toBe('fast')
    expect(isGaming(run('W W', WINDOW, { ms: 2_000 })[1]!)).toBe(false)
  })

  it('fast ignores reveals (reading a revealed solution is not an answer)', () => {
    let rec = run('W W W', WINDOW)[2]!
    rec = reduceItem(rec, { type: 'reveal', now: rec.shownAt + 100 }, WINDOW, { salt: SALT, key: KEY })
    rec = reduceItem(rec, { type: 'answer', correct: false, now: rec.shownAt + 100 }, WINDOW, { salt: SALT, key: KEY })
    expect(isGaming(rec)).toBe(false)
  })

  it('ladder: three wrong answers, each under burstMs, up to L3', () => {
    const recs = run('W W W', WINDOW, { ms: 3_000 })
    expect(recs.map((r) => isGaming(r))).toEqual([false, false, 'ladder'])
    expect(recs[2]!.fallbackNext).toBe(true)
    expect(isGaming(run('W W W', WINDOW, { ms: 5_000 })[2]!)).toBe(false)
    expect(isGaming(run('C W W', WINDOW, { ms: 3_000 })[2]!)).toBe(false)
  })

  it('reveals: two reveals among the last six outcomes', () => {
    expect(isGaming(run('R W W W W R', WINDOW)[5]!)).toBe('reveals')
    expect(isGaming(run('R W W W W W R', WINDOW)[6]!)).toBe(false)
    expect(isGaming(run('W W W R', WINDOW)[3]!)).toBe(false)
  })

  it('custom thresholds: configure({ minLatencyMs: 0, burstMs: 0 }) switches fast and ladder off', () => {
    const cfg = { minLatencyMs: 0, burstMs: 0 }
    expect(isGaming(run('W W W', WINDOW, { ms: 0 })[2]!, cfg)).toBe(false)
    expect(DEFAULT_RULES).toEqual({ minLatencyMs: 2000, burstMs: 5000 })
  })

  it('fallbackNext lifecycle: the fallback outcome is recorded on the item and then clears', () => {
    const [, gamed] = run('W W', WINDOW, { ms: 100 })
    expect(gamed!.fallbackNext).toBe(true)
    const answered = reduceItem(gamed!, { type: 'answer', correct: true, now: gamed!.shownAt + SLOW }, WINDOW, {
      salt: SALT,
      key: KEY,
    })
    expect(answered.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true, seed: fallbackSeed(SALT, KEY, 3) })
    expect(answered.fallbackNext).toBe(false)
    expect(answered.seed).toBe(instanceSeed(SALT, KEY, 4, 0))
    // Two instant answers again → another fallback.
    const again = reduceItem(answered, { type: 'answer', correct: false, now: answered.shownAt + 1 }, WINDOW, { salt: SALT, key: KEY })
    const again2 = reduceItem(again, { type: 'answer', correct: false, now: again.shownAt + 1 }, WINDOW, { salt: SALT, key: KEY })
    expect(again2.fallbackNext).toBe(true)
  })
})

describe('rule 6: code items (probe AND every case of this instance)', () => {
  const inst = { seed: 77 }
  const total = double.solve(inst).run.total
  const pass = { status: 'pass' as const, passed: total, total, instanceSeed: 77 }
  it.each([
    ['probe right, all cases pass', { probe: '42', run: pass }, true],
    ['probe right (spaces, quotes)', { probe: ' "42" ', run: pass }, true],
    ['probe wrong, all cases pass', { probe: '41', run: pass }, false],
    ['probe right, a failing case', { probe: '42', run: { ...pass, status: 'fail' as const, passed: total - 1 } }, false],
    ['probe right, a stale run of another instance', { probe: '42', run: { ...pass, instanceSeed: 78 } }, false],
    ['probe right, too long', { probe: '42', run: { ...pass, status: 'too-long' as const, passed: 0 } }, false],
    ['probe right, timeout', { probe: '42', run: { ...pass, status: 'timeout' as const, passed: 0 } }, false],
    ['no probe', { probe: '', run: pass }, false],
  ])('%s', (_label, answer, correct) => {
    expect(double.check(inst, answer).correct).toBe(correct)
  })

  it('the rollback of a keypress-style run draws the recorded hops against the reference case', () => {
    const item = codeItem<{ seed: number }>(
      {
        fnNames: ['f'],
        signature: 'f()',
        brief: '',
        starter: '',
        provided: '',
        maxLines: 3,
        reference: '',
        instrument: 'keypress-parts',
        cases: () => [
          {
            label: 'hops',
            fn: 'f',
            args: [],
            expect: [
              { output: 'B' },
              { output: 'C' },
            ],
            compare: 'hops',
          },
        ],
        probe: () => ({ call: 'f()', expected: 'C' }),
      },
      { id: 'f', rule: WINDOW, generate: () => ({ seed: 1 }), same: () => true, highlight: () => [] },
    )
    const hop = (output: string) => ({ kind: 'rotor' as const, stage: 'rotor-right-fwd' as const, input: 'A' as const, output: output as 'B', inputIndex: 0, outputIndex: 1 })
    const res = item.check({ seed: 1 }, { probe: 'C', run: { status: 'fail', passed: 0, total: 1, instanceSeed: 1, hops: [hop('B'), hop('D')] } })
    expect(res.rollback).toMatchObject({ kind: 'path', ghost: { divergeAt: 1 } })
  })
})

describe('rule 7: gate pass', () => {
  it('passes when every item has passed', () => {
    const logic = GATES.main!
    const passed = { ...newItemRecord(SALT, KEY, 0), passed: true }
    const items = Object.fromEntries(logic.items.map((it) => [it.id, passed]))
    expect(gatePassed({ items, passed: false }, logic)).toBe(true)
    const { [logic.items[3]!.id]: _gone, ...missing } = items
    expect(gatePassed({ items: missing, passed: false }, logic)).toBe(false)
  })
})

describe('seeds', () => {
  const l = toyLamp as ItemLogic

  it('the worked example differs from the current and the next instance (1,000 cases)', () => {
    for (let attempt = 1; attempt <= 1000; attempt++) {
      const current = drawInstance(l, `s${attempt}`, KEY, attempt, [])
      const next = drawInstance(l, `s${attempt}`, KEY, attempt + 1, [current.instance])
      const worked = drawWorked(l, `s${attempt}`, KEY, attempt, current.instance, next.instance)
      expect(l.same(worked.instance, current.instance)).toBe(false)
      expect(l.same(worked.instance, next.instance)).toBe(false)
      expect(worked.seed).not.toBe(current.seed)
      expect(worked.seed).not.toBe(next.seed)
    }
  })

  it('drawInstance redraws while the instance repeats one of the previous ones', () => {
    const three: ItemLogic<number, number> = {
      id: 'three',
      kind: 'custom',
      rule: WINDOW,
      compute: false,
      inPage: false,
      generate: (r) => int(r, 3),
      same: (a, b) => a === b,
      check: () => ({ correct: true, rollback: { kind: 'none' } }),
      solve: (i) => i,
      sampleAnswer: (i) => i,
      mutate: (i) => i + 1,
      highlight: () => [],
    }
    let redrawn = 0
    for (let attempt = 1; attempt <= 200; attempt++) {
      const d = drawInstance(three as ItemLogic, SALT, KEY, attempt, [0, 1])
      expect(d.instance).toBe(2)
      expect(d.seed).toBe(instanceSeed(SALT, KEY, attempt, d.redraw))
      if (d.redraw > 0) redrawn++
    }
    expect(redrawn).toBeGreaterThan(100)
    const constant = { ...three, generate: () => 0 }
    expect(drawInstance(constant as ItemLogic, SALT, KEY, 1, [0]).redraw).toBe(20)
  })

  it('worked, instance and fallback seeds are distinct streams', () => {
    const seeds = new Set([instanceSeed(SALT, KEY, 3, 0), workedSeed(SALT, KEY, 3, 0), fallbackSeed(SALT, KEY, 3)])
    expect(seeds.size).toBe(3)
  })
})
