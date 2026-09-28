/**
 * Chapter iii9-cribs: generator, check and misconception tests (PLAN §6.13 brief 14). The shared lints (validate,
 * L1 lint, guess bot, CC learner, purity) cover the chapter too.
 *
 * Misconception bots: a learner who accepts an offset with one crash, reads the crib one letter out of line, answers
 * the crash count or a cipher index for the probe, or counts 1-based, never passes an item (every counted instance
 * requires the key idea).
 */

import { describe, expect, it } from 'vitest'
import type { GateRecord, GenCtx, ItemLogic } from '../../../contracts/lesson'
import { crashes, isConsistentCrib, zeroCrashOffsets } from '../../../crypto/cribs'
import { createMachine, encipher, step, validateConfig } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { codeTaskOf, passingRun } from '../../../lesson/kinds'
import { executeRequest } from '../../../code/runnerCore'
import { summarizeRun } from '../../../code/summary'
import {
  BET_CRASH,
  BET_OFFSET,
  CRIBS,
  EDGE,
  FITS_TRUTH,
  GATES,
  INTERCEPT,
  INTERCEPT_FREE,
  IS_CONSISTENT_REFERENCE,
  V14,
  VISIBLE_CASES,
  crashCount,
  crashFree,
  crashFreeMessage,
  failingCase,
  firstCrash,
  isConsistent,
  isInRange,
  maxOffset,
  type CrashCountInstance,
  type CrashFreeInstance,
  type CribCodeInstance,
} from '../gates'

