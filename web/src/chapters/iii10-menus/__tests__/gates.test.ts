/**
 * Chapter iii10-menus: generator, check and misconception tests (PLAN §6.13 brief 14). The shared lints (validate,
 * L1 lint, guess bot, CC learner, purity) cover the chapter too.
 *
 * Misconception bots: a learner who builds the menu from every link (ignoring the turnover), or from every link
 * before the turnover (ignoring the pieces); who counts closures as E − V or E − V + 1 (ignoring the pieces); who
 * answers a loop with the assumed letter itself, goes round the wrong way, or stops one link short: never passes.
 */

import { describe, expect, it } from 'vitest'
import type { Letter } from '../../../contracts/core'
import type { GateRecord, GenCtx, ItemLogic } from '../../../contracts/lesson'
import { liveCount, propagate } from '../../../crypto/bombe'
import { closures, loops, menuFromCrib, menuFromEdges } from '../../../crypto/menu'
import { LETTERS, createMachine, encipher, pressKey, positionsToString } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { dayKey } from '../../../crypto/generators'
import {
  GATES,
  LOOP_TOY,
  MAX_LINKS,
  MENU_CRIBS,
  TOY_ALPHABET,
  TOY_BANKS,
  V14,
  V14_CLOSURES,
  V14_MENU,
  V14_NAMED_LOOPS,
  buildMenu,
  cipherBeforeTurnover,
  closuresItem,
  contradicts,
  goodExercise,
  loopChain,
  loopReturn,
  loopReturnItem,
  loopWalk,
  menuCheck,
  pieces,
  startFor,
  twoCore,
  usableLinks,
  type ClosuresInstance,
  type LoopReturnInstance,
  type MenuInstance,
} from '../gates'

