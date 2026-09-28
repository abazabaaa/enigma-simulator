/**
 * Chapter ii6-cycles: the scenes' truths (the hexagon, the stecker toggle, CF's 13 splits) and gate `cycles`'s
 * generators and checks, including the MISCONCEPTION BOTS: naive answers never pass an item.
 */

import { describe, expect, it } from 'vitest'
import type { ItemKey } from '../../../contracts/core'
import type { GateLogic, GateRecord, ItemLogic } from '../../../contracts/lesson'
import { executeRequest, countLines } from '../../../code/runnerCore'
import { summarizeRun } from '../../../code/summary'
import { dayKey, factorizationCount, isPairedType, productsFromMachine } from '../../../crypto'
import {
  compose,
  conjugate,
  cycleSignature,
  fixedPoints,
  formatCycles,
  fromPairs,
  isInvolution,
  validateConfig,
} from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import {
  EMPTY_GATE,
  currentItem,
  ensureCurrent,
  revealCurrent,
  shownInstance,
  submitAnswer,
  type GateCtx,
} from '../../../lesson/gateEngine'
import { codeTaskOf } from '../../../lesson/kinds'
import { hintLevel } from '../../../lesson/rules'
import {
  AD_TYPE_CAP,
  CF65,
  CF_PAIR,
  COMMON_AD_TYPES,
  LENGTH_SIZES,
  CYCLE_LENGTHS_REFERENCE,
  DAY,
  DAY_AD,
  DEMO_CABLE,
  GATES,
  HEX_P,
  LENGTHS_TRUTH,
  PAIRS_TRUTH,
  adOf,
  alignPair,
  alignRight,
  alignTruth,
  blindAlign,
  canonLengths,
  cycleLengths,
  cycleLengthsProbe,
  cycleOf,
  flatDay,
  freeLetters,
  freePairs,
  idx,
  lengthTypes,
  lengths,
  naiveAlign,
  naiveLengths,
  naiveRelabel,
  relabel,
  relabelAnswer,
  solvePair,
  splitFromAlignment,
  steckerSet,
  steckerSolutions,
  swapsForType,
  withCable,
  type AlignInstance,
  type CycleLengthsInstance,
  type LengthsInstance,
  type RelabelInstance,
  type SteckerInstance,
} from '../gates'

const SEEDS = 300
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = 1): I =>
  l.generate(createRng(seedFor('ii6-test', l.id, s)), {
    key: `ii6-cycles/cycles/${l.id}` as ItemKey,
    attempt,
    purpose: 'instance',
    previous: [],
  })

/**
 * A misconception bot through the gate engine: `naive` answers every instance (fallback included) for up to 12
 * attempts per run. (Every naive answer is also checked wrong on each of 300 instances below.)
 */
function naivePasses(
  logic: GateLogic,
  naive: (i: unknown, l: ItemLogic) => unknown,
  runs = 100,
  attempts = 12,
): number {
  let passes = 0
  for (let run = 0; run < runs; run++) {
    const ctx: GateCtx = { key: 'ii6-cycles/naive', logic, salt: `naive-${run}` }
    let rec: GateRecord = EMPTY_GATE
    let now = 1
    for (;;) {
      rec = ensureCurrent(ctx, rec, now)
      const item = currentItem(ctx.logic, rec)
      if (!item) {
        passes++
        break
      }
      const it = rec.items[item.id]!
      if (it.attempt > attempts) break
      now += 10_000
      if (hintLevel(it, false) === 3) rec = revealCurrent(ctx, rec, item.id, now).gate
      else {
        const shown = shownInstance(ctx, item, it)
        rec = submitAnswer(ctx, rec, item.id, JSON.parse(JSON.stringify(naive(shown.instance, shown.logic))), now).gate
      }
    }
  }
  return passes
}

/**
 * The same engine for an answer that is right with probability `p` on each instance, independently (a constant answer
 * against a generator whose modal answer has share p). The fallback is answered wrong.
 */
function bernoulliPasses(p: number, runs: number, attempts: number): number {
  const item: ItemLogic = {
    id: 'b',
    kind: 'custom',
    rule: { kind: 'window' },
    compute: true,
    inPage: true,
    generate: (r) => ({ v: r() }),
    same: () => false,
    solve: () => 1,
    check: (_i, a) => ({ correct: a === 1, rollback: { kind: 'none' } }),
    sampleAnswer: () => 0,
    mutate: () => 0,
    highlight: () => [],
  }
  const r = createRng(99)
  return naivePasses({ items: [item], fallback: { ...item, id: 'fb' } }, (_i, l) => (l.id === 'b' && r() < p ? 1 : 0), runs, attempts)
}

