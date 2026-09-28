/**
 * Chapter ii5-indicators: the scene day and its truths, the 65 indicators, and gate `indicators`'s generators and
 * checks, including the MISCONCEPTION BOTS: learners who read an indicator the wrong way never pass an item.
 */

import { describe, expect, it } from 'vitest'
import type { ItemKey } from '../../../contracts/core'
import type { GateLogic, GateRecord, ItemLogic } from '../../../contracts/lesson'
import { executeRequest } from '../../../code/runnerCore'
import { summarizeRun } from '../../../code/summary'
import { REJEWSKI_65, encryptIndicator, products } from '../../../crypto'
import { LETTERS, cycleSignature, formatCycles, fixedPoints, validateConfig } from '../../../engine'
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
  AD65,
  AD_FIXED_TRUTH,
  BE65,
  BUILD_AD_REFERENCE,
  CF65,
  CONFLICT_AT,
  DAY,
  DAY_PRODUCTS,
  FIXED_FEEDBACK,
  FIXED_OPTIONS,
  GATES,
  HALVES_TRUTH,
  MISREADINGS,
  STEP_ORDER,
  adFixedPoint,
  adOf,
  buildAd,
  buildAdExpected,
  buildAdProbe,
  fillAd,
  fillAdWrongCells,
  idx,
  indicatorWith,
  misreadFill,
  pathAtPress,
  rejewskiSteps,
  type BuildAdInstance,
  type FillAdInstance,
  type FixedPointInstance,
} from '../gates'

const SEEDS = 300
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = 1): I =>
  l.generate(createRng(seedFor('ii5-test', l.id, s)), {
    key: `ii5-indicators/indicators/${l.id}` as ItemKey,
    attempt,
    purpose: 'instance',
    previous: [],
  })

/** Run the item's own task over its cases in Node (the worker core), with `source`. */
function runTask(l: ItemLogic, instance: { seed: number }, source: string) {
  const task = codeTaskOf(l)!
  const cases = task.cases(instance)
  const res = executeRequest({
    id: 1,
    source,
    provided: task.provided,
    fnNames: task.fnNames,
    calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
    timeoutMs: 1500,
  })
  return summarizeRun(cases, res, instance.seed)
}

/**
 * A misconception bot through the gate engine (as the guess bot): it answers every instance of one item with
 * `naive(instance, logic)` (the fallback included) for up to 12 attempts. Returns how many of `runs` runs passed.
 * (Every naive answer is also checked wrong on each of 300 instances.)
 */
