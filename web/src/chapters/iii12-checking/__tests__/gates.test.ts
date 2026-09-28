/**
 * Chapter iii12-checking: scene data, the checking machine, generators, checks and bots (PLAN §6.14 brief 15).
 */

import { describe, expect, it } from 'vitest'
import type { GenCtx, ItemLogic } from '../../../contracts/lesson'
import { checkStop, runBombe, scramblerAt } from '../../../crypto/bombe'
import { closures } from '../../../crypto/menu'
import { LETTERS, createMachine, encodeLetter, fromPairs, normalizeConfig, validateConfig, type MachineConfig } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import {
  GATES,
  KEY_START,
  STOPS_CRIB,
  STOPS_DAY,
  STOP_LIST,
  canonicalLog,
  closure,
  columnScrambler,
  columnWindows,
  falseStopAttempt,
  keyScenario,
  replay,
  sceneCheckData,
  STOP_POOL_SIZE,
  setKey,
  stopPool,
  stopVerdict,
  trueStopsTruth,
  windowsAfter,
  type CheckStep,
  type KeyInstance,
  type StopAnswer,
  type StopInstance,
} from '../gates'
import { modalAnswer, passRate } from './bots'

const KEY = 'iii12-checking/checking' as const
const ctx = (id: string, attempt: number): GenCtx => ({ key: `${KEY}/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = (s % 3) + 1): I =>
  l.generate(createRng(seedFor('iii12-test', l.id, s)), ctx(l.id, attempt))
const SEEDS = 150

/** The stop's partner of the crib/cipher test letter at the true position, from the day's cables. */
const truePartner = (day: MachineConfig, l: string) => LETTERS[fromPairs(day.plugboard)[LETTERS.indexOf(l as never)]!]!

describe('the scene day (stops, checking-machine)', () => {
  it('KEINEBESONDEREN at offset 13, wheel order V II III, rings 01 01 01; menu of 1 closure, test letter E', () => {
    expect(STOPS_DAY.day.rings.join('')).toBe('AAA')
    expect(STOPS_DAY.day.plugboard).toHaveLength(10)
    expect(STOPS_DAY.day.rotors).toEqual(['V', 'II', 'III'])
    expect(STOPS_DAY.offset).toBe(13)
    expect(closures(STOPS_DAY.menu)).toBe(1)
    expect(STOPS_DAY.test).toBe('E')
    expect(STOPS_DAY.truth).toBe('WAB')
  })

  it('the wheel order with the diagonal board gives exactly STOP_LIST: one true stop, five false (the bet’s truth)', () => {
    const stops = runBombe({ menu: STOPS_DAY.menu, rotors: STOPS_DAY.day.rotors, reflector: STOPS_DAY.day.reflector, diagonal: true })
    expect(stops.map((s) => [s.positions, s.stecker, s.live])).toEqual(STOP_LIST)
    expect(trueStopsTruth(stops, STOPS_DAY.truth)).toBe('most-false')
    for (const s of stops) {
      const check = checkStop(s, STOPS_DAY.cipher, STOPS_CRIB, STOPS_DAY.offset)
      expect(check.consistent).toBe(s.positions === STOPS_DAY.truth)
      // The scene's checking machine reaches the same verdict (and the same contradiction letter).
      const c = canonicalLog(sceneCheckData(s.positions))
      expect(c.conflict === null).toBe(check.consistent)
      if (check.contradiction) expect(c.conflict!.letters).toContain(check.contradiction.letter)
    }
    expect(truePartner(STOPS_DAY.day, 'E')).toBe('S')
  })

  it('a column’s scrambler is what the plugless machine at the column’s windows lights (engine, hold)', () => {
    const d = sceneCheckData('WAB')
    for (let pos = 1; pos <= d.crib.length; pos++) {
      // The plugless machine at the column's windows, held (no step): press each key once from those windows.
      const lit = LETTERS.map((l) => {
        const m = createMachine({ model: 'I', reflector: d.reflector, rotors: [...d.rotors], rings: 'AAA', positions: columnWindows(d, pos), plugboard: [] })
        return LETTERS.indexOf(encodeLetter(m, l).output)
      })
      expect(lit).toEqual(columnScrambler(d, pos))
      expect(columnScrambler(d, pos)).toEqual(scramblerAt(d.rotors, d.reflector, d.stop.positions, pos))
    }
  })
})

describe('the checking machine (replay)', () => {
  it('the canonical log agrees with checkStop on 150 generated stops (letters and verdicts)', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(stopVerdict, s) as StopInstance
      const c = canonicalLog(i)
      const cipher = i.under
      const check = checkStop({ rotors: i.rotors, positions: i.stop.positions, testLetter: i.stop.testLetter, stecker: i.stop.stecker, live: i.stop.live, reflector: i.reflector }, cipher, i.crib, 0)
      expect(c.conflict === null).toBe(check.consistent)
      if (check.contradiction) expect(c.conflict!.letters).toContain(check.contradiction.letter)
      if (check.consistent) expect(closure(i, replay(i, c.log).partner)).toEqual({ closed: true })
    }
  })

  it('any valid order counts: the canonical deductions replayed back to front still reach the same verdict', () => {
    let reordered = 0
    for (let s = 0; s < 60; s++) {
      const i = gen(stopVerdict, s, 3) as StopInstance // true stops: no conflict, so the order is free
      const { log } = canonicalLog(i)
      // A greedy other order: always the deduction from the rightmost usable column.
      const partner = replay(i, []).partner as Record<string, string>
      const other: CheckStep[] = []
      for (let guard = 0; guard < 60; guard++) {
        let stepped = false
        for (let pos = i.crib.length; pos >= 1 && !stepped; pos--) {
          const [a, b] = [i.crib[pos - 1]!, i.under[pos - 1]!]
          for (const [from, to] of [[b, a], [a, b]] as const) {
            if (partner[from] === undefined || partner[to] !== undefined) continue
            const lit = LETTERS[columnScrambler(i, pos)[LETTERS.indexOf(partner[from] as never)]!]!
            other.push({ pos, press: partner[from]!, letter: to, partner: lit })
            partner[to] = lit
            partner[lit] = to
            stepped = true
            break
          }
        }
        if (!stepped) break
      }
      const r = replay(i, other)
      expect(r.invalid).toBeUndefined()
      expect(r.conflict).toBeUndefined()
      expect(closure(i, r.partner)).toEqual({ closed: true })
      expect(stopVerdict.check(i, { verdict: 'consistent', letter: i.stop.stecker, log: other }).correct).toBe(true)
      if (JSON.stringify(other) !== JSON.stringify(log)) reordered++
    }
    expect(reordered).toBeGreaterThan(20)
  })

  it('a wrong key, a wrong lamp or a letter outside the column breaks the replay', () => {
    const i = gen(stopVerdict, 3, 3) as StopInstance
    const { log } = canonicalLog(i)
    const s0 = log[0]!
    const flip = (l: string) => LETTERS[(LETTERS.indexOf(l as never) + 1) % 26]!
    expect(replay(i, [{ ...s0, press: flip(s0.press) }]).invalid).toBeDefined()
    expect(replay(i, [{ ...s0, partner: flip(s0.partner) }]).invalid).toBeDefined()
    expect(replay(i, [{ ...s0, letter: LETTERS.find((l) => l !== i.crib[s0.pos - 1] && l !== i.under[s0.pos - 1])! }]).invalid).toBeDefined()
    expect(replay(i, [{ ...s0, pos: 99 }]).invalid).toBeDefined()
  })
})

describe('stop-verdict', () => {
  it('the pools: 96 distinct scenarios per class, each the first qualifying stop of its own scan, varied', () => {
    for (const wantFalse of [true, false]) {
      const pool = stopPool(wantFalse)
      expect(pool).toHaveLength(STOP_POOL_SIZE)
      expect(new Set(pool.map((x) => JSON.stringify(x))).size).toBe(STOP_POOL_SIZE)
      expect(new Set(pool.map((x) => x.rotors.join(' '))).size).toBeGreaterThan(20)
      expect(new Set(pool.map((x) => x.crib)).size).toBeGreaterThan(5)
      for (const x of pool) expect(canonicalLog(x).conflict === null).toBe(!wantFalse)
    }
  })

  it('the true stop on every third attempt, false stops otherwise; nothing in the instance says which', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const attempt of [1, 2, 3, 4, 5, 6]) {
        const i = gen(stopVerdict, s, attempt) as StopInstance
        const sol = stopVerdict.solve(i) as StopAnswer
        expect(sol.verdict).toBe(falseStopAttempt(attempt) ? 'contradiction' : 'consistent')
        expect(Object.keys(i).sort()).toEqual(['crib', 'reflector', 'rotors', 'stop', 'under'])
        expect(Object.keys(i.stop).sort()).toEqual(['live', 'positions', 'stecker', 'testLetter'])
        expect(stopVerdict.check(i, sol).correct).toBe(true)
        expect(stopVerdict.check(i, { ...sol, verdict: sol.verdict === 'consistent' ? 'contradiction' : 'consistent' }).correct).toBe(false)
        expect(stopVerdict.check(i, sol).rollback.kind).toBe('none')
        expect(stopVerdict.check(i, { ...sol, log: [] }).rollback.kind).toBe('machine')
      }
    }
  })

  it('a consistent claim before the check is finished fails (every column must agree)', () => {
    for (let s = 0; s < 40; s++) {
      const i = gen(stopVerdict, s, 3) as StopInstance
      const sol = stopVerdict.solve(i) as StopAnswer
      const res = stopVerdict.check(i, { ...sol, log: sol.log.slice(0, -1) })
      expect(res.correct).toBe(false)
    }
  })

  it('misconception bot: "any stop is the key" (consistent, the register’s partner, no check) never passes', () => {
    const bot = (_l: ItemLogic, i: unknown) => ({ verdict: 'consistent', letter: (i as StopInstance).stop.stecker, log: [] })
    expect(passRate(KEY, GATES.checking!, 'stop-verdict', bot, 200)).toBe(0)
  })

  it('misconception bot: a full check but "any stop is the key" anyway never passes', () => {
    const bot = (_l: ItemLogic, i: unknown) => ({ ...(stopVerdict.solve(i as StopInstance) as StopAnswer), verdict: 'consistent', letter: (i as StopInstance).stop.stecker })
    expect(passRate(KEY, GATES.checking!, 'stop-verdict', bot, 200)).toBe(0)
  })

  it('the modal constant answer passes under 1 %', () => {
    const modal = modalAnswer(stopVerdict as ItemLogic, (s) => gen(stopVerdict, s), 100)
    expect(passRate(KEY, GATES.checking!, 'stop-verdict', () => modal.answer, 200)).toBeLessThan(0.01)
  })
})

describe('set-key', () => {
  it('scenarios: rings 01 01 01, 10 cables, the crib 1–10 letters in, no middle step before it; 1–2 cables left to find', () => {
    for (let s = 0; s < 60; s++) {
      const i = gen(setKey, s) as KeyInstance
      const sc = keyScenario(i.seed)!
      expect(sc.day.rings.join('')).toBe('AAA')
      expect(sc.day.plugboard).toHaveLength(10)
      expect(sc.offset).toBeGreaterThanOrEqual(1)
      expect(sc.offset).toBeLessThanOrEqual(10)
      // The start is the stop turned back `offset` places on the right rotor only (engine stepping agrees).
      expect(windowsAfter(sc.day, sc.start, sc.offset)).toBe(sc.stop.positions)
      expect(sc.start.slice(0, 2)).toBe(sc.stop.positions.slice(0, 2))
      expect(i.message).toBe(sc.cipher)
      expect(validateConfig(setKey.setup!(i).machine!)).toEqual([])
      expect(Object.keys(i).sort()).toEqual(['message', 'seed', 'setup', 'trial', 'unlocked'])
    }
  })

  it('the predicate accepts the true key only; the two shortcuts and a wrong rotor order fail', () => {
    for (let s = 0; s < 60; s++) {
      const i = gen(setKey, s) as KeyInstance
      const sc = keyScenario(i.seed)!
      const truth = normalizeConfig({ ...KEY_START, rotors: [...sc.day.rotors], positions: sc.start, plugboard: [...sc.day.plugboard] })
      expect(setKey.check(i, truth).correct).toBe(true)
      expect(setKey.check(i, setKey.solve(i)).correct).toBe(true)
      // The stop's drum positions as the start (forgetting the offset).
      expect(setKey.check(i, { ...truth, positions: sc.stop.positions.split('') as never })).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'positions' } })
      // Only the cables the checking machine found.
      expect(setKey.check(i, { ...truth, plugboard: [...sc.cables] as never })).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'plugboard' } })
      // Another wheel order.
      const rotors = [...sc.day.rotors].reverse()
      expect(setKey.check(i, { ...truth, rotors })).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'rotors' } })
      // A locked field changed (rings) is refused.
      expect(setKey.check(i, { ...truth, rings: ['B', 'A', 'A'] }).correct).toBe(false)
    }
  })

  it('misconception bots never pass: the stop positions as the start; only the checked cables', () => {
    const botStart = (_l: ItemLogic, inst: unknown) => {
      const sc = keyScenario((inst as KeyInstance).seed)!
      return { ...KEY_START, rotors: sc.day.rotors, positions: sc.stop.positions.split(''), plugboard: sc.day.plugboard }
    }
    const botCables = (_l: ItemLogic, inst: unknown) => {
      const sc = keyScenario((inst as KeyInstance).seed)!
      return { ...KEY_START, rotors: sc.day.rotors, positions: sc.start.split(''), plugboard: sc.cables }
    }
    // stop-verdict passes first (solved), then set-key is the target.
    expect(passRate(KEY, GATES.checking!, 'set-key', botStart, 100)).toBe(0)
    expect(passRate(KEY, GATES.checking!, 'set-key', botCables, 100)).toBe(0)
  })
})

describe('gate checking', () => {
  it('holds stop-verdict and set-key in order, with the stop-verdict fallback; it ends Act III on compute items', () => {
    const g = GATES.checking!
    expect(g.items.map((i) => i.id)).toEqual(['stop-verdict', 'set-key'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'once'])
    expect(g.items.every((i) => i.compute)).toBe(true)
    expect(g.fallback).toMatchObject({ id: 'stop-verdict', kind: 'custom', inPage: true })
  })
})