/** The fallback's naive answer: the X–Y cable (a new cable between the two letters named in the question). */
const naiveStecker = (i: SteckerInstance) => {
  const pair = [i.x, i.y].sort().join('')
  return freePairs(i.setup.machine).includes(pair) ? withCable(i.setup.machine, pair) : i.setup.machine
}
const withFallback = (item: ItemLogic): GateLogic => ({ items: [item], fallback: steckerSet as ItemLogic })

describe('the scenes', () => {
  it('the hexagon: (ab)(cd)(ef)·(bc)(de)(fa) = (ace)(bfd), paired', () => {
    expect(formatCycles(HEX_P)).toBe('(ace)(bfd)')
    expect(PAIRS_TRUTH).toBe('pairs')
  })

  it('the day: valid, AD 6 6 4 4 3 3; the demo cable joins two free letters of cycles of different lengths', () => {
    expect(validateConfig(DAY)).toEqual([])
    expect(DAY).toMatchObject({ model: 'I', reflector: 'A' })
    expect(formatCycles(DAY_AD)).toBe('(afhq)(beuyiv)(csolmz)(dwp)(gkxt)(jnr)')
    const [f, n] = [idx(DEMO_CABLE[0]!), idx(DEMO_CABLE[1]!)]
    expect(freeLetters(DAY)).toEqual(expect.arrayContaining([f, n]))
    expect(cycleOf(DAY_AD, f).length).not.toBe(cycleOf(DAY_AD, n).length)
    expect(LENGTHS_TRUTH).toBe('unchanged')
  })

  it('invariance: every new cable on the day, and on random days, leaves the lengths of AD, BE and CF unchanged', () => {
    const sig = (c: Parameters<typeof productsFromMachine>[0]) =>
      Object.values(productsFromMachine(c)).map((p) => cycleSignature(p).join('.'))
    for (const pair of freePairs(DAY)) expect(sig(withCable(DAY, pair))).toEqual(sig(DAY))
    for (let s = 0; s < 30; s++) {
      const day = dayKey(createRng(seedFor('inv', s)), { era: '1932', plugs: 0 })
      const plugged = dayKey(createRng(seedFor('inv-plugs', s)), { era: '1932' })
      expect(sig({ ...day, plugboard: plugged.plugboard })).toEqual(sig(day))
    }
  })

  it('CF of the 65 splits in exactly 13 ways: every reversed alignment, no forward one', () => {
    const [a, b] = CF_PAIR
    expect(a).toHaveLength(13)
    expect(factorizationCount(CF65)).toBe(13)
    for (let o = 0; o < 13; o++) {
      expect(splitFromAlignment(CF65, a, b, o, true).valid).toBe(true)
      expect(splitFromAlignment(CF65, a, b, o, false).valid).toBe(false)
    }
  })
})