const SEEDS = 300
const ctx = (id: string, attempt: number): GenCtx => ({ key: `iii9-cribs/cribs/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number): I =>
  l.generate(createRng(seedFor('iii9-test', l.id, s)), ctx(l.id, (s % 4) + 1))
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe('the scene data', () => {
  it('vector 14 has no crash; the intercept starts with it and crashes everywhere else', () => {
    expect(crashes(V14.cipher, V14.crib, 0)).toEqual([])
    expect(INTERCEPT.startsWith(V14.cipher)).toBe(true)
    expect(INTERCEPT_FREE).toEqual([0])
    for (let k = 1; k <= INTERCEPT.length - V14.crib.length; k++) expect(crashes(INTERCEPT, V14.crib, k).length).toBeGreaterThan(0)
  })

  it('the bet sits at an offset with exactly one crash, so its truth is "no"', () => {
    expect(crashes(INTERCEPT, V14.crib, BET_OFFSET)).toEqual([BET_CRASH.index])
    expect(INTERCEPT[BET_OFFSET + BET_CRASH.index]).toBe(BET_CRASH.letter)
    expect(FITS_TRUTH).toBe('no')
  })
})

describe('crash-free', () => {
  it('every message has exactly 1–3 valid offsets, none within EDGE of either end, the true offset among them', () => {
    const counts = new Set<number>()
    for (let s = 0; s < SEEDS; s++) {
      const m = crashFreeMessage(createRng(seedFor('msg', s)))
      const valid = zeroCrashOffsets(m.cipher, m.crib)
      expect(valid.length, `seed ${s}`).toBeGreaterThanOrEqual(1)
      expect(valid.length, `seed ${s}`).toBeLessThanOrEqual(3)
      counts.add(valid.length)
      const max = m.cipher.length - m.crib.length
      for (const k of valid) expect(k >= EDGE && k <= max - EDGE, `seed ${s} offset ${k}`).toBe(true)
      expect(valid).toContain(m.offset)
      expect(m.cipher.length).toBeGreaterThanOrEqual(40)
      expect(m.cipher.length).toBeLessThanOrEqual(60)
      expect(CRIBS).toContain(m.crib)
      expect(validateConfig(m.day)).toEqual([])
      expect(m.day).toMatchObject({ model: 'I', reflector: 'B' })
      expect(m.day.plugboard).toHaveLength(10)
    }
    expect([...counts].sort()).toEqual([1, 2, 3])
  })

  it('the crib span is a real encipherment of the crib on the day key from the message setting', () => {
    for (let s = 0; s < 60; s++) {
      const m = crashFreeMessage(createRng(seedFor('real', s)))
      let state = createMachine({ ...m.day, positions: m.start })
      for (let k = 0; k < m.offset; k++) state = step(state).state
      expect(encipher(state, m.crib).output).toBe(m.cipher.slice(m.offset, m.offset + m.crib.length))
    }
  })

  it('the instance carries only the cipher text and the crib (no answer)', () => {
    for (let s = 0; s < 50; s++) expect(Object.keys(gen(crashFree, s) as object).sort()).toEqual(['cipher', 'crib'])
  })

  it('check accepts exactly the zero-crash offsets; the rollback is the strip at the learner offset', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(crashFree, s) as CrashFreeInstance
      for (let k = 0; k <= maxOffset(i); k++) {
        const res = crashFree.check(i, k)
        expect(res.correct).toBe(crashes(i.cipher, i.crib, k).length === 0)
        if (!res.correct) expect(res.rollback).toEqual({ kind: 'crib', offset: k, crashes: crashes(i.cipher, i.crib, k) })
      }
      for (const bad of [-1, maxOffset(i) + 1, 2.5, 'x', null]) expect(crashFree.check(i, bad as never).correct).toBe(false)
    }
  })

  it('misconception bot: an offset with one crash is always rejected', () => {
    let tried = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(crashFree, s) as CrashFreeInstance
      const one = Array.from({ length: maxOffset(i) + 1 }, (_, k) => k).filter((k) => crashes(i.cipher, i.crib, k).length === 1)
      for (const k of one) {
        tried++
        expect(crashFree.check(i, k).correct).toBe(false)
      }
    }
    expect(tried).toBeGreaterThan(SEEDS)
  })
})

describe('crash-count', () => {
  it('counts 1–5 crashes, and the neighbouring offsets never have the same count', () => {
    const answers = new Set<number>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(crashCount, s) as CrashCountInstance
      const n = crashes(i.cipher, i.crib, i.offset).length
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(5)
      answers.add(n)
      expect(crashCount.solve(i)).toEqual([n])
      expect(crashCount.check(i, [n]).correct).toBe(true)
      expect(crashCount.check(i, [n + 1]).rollback).toEqual({ kind: 'crib', offset: i.offset, crashes: crashes(i.cipher, i.crib, i.offset) })
      const max = i.cipher.length - i.crib.length
      // Misconception bots: one letter out of line (either way), or counting the columns that differ.
      for (const k of [i.offset - 1, i.offset + 1]) {
        if (k < 0 || k > max) continue
        expect(crashCount.check(i, [crashes(i.cipher, i.crib, k).length]).correct, `seed ${s} offset ${k}`).toBe(false)
      }
      expect(crashCount.check(i, [i.crib.length - n]).correct).toBe(false)
    }
    expect([...answers].sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('is-consistent-crib', () => {
  const task = codeTaskOf(isConsistent)!

  it('the probe is the first crash index at an offset ≥ 1; misconception answers are always wrong', () => {
    const probes = new Set<string>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(isConsistent, s) as CribCodeInstance
      const hits = crashes(i.cipher, i.crib, i.offset)
      const f = firstCrash(i)
      expect(i.offset).toBeGreaterThanOrEqual(1)
      expect(f).toBe(hits[0])
      expect(task.probe(i).expected).toBe(String(f))
      probes.add(String(f))
      const run = passingRun(task.cases(i).length, i.seed)
      expect(isConsistent.check(i, { probe: String(f), run }).correct).toBe(true)
      // The crash count, the cipher index, a 1-based index and "no crash" are all wrong.
      for (const wrong of [hits.length, i.offset + f, f + 1, -1]) {
        expect(isConsistent.check(i, { probe: String(wrong), run }).correct, `seed ${s}: ${wrong}`).toBe(false)
      }
    }
    expect(probes.size).toBeGreaterThan(15)
  })

  it('has at least 20 cases mixing true and false; the visible three never hold the probe', () => {
    for (let s = 0; s < 50; s++) {
      const i = gen(isConsistent, s) as CribCodeInstance
      const cases = task.cases(i)
      expect(cases.length).toBeGreaterThanOrEqual(20)
      expect(cases.slice(0, 3)).toEqual(VISIBLE_CASES)
      expect(new Set(cases.map((c) => c.expect))).toEqual(new Set([true, false]))
      for (const c of cases) {
        const [cipher, crib, offset] = c.args as [string, string, number]
        expect(c.expect).toBe(isConsistentCrib(cipher, crib, offset))
      }
      expect(cases.some((c) => c.args[0] === i.cipher && c.args[2] === i.offset)).toBe(false)
      expect(JSON.stringify(cases)).toBe(JSON.stringify(task.cases(clone(i))))
    }
  })

  it('the reference passes every case within maxLines; a code that ignores the range fails', () => {
    const i = gen(isConsistent, 7) as CribCodeInstance
    const cases = task.cases(i)
    const run = (source: string) =>
      executeRequest({
        id: 1,
        source,
        provided: '',
        fnNames: task.fnNames,
        calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
        timeoutMs: 1500,
      })
    const ok = run(IS_CONSISTENT_REFERENCE)
    expect(ok.ok).toBe(true)
    if (ok.ok) ok.results.forEach((r, k) => expect((r as { value?: unknown }).value, cases[k]!.label).toBe(cases[k]!.expect))
    const sloppy = run('function isConsistentCrib(cipher, crib, offset) {\n  for (let i = 0; i < crib.length; i++) if (cipher[offset + i] === crib[i]) return false\n  return true\n}\n')
    expect(sloppy.ok).toBe(true)
    if (sloppy.ok) expect(sloppy.results.some((r, k) => 'value' in r && r.value !== cases[k]!.expect)).toBe(true)
  })

  it('case labels are unique (a failing run names its case)', () => {
    for (let s = 0; s < 50; s++) {
      const labels = task.cases(gen(isConsistent, s) as CribCodeInstance).map((c) => c.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('a failing run rolls back to the case it failed on: the textbook example for an off-by-one range check', () => {
    const i = gen(isConsistent, 11) as CribCodeInstance
    const cases = task.cases(i)
    const offByOne =
      'function isConsistentCrib(cipher, crib, offset) {\n  if (offset < 0 || offset + crib.length >= cipher.length) return false\n' +
      '  for (let i = 0; i < crib.length; i++) if (cipher[offset + i] === crib[i]) return false\n  return true\n}\n'
    const res = executeRequest({ id: 1, source: offByOne, provided: '', fnNames: task.fnNames, calls: cases.map((c) => ({ fn: c.fn, args: c.args })), timeoutMs: 1500 })
    const run = summarizeRun(cases, res, i.seed)
    expect(run.firstFailure?.label).toBe('the textbook example')
    const a = { probe: String(firstCrash(i)), run }
    expect(failingCase(i, a)?.args).toEqual([V14.cipher, V14.crib, 0])
    expect(isConsistent.check(i, a).rollback).toEqual({ kind: 'crib', offset: 0, crashes: [] })
    // A case whose crib runs off the end: no strip offset inside the text, no crashes.
    const past = { ...run, firstFailure: { label: 'past the end', expected: 'false', actual: 'true' } }
    expect(isInRange('KLMNOPQ', 'XYOZ', 4)).toBe(false)
    expect(isConsistent.check(i, { probe: '0', run: past }).rollback).toEqual({ kind: 'crib', offset: 4, crashes: [] })
    // Every case passed: the prediction was wrong, so the rollback is the prediction's strip.
    const passing = passingRun(cases.length, i.seed)
    expect(failingCase(i, { probe: '99', run: passing })).toBeNull()
    expect(isConsistent.check(i, { probe: '99', run: passing }).rollback).toMatchObject({ kind: 'crib', offset: i.offset })
    // Code that did not run (a syntax error) names no case.
    const broken = summarizeRun(cases, executeRequest({ id: 2, source: 'function isConsistentCrib(', provided: '', fnNames: task.fnNames, calls: [], timeoutMs: 1500 }), i.seed)
    expect(failingCase(i, { probe: '0', run: broken })).toBeNull()
  })

  it('a wrong answer rolls back to the strip at the probe offset', () => {
    const i = gen(isConsistent, 3) as CribCodeInstance
    const res = isConsistent.check(i, { probe: '99', run: passingRun(task.cases(i).length, i.seed) })
    expect(res.rollback).toEqual({ kind: 'crib', offset: i.offset, crashes: crashes(i.cipher, i.crib, i.offset) })
  })
})

describe('gate cribs', () => {
  it('holds crash-free, crash-count and is-consistent-crib in order, with the crash-free fallback', () => {
    const g = GATES.cribs!
    expect(g.items.map((i) => i.id)).toEqual(['crash-free', 'crash-count', 'is-consistent-crib'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'window', 'window'])
    expect(g.items.map((i) => i.kind)).toEqual(['custom', 'numbers', 'code'])
    expect(g.fallback).toBe(crashFree)
    expect(crashFree).toMatchObject({ inPage: true, kind: 'custom' })
  })

  /**
   * A misconception learner through the real gate engine: every item answered by the misconception (one crash is
   * fine; the crib read one letter out of line; the probe answered with the crash count), for 300 runs of 8
   * attempts per item, hint levels included. It never passes a single item.
   */
  it('misconception bot: never passes an item over 300 runs', () => {
    const logic = GATES.cribs!
    const gctx: GateCtx = { key: 'iii9-cribs/cribs', logic, salt: 'misconception' }
    const task = codeTaskOf(isConsistent)!
    const naive = (l: ItemLogic, i: unknown): unknown => {
      if (l.id === 'crash-free') {
        const x = i as CrashFreeInstance
        const one = Array.from({ length: maxOffset(x) + 1 }, (_, k) => k).find((k) => crashes(x.cipher, x.crib, k).length === 1)
        return one ?? 0
      }
      if (l.id === 'crash-count') {
        const x = i as CrashCountInstance
        const k = x.offset + 1 <= x.cipher.length - x.crib.length ? x.offset + 1 : x.offset - 1
        return [crashes(x.cipher, x.crib, k).length]
      }
      const x = i as CribCodeInstance
      return { probe: String(crashes(x.cipher, x.crib, x.offset).length), run: passingRun(task.cases(x).length, x.seed) }
    }
    for (let run = 0; run < 300; run++) {
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      for (const item of logic.items) {
        for (let attempt = 0; attempt < 8; attempt++) {
          rec = ensureCurrent(gctx, rec, now)
          const cur = currentItem(logic, rec)
          if (!cur) break
          if (cur.id !== item.id) break
          const shown = shownInstance(gctx, cur, rec.items[cur.id]!)
          now += 10_000
          rec = submitAnswer(gctx, rec, cur.id, clone(naive(shown.logic, shown.instance)), now).gate
          expect(rec.items[cur.id]!.passed, `run ${run} ${cur.id}`).toBe(false)
        }
        // Move on: mark the item passed so the next item becomes current.
        rec = { ...rec, items: { ...rec.items, [item.id]: { ...rec.items[item.id]!, passed: true } } }
      }
    }
  })
})
