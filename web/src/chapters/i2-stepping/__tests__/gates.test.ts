/**
 * Chapter i2-stepping: generator and check tests (PLAN §6.6 brief 07). The shared lints (validate, L1 lint,
 * guess bot, CC learner, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import type { GenCtx, ItemLogic } from '../../../contracts/lesson'
import { LETTERS, ROTORS, createMachine, encipher, normalizeConfig, step, validateConfig, type MachineConfig } from '../../../engine'
import { createRng, randLetter, seedFor } from '../../../lib/rng'
import {
  DOUBLE_START,
  GATES,
  RING_OPTIONS,
  START,
  includesDoubleStep,
  leftSteps,
  middleSteps,
  movedChoice,
  ringProbe,
  stepsFrom,
  windows,
  windowsM3,
  type StepsInstance,
  type WindowsInstance,
} from '../gates'

const idx = (l: string) => LETTERS.indexOf(l as (typeof LETTERS)[number])
const ctx = (id: string, attempt: number): GenCtx => ({ key: `i2-stepping/stepping/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = (s % 4) + 1): I =>
  l.generate(createRng(seedFor('i2-test', l.id, s)), ctx(l.id, attempt))
const SEEDS = 300

describe('the chapter machines and the verified stepping sequences', () => {
  it('rotors I II III from ADU step ADV, AEW, BFX, BFY (the third press is the double step)', () => {
    const s = stepsFrom(DOUBLE_START, 4)
    expect(s.map((x) => x.after)).toEqual(['ADV', 'AEW', 'BFX', 'BFY'])
    expect(s.map(movedChoice)).toEqual(['right', 'right-middle', 'all', 'right'])
    expect(s.map((x) => x.doubleStep)).toEqual([false, false, true, false])
  })

  it("rotors III II I from KDO step KDP KDQ KER LFS LFT LFU (Rijmenants' sequence)", () => {
    const kdo = normalizeConfig({ ...START, rotors: ['III', 'II', 'I'], positions: 'KDO' })
    expect(stepsFrom(kdo, 6).map((x) => x.after)).toEqual(['KDP', 'KDQ', 'KER', 'LFS', 'LFT', 'LFU'])
  })

  it('the first press from AAA moves only the right rotor', () => {
    expect(stepsFrom(START, 1)[0]).toMatchObject({ before: 'AAA', after: 'AAB', moved: ['right'] })
  })

  it('the ring setting shifts the wiring, not the turnover letter', () => {
    const ring05 = normalizeConfig({ ...DOUBLE_START, rings: 'AAE' })
    expect(stepsFrom(ring05, 3).map((x) => x.after)).toEqual(['ADV', 'AEW', 'BFX'])
    // Same windows, different wiring: the lamps differ.
    const lamps = (c: MachineConfig) => encipher(createMachine(c), 'AAAAA').output
    expect(lamps(ring05)).not.toEqual(lamps(DOUBLE_START))
  })
})

describe('windows', () => {
  it('starts within 3 presses of a right-rotor turnover', () => {
    for (let s = 0; s < SEEDS; s++) {
      const { config } = gen(windows, s) as WindowsInstance
      const turnover = ROTORS[config.rotors[2]!].turnovers[0]!
      const distance = (idx(turnover) - idx(config.positions[2]!) + 26) % 26
      expect(distance, `seed ${s}`).toBeLessThanOrEqual(2)
      // The right rotor carries the middle rotor within the three presses.
      expect(stepsFrom(config, 3).some((x) => x.moved.includes('middle')), `seed ${s}`).toBe(true)
      expect(config.plugboard).toEqual([])
      expect(config.model).toBe('I')
      expect(new Set(config.rotors).size).toBe(3)
      expect(validateConfig(config)).toEqual([])
    }
  })

  it('even attempts include a double step (all 300 seeds)', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const attempt of [2, 4, 6]) {
        const { config } = gen(windows, s, attempt) as WindowsInstance
        expect(includesDoubleStep(config, 3), `seed ${s} attempt ${attempt}`).toBe(true)
      }
    }
  })

  it('the rings vary (a ring is never needed to find the windows)', () => {
    const rings = new Set<string>()
    for (let s = 0; s < 50; s++) rings.add((gen(windows, s) as WindowsInstance).config.rings.join(''))
    expect(rings.size).toBeGreaterThan(40)
  })

  it('check is exact: only the nine letters of the three windows, in order, pass', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(windows, s) as WindowsInstance
      const good = windows.solve(i) as string
      expect(good).toMatch(/^[A-Z]{9}$/)
      expect(windows.check(i, good).correct).toBe(true)
      expect(windows.check(i, good.toLowerCase()).correct).toBe(true)
      for (let k = 0; k < 9; k++) {
        const bad = good.slice(0, k) + LETTERS[(idx(good[k]!) + 1) % 26] + good.slice(k + 1)
        expect(windows.check(i, bad).correct, `seed ${s} letter ${k}`).toBe(false)
      }
      expect(windows.check(i, good.slice(0, 6)).correct).toBe(false)
      expect(windows.check(i, good + 'A').correct).toBe(false)
      // The windows in the wrong order are wrong.
      expect(windows.check(i, good.slice(3, 6) + good.slice(0, 3) + good.slice(6)).correct).toBe(good.slice(0, 3) === good.slice(3, 6))
    }
  })

  it('the rollback firstWrong index is the first wrong window, with expected and typed side by side', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(windows, s) as WindowsInstance
      const good = windows.solve(i) as string
      const expected = [good.slice(0, 3), good.slice(3, 6), good.slice(6, 9)]
      for (let press = 0; press < 3; press++) {
        const k = press * 3 + (s % 3)
        const bad = good.slice(0, k) + LETTERS[(idx(good[k]!) + 1) % 26] + good.slice(k + 1)
        const res = windows.check(i, bad)
        expect(res.correct).toBe(false)
        expect(res.rollback).toEqual({
          kind: 'windows',
          from: i.config,
          expected,
          got: [bad.slice(0, 3), bad.slice(3, 6), bad.slice(6, 9)],
          firstWrong: press,
        })
      }
    }
  })
})

describe('middle-steps and left-steps', () => {
  it.each([
    ['middle-steps', middleSteps, 'middle'],
    ['left-steps', leftSteps, 'left'],
  ] as const)('%s: the predicate agrees with engine step() over 1,000 random snapshots', (_id, item, target) => {
    const r = createRng(seedFor('snapshots', target))
    let yes = 0
    for (let n = 0; n < 1000; n++) {
      const i = gen(item, n) as StepsInstance
      expect(i.target).toBe(target)
      expect(i.unlocked).toEqual(['positions'])
      expect(i.trial).toBe('locked')
      // The start does not already solve the item.
      expect(step(createMachine(i.setup.machine)).stepped[target]).toBe(false)
      // Near-miss windows (the carrier at or around its turnover) as well as uniform ones.
      const positions = [randLetter(r), randLetter(r), randLetter(r)]
      if (n % 2 === 0) {
        const carrier = target === 'middle' ? 2 : 1
        const t = idx(ROTORS[i.setup.machine.rotors[carrier]!].turnovers[0]!)
        positions[carrier] = LETTERS[(t + (n % 3) - 1 + 26) % 26]!
      }
      const cfg = { ...i.setup.machine, positions }
      const truth = step(createMachine(cfg)).stepped[target]
      const res = item.check(i, cfg)
      expect(res.correct, `snapshot ${n}: ${positions.join('')}`).toBe(truth)
      if (!res.correct) expect(res.rollback.kind).toBe('machine')
      if (truth) yes++
    }
    expect(yes).toBeGreaterThan(100)
  })

  it('a changed rotor order or ring setting is refused (only the windows are the learner’s)', () => {
    const i = gen(middleSteps, 1) as StepsInstance
    const solved = middleSteps.solve(i) as MachineConfig
    expect(middleSteps.check(i, solved).correct).toBe(true)
    const rings = [...solved.rings]
    rings[2] = LETTERS[(idx(rings[2]!) + 1) % 26]!
    expect(middleSteps.check(i, { ...solved, rings }).correct).toBe(false)
  })

  it('instances use rotors I–V, random rings and no plugs, and validate', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(leftSteps, s) as StepsInstance
      expect(validateConfig(i.setup.machine)).toEqual([])
      expect(i.setup.machine.plugboard).toEqual([])
      expect(i.setup.machine.rotors.every((r) => ['I', 'II', 'III', 'IV', 'V'].includes(r))).toBe(true)
    }
  })
})

describe('windows-m3', () => {
  it('model M3; at least one of VI–VIII in the right or middle slot; the setup passes validateConfig', () => {
    let middle = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(windowsM3, s) as WindowsInstance
      const c = i.config
      expect(c.model).toBe('M3')
      expect(validateConfig(windowsM3.setup!(i).machine!)).toEqual([])
      const naval = [1, 2].filter((k) => ['VI', 'VII', 'VIII'].includes(c.rotors[k]!))
      expect(naval.length, `seed ${s}`).toBeGreaterThan(0)
      if (naval.includes(1) && !naval.includes(2)) middle++
      // Within two presses a double-notched rotor in the right or middle slot sits on Z or M.
      const seen = [c.positions.join(''), ...stepsFrom(c, 2).map((x) => x.after)]
      expect(seen.some((w) => naval.some((k) => 'ZM'.includes(w[k]!))), `seed ${s}: ${seen.join(' ')}`).toBe(true)
    }
    expect(middle).toBeGreaterThan(30)
  })

  it('is a once transfer item with a windows rollback', () => {
    expect(windowsM3.rule).toEqual({ kind: 'once' })
    expect(windowsM3.transfer).toBe(true)
    const i = gen(windowsM3, 3) as WindowsInstance
    expect(windowsM3.check(i, 'AAAAAAAAA').rollback.kind).toBe('windows')
  })
})

describe('ring-probe', () => {
  it('is shuffled, and the misconception "the ring changes the window letter" is present', () => {
    const orders = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(ringProbe, s) as { options: typeof RING_OPTIONS }
      orders.add(i.options.map((o) => o.id).join())
      expect(i.options).toHaveLength(4)
      expect(i.options.find((o) => o.id === 'window')).toMatchObject({ misconception: true })
      expect(i.options.filter((o) => o.misconception)).toHaveLength(3)
      expect(ringProbe.check(i, 'wiring').correct).toBe(true)
      for (const o of i.options.filter((x) => x.id !== 'wiring')) {
        const res = ringProbe.check(i, o.id)
        expect(res.correct).toBe(false)
        expect(res.rollback.kind).toBe('none')
        expect(res.feedback).toBeTruthy()
      }
    }
    expect(orders.size).toBeGreaterThan(10)
    expect(ringProbe).toMatchObject({ rule: { kind: 'once' }, constantAnswer: true })
  })
})

describe('gate stepping', () => {
  it('holds windows, middle-steps, ring-probe and windows-m3 in order, with the left-steps fallback', () => {
    const g = GATES.stepping!
    expect(g.items.map((i) => i.id)).toEqual(['windows', 'middle-steps', 'ring-probe', 'windows-m3'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'window', 'once', 'once'])
    expect(g.fallback.id).toBe('left-steps')
    expect(g.fallback.kind).toBe('set-machine')
  })

  it('every setup machine uses no plugs (the plugboard comes in I.3)', () => {
    for (const item of [windows, windowsM3, middleSteps, leftSteps] as ItemLogic[]) {
      for (let s = 0; s < 50; s++) {
        const setup = item.setup!(gen(item, s))
        expect(setup.machine!.plugboard ?? []).toEqual([])
        if (item.kind === 'set-machine') expect(setup.locks).toMatchObject({ keyboard: true, lampsHidden: true, positions: false })
        else expect(setup.locks).toMatchObject({ keyboard: true, lampsHidden: true })
      }
    }
  })
})