describe('lengths', () => {
  it('are always a paired type on 18, 20 or 22 letters, never "all twos" or "all ones"', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(lengths, s) as LengthsInstance
      const sol = lengths.solve(i)
      expect(LENGTH_SIZES).toContain(i.n)
      expect(isPairedType(sol), `seed ${s}`).toBe(true)
      expect(sol.reduce((x, y) => x + y, 0)).toBe(i.n)
      expect(isInvolution(i.x) && isInvolution(i.y)).toBe(true)
      expect(fixedPoints(i.x).length + fixedPoints(i.y).length).toBe(0)
      expect(lengths.check(i, naiveLengths(i)).correct).toBe(false)
      expect(sol.every((l) => l === 1)).toBe(false)
    }
  })

  it('swapsForType builds X and Y whose product has exactly the asked type (Rejewski\'s theorem 2)', () => {
    for (const n of LENGTH_SIZES) {
      for (const parts of lengthTypes(n)) {
        const { x, y } = swapsForType(createRng(seedFor('type', n, parts.join())), n, parts)
        expect(cycleSignature(compose(x, y))).toEqual(parts.flatMap((l) => [l, l]).sort((a, b) => b - a))
      }
    }
    expect(LENGTH_SIZES.map((n) => lengthTypes(n).length)).toEqual([29, 40, 55])
  })

  it('CONSTANT BOTS: the commonest answer for n (and the reviewer\'s "n/2 n/2") passes under 1 % of runs', () => {
    // The modal type per n over 3,000 instances: under uniform types, no type is much above 1 in 29.
    const counts = new Map<string, number>()
    for (let s = 0; s < 3000; s++) {
      const i = gen(lengths, s) as LengthsInstance
      const key = `${i.n}:${lengths.solve(i).join(' ')}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const modal = new Map<number, number[]>()
    for (const n of LENGTH_SIZES) {
      const best = [...counts].filter(([k]) => k.startsWith(`${n}:`)).sort((a, b) => b[1] - a[1])[0]!
      modal.set(n, best[0].split(':')[1]!.split(' ').map(Number))
      expect(best[1] / 3000, `n = ${n}`).toBeLessThan(0.025)
    }
    const logic = withFallback(lengths as ItemLogic)
    const asFallback = (i: unknown) => naiveStecker(i as SteckerInstance)
    const constant = (i: unknown, l: ItemLogic) => (l.id === 'lengths' ? modal.get((i as LengthsInstance).n)! : asFallback(i))
    const halves = (i: unknown, l: ItemLogic) => {
      const n = (i as LengthsInstance).n
      return l.id === 'lengths' ? [n / 2, n / 2] : asFallback(i)
    }
    // The guess bot's budget (6 attempts), and a patient guesser (12).
    expect(naivePasses(logic, constant, 1000, 6) / 1000).toBeLessThan(0.01)
    expect(naivePasses(logic, halves, 1000, 6) / 1000).toBeLessThan(0.01)
    expect(naivePasses(logic, constant, 500, 12) / 500).toBeLessThan(0.02)
    expect(naivePasses(logic, (i, l) => (l.id === 'lengths' ? naiveLengths(i as LengthsInstance) : asFallback(i)))).toBe(0)
  })

  it('the AD of any day is a paired type too', () => {
    for (let s = 0; s < 100; s++) {
      const day = dayKey(createRng(seedFor('paired', s)), { era: '1932' })
      for (const p of Object.values(productsFromMachine(day))) expect(isPairedType(cycleSignature(p))).toBe(true)
    }
  })

  it('checks as a multiset and rolls back the missed cycle (or none, when only extra numbers are wrong)', () => {
    const i = gen(lengths, 2) as LengthsInstance
    const sol = lengths.solve(i)
    expect(lengths.check(i, [...sol].reverse()).correct).toBe(true)
    const res = lengths.check(i, [sol[0]! + 1, ...sol.slice(1)])
    expect(res.correct).toBe(false)
    expect(res.rollback).toMatchObject({ kind: 'cycles' })
    expect((res.rollback as unknown as { cycle: number[] }).cycle.length).toBe(sol[0])
    const extra = lengths.check(i, [...sol, 1])
    expect(extra.rollback).toMatchObject({ kind: 'cycles', cycle: [] })
  })
})

describe('relabel', () => {
  it("agrees with engine conjugate() and with the machine's own AD after the new cable", () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(relabel, s) as RelabelInstance
      const x = idx(i.cable[0]!)
      const byConjugate = cycleOf(conjugate(adOf(i.day), fromPairs([i.cable])), x)
      const byMachine = cycleOf(adOf(withCable(i.day, i.cable)), x)
      expect(byMachine, `seed ${s}`).toEqual(byConjugate)
      expect(relabelAnswer(i)).toBe(byMachine.map((c) => String.fromCharCode(65 + c)).join(''))
      expect(relabelAnswer(i)).toHaveLength(i.length)
      expect(i.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('MISCONCEPTION BOTS: the old cycle, the unrenamed cycle and the backwards cycle never pass', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(relabel, s) as RelabelInstance
      for (const a of naiveRelabel(i)) expect(relabel.check(i, a).correct, `seed ${s}: ${a}`).toBe(false)
    }
    for (const k of [0, 1, 2]) {
      const naive = (i: unknown, l: ItemLogic) => (l.id === 'relabel' ? naiveRelabel(i as RelabelInstance)[k] : naiveStecker(i as SteckerInstance))
      expect(naivePasses(withFallback(relabel as ItemLogic), naive)).toBe(0)
    }
  })
})

describe('stecker-set', () => {
  it('steckerSolutions finds exactly the working cables (brute force with the engine over every free pair)', () => {
    for (let s = 0; s < 40; s++) {
      const i = gen(steckerSet, s) as SteckerInstance
      const day = i.setup.machine
      const [x, y] = [idx(i.x), idx(i.y)]
      const brute = freePairs(day).filter((p) => cycleOf(adOf(withCable(day, p)), x).includes(y))
      expect(steckerSolutions(day, i.x, i.y), `seed ${s}`).toEqual(brute)
    }
  })

  it('always has a solution; X and Y sit in different short cycles; a random new cable almost never works', () => {
    let rate = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(steckerSet, s) as SteckerInstance
      const day = i.setup.machine
      const ad = adOf(day)
      const [x, y] = [idx(i.x), idx(i.y)]
      expect(cycleOf(ad, x)).not.toContain(y)
      expect(cycleOf(ad, x).length).toBeLessThanOrEqual(3)
      expect(cycleOf(ad, y).length).toBeLessThanOrEqual(3)
      const good = steckerSolutions(day, i.x, i.y, ad)
      expect(good.length, `seed ${s}`).toBeGreaterThan(0)
      expect(steckerSet.check(i, steckerSet.solve(i)).correct).toBe(true)
      rate += good.length / freePairs(day).length
    }
    expect(rate / SEEDS).toBeLessThan(0.03)
  })

  it('MISCONCEPTION BOT: joining X and Y themselves never works; nor does removing a day cable or adding two', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(steckerSet, s) as SteckerInstance
      expect(steckerSet.check(i, naiveStecker(i)).correct, `seed ${s}`).toBe(false)
    }
    expect(naivePasses(withFallback(steckerSet as ItemLogic), (i) => naiveStecker(i as SteckerInstance), 30)).toBe(0)
    const i = gen(steckerSet, 4) as SteckerInstance
    const good = steckerSet.solve(i)
    expect(steckerSet.check(i, { ...good, plugboard: good.plugboard.slice(1) })).toMatchObject({
      correct: false,
      rollback: { kind: 'machine', field: 'plugboard' },
    })
    const extra = freePairs(good).find(Boolean)!
    expect(steckerSet.check(i, withCable(good, extra)).correct).toBe(false)
  })
})

describe('cycle-lengths', () => {
  const task = codeTaskOf(cycleLengths as ItemLogic)!

  it('the reference passes every case and stays within 10 lines', () => {
    expect(countLines(CYCLE_LENGTHS_REFERENCE, 'cycleLengths')).toBeLessThanOrEqual(10)
    for (let s = 0; s < 10; s++) {
      const i = gen(cycleLengths, s) as CycleLengthsInstance
      const cases = task.cases(i)
      expect(cases.length).toBeGreaterThanOrEqual(20)
      const res = executeRequest({
        id: 1,
        source: CYCLE_LENGTHS_REFERENCE,
        provided: '',
        fnNames: ['cycleLengths'],
        calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
        timeoutMs: 1500,
      })
      expect(summarizeRun(cases, res, i.seed)).toMatchObject({ status: 'pass', total: cases.length })
      for (const c of cases.slice(0, 3)) expect(c.args[0]).not.toEqual(adOf(i.day))
    }
  })

  it('reads the prediction as numbers in any common format; it varies and is never all twos', () => {
    const answers = new Set<string>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(cycleLengths, s) as CycleLengthsInstance
      const p = cycleLengthsProbe(i)
      answers.add(p)
      expect(p.split(' ').every((x) => x === '2')).toBe(false)
    }
    expect(answers.size).toBeGreaterThan(5)
    const i = gen(cycleLengths, 1) as CycleLengthsInstance
    const good = cycleLengths.solve(i)
    const nums = cycleLengthsProbe(i).split(' ')
    for (const typed of [`[${nums.join(', ')}]`, nums.join(','), ` ${nums.join('  ')} `]) {
      expect(canonLengths(typed)).toBe(cycleLengthsProbe(i))
      expect(cycleLengths.check(i, { ...good, probe: typed }).correct).toBe(true)
    }
    expect(cycleLengths.check(i, { ...good, probe: [...nums].reverse().join(' ') }).correct).toBe(nums.length === 1)
    expect(cycleLengths.check(i, { ...good, probe: '2 2 2 2 2 2 2 2 2 2 2 2 2' }).correct).toBe(false)
  })
})

describe('cycle-lengths days', () => {
  it('CONSTANT BOT: no AD type ("13 13" above all) is the answer on more than 3 % of days; the modal guess passes under 1 %', () => {
    const counts = new Map<string, number>()
    const N = 3000
    for (let s = 0; s < N; s++) {
      const p = cycleLengthsProbe(gen(cycleLengths, s) as CycleLengthsInstance)
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    const [modal, top] = [...counts].sort((a, b) => b[1] - a[1])[0]!
    expect(top / N, `modal ${modal}`).toBeLessThan(0.03)
    expect((counts.get('13 13') ?? 0) / N).toBeLessThan(0.03)
    expect(counts.size).toBeGreaterThan(40)
    // Through the gate engine, a constant prediction right on that share of days (the code always passing).
    expect(bernoulliPasses(top / N, 2000, 6) / 2000).toBeLessThan(0.01)
  })

  it('thins exactly the listed common types; adOf is the engine\'s AD', () => {
    expect(Object.values(COMMON_AD_TYPES).every((f) => f > AD_TYPE_CAP)).toBe(true)
    for (let s = 0; s < 50; s++) {
      const d = dayKey(createRng(seedFor('adof', s)), { era: '1932' })
      expect(adOf(d)).toEqual(productsFromMachine(d).AD)
    }
    const r = createRng(5)
    const day = flatDay(r)
    expect(validateConfig(day)).toEqual([])
  })
})

describe('align-pair', () => {
  it('lines up every long pair; each pair has exactly one right alignment, read backwards', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(alignPair, s) as AlignInstance
      const product = i.pairs.reduce((t, p) => t * p.a.length, 1)
      expect(product, `seed ${s}`).toBeGreaterThanOrEqual(48)
      expect(i.pairs.flatMap((p) => [...p.a, ...p.b]).sort((a, b) => a - b)).toEqual(i.product.map((_, k) => k))
      for (const p of i.pairs) {
        let right = 0
        for (let o = 0; o < p.a.length; o++) for (const r of [true, false]) if (alignRight(p, { offset: o, reversed: r })) right++
        expect(right).toBe(1)
        expect(solvePair(p).reversed).toBe(true)
        expect(splitFromAlignment(i.product, p.a, p.b, solvePair(p).offset, true).valid).toBe(true)
        expect(alignTruth(p)).toContain([p.clue[0], p.clue[1]].map((c) => String.fromCharCode(65 + c)).sort().join(''))
      }
      expect(alignPair.check(i, alignPair.solve(i)).correct).toBe(true)
      expect(alignPair.check(i, naiveAlign(i)).correct).toBe(false)
    }
  })

  it('CONSTANT BOTS: "backwards, not slid" and the forward alignment pass under 1 % of runs', () => {
    const asFallback = (i: unknown) => naiveStecker(i as SteckerInstance)
    const blind = (i: unknown, l: ItemLogic) => (l.id === 'align-pair' ? blindAlign(i as AlignInstance) : asFallback(i))
    const forward = (i: unknown, l: ItemLogic) => (l.id === 'align-pair' ? naiveAlign(i as AlignInstance) : asFallback(i))
    expect(naivePasses(withFallback(alignPair as ItemLogic), blind, 1000, 6) / 1000).toBeLessThan(0.01)
    expect(naivePasses(withFallback(alignPair as ItemLogic), forward)).toBe(0)
  })
})

describe('L1 hints after a wrong answer (submitAnswer → ensureCurrent → the next instance)', () => {
  it('are the same whichever instance they are given: the plugboard for stecker-set, prompt text elsewhere', () => {
    for (const item of GATES.cycles!.items) {
      const ctx: GateCtx = { key: 'ii6-cycles/l1', logic: { items: [item], fallback: steckerSet as ItemLogic }, salt: 'l1' }
      let rec: GateRecord = ensureCurrent(ctx, EMPTY_GATE, 1)
      const first = shownInstance(ctx, item, rec.items[item.id]!)
      const wrong = item.mutate(first.instance, item.solve(first.instance), createRng(3))
      rec = ensureCurrent(ctx, submitAnswer(ctx, rec, item.id, wrong, 20_000).gate, 20_000)
      const next = shownInstance(ctx, item, rec.items[item.id]!)
      expect(hintLevel(rec.items[item.id]!, false)).toBe(1)
      const parts = next.logic.highlight(next.instance, wrong).map((h) => h.part)
      expect(parts, item.id).toEqual(item.id === 'stecker-set' ? ['plugboard'] : [])
    }
  })
})

describe('gate cycles', () => {
  it('lists the items in order, with the in-page stecker-set as fallback', () => {
    expect(GATES.cycles!.items.map((i) => i.id)).toEqual(['lengths', 'relabel', 'stecker-set', 'cycle-lengths', 'align-pair'])
    expect(GATES.cycles!.fallback).toMatchObject({ id: 'stecker-set', kind: 'set-machine', inPage: true })
  })
})
