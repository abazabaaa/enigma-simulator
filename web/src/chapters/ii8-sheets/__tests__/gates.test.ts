/**
 * Chapter ii8-sheets: the females (checked against the engine), the sheets (the day's ring settings survive every
 * sheet; the light table and the direct count agree), the scenes' truths (about 40 % holes, about 12 females for
 * 105,456 settings), the females-needed formula, and the MISCONCEPTION BOTS: taking p as the share a sheet removes,
 * or letting the sheets remove a fixed amount each, never passes an item.
 */

import { describe, expect, it } from 'vitest'
import type { ItemKey } from '../../../contracts/core'
import type { GateLogic, GateRecord, ItemLogic } from '../../../contracts/lesson'
import { sixPermutations } from '../../../crypto'
import { compose, normalizeConfig, validateConfig } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import {
  ALL_SETTINGS,
  GATES,
  SURVIVORS_MAX,
  alignedSheets,
  daySetting,
  expected,
  femaleMessage,
  femalePlaces,
  femalesNeeded,
  femalesNeededItem,
  firstAlone,
  holeShare,
  idx,
  litCounts,
  litSettings,
  makeSheetDay,
  naiveNeeded,
  naiveSurvivors,
  plainMessages,
  sceneDay,
  stackToOne,
  steadyFor,
  surviveChoice,
  survivorsItem,
  type NeededInstance,
  type StackInstance,
  type SurvivorsInstance,
} from '../gates'

const SEEDS = 300

const gen = <I>(l: ItemLogic<I, unknown>, s: number): I =>
  l.generate(createRng(seedFor('ii8-test', l.id, s)), {
    key: `ii8-sheets/sheets/${l.id}` as ItemKey,
    attempt: 1,
    purpose: 'instance',
    previous: [],
  })

function naivePasses(logic: GateLogic, naive: (i: unknown, l: ItemLogic) => unknown, runs = 100): number {
  let passes = 0
  for (let run = 0; run < runs; run++) {
    const ctx: GateCtx = { key: 'ii8-sheets/naive', logic, salt: `naive-${run}` }
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

describe('females and sheets', () => {
  it('a female found through the kit’s tables is one on the engine: its AD has a fixed point and the letter repeats', () => {
    let found = 0
    let steadyCount = 0
    for (let s = 0; s < 200; s++) {
      const r = createRng(seedFor('female', s))
      const d = makeSheetDay(r, { extra: 2 })
      const setting = [0, 1, 2].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 26)]).join('')
      // makeSheetDay only asks at steady settings (no middle rotor moves in the four presses).
      if (!steadyFor(d.day.rotors, d.day.rings.map(idx), setting)) continue
      steadyCount++
      const f = femaleMessage(r, d.day, setting)
      const six = sixPermutations(normalizeConfig({ ...d.day, positions: setting }))
      const ad = compose(six[0]!, six[3]!)
      expect(f !== null).toBe(ad.some((y, x) => y === x))
      if (f) {
        found++
        expect(femalePlaces(f.indicator)).toContain(0)
      }
    }
    expect(steadyCount).toBeGreaterThan(100)
    expect(found).toBeGreaterThan(30)
  })

  it('every generated day: its females repeat at places 1 and 4, move no middle rotor, and the day’s rings survive every sheet', () => {
    for (let s = 0; s < 80; s++) {
      const d = makeSheetDay(createRng(seedFor('day', s)), { extra: 3 })
      expect(validateConfig(d.day)).toEqual([])
      expect(d.day.reflector).toBe('B')
      expect([...d.day.rotors].sort()).toEqual(['I', 'II', 'III'])
      expect(d.day.plugboard).toHaveLength(6)
      const rings = d.day.rings.map(idx)
      for (const f of d.females) {
        expect(femalePlaces(f.indicator)).toContain(0)
        expect(steadyFor(d.day.rotors, rings, f.setting)).toBe(true)
      }
      const counts = litCounts(d.day.rotors, rings[0]!, d.females)
      for (const lit of counts) expect(lit).toContain(daySetting(d))
      const k = firstAlone(d.day.rotors, rings[0]!, d.females)!
      expect(k).toBeGreaterThanOrEqual(5)
      expect(counts[k - 1]).toEqual([daySetting(d)])
      expect(d.females.length).toBe(k + 3)
    }
  })

  it('the light table’s aligned 51 × 51 sheets count the same settings as the direct count, and repeat a–z, a–y', () => {
    const d = sceneDay()
    const rings = d.day.rings.map(idx)
    const sheets = alignedSheets(d.day.rotors, rings[0]!, d.females)
    expect(sheets).toHaveLength(d.females.length)
    for (const s of sheets) {
      expect(s).toHaveLength(51 * 51)
      for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) expect(s[(y + 26) * 51 + x + 26]).toBe(s[y * 51 + x])
    }
    const counts = litCounts(d.day.rotors, rings[0]!, d.females)
    for (let k = 1; k <= d.females.length; k++) expect(litSettings(d.females[0]!, sheets, k)).toEqual(counts[k - 1])
    expect(litSettings(d.females[0]!, sheets, 0)).toHaveLength(676)
  })
})