const SEEDS = 300
const ctx = (id: string, attempt: number): GenCtx => ({ key: `iii10-menus/menus/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number): I =>
  l.generate(createRng(seedFor('iii10-test', l.id, s)), ctx(l.id, (s % 4) + 1))
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const sameLoop = (a: readonly string[], b: readonly string[]) => [...a].sort().join('') === [...b].sort().join('')

describe('vector 14 (F21)', () => {
  it('has 12 links, 10 letters, one piece and 3 closures; its cycle basis is the three named loops', () => {
    expect(V14_MENU.edges).toHaveLength(12)
    expect(V14_MENU.letters).toHaveLength(10)
    expect(pieces(V14_MENU.edges)).toHaveLength(1)
    expect(V14_CLOSURES).toBe(3)
    const basis = loops(V14_MENU)
    expect(basis).toHaveLength(3)
    for (const named of V14_NAMED_LOOPS) expect(basis.some((l) => sameLoop(l, named)), named.join('')).toBe(true)
    // ATLK is links 10, 8, 6, 7 (A–T, T–L, L–K, K–A).
    const at = (a: string, b: string) => V14_MENU.edges.find((e) => sameLoop([e.a, e.b], [a, b]))!.pos
    expect([at('A', 'T'), at('T', 'L'), at('L', 'K'), at('K', 'A')]).toEqual([10, 8, 6, 7])
    expect(V14).toEqual({ cipher: 'WSNPNLKLSTCS', crib: 'ATTACKATDAWN' })
  })
})

describe('the toy loop A–T–L–K', () => {
  it('two of the three options survive, one contradicts; propagate agrees with the direct walk for every letter', () => {
    expect(LOOP_TOY.options).toHaveLength(3)
    expect([...LOOP_TOY.options].sort()).toEqual(LOOP_TOY.options)
    expect(LOOP_TOY.options.filter((x) => contradicts(x))).toHaveLength(1)
    for (const x of TOY_ALPHABET) expect(contradicts(x), x).toBe(loopWalk(x)[4] !== x)
    expect(TOY_ALPHABET.filter((x) => !contradicts(x))).toHaveLength(2)
    expect(contradicts('A')).toBe(true)
  })

  it('every scrambler is a fixed-point-free involution on the eight letters; a survivor is a consistent plugboard', () => {
    for (const t of LOOP_TOY.tables) {
      expect([...t].sort().join('')).toBe([...TOY_ALPHABET].sort().join(''))
      ;[...t].forEach((y, k) => {
        expect(y).not.toBe(TOY_ALPHABET[k])
        expect(t[TOY_ALPHABET.indexOf(y as Letter)]).toBe(TOY_ALPHABET[k])
      })
    }
    const consistent = (x: Letter) => {
      const partner = new Map<string, string>()
      const walk = loopWalk(x)
      return TOY_BANKS.every((b, j) => {
        const p = walk[j]!
        if ((partner.get(b) ?? p) !== p || (partner.get(p) ?? b) !== b) return false
        partner.set(b, p)
        partner.set(p, b)
        return true
      })
    }
    expect(LOOP_TOY.options.some((x) => !contradicts(x) && consistent(x))).toBe(true)
  })
})

describe('build-menu', () => {
  it('has a solution on every seed: ≥ 2 closures, one piece, ≤ 14 links, none at or after the turnover', () => {
    const turnovers = new Set<number>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(buildMenu, s) as MenuInstance
      expect(MENU_CRIBS).toContain(i.crib)
      expect(i.crib.length).toBeGreaterThanOrEqual(12)
      expect(i.crib.length).toBeLessThanOrEqual(16)
      turnovers.add(i.turnover)
      const solution = buildMenu.solve(i) as number[]
      expect(buildMenu.check(i, solution).correct, `seed ${s}`).toBe(true)
      const edges = menuFromCrib(i.cipher, i.crib, 0).edges.filter((e) => solution.includes(e.pos))
      expect(edges.length).toBeLessThanOrEqual(MAX_LINKS)
      expect(edges.every((e) => e.pos < i.turnover)).toBe(true)
      expect(pieces(edges)).toHaveLength(1)
      expect(closures(menuFromEdges(edges))).toBeGreaterThanOrEqual(2)
      expect(Object.keys(i).sort()).toEqual(['cipher', 'crib', 'turnover'])
    }
    expect(turnovers.size).toBeGreaterThan(2)
  })

  it('the crib is a real encipherment with no crash, and the middle rotor steps exactly at the turnover press', () => {
    for (let s = 0; s < 60; s++) {
      const r = createRng(seedFor('turnover', s))
      const day = dayKey(r, { era: '1940' })
      const t = 12 + (s % 4)
      const start = startFor(r, day.rotors, t)
      let state = createMachine({ ...day, positions: start })
      for (let press = 1; press <= 16; press++) {
        const before = positionsToString(state)
        const res = pressKey(state, 'A')
        const middleMoved = before[1] !== positionsToString(res.state)[1]
        expect(middleMoved, `seed ${s} press ${press}`).toBe(press === t)
        state = res.state
        if (press === t) break
      }
      // The fast path of the generator equals the engine before the turnover.
      const crib = MENU_CRIBS[s % MENU_CRIBS.length]!
      const cipher = encipher(createMachine({ ...day, positions: start }), crib).output
      expect(cipherBeforeTurnover(day, start, crib, t)).toBe(cipher.slice(0, t - 1))
    }
    for (let s = 0; s < 50; s++) {
      const i = gen(buildMenu, s) as MenuInstance
      expect([...i.crib].every((c, k) => c !== i.cipher[k])).toBe(true)
    }
  })

  it('goodExercise agrees with pieces and closures', () => {
    for (let s = 0; s < 200; s++) {
      const r = createRng(seedFor('good', s))
      const a = Array.from({ length: 12 }, () => Math.floor(r() * 12))
      const b = a.map((x) => (x + 1 + Math.floor(r() * 11)) % 12)
      const edges = a.map((x, j) => ({ a: LETTERS[x]!, b: LETTERS[b[j]!]!, pos: j + 1 }))
      const parts = pieces(edges)
      expect(goodExercise(a, b)).toBe(parts.length >= 2 && parts.some((p) => closures(menuFromEdges(p)) >= 2))
    }
  })

  it('the loop-holding core keeps every closure and stays in one piece', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(buildMenu, s) as MenuInstance
      for (const p of pieces(usableLinks(i))) {
        const core = twoCore(p)
        expect(closures(menuFromEdges(core))).toBe(closures(menuFromEdges(p)))
        if (core.length) expect(pieces(core)).toHaveLength(1)
      }
    }
  })

  it('misconception bots: every link, or every link before the turnover, is always wrong', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(buildMenu, s) as MenuInstance
      const all = menuFromCrib(i.cipher, i.crib, 0).edges.map((e) => e.pos)
      expect(menuCheck(i, all).correct, `seed ${s}: all`).toBe(false)
      expect(menuCheck(i, all).rollback).toMatchObject({ kind: 'menu', breakAt: i.turnover })
      const early = usableLinks(i).map((e) => e.pos)
      const res = menuCheck(i, early)
      expect(res.correct, `seed ${s}: before the turnover`).toBe(false)
      expect(res.feedback).toMatch(/separate pieces/)
    }
  })

  it('rejects malformed answers', () => {
    const i = gen(buildMenu, 1) as MenuInstance
    for (const bad of [[], [0], [1, 1], [99], 'x', null, [1.5]]) expect(menuCheck(i, bad).correct).toBe(false)
  })
})

describe('closures', () => {
  it('E − V + C from crypto.closures, 0–4 closures in 2–3 pieces; E − V and E − V + 1 are always wrong', () => {
    const answers = new Set<number>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(closuresItem, s) as ClosuresInstance
      const m = menuFromEdges(i.edges)
      const E = i.edges.length
      const V = m.letters.length
      const C = pieces(i.edges).length
      expect(E).toBeGreaterThanOrEqual(6)
      expect(E).toBeLessThanOrEqual(10)
      expect([2, 3]).toContain(C)
      expect(E - V + C).toBe(closures(m))
      expect(closuresItem.solve(i)).toEqual([closures(m)])
      answers.add(closures(m))
      expect(i.edges.map((e) => e.pos)).toEqual(Array.from({ length: E }, (_, k) => k + 1))
      expect(i.edges.every((e) => e.a !== e.b)).toBe(true)
      expect(closuresItem.check(i, [E - V]).correct).toBe(false)
      expect(closuresItem.check(i, [E - V + 1]).correct).toBe(false)
      expect(closuresItem.check(i, [closures(m) + 1]).rollback).toMatchObject({ kind: 'menu', breakAt: closures(m) })
    }
    expect([...answers].sort()).toEqual([0, 1, 2, 3, 4])
  })
})

describe('loop-return', () => {
  it('matches a direct composition of the tables; the misreadings are always wrong', () => {
    const answers = new Set<string>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(loopReturnItem, s) as LoopReturnInstance
      const k = i.loop.length
      expect([3, 4]).toContain(k)
      let x = LETTERS.indexOf(i.hypothesis)
      for (const t of i.tables) x = LETTERS.indexOf(t[x] as Letter)
      const direct = LETTERS[x]!
      expect(loopReturn(i)).toBe(direct)
      expect(loopReturnItem.solve(i)).toBe(direct)
      expect(loopChain(i)[k]).toBe(direct)
      answers.add(direct)
      for (const wrong of [i.hypothesis, loopChain(i, true)[k]!, loopChain(i)[k - 1]!]) {
        expect(loopReturnItem.check(i, wrong).correct, `seed ${s}: ${wrong}`).toBe(false)
      }
      // The bombe's view of the closed loop: the assumption contradicts itself, so the bank holds more than one wire.
      const edges = i.loop.map((a, j) => ({ a, b: i.loop[(j + 1) % k]!, pos: j + 1 }))
      const ws = propagate(menuFromEdges(edges), i.tables.map((t) => [...t].map((c) => LETTERS.indexOf(c as Letter))), { bank: i.loop[0]!, wire: i.hypothesis }, { n: 8, diagonal: false })
      expect(liveCount(ws, i.loop[0]!)).toBeGreaterThan(1)
      for (const t of i.tables) expect([...t].every((c) => c >= 'A' && c <= 'H')).toBe(true)
      expect(loopReturnItem.check(i, direct).correct).toBe(true)
      expect(loopReturnItem.check(clone(i), direct.toLowerCase() as Letter).correct).toBe(true)
    }
    expect(answers.size).toBeGreaterThanOrEqual(6)
  })
})

describe('gate menus', () => {
  it('holds build-menu, closures and loop-return in order, with the build-menu fallback', () => {
    const g = GATES.menus!
    expect(g.items.map((i) => i.id)).toEqual(['build-menu', 'closures', 'loop-return'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'window', 'window'])
    expect(g.items.map((i) => i.kind)).toEqual(['custom', 'numbers', 'letter'])
    expect(g.fallback).toBe(buildMenu)
    expect(buildMenu).toMatchObject({ inPage: true, kind: 'custom' })
  })

  /**
   * A misconception learner through the real gate engine, 300 runs of 8 attempts per item, hint levels included:
   * every link before the turnover, E − V + 1, and the letter reached going round the wrong way. It never passes.
   */
  it('misconception bot: never passes an item over 300 runs', () => {
    const logic = GATES.menus!
    const gctx: GateCtx = { key: 'iii10-menus/menus', logic, salt: 'misconception' }
    const naive = (l: ItemLogic, i: unknown): unknown => {
      if (l.id === 'build-menu') return usableLinks(i as MenuInstance).map((e) => e.pos)
      if (l.id === 'closures') {
        const x = i as ClosuresInstance
        return [x.edges.length - menuFromEdges(x.edges).letters.length + 1]
      }
      const x = i as LoopReturnInstance
      return loopChain(x, true)[x.loop.length]
    }
    for (let run = 0; run < 300; run++) {
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      for (const item of logic.items) {
        for (let attempt = 0; attempt < 8; attempt++) {
          rec = ensureCurrent(gctx, rec, now)
          const cur = currentItem(logic, rec)
          if (!cur || cur.id !== item.id) break
          const shown = shownInstance(gctx, cur, rec.items[cur.id]!)
          now += 10_000
          rec = submitAnswer(gctx, rec, cur.id, clone(naive(shown.logic, shown.instance)), now).gate
          expect(rec.items[cur.id]!.passed, `run ${run} ${cur.id}`).toBe(false)
        }
        rec = { ...rec, items: { ...rec.items, [item.id]: { ...rec.items[item.id]!, passed: true } } }
      }
    }
  })
})