function naivePasses(logic: GateLogic, naive: (i: unknown, l: ItemLogic) => unknown, runs = 100): number {
  let passes = 0
  for (let run = 0; run < runs; run++) {
    const ctx: GateCtx = { key: 'ii5-indicators/naive', logic, salt: `naive-${run}` }
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
      if (it.attempt > 12) break
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

const naiveFill = (how: string) => (i: unknown) => misreadFill(i as FillAdInstance, how)

describe('the scene day', () => {
  it('is an Enigma I of the time: UKW-A, rotors I–III, six cables, valid', () => {
    expect(validateConfig(DAY)).toEqual([])
    expect(DAY).toMatchObject({ model: 'I', reflector: 'A' })
    expect([...DAY.rotors].sort()).toEqual(['I', 'II', 'III'])
    expect(DAY.plugboard).toHaveLength(6)
  })

  it('has no fixed point in AD, BE or CF, so any key typed twice gives halves that differ in every letter', () => {
    for (const p of [DAY_PRODUCTS.AD, DAY_PRODUCTS.BE, DAY_PRODUCTS.CF]) expect(fixedPoints(p)).toEqual([])
    expect(HALVES_TRUTH).toBe('differ')
    const r = createRng(7)
    for (let k = 0; k < 300; k++) {
      const key = [0, 1, 2].map(() => LETTERS[Math.floor(r() * 26)]).join('')
      const s = encryptIndicator(DAY, key)
      for (let j = 0; j < 3; j++) expect(s[j]).not.toBe(s[j + 3])
    }
  })
})

describe('the key on the wires', () => {
  it('pathAtPress starts at the key letter and ends at the lamp of that press', () => {
    for (const key of ['ABL', 'QQQ', 'ZXY']) {
      const s = encryptIndicator(DAY, key)
      for (let k = 0; k < 6; k++) {
        const path = pathAtPress(DAY, k + 1, key[k % 3]!)
        expect(path[0]).toBe(key[k % 3])
        expect(path).toHaveLength(12)
        expect(path.at(-1)).toBe(s[k])
      }
    }
  })
})

describe('the 65 indicators (vector 13)', () => {
  it("give Rejewski's AD, BE and CF, with the one conflict SYZ SCW resolved by majority", () => {
    expect(formatCycles(AD65)).toBe('(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    expect(formatCycles(BE65)).toBe('(axt)(blfqveoum)(cgy)(d)(hjpswizrn)(k)')
    expect(formatCycles(CF65)).toBe('(abviktjgfcqny)(duzrehlxwpsmo)')
    expect(cycleSignature(AD65)).toEqual([10, 10, 2, 2, 1, 1])
    expect(products(REJEWSKI_65).conflicts).toEqual(['CF: Z→W vs X→W'])
    expect(REJEWSKI_65[CONFLICT_AT]).toBe('SYZSCW')
    expect(AD_FIXED_TRUTH).toBe('yes')
  })
})

describe('fill-ad', () => {
  it('targets 8 distinct cells, each determined by a shown indicator (its letter 1 → letter 4)', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(fillAd, s)
      expect(i.indicators.length).toBeGreaterThanOrEqual(12)
      expect(new Set(i.targets).size).toBe(8)
      const solution = fillAd.solve(i)
      i.targets.forEach((t, k) => {
        const ind = indicatorWith(i.indicators, 0, t)
        expect(ind, `seed ${s}: cell ${t} has no indicator`).not.toBeNull()
        expect(solution[k]).toBe(ind![3])
      })
    }
  })

  it('checks every cell exactly and rolls back the wrong ones', () => {
    const i = gen(fillAd, 1)
    const good = fillAd.solve(i)
    expect(fillAd.check(i, good).correct).toBe(true)
    const bad = good.map((x, k) => (k === 3 ? (x === 'A' ? 'B' : 'A') : x))
    expect(fillAd.check(i, bad)).toMatchObject({ correct: false, rollback: { kind: 'perm', wrongCells: [i.targets[3]] } })
    expect(fillAdWrongCells(i, good.map((x) => x.toLowerCase()))).toEqual([])
    expect(fillAd.check(i, good.slice(0, 7)).correct).toBe(false)
  })

  it.each(Object.keys(MISREADINGS))('MISCONCEPTION BOT "%s": wrong on every instance and never passes', (how) => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(fillAd, s)
      expect(fillAd.check(i, misreadFill(i, how)).correct, `seed ${s}`).toBe(false)
    }
    expect(naivePasses({ items: [fillAd as ItemLogic], fallback: fillAd as ItemLogic }, naiveFill(how))).toBe(0)
  })
})

describe('ad-fixed-point', () => {
  it('varies its evidence: two indicators whose letters 1 and 4 are the fixed letter', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(adFixedPoint, s) as FixedPointInstance
      for (const e of i.evidence) {
        expect(e[0]).toBe(i.letter)
        expect(e[3]).toBe(i.letter)
      }
      seen.add(i.evidence.join())
      expect(i.options.map((o) => o.id).sort()).toEqual(FIXED_OPTIONS.map((o) => o.id).sort())
    }
    expect(seen.size).toBeGreaterThan(90)
  })

  it('has one answer, a misconception distractor, and feedback that never states the answer', () => {
    const i = gen(adFixedPoint, 3) as FixedPointInstance
    expect(adFixedPoint.check(i, 'product').correct).toBe(true)
    expect(FIXED_OPTIONS.find((o) => o.id === 'faulty')).toMatchObject({ misconception: true })
    const right = FIXED_OPTIONS.find((o) => o.id === 'product')!.label
    for (const id of ['faulty', 'mistyped', 'unplugged']) {
      const res = adFixedPoint.check(i, id)
      expect(res.correct).toBe(false)
      expect(res.feedback).toBe(FIXED_FEEDBACK[id]!(i.letter))
      expect(res.feedback).not.toContain(right)
      expect(res.feedback).not.toMatch(/nothing is wrong|can bring a letter back/i)
    }
  })
})

