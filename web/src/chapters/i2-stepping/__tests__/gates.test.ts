/**
 * Chapter i2-stepping: generator and check tests (PLAN §6.6 brief 07, review round 1). The shared lints (validate,
 * L1 lint, guess bot, CC learner, purity) cover the chapter too. The odometer bot proves that the gate cannot be
 * passed without the double step (review B1).
 */

import { describe, expect, it } from 'vitest'
import type { GenCtx, GateRecord, ItemLogic } from '../../../contracts/lesson'
import { LETTERS, ROTORS, createMachine, encipher, normalizeConfig, step, validateConfig, type MachineConfig } from '../../../engine'
import { createRng, randLetter, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import {
  DOUBLE_START,
  GATES,
  START,
  firstLetter,
  includesDoubleStep,
  leftSteps,
  middleSteps,
  movedChoice,
  ringProbe,
  ringProbeAnswer,
  stepsFrom,
  windows,
  windowsM3,
  type FirstLetterInstance,
  type RingProbeInstance,
  type StepsInstance,
  type WindowsInstance,
} from '../gates'

const idx = (l: string) => LETTERS.indexOf(l as (typeof LETTERS)[number])
const ctx = (id: string, attempt: number): GenCtx => ({ key: `i2-stepping/stepping/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = (s % 4) + 1): I =>
  l.generate(createRng(seedFor('i2-test', l.id, s)), ctx(l.id, attempt))
const SEEDS = 300

/** The "odometer" misconception: the middle rotor moves only when the right rotor carries it (no double step). */
function odometerWindows(config: MachineConfig, presses: number): string[] {
  const turn = config.rotors.map((r) => ROTORS[r].turnovers)
  const p = config.positions.map(idx)
  const [L, M, R] = [p.length - 3, p.length - 2, p.length - 1]
  const out: string[] = []
  for (let k = 0; k < presses; k++) {
    const rightAt = turn[R]!.includes(LETTERS[p[R]!]!)
    const middleAt = turn[M]!.includes(LETTERS[p[M]!]!)
    p[R] = (p[R]! + 1) % 26
    if (rightAt) {
      p[M] = (p[M]! + 1) % 26
      if (middleAt) p[L] = (p[L]! + 1) % 26
    }
    out.push(p.map((x) => LETTERS[x]).join(''))
  }
  return out
}

describe('the chapter machines and the verified stepping sequences', () => {
  it('rotors I II III from ADU step ADV, AEW, BFX, BFY (the third press is the double step)', () => {
    const s = stepsFrom(DOUBLE_START, 4)
    expect(s.map((x) => x.after)).toEqual(['ADV', 'AEW', 'BFX', 'BFY'])
    expect(s.map(movedChoice)).toEqual(['right', 'right-middle', 'all', 'right'])
    expect(s.map((x) => x.doubleStep)).toEqual([false, false, true, false])
    // The odometer gets the third press wrong: AEX instead of BFX.
    expect(odometerWindows(DOUBLE_START, 3)).toEqual(['ADV', 'AEW', 'AEX'])
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
    // Same windows, different wiring: the lamps differ here.
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

  it('every instance includes a double step (300 seeds × attempts 1–6), so the odometer answer is always wrong', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (let attempt = 1; attempt <= 6; attempt++) {
        const i = gen(windows, s, attempt) as WindowsInstance
        expect(includesDoubleStep(i.config, 3), `seed ${s} attempt ${attempt}`).toBe(true)
        expect(windows.check(i, odometerWindows(i.config, 3).join('')).correct, `seed ${s} attempt ${attempt}`).toBe(false)
      }
    }
  })

  it('the double step falls on press 1, 2 or 3 (counting still matters)', () => {
    const at = new Set<number>()
    for (let s = 0; s < 100; s++) at.add(stepsFrom((gen(windows, s) as WindowsInstance).config, 3).findIndex((x) => x.doubleStep))
    expect([...at].sort()).toEqual([0, 1, 2])
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
  ] as const)('%s: the check agrees with engine step() over 1,000 random snapshots', (_id, item, target) => {
    const r = createRng(seedFor('snapshots', target))
    let yes = 0
    for (let n = 0; n < 1000; n++) {
      const i = gen(item, n) as StepsInstance
      expect(i.target).toBe(target)
      expect(i.unlocked).toEqual(['positions'])
      expect(i.trial).toBe('locked')
      const start = i.setup.machine
      // The start does not already solve the item.
      expect(step(createMachine(start)).stepped[target]).toBe(false)
      // Near-miss windows (the carrier at or around its turnover) as well as uniform ones.
      const positions = [randLetter(r), randLetter(r), randLetter(r)]
      if (n % 2 === 0) {
        const carrier = target === 'middle' ? 2 : 1
        const t = idx(ROTORS[start.rotors[carrier]!].turnovers[0]!)
        positions[carrier] = LETTERS[(t + (n % 3) - 1 + 26) % 26]!
        if (target === 'left' && n % 4 === 0) positions[2] = start.positions[2]!
      }
      const cfg = { ...start, positions }
      // left-steps keeps the right rotor where it is: the left rotor must step on the double step alone.
      const truth = step(createMachine(cfg)).stepped[target] && (target === 'middle' || positions[2] === start.positions[2])
      const res = item.check(i, cfg)
      expect(res.correct, `snapshot ${n}: ${positions.join('')}`).toBe(truth)
      if (!res.correct) expect(res.rollback.kind).toBe('machine')
      if (truth) yes++
    }
    expect(yes).toBeGreaterThan(target === 'middle' ? 100 : 40)
  })

  it('left-steps can only be solved with the double step: the odometer answer (right on its turnover) is refused', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(leftSteps, s) as StepsInstance
      const m = i.setup.machine
      const tm = ROTORS[m.rotors[1]!].turnovers[0]!
      const tr = ROTORS[m.rotors[2]!].turnovers[0]!
      const odometer = { ...m, positions: [m.positions[0]!, tm, tr] } as unknown as MachineConfig
      expect(leftSteps.check(i, odometer).correct, `seed ${s}`).toBe(false)
      expect(leftSteps.check(i, leftSteps.solve(i)).correct).toBe(true)
      expect(step(createMachine(leftSteps.solve(i) as MachineConfig)).doubleStep).toBe(true)
    }
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

describe('first-letter', () => {
  it('asks where the first letter is enciphered: after the step; "before the step" is the tagged misconception', () => {
    const answers = new Set<string>()
    let doubles = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(firstLetter, s) as FirstLetterInstance
      const now = i.config.positions.join('')
      const next = stepsFrom(i.config, 1)[0]!
      expect(new Set(i.options.map((o) => o.id)).size).toBe(4)
      expect(i.options.find((o) => o.id === now)).toMatchObject({ misconception: true })
      expect(firstLetter.solve(i)).toBe(next.after)
      expect(firstLetter.check(i, next.after).correct).toBe(true)
      expect(firstLetter.check(i, now).correct).toBe(false)
      answers.add(next.after)
      if (next.doubleStep) doubles++
      expect(validateConfig(i.config)).toEqual([])
    }
    expect(answers.size).toBeGreaterThan(200)
    expect(doubles).toBeGreaterThan(50)
    expect(firstLetter.rule).toEqual({ kind: 'once' })
  })
})

describe('windows-m3', () => {
  it('model M3; one of VI–VIII in the right or middle slot; always a double step; the setup passes validateConfig', () => {
    let middle = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(windowsM3, s) as WindowsInstance
      const c = i.config
      expect(c.model).toBe('M3')
      expect(validateConfig(windowsM3.setup!(i).machine!)).toEqual([])
      const naval = [1, 2].filter((k) => ['VI', 'VII', 'VIII'].includes(c.rotors[k]!))
      expect(naval.length, `seed ${s}`).toBeGreaterThan(0)
      if (naval.includes(1) && !naval.includes(2)) middle++
      // Within two presses a double-notched rotor in the right or middle slot sits on Z or M …
      const seen = [c.positions.join(''), ...stepsFrom(c, 2).map((x) => x.after)]
      expect(seen.some((w) => naval.some((k) => 'ZM'.includes(w[k]!))), `seed ${s}: ${seen.join(' ')}`).toBe(true)
      // … and the double step happens within two presses: the odometer answer is wrong.
      expect(includesDoubleStep(c, 2), `seed ${s}`).toBe(true)
      expect(windowsM3.check(i, odometerWindows(c, 3).join('')).correct, `seed ${s}`).toBe(false)
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
  it('varies per instance (ring change or turn by hand), is shuffled, and tags "the ring changes the window letter"', () => {
    const answers = new Set<string>()
    const orders = new Set<string>()
    const changes = new Set<string>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(ringProbe, s) as RingProbeInstance
      changes.add(i.change)
      const right = ringProbeAnswer(i)
      answers.add(right)
      orders.add(i.options.map((o) => (o.id === right ? 'x' : 'o')).join(''))
      expect(new Set(i.options.map((o) => o.id)).size).toBe(4)
      expect(i.options.filter((o) => o.misconception)).toHaveLength(3)
      const t = ROTORS[i.rotor].turnovers[0]!
      // The turnover letter never moves.
      expect(right[1]).toBe(t)
      if (i.change === 'ring') {
        expect(right[0]).toBe(i.window)
        // The distractor "the ring changes the window letter" is present and tagged.
        expect(i.options.find((o) => o.id[1] === t && o.id[0] !== i.window)).toMatchObject({ misconception: true })
      } else {
        expect(right[0]).toBe(LETTERS[(idx(i.window) + i.by) % 26])
      }
      expect(ringProbe.solve(i)).toBe(right)
      expect(ringProbe.check(i, right).correct).toBe(true)
      for (const o of i.options.filter((x) => x.id !== right)) {
        const res = ringProbe.check(i, o.id)
        expect(res.correct).toBe(false)
        expect(res.rollback.kind).toBe('none')
        expect(res.feedback).toBeTruthy()
        // The feedback explains the rule without naming this instance's answer.
        expect(res.feedback).not.toContain(right)
      }
    }
    expect([...changes].sort()).toEqual(['position', 'ring'])
    expect(answers.size).toBeGreaterThan(50)
    expect(orders.size).toBe(4)
    expect(ringProbe.rule).toEqual({ kind: 'once' })
    expect(ringProbe.constantAnswer).toBeUndefined()
  })
})

describe('gate stepping', () => {
  it('holds windows, middle-steps, first-letter, ring-probe and windows-m3 in order, with the left-steps fallback', () => {
    const g = GATES.stepping!
    expect(g.items.map((i) => i.id)).toEqual(['windows', 'middle-steps', 'first-letter', 'ring-probe', 'windows-m3'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'window', 'once', 'once', 'once'])
    expect(g.fallback.id).toBe('left-steps')
    expect(g.fallback.kind).toBe('set-machine')
  })

  it('every setup machine uses no plugs (the plugboard comes in I.3)', () => {
    for (const item of [windows, windowsM3, middleSteps, leftSteps, firstLetter] as ItemLogic[]) {
      for (let s = 0; s < 50; s++) {
        const setup = item.setup!(gen(item, s))
        expect(setup.machine!.plugboard ?? []).toEqual([])
        if (item.kind === 'set-machine') expect(setup.locks).toMatchObject({ keyboard: true, lampsHidden: true, positions: false })
        else expect(setup.locks).toMatchObject({ keyboard: true, lampsHidden: true })
      }
    }
  })

  it('an odometer learner (right on everything else, no double step) never passes the gate over 300 runs', () => {
    const logic = GATES.stepping!
    /** The odometer learner: exact counting without the double step; every other idea right. */
    const answer = (l: ItemLogic, i: unknown): unknown => {
      if (l.id === 'windows' || l.id === 'windows-m3') return odometerWindows((i as WindowsInstance).config, 3).join('')
      if (l.id === 'first-letter') {
        const f = i as FirstLetterInstance
        const odo = odometerWindows(f.config, 1)[0]!
        return f.options.some((o) => o.id === odo) ? odo : l.solve(i)
      }
      if (l.id === 'left-steps') {
        const m = (i as StepsInstance).setup.machine
        return { ...m, positions: [m.positions[0]!, ROTORS[m.rotors[1]!].turnovers[0]!, ROTORS[m.rotors[2]!].turnovers[0]!] }
      }
      return l.solve(i)
    }
    let passes = 0
    let reachedWindows = 0
    for (let run = 0; run < SEEDS; run++) {
      const c: GateCtx = { key: 'i2-stepping/stepping', logic, salt: `odometer:${run}` }
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      for (let guard = 0; guard < 200; guard++) {
        rec = ensureCurrent(c, rec, now)
        const item = currentItem(logic, rec)
        if (!item) break
        const it = rec.items[item.id]!
        if (it.attempt > 6) break
        if (item.id === 'windows') reachedWindows++
        now += 10_000
        if (hintLevel(it, false) === 3) rec = revealCurrent(c, rec, item.id, now).gate
        else {
          const shown = shownInstance(c, item, it)
          rec = submitAnswer(c, rec, item.id, JSON.parse(JSON.stringify(answer(shown.logic, shown.instance))), now).gate
        }
      }
      if (rec.passed) passes++
    }
    expect(reachedWindows).toBeGreaterThan(SEEDS)
    expect(passes).toBe(0)
  })
})
