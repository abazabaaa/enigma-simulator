/**
 * Chapter iv-capstone: generator, solvability and check tests (PLAN §4.4 iv-capstone, brief 16). The shared lints
 * (validate, L1 lint, guess bot, CC learner, purity) cover the chapter too. Here:
 *  - the fast machine is the engine;
 *  - every generated day is solvable with the given tools, and the truth is within the candidates;
 *  - the puzzle ladder through the gate engine: no hint after 1 wrong answer, L1 after 2; a retry draws a new day;
 *  - MISCONCEPTION BOTS over 300 seeds: every named naive strategy fails on every day;
 *  - the modal constant answer passes < 1 % of instances, and never passes a gate through the gate engine;
 *  - no key item's instance carries the day's key.
 */

import { describe, expect, it } from 'vitest'
import type { GateRecord, GenCtx, ItemLogic } from '../../../contracts/lesson'
import { characteristicAt, checkStop, productsFromMachine, runBombe, trueBombePosition, type Stop } from '../../../crypto'
import { closures, menuFromEdges, turnoverWithin } from '../../../crypto/menu'
import { LETTERS, createMachine, encipher, normalizeConfig, validateConfig, type MachineConfig } from '../../../engine'
import { createRng, int, pick, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import {
  BRITISH_CABLES,
  BRITISH_DAY_SEEDS,
  BRITISH_START,
  GATES,
  INDICATOR_COUNT,
  MAX_LINKS,
  POLISH_CABLES,
  POLISH_START,
  PRACTICE_BRITISH_SEED,
  PRACTICE_POLISH_SEED,
  britishDay,
  britishKey,
  britishMenu,
  britishPlugs,
  britishSolution,
  cardAgreement,
  characteristicOf,
  cribLinks,
  decryptWith,
  doubledTest,
  encipherFast,
  greedyCables,
  indicatorOf,
  keyOf,
  naiveBritishConfigs,
  naiveCharacteristic,
  naivePolishConfigs,
  naiveReads,
  pieces,
  polishCard,
  polishDay,
  polishKey,
  polishKeyItem,
  polishPlugs,
  polishSolution,
  productsOf,
  readIntercept,
  readIntercepts,
  readSolve,
  sixPerms,
  windowsAfter,
  type BritishKeyInstance,
  type BritishMenuInstance,
  type PolishCardInstance,
  type PolishKeyInstance,
  type ReadInstance,
} from '../gates'

const SEEDS = 300
const ctx = (id: string, attempt: number): GenCtx => ({ key: `iv-capstone/test/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number, salt = 'iv-test'): I =>
  l.generate(createRng(seedFor(salt, l.id, s)), ctx(l.id, (s % 4) + 1))
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const withPlugs = (c: MachineConfig, plugboard: readonly string[]): MachineConfig => normalizeConfig({ ...c, plugboard: [...plugboard] })

// ---------------------------------------------------------------------------

describe('the fast machine', () => {
  it('enciphers exactly as the engine (random configs, rings, both reflectors, double steps)', () => {
    const r = createRng(1)
    const text = LETTERS.join('').repeat(4)
    for (let k = 0; k < 300; k++) {
      const cfg = normalizeConfig({
        model: 'I',
        reflector: k % 2 ? 'A' : 'B',
        rotors: pick(r, [
          ['I', 'II', 'III'],
          ['V', 'IV', 'II'],
          ['III', 'I', 'V'],
          ['II', 'V', 'I'],
        ] as const),
        rings: LETTERS[int(r, 26)]! + LETTERS[int(r, 26)]! + LETTERS[int(r, 26)]!,
        // Every fourth start puts the middle rotor on its turnover letter: a double step within the text.
        positions: LETTERS[int(r, 26)]! + (k % 4 === 0 ? 'E' : LETTERS[int(r, 26)]!) + LETTERS[int(r, 26)]!,
        plugboard: k % 3 ? ['AB', 'CD', 'EF', 'QZ'] : [],
      })
      expect(decryptWith(cfg, text), `config ${k}`).toBe(encipher(createMachine(cfg), text).output)
      expect(windowsAfter(cfg.rotors, cfg.positions.join(''), 30)).toBe(
        (() => {
          let s = createMachine(cfg)
          for (let j = 0; j < 30; j++) s = encipherState(s)
          return s.positions.map((x) => LETTERS[x]).join('')
        })(),
      )
    }
  })
})

function encipherState(s: ReturnType<typeof createMachine>): ReturnType<typeof createMachine> {
  return encipher(s, 'A').state
}

// ---------------------------------------------------------------------------
// Solvability
// ---------------------------------------------------------------------------

describe('Polish days are solvable with the given tools (the truth is within the candidates)', () => {
  it.each([PRACTICE_POLISH_SEED, ...Array.from({ length: 40 }, (_, k) => seedFor('polish-day', k))])('seed %i', (seed) => {
    const d = polishDay(seed)
    expect(validateConfig(d.day)).toEqual([])
    expect(d.day).toMatchObject({ model: 'I', reflector: 'A', rings: ['A', 'A', 'A'] })
    expect(d.day.plugboard).toHaveLength(POLISH_CABLES)
    expect(d.indicators).toHaveLength(INDICATOR_COUNT)
    // The indicators are the day's: each is a key typed twice, the first one the message's.
    expect(d.indicators[0]).toBe(indicatorOf(sixPerms(polishKey(d.day.rotors, d.day.plugboard), d.day.positions.join('')), d.messageKey))
    // Every letter shows in every place, so the products read off the indicators are the machine's.
    const p = productsOf(d.indicators)
    const truth = productsFromMachine(d.day)
    expect(p).toEqual({ AD: truth.AD, BE: truth.BE, CF: truth.CF })
    // The characteristic is the day's catalogue key, and the day is on its card, never first.
    const key = characteristicOf(p)
    expect(key).toBe(characteristicAt(d.day.rotors, 'A', d.day.positions.join('')))
    const own = d.row.card.findIndex((s) => s.rotors.join('-') === d.day.rotors.join('-') && s.positions === d.day.positions.join(''))
    expect(own).toBeGreaterThan(0)
    for (const s of d.row.card) expect(characteristicAt(s.rotors, 'A', s.positions)).toBe(key)
    // The doubled-key test with no cables picks the day out of its card.
    const scores = cardAgreement(d)
    for (const [k, v] of scores.entries()) if (k !== own) expect(scores[own]!).toBeGreaterThanOrEqual(2 * v)
    // The cable finder, best cable each time, makes every indicator read doubled; the first gives the message key.
    const cables = greedyCables(d.indicators, d.day.rotors, d.day.positions.join(''), POLISH_CABLES)!
    expect(cables).not.toBeNull()
    const test = doubledTest(d.indicators, polishKey(d.day.rotors, cables), d.day.positions.join(''))
    expect(test.doubled).toBe(INDICATOR_COUNT)
    expect(test.decrypts[0]).toBe(d.messageKey + d.messageKey)
    // With them the message reads.
    expect(decryptWith(polishSolution(d), d.cipher)).toBe(d.plain)
    expect(polishSolution(d).positions.join('')).toBe(d.messageKey)
  })
})

describe('British days are solvable with the given tools (the truth is within the candidates)', () => {
  it.each([PRACTICE_BRITISH_SEED, ...BRITISH_DAY_SEEDS.slice(0, 30), ...Array.from({ length: 30 }, (_, k) => seedFor('british-day', k))])('seed %i', (seed) => {
    const d = britishDay(seed)
    const day = normalizeConfig({ model: 'I', reflector: 'B', rotors: [...d.key.rotors], rings: 'AAA', positions: d.messageKey, plugboard: [...d.key.plugboard] })
    expect(validateConfig(day)).toEqual([])
    expect(d.key.plugboard).toHaveLength(BRITISH_CABLES)
    // The day's wheel order is one of the three candidates.
    expect(new Set(d.orders.map((o) => o.join('-'))).size).toBe(3)
    expect(d.orders.map((o) => o.join('-'))).toContain(d.key.rotors.join('-'))
    // The key enciphered once at the start position reads as the message key; the body reads from it.
    expect(encipherFast(d.key, d.start, d.encKey)).toBe(d.messageKey)
    expect(encipher(createMachine(day), d.plain).output).toBe(d.cipher)
    expect(d.plain.slice(d.offset, d.offset + d.crib.length)).toBe(d.crib)
    // Only the crib's own offset in the window is free of crashes, and it is not the window's first.
    const free = Array.from({ length: d.window[1] - d.window[0] + 1 }, (_, k) => d.window[0] + k).filter(
      (o) => ![...d.crib].some((c, i) => d.cipher[o + i] === c),
    )
    expect(free).toEqual([d.offset])
    expect(d.window[0]).toBeLessThan(d.offset)
    // The middle rotor stands still during the crib, so every link is usable and the drums sit at the crib.
    expect(turnoverWithin(d.key.rotors, d.messageKey, d.offset + 1, d.offset + d.crib.length)).toBeNull()
    expect(d.stop.positions).toBe(trueBombePosition(day, d.messageKey, d.offset))
    // The solution menu: one piece, ≥ 2 closures, ≤ 14 links; the whole crib has more than 14.
    const links = cribLinks(d.cipher, d.crib, d.offset).filter((e) => d.menu.includes(e.pos))
    expect(pieces(links)).toHaveLength(1)
    expect(closures(menuFromEdges(links))).toBeGreaterThanOrEqual(2)
    expect(links.length).toBeLessThanOrEqual(MAX_LINKS)
    expect(d.crib.length).toBeGreaterThan(MAX_LINKS)
    // The checking machine on the true stop: consistent, true cables only, and 1 to 3 left for the reading.
    const check = checkStop({ ...d.stop, rotors: d.key.rotors, live: 1, reflector: 'B' }, d.cipher, d.crib, d.offset)
    expect(check.consistent).toBe(true)
    for (const c of check.steckers) expect(d.key.plugboard).toContain(c)
    // With the checked cables alone, the enciphered key already reads as the message key (the wartime procedure).
    expect(encipherFast({ ...d.key, plugboard: [...check.steckers] }, d.start, d.encKey)).toBe(d.messageKey)
    const solution = britishSolution(d)
    const extra = solution.plugboard.filter((c) => !check.steckers.includes(c))
    expect(extra.length).toBeGreaterThanOrEqual(1)
    expect(extra.length).toBeLessThanOrEqual(3)
    expect(decryptWith(solution, d.cipher)).toBe(d.plain)
  })

  it('british-key draws only verified days: the bombe finds the true stop and a false one, at most 12 (a sample of 4, full runs)', { timeout: 240_000 }, () => {
    expect(BRITISH_DAY_SEEDS).toHaveLength(299)
    expect(new Set(BRITISH_DAY_SEEDS).size).toBe(299)
    expect(BRITISH_DAY_SEEDS).not.toContain(PRACTICE_BRITISH_SEED)
    const sample = [PRACTICE_BRITISH_SEED, ...[0, 101, 298].map((k) => BRITISH_DAY_SEEDS[k]!)]
    for (const seed of sample) {
      const d = britishDay(seed)
      const menu = menuFromEdges(cribLinks(d.cipher, d.crib, d.offset).filter((e) => d.menu.includes(e.pos)))
      const stops: Stop[] = d.orders.flatMap((rotors) => runBombe({ menu, rotors, reflector: 'B', diagonal: true }))
      const isTrue = (s: Stop) => s.rotors.join('-') === d.key.rotors.join('-') && s.positions === d.stop.positions
      expect(stops.some(isTrue), `seed ${seed}: the true stop`).toBe(true)
      expect(stops.filter((s) => !isTrue(s)).length, `seed ${seed}: a false stop to reject`).toBeGreaterThanOrEqual(1)
      expect(stops.length, `seed ${seed}: few enough to check`).toBeLessThanOrEqual(12)
      for (const s of stops.filter((x) => !isTrue(x))) {
        // A false stop taken without checking: its rotors and the cables it implies, the key read at the start position.
        const c = checkStop(s, d.cipher, d.crib, d.offset)
        const plugboard = c.consistent ? [...c.steckers] : []
        const key = encipherFast({ rotors: s.rotors, reflector: 'B', rings: 'AAA', plugboard }, d.start, d.encKey)
        const cfg = normalizeConfig({ ...BRITISH_START, rotors: [...s.rotors], positions: key, plugboard })
        expect(decryptWith(cfg, d.cipher), `seed ${seed}: stop ${s.rotors.join('-')} ${s.positions}`).not.toBe(d.plain)
      }
    }
  })
})

describe('read-intercepts', () => {
  it('every intercept follows the wartime procedure: the key enciphered once at the start position', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(readIntercepts, s)
      expect(validateConfig({ model: 'I', reflector: 'B', rotors: [...i.key.rotors], rings: i.key.rings, positions: 'AAA', plugboard: [...i.key.plugboard] })).toEqual([])
      for (const m of i.intercepts) {
        const { messageKey, plain } = readIntercept(i.key, m)
        const cfg = normalizeConfig({ model: 'I', reflector: 'B', rotors: [...i.key.rotors], rings: i.key.rings, positions: m.start, plugboard: [...i.key.plugboard] })
        expect(encipher(createMachine(cfg), m.encKey).output).toBe(messageKey)
        expect(encipher(createMachine({ ...cfg, positions: messageKey }), m.body).output).toBe(plain)
      }
      expect(readIntercepts.check(i, readSolve(i).toLowerCase()).correct).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// The puzzle ladder and a new day on retry, through the gate engine
// ---------------------------------------------------------------------------

describe('the puzzle ladder (first hint at attempt 3) and a fresh day on every retry', () => {
  it.each(Object.entries(GATES))('gate %s', (id, logic) => {
    expect(logic.puzzle).toBe(true)
    const c: GateCtx = { key: `iv-capstone/${id}` as GateCtx['key'], logic, salt: 'ladder' }
    let rec: GateRecord = ensureCurrent(c, EMPTY_GATE, 1)
    const item = currentItem(logic, rec)!
    const levels: number[] = []
    const seeds: number[] = []
    const instances: string[] = []
    let now = 1
    for (let k = 0; k < 4; k++) {
      const it = rec.items[item.id]!
      const shown = shownInstance(c, item, it)
      seeds.push(it.seed)
      instances.push(JSON.stringify(shown.instance))
      const wrong = shown.logic.mutate(shown.instance, shown.logic.solve(shown.instance), createRng(k))
      now += 10_000
      rec = ensureCurrent(c, submitAnswer(c, rec, item.id, wrong, now).gate, now)
      levels.push(hintLevel(rec.items[item.id]!, true))
    }
    // No hint after 1 wrong answer, L1 after 2, then L2 and L3.
    expect(levels).toEqual([0, 1, 2, 3])
    // Every answer drew a new day.
    expect(new Set(seeds).size).toBe(4)
    expect(new Set(instances).size).toBe(4)
    // L3's "Got it" records the reveal and draws yet another day, with the ladder back at 0.
    const before = rec.items[item.id]!.seed
    rec = ensureCurrent(c, revealCurrent(c, rec, item.id, now + 10_000).gate, now + 10_000)
    expect(rec.items[item.id]!.seed).not.toBe(before)
    expect(hintLevel(rec.items[item.id]!, true)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// MISCONCEPTION BOTS: every named naive strategy fails on every day
// ---------------------------------------------------------------------------

describe('MISCONCEPTION BOTS (300 seeds): a naive strategy never passes', () => {
  it('polish-card: the lengths copied in the order the cycles are met', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<PolishCardInstance>(polishCard, s)
      expect(polishCard.check(i, naiveCharacteristic(productsOf(i.indicators))).correct, `seed ${s}`).toBe(false)
    }
  })

  it('polish-card: products paired the wrong way (letter 1 with letter 2, …) cannot even be read, and lengths never sorted fail', () => {
    for (let s = 0; s < 60; s++) {
      const i = gen<PolishCardInstance>(polishCard, s)
      const lists = (['AD', 'BE', 'CF'] as const).map((n) => [...cyclesLengths(productsOf(i.indicators)[n])].sort((a, b) => a - b))
      expect(polishCard.check(i, keyOf(lists)).correct, `seed ${s}: ascending`).toBe(false)
    }
  })

  it('polish-key: the first setting on the card; the ground setting as the message key; no cables; one cable short', { timeout: 120_000 }, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<PolishKeyInstance>(polishKeyItem, s)
      const d = polishDay(i.seed)
      const naive = naivePolishConfigs(d)
      for (const [name, cfg] of Object.entries(naive)) {
        expect(polishKeyItem.check(i, withLearnerMachine(cfg, POLISH_START)).correct, `seed ${s}: ${name}`).toBe(false)
      }
      const solution = polishSolution(d)
      const needed = solution.plugboard.find((c) => decryptWith(withPlugs(solution, solution.plugboard.filter((x) => x !== c)), d.cipher) !== d.plain)
      expect(needed, `seed ${s}: every cable matters`).toBeDefined()
      expect(polishKeyItem.check(i, withPlugs(solution, solution.plugboard.filter((x) => x !== needed))).correct).toBe(false)
    }
  })

  it('polish-plugs: no cables; one cable short', { timeout: 120_000 }, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<PolishKeyInstance>(polishPlugs, s)
      expect(polishPlugs.check(i, i.setup.machine).correct, `seed ${s}: no cables`).toBe(false)
      const solution = polishPlugs.solve(i)
      expect(polishPlugs.check(i, polishPlugs.mutate(i, solution, createRng(s))).correct, `seed ${s}: one short`).toBe(false)
    }
  })

  it('british-menu: the crib at offset 0 or at the window’s first letter; every link; the menu at a crash-free offset outside the window', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<BritishMenuInstance>(britishMenu, s)
      const right = britishMenu.solve(i)
      const all = Array.from({ length: i.crib.length }, (_, k) => k + 1)
      expect(britishMenu.check(i, { offset: 0, links: right.links }).correct, `seed ${s}: offset 0`).toBe(false)
      expect(britishMenu.check(i, { offset: i.window[0], links: right.links }).correct, `seed ${s}: first of the window`).toBe(false)
      expect(britishMenu.check(i, { offset: right.offset, links: all }).correct, `seed ${s}: every link`).toBe(false)
      const outside = Array.from({ length: i.cipher.length - i.crib.length + 1 }, (_, k) => k).filter(
        (o) => (o < i.window[0] || o > i.window[1]) && ![...i.crib].some((c, j) => i.cipher[o + j] === c),
      )
      for (const o of outside) expect(britishMenu.check(i, { offset: o, links: right.links }).correct, `seed ${s}: offset ${o}`).toBe(false)
    }
  })

  it('british-key: a stop taken without the checking machine; the drums as the message key; the start position as the message key; the checking machine’s cables only', { timeout: 120_000 }, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<BritishKeyInstance>(britishKey, s)
      const d = britishDay(i.seed)
      for (const [name, cfg] of Object.entries(naiveBritishConfigs(d))) {
        expect(britishKey.check(i, withLearnerMachine(cfg, BRITISH_START)).correct, `seed ${s}: ${name}`).toBe(false)
      }
    }
  })

  it('british-plugs: the checking machine’s cables only', { timeout: 120_000 }, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<BritishKeyInstance>(britishPlugs, s)
      const d = britishDay(i.seed)
      expect(britishPlugs.check(i, withPlugs(i.setup.machine, d.checked)).correct, `seed ${s}`).toBe(false)
    }
  })

  it('read-intercepts: the body read at the start position, read on after the key, or with the rings ignored', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen<ReadInstance>(readIntercepts, s)
      const naive = naiveReads(i.key, i.intercepts[i.which]!)
      for (const [name, text] of Object.entries(naive)) {
        expect(readIntercepts.check(i, text.slice(0, 10)).correct, `seed ${s}: ${name}`).toBe(false)
      }
    }
  })
})

/** A naive setting as the learner's machine would submit it (model, reflector and rings are the item's). */
function withLearnerMachine(cfg: MachineConfig, start: MachineConfig): MachineConfig {
  return normalizeConfig({ ...start, rotors: [...cfg.rotors], positions: [...cfg.positions], plugboard: [...cfg.plugboard] })
}

function cyclesLengths(p: readonly number[]): number[] {
  const seen = new Array<boolean>(p.length).fill(false)
  const out: number[] = []
  for (let x = 0; x < p.length; x++) {
    if (seen[x]) continue
    let n = 0
    for (let y = x; !seen[y]; y = p[y]!) {
      seen[y] = true
      n++
    }
    out.push(n)
  }
  return out
}

// ---------------------------------------------------------------------------
// The modal constant answer
// ---------------------------------------------------------------------------

describe('the modal constant answer passes < 1 %', () => {
  const items: [string, ItemLogic, number][] = [
    ['polish-card', polishCard as ItemLogic, SEEDS],
    ['polish-key', polishKeyItem as ItemLogic, 100],
    ['polish-plugs', polishPlugs as ItemLogic, 100],
    ['british-menu', britishMenu as ItemLogic, 1000],
    ['british-key', britishKey as ItemLogic, 1000],
    ['british-plugs', britishPlugs as ItemLogic, 100],
    ['read-intercepts', readIntercepts as ItemLogic, SEEDS],
  ]
  it.each(items)('%s', (_id, l, n) => {
    const counts = new Map<string, number>()
    for (let s = 0; s < n; s++) {
      const key = JSON.stringify(l.solve(gen(l, s, 'modal-a')))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const mode = JSON.parse([...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]) as unknown
    let passes = 0
    for (let s = 0; s < n; s++) if (l.check(gen(l, s, 'modal-b'), clone(mode)).correct) passes++
    expect(passes / n).toBeLessThan(0.01)
  }, 120_000)

  it.each(Object.entries(GATES))('gate %s: a learner who always gives each item’s modal answer never passes (200 runs, gate engine)', (id, logic) => {
    const modes = new Map<string, unknown>()
    for (const l of logic.items) {
      const counts = new Map<string, number>()
      for (let s = 0; s < 50; s++) {
        const key = JSON.stringify(l.solve(gen(l, s, 'modal-gate')))
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      modes.set(l.id, JSON.parse([...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]))
    }
    let passes = 0
    for (let run = 0; run < 200; run++) {
      const c: GateCtx = { key: `iv-capstone/${id}` as GateCtx['key'], logic, salt: `modal:${run}` }
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      for (let guard = 0; guard < 40; guard++) {
        rec = ensureCurrent(c, rec, now)
        const item = currentItem(logic, rec)
        if (!item) break
        const it = rec.items[item.id]!
        if (it.attempt > 6) break
        now += 10_000
        if (hintLevel(it, true) === 3) rec = revealCurrent(c, rec, item.id, now).gate
        else rec = submitAnswer(c, rec, item.id, clone(modes.get(item.id)), now).gate
      }
      if (rec.passed) passes++
    }
    expect(passes).toBe(0)
  }, 120_000)
})

// ---------------------------------------------------------------------------
// No key item carries its day's key
// ---------------------------------------------------------------------------

describe('no instance carries what it asks for', () => {
  it('polish-key and british-key: the traffic and a seed; the machine starts neutral; no card, stop or stecker', () => {
    for (let s = 0; s < 50; s++) {
      const p = gen<PolishKeyInstance>(polishKeyItem, s)
      expect(Object.keys(p).sort()).toEqual(['indicators', 'known', 'maxPlugs', 'message', 'seed', 'setup', 'trial', 'unlocked'])
      expect(p.setup.machine).toEqual(POLISH_START)
      const b = gen<BritishKeyInstance>(britishKey, s)
      expect(Object.keys(b).sort()).toEqual(['crib', 'encKey', 'maxPlugs', 'message', 'orders', 'seed', 'setup', 'start', 'trial', 'unlocked', 'window'])
      expect(b.setup.machine).toEqual(BRITISH_START)
    }
  })

  it('the fallbacks give the rotors and message key but never the cables', () => {
    for (let s = 0; s < 50; s++) {
      expect(gen<PolishKeyInstance>(polishPlugs, s).setup.machine.plugboard).toEqual([])
      expect(gen<BritishKeyInstance>(britishPlugs, s).setup.machine.plugboard).toEqual([])
    }
  })

  it('polish-card and british-menu hold only the traffic', () => {
    expect(Object.keys(gen<PolishCardInstance>(polishCard, 1))).toEqual(['indicators'])
    expect(Object.keys(gen<BritishMenuInstance>(britishMenu, 1)).sort()).toEqual(['cipher', 'crib', 'window'])
  })
})