describe('the scenes', () => {
  it('the scene day has 14 females and converges to its own rings well before the last sheet', () => {
    const d = sceneDay()
    expect(d.females).toHaveLength(14)
    const k = firstAlone(d.day.rotors, idx(d.day.rings[0]!), d.females)!
    expect(k).toBeLessThanOrEqual(12)
    expect(litCounts(d.day.rotors, idx(d.day.rings[0]!), d.females)[k - 1]).toEqual([daySetting(d)])
  })

  it('the traffic beside the females has no repeat at a distance of three', () => {
    for (const m of plainMessages(sceneDay(), 16)) expect(femalePlaces(m.indicator)).toEqual([])
  })

  it('about 40% of a sheet’s positions are holes (the survive bet), and about 12 females isolate one of 105,456 (the isolate bet)', () => {
    const share = holeShare(sceneDay().day.rotors)
    expect(share).toBeGreaterThan(0.37)
    expect(share).toBeLessThan(0.43)
    expect(surviveChoice(share)).toBe('40')
    expect([surviveChoice(0.08), surviveChoice(0.8)]).toEqual(['10', '90'])
    expect(ALL_SETTINGS).toBe(105456)
    expect(femalesNeeded(ALL_SETTINGS, share)).toBe(12)
  })
})

describe('females-needed', () => {
  it('the formula: the smallest k with N·pᵏ ≤ 2', () => {
    expect(femalesNeeded(105456, 0.4)).toBe(12)
    expect(femalesNeeded(17576, 0.4)).toBe(10)
    expect(femalesNeeded(1054560, 0.4)).toBe(15)
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(femalesNeededItem, s) as NeededInstance
      const k = femalesNeeded(i.n, i.p)
      expect(expected(i.n, i.p, k)).toBeLessThanOrEqual(2)
      expect(expected(i.n, i.p, k - 1)).toBeGreaterThan(2)
      expect(k).toBeGreaterThanOrEqual(1)
      expect(k).toBeLessThanOrEqual(30)
      expect(femalesNeededItem.check(i, [k - 1]).correct).toBe(true)
      expect(femalesNeededItem.check(i, [k + 2]).correct).toBe(false)
    }
  })

  it('MISCONCEPTION BOT: counting with 1 − p surviving is wrong on every one of 300 instances', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(femalesNeededItem, s) as NeededInstance
      expect(femalesNeededItem.check(i, [naiveNeeded(i)]).correct).toBe(false)
    }
  })
})

describe('survivors', () => {
  it('N·pᵏ between 5 and 2,000, within 10%', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(survivorsItem, s) as SurvivorsInstance
      const e = expected(i.n, i.p, i.k)
      expect(e).toBeGreaterThanOrEqual(5)
      expect(e).toBeLessThanOrEqual(SURVIVORS_MAX)
      expect(survivorsItem.check(i, [e * 1.08]).correct).toBe(true)
      expect(survivorsItem.check(i, [e * 1.15]).correct).toBe(false)
    }
  })

  it('MISCONCEPTION BOT: a fixed amount per sheet (N·p·k), or 1 − p surviving, is wrong on every one of 300 instances', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(survivorsItem, s) as SurvivorsInstance
      for (const naive of naiveSurvivors(i)) expect(survivorsItem.check(i, [naive]).correct).toBe(false)
    }
  })
})

describe('stack-to-one (the fallback)', () => {
  it('stop at the first sheet that leaves one setting: one sheet more or fewer is wrong; the rings are not in the instance', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(stackToOne, s) as StackInstance
      const [k, setting] = stackToOne.solve(i)
      expect(stackToOne.check(i, [k, setting]).correct).toBe(true)
      expect(stackToOne.check(i, [k + 1, setting]).correct).toBe(false)
      expect(stackToOne.check(i, [k - 1, setting]).correct).toBe(false)
      expect(stackToOne.check(i, [k, (setting + 1) % 676]).correct).toBe(false)
      expect(i.females.length).toBeGreaterThanOrEqual(k + 2)
      expect(Object.keys(i).sort()).toEqual(['females', 'leftRing', 'rotors'])
    }
  })
})

describe('gate sheets', () => {
  it('holds the two estimates of §4.4 with stack-to-one as the in-page fallback', () => {
    expect(GATES.sheets!.items.map((i) => [i.id, i.kind, i.rule.kind, i.compute])).toEqual([
      ['females-needed', 'numbers', 'window', true],
      ['survivors', 'numbers', 'window', true],
    ])
    expect(GATES.sheets!.fallback).toMatchObject({ id: 'stack-to-one', kind: 'custom', inPage: true })
  })

  it('MISCONCEPTION BOT through the gate: the 1 − p learner never passes', () => {
    const naive = (i: unknown, l: ItemLogic) =>
      l.id === 'females-needed'
        ? [naiveNeeded(i as NeededInstance)]
        : l.id === 'survivors'
          ? [naiveSurvivors(i as SurvivorsInstance)[1]]
          : [1, 0]
    expect(naivePasses(GATES.sheets!, naive)).toBe(0)
  })
})