describe('build-ad', () => {
  const task = codeTaskOf(buildAd as ItemLogic)!

  it('the reference passes every case, including the 65 indicators → vector 13 AD', () => {
    for (let s = 0; s < 20; s++) {
      const i = gen(buildAd, s) as BuildAdInstance
      const run = runTask(buildAd as ItemLogic, i, BUILD_AD_REFERENCE)
      expect(run, `seed ${s}`).toMatchObject({ status: 'pass', total: task.cases(i).length })
    }
    const cases = task.cases(gen(buildAd, 0) as BuildAdInstance)
    const vector = cases.find((c) => c.label.includes('65'))!
    expect(vector.expect).toBe(AD65.map((x) => LETTERS[x]).join(''))
    expect(cases.length).toBeGreaterThanOrEqual(20)
  })

  it('wrong code (letters 1 → 2, or 4 → 1) fails a case', () => {
    const i = gen(buildAd, 5) as BuildAdInstance
    for (const bug of [BUILD_AD_REFERENCE.replace('s[3]', 's[1]'), BUILD_AD_REFERENCE.replace('s.charCodeAt(0) - 65] = s[3]', 's.charCodeAt(3) - 65] = s[0]')]) {
      expect(bug).not.toBe(BUILD_AD_REFERENCE)
      expect(runTask(buildAd as ItemLogic, i, bug).status).toBe('fail')
    }
  })

  it('the prediction AD(X) is read off the shown indicators, varies, and no naive reading gives it', () => {
    const answers = new Set<string>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(buildAd, s) as BuildAdInstance
      const x = idx(i.letter)
      expect(buildAdProbe(i)).toBe(indicatorWith(i.indicators, 0, x)![3])
      expect(buildAdExpected(i.indicators)[x]).toBe(buildAdProbe(i))
      for (const read of Object.values(MISREADINGS)) expect(read(i.indicators, x)).not.toBe(buildAdProbe(i))
      answers.add(buildAdProbe(i))
      // The visible tests never show the shown indicators' AD.
      for (const c of task.cases(i).slice(0, 3)) expect(c.args[0]).not.toEqual(i.indicators)
    }
    expect(answers.size).toBeGreaterThan(10)
  })

  it('MISCONCEPTION BOT: a working function with the prediction read as "the letter itself" never passes', () => {
    const naive = (i: unknown, l: ItemLogic) =>
      l.id === 'build-ad'
        ? { ...(l.solve(i) as object), probe: (i as BuildAdInstance).letter }
        : misreadFill(i as FillAdInstance, 'same')
    expect(naivePasses({ items: [buildAd as ItemLogic], fallback: fillAd as ItemLogic }, naive, 40)).toBe(0)
  })

  it('a wrong prediction rolls back the predicted cell', () => {
    const i = gen(buildAd, 9) as BuildAdInstance
    const good = buildAd.solve(i)
    expect(buildAd.check(i, good).correct).toBe(true)
    const res = buildAd.check(i, { ...good, probe: i.letter })
    expect(res).toMatchObject({ correct: false, rollback: { kind: 'perm', wrongCells: [idx(i.letter)] } })
  })
})

describe('rejewski-steps', () => {
  it('never starts in order, and has one order', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(rejewskiSteps, s)
      expect(i.blocks.map((b) => b.id)).not.toEqual(STEP_ORDER)
      expect(rejewskiSteps.check(i, [...STEP_ORDER]).correct).toBe(true)
    }
  })
})

describe('gate indicators', () => {
  it('lists fill-ad, ad-fixed-point, build-ad, rejewski-steps with the in-page fill-ad as fallback', () => {
    expect(GATES.indicators!.items.map((i) => i.id)).toEqual(['fill-ad', 'ad-fixed-point', 'build-ad', 'rejewski-steps'])
    expect(GATES.indicators!.fallback).toMatchObject({ id: 'fill-ad', kind: 'custom', inPage: true })
  })

  it('adOf agrees with the indicators (letter 1 → letter 4)', () => {
    const ad = adOf(['ABCDEF', 'QWERTZ'])
    expect(ad[0]).toBe(3)
    expect(ad[16]).toBe(idx('R'))
    expect(ad.filter((x) => x !== null)).toHaveLength(2)
  })
})
