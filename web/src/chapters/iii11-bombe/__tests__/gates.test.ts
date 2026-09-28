/**
 * Chapter iii11-bombe: scene data, generators, checks and bots (PLAN §6.14 brief 15). The shared lints (validate, L1
 * lint, guess bot, CC learner, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import type { GenCtx, ItemLogic } from '../../../contracts/lesson'
import { checkStop, liveCount, menuScramblers, propagate, runBombe, testLetterOf, trueBombePosition } from '../../../crypto/bombe'
import { closures, loops } from '../../../crypto/menu'
import { LETTERS, compose, type Letter } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import {
  B26,
  BOARD_MYTH_OPTIONS,
  DIAG_FALSE_STOP,
  DIAG_STOPS,
  GATES,
  TOY8,
  TOY8_FIRST_LIVE,
  TOY8_FIRST_WIRE,
  TOY_LETTERS,
  b26State,
  boardMyth,
  cell,
  clickThrough,
  consistentAttempt,
  diagTruth,
  gridProbe,
  liveCountItem,
  livePartner,
  menuToyLive,
  probeSolution,
  registerWires,
  testOf,
  toyLive,
  toyMenu,
  toyScramblers,
  tripChain,
  walkState,
  type ClickInstance,
  type LiveAnswer,
  type LiveInstance,
  type ProbeInstance,
} from '../gates'
import { modalAnswer, passRate } from './bots'

const SEEDS = 300
const KEY = 'iii11-bombe/bombe' as const
const ctx = (id: string, attempt: number): GenCtx => ({ key: `${KEY}/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = (s % 3) + 1, key = l.id): I =>
  l.generate(createRng(seedFor('iii11-test', l.id, key, s)), ctx(key, attempt))
const idx = (l: string) => LETTERS.indexOf(l as Letter)
const n8 = { n: 8, diagonal: false }

describe('the eight-letter scene toy (wire-8)', () => {
  it('two loops through the test letter; at the day’s position 1 wire for the partner, 7 for every other hypothesis', () => {
    expect(closures(TOY8.truth.menu)).toBe(2)
    expect(TOY8.truth.menu.edges).toHaveLength(6)
    for (const w of TOY_LETTERS) expect(menuToyLive(TOY8.truth, w)).toBe(w === TOY8.partner ? 1 : 7)
    expect(TOY8.truth.menu.letters).not.toContain(TOY8.partner)
    expect(TOY8_FIRST_WIRE).not.toBe(TOY8.partner)
    expect(TOY8_FIRST_LIVE).toBe(7)
  })

  it('at the wrong position every hypothesis lights all 8 register wires', () => {
    for (const w of TOY_LETTERS) expect(menuToyLive(TOY8.wrong, w)).toBe(8)
  })

  it('a single loop can never light all 8: every trip round it is an even permutation (why the scene has two loops)', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(clickThrough, s) as ClickInstance
      const z = toyScramblers(i)
      const trip = z.reduce<readonly number[]>((p, q) => compose(p, q), TOY_LETTERS.map((_, k) => k))
      const lengths = new Set<number>()
      for (const w of TOY_LETTERS) lengths.add(liveCount(propagate(toyMenu(i), z, { bank: testOf(i), wire: w }, n8), testOf(i)))
      expect(Math.max(...lengths)).toBeLessThan(8)
      expect(trip).toHaveLength(8)
    }
  })
})

describe('the 26-wire day (wire-26 and diagonal)', () => {
  it('ATTACKATDAWN at offset 10: 11 letters, 3 closures, test letter A, its partner W, drums at GXV', () => {
    expect(B26.menu.letters).toHaveLength(11)
    expect(closures(B26.menu)).toBe(3)
    expect(loops(B26.menu)).toHaveLength(3)
    expect(B26.test).toBe(testLetterOf(B26.menu))
    expect([B26.test, B26.partner, B26.truth, B26.offset]).toEqual(['A', 'W', 'GXV', 10])
  })

  it('at the day’s position the partner lights 1 register wire and every other hypothesis 25; the wrong position floods', () => {
    for (const w of LETTERS) expect(liveCount(b26State(B26.truth, w, false), B26.test)).toBe(w === B26.partner ? 1 : 25)
    expect(liveCount(b26State(B26.wrong, B26.firstWire, false), B26.test)).toBe(26)
    expect(B26.wrong).not.toBe(B26.truth)
  })

  it('the whole wheel order: 20 stops without the board, only the day’s position with it (the diag bet’s truth)', () => {
    const o = { menu: B26.menu, rotors: B26.day.rotors, reflector: B26.day.reflector }
    const off = runBombe({ ...o, diagonal: false })
    const on = runBombe({ ...o, diagonal: true })
    expect([off.length, on.length]).toEqual([DIAG_STOPS.off, DIAG_STOPS.on])
    expect(on.map((s) => s.positions)).toEqual([B26.truth])
    expect(off.map((s) => s.positions)).toContain(B26.truth)
    // The board never adds a stop.
    const offSet = new Set(off.map((s) => s.positions))
    for (const s of on) expect(offSet.has(s.positions)).toBe(true)
    expect(diagTruth(off.length, on.length)).toBe('fewer')
    // The close-up stop: a stop without the board, gone with it.
    expect(offSet.has(DIAG_FALSE_STOP)).toBe(true)
    expect(on.some((s) => s.positions === DIAG_FALSE_STOP)).toBe(false)
    expect(liveCount(b26State(DIAG_FALSE_STOP, 'A', false), B26.test)).toBeLessThan(26)
    expect(liveCount(b26State(DIAG_FALSE_STOP, 'A', true), B26.test)).toBe(26)
    // The true stop checks out along the crib.
    const stop = on[0]!
    expect(checkStop(stop, B26.cipher, 'ATTACKATDAWN', B26.offset).consistent).toBe(true)
    expect(trueBombePosition(B26.day, 'JTM', B26.offset)).toBe(B26.truth)
  })

  it('the TestRegister reading is liveCount of the state shown (board off and on)', () => {
    for (const diagonal of [false, true]) {
      const ws = b26State(B26.truth, B26.firstWire, diagonal)
      expect(ws.live[idx(B26.test)]!.filter(Boolean).length).toBe(liveCount(ws, B26.test))
    }
  })
})

describe('walkState (the Step replay) lights exactly what propagate lights', () => {
  it('300 single-loop toys and hypotheses', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(clickThrough, s) as ClickInstance
      for (const w of [i.hypothesis, TOY_LETTERS[s % 8]!]) {
        const walk = walkState(i, w)
        const bfs = propagate(toyMenu(i), toyScramblers(i), { bank: testOf(i), wire: w }, n8)
        expect(walk.live).toEqual(bfs.live)
        expect(walk.order[0]).toEqual({ bank: idx(testOf(i)), wire: idx(w), via: 'hypothesis' })
        expect(walk.order).toHaveLength(bfs.order.length)
      }
    }
  })
})

describe('click-through', () => {
  it('the chain letters equal the composition of the scramblers round the loop (engine compose)', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(clickThrough, s) as ClickInstance
      const z = toyScramblers(i)
      const sol = clickThrough.solve(i) as string[]
      expect(sol).toHaveLength(i.loop.length + 1)
      let p: readonly number[] = TOY_LETTERS.map((_, k) => k)
      for (let j = 0; j < i.loop.length; j++) {
        p = compose(p, z[j]!)
        expect(sol[j]).toBe(LETTERS[p[idx(i.hypothesis)]!])
      }
      expect(sol.slice(0, -1)).toEqual(tripChain(i, i.hypothesis))
      expect(sol.at(-1)).toBe(sol.at(-2) === i.hypothesis ? 'C' : 'X')
      expect(i.stages.map((x) => x.id)).toEqual([...i.loop.map((_, j) => `s${j + 1}`), 'verdict'])
    }
  })

  it('the verdict is C exactly on every third attempt (the true partner), X otherwise; the truth is not stored', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const attempt of [1, 2, 3, 4, 5, 6]) {
        const i = gen(clickThrough, s, attempt) as ClickInstance
        expect((clickThrough.solve(i) as string[]).at(-1)).toBe(consistentAttempt(attempt) ? 'C' : 'X')
        expect(Object.keys(i).sort()).toEqual(['alphabet', 'hypothesis', 'loop', 'stages', 'tables'])
      }
    }
  })

  it('check: each wrong token is caught, with a wires rollback at that scrambler', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(clickThrough, s) as ClickInstance
      const good = clickThrough.solve(i) as string[]
      expect(clickThrough.check(i, good).correct).toBe(true)
      expect(clickThrough.check(i, good.map((t) => t.toLowerCase())).correct).toBe(true)
      for (let k = 0; k < good.length; k++) {
        const bad = [...good]
        bad[k] = k === good.length - 1 ? (good[k] === 'C' ? 'X' : 'C') : LETTERS[(idx(good[k]!) + 1) % 8]!
        const res = clickThrough.check(i, bad)
        expect(res.correct).toBe(false)
        expect(res.rollback).toMatchObject({ kind: 'wires', scrambler: k })
      }
    }
  })

  it('misconception bot: letters right but "every loop is consistent" (always C) never passes (300 runs)', () => {
    const bot = (_l: ItemLogic, i: unknown) => [...tripChain(i as ClickInstance, (i as ClickInstance).hypothesis), 'C']
    expect(passRate(KEY, GATES.bombe!, 'click-through', bot)).toBe(0)
  })
})

describe('live-count', () => {
  it('the counts equal liveCount(propagate(…)) and the dead wire is the true partner (300 seeds), classes balanced', () => {
    const classes = { tf: 0, ft: 0, ff: 0 }
    const partners = new Map<string, number>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(liveCountItem, s) as LiveInstance
      const sol = liveCountItem.solve(i) as LiveAnswer
      i.hypotheses.forEach((h, k) => {
        const ws = propagate(toyMenu(i), toyScramblers(i), { bank: testOf(i), wire: h }, n8)
        expect(sol.counts[k]).toBe(liveCount(ws, testOf(i)))
        expect([1, 7]).toContain(sol.counts[k])
      })
      expect(toyLive(i, sol.dead as Letter)).toBe(1)
      expect(sol.dead).toBe(livePartner(i))
      for (const h of i.hypotheses) if (h !== sol.dead) expect(registerWires(i, h)).not.toContain(sol.dead)
      const key = sol.counts[0] === 1 ? 'tf' : sol.counts[1] === 1 ? 'ft' : 'ff'
      classes[key]++
      partners.set(sol.dead, (partners.get(sol.dead) ?? 0) + 1)
      expect(Object.keys(i).sort()).toEqual(['alphabet', 'hypotheses', 'loop', 'tables'])
    }
    for (const n of Object.values(classes)) expect(n).toBeGreaterThan(70)
    expect(partners.size).toBe(8)
    for (const n of partners.values()) expect(n).toBeLessThan(70)
  })

  it('misconception bot: "a false hypothesis lights every wire" (8) never passes (300 runs)', () => {
    const bot = (_l: ItemLogic, inst: unknown) => {
      const i = inst as LiveInstance
      return { counts: i.hypotheses.map((h) => (tripChain(i, h).at(-1) === h ? 1 : 8)), dead: livePartner(i) }
    }
    expect(passRate(KEY, GATES.bombe!, 'live-count', bot)).toBe(0)
  })

  it('check: a wrong count or a wrong dead wire fails with a wires rollback', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(liveCountItem, s) as LiveInstance
      const sol = liveCountItem.solve(i) as LiveAnswer
      expect(liveCountItem.check(i, sol).correct).toBe(true)
      expect(liveCountItem.check(i, { ...sol, counts: [sol.counts[0] === 1 ? 7 : 1, sol.counts[1]] })).toMatchObject({
        correct: false,
        rollback: { kind: 'wires', scrambler: 0 },
      })
      expect(liveCountItem.check(i, { ...sol, dead: LETTERS[(idx(sol.dead) + 1) % 8] })).toMatchObject({
        correct: false,
        rollback: { kind: 'wires', scrambler: 2 },
      })
    }
  })
})

describe('modal constant answers (review rule: < 1 % through the gate engine)', () => {
  it.each([
    ['click-through', clickThrough],
    ['live-count', liveCountItem],
  ] as const)('%s: its most common solution passes the item in under 1 % of runs', (id, item) => {
    const modal = modalAnswer(item as ItemLogic, (s) => gen(item as ItemLogic<unknown, unknown>, s), SEEDS)
    const rate = passRate(KEY, GATES.bombe!, id, () => modal.answer)
    expect(rate).toBeLessThan(0.01)
  })
})

describe('board-myth', () => {
  it('once, constant, shuffled; the misconception "part of Turing’s 1939 design" is an option', () => {
    expect(boardMyth).toMatchObject({ rule: { kind: 'once' }, constantAnswer: true })
    const orders = new Set<string>()
    for (let s = 0; s < 60; s++) {
      const i = gen(boardMyth, s) as { options: typeof BOARD_MYTH_OPTIONS }
      orders.add(i.options.map((o) => o.id).join())
      expect(boardMyth.check(i, 'no-welchman').correct).toBe(true)
      for (const o of i.options.filter((x) => x.id !== 'no-welchman')) {
        const res = boardMyth.check(i, o.id)
        expect(res.correct).toBe(false)
        expect(res.feedback).toBeTruthy()
      }
    }
    expect(orders.size).toBeGreaterThan(10)
    expect(BOARD_MYTH_OPTIONS.find((o) => o.id === 'turing-1939')).toMatchObject({ misconception: true })
  })
})

describe('grid-probe (the fallback, per trigger)', () => {
  it('after click-through it asks for one trip round the loop; after the others, the register', () => {
    for (let s = 0; s < 100; s++) {
      const trip = gen(gridProbe, s, 1, 'click-through') as ProbeInstance
      expect(trip.mode).toBe('trip')
      const chain = tripChain(trip, trip.hypothesis)
      const k = trip.loop.length
      expect(probeSolution(trip)).toEqual(
        [...new Set([cell(testOf(trip), trip.hypothesis), ...chain.map((x, j) => cell(trip.loop[(j + 1) % k]!, x))])].sort(),
      )
      for (const key of ['live-count', 'board-myth']) {
        const reg = gen(gridProbe, s, 1, key) as ProbeInstance
        expect(reg.mode).toBe('register')
        expect(probeSolution(reg)).toEqual(registerWires(reg, reg.hypothesis).map((w) => cell(testOf(reg), w)))
      }
    }
  })

  it('check: the solution passes, one missing or one extra cell fails; cells outside the judged rows are scratch', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(gridProbe, s, 1, s % 2 ? 'click-through' : 'live-count') as ProbeInstance
      const good = probeSolution(i)
      expect(gridProbe.check(i, good).correct).toBe(true)
      const outside = TOY_LETTERS.find((l) => !i.loop.includes(l))!
      expect(gridProbe.check(i, [...good, cell(outside, 'A')]).correct).toBe(true)
      expect(gridProbe.check(i, gridProbe.mutate(i, good, createRng(s))).correct).toBe(false)
    }
  })
})

describe('gate bombe', () => {
  it('holds click-through, live-count and board-myth in order, with the grid-probe fallback', () => {
    const g = GATES.bombe!
    expect(g.items.map((i) => i.id)).toEqual(['click-through', 'live-count', 'board-myth'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'window', 'once'])
    expect(g.fallback).toMatchObject({ id: 'grid-probe', kind: 'custom', inPage: true })
  })
})

// Keep the scrambler helper honest against the bombe kit on a real day.
describe('menuScramblers sanity', () => {
  it('scramblers of the B26 day are fixed-point-free involutions', () => {
    for (const z of menuScramblers(B26.menu, B26.day.rotors, B26.day.reflector, B26.truth)) {
      z.forEach((y, x) => {
        expect(y).not.toBe(x)
        expect(z[y]).toBe(x)
      })
    }
  })
})
