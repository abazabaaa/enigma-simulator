import { describe, expect, it } from 'vitest'
import {
  LETTERS,
  createMachine,
  fromPairs,
  isInvolution,
  letterToIndex,
  machinePermutation,
  type Letter,
  type MachineConfig,
  type RotorName,
} from '../engine'
import { createRng, int, pick, randLetter, sample } from '../lib/rng'
import {
  checkStop,
  liveCount,
  menuScramblers,
  propagate,
  runBombe,
  scramblerAt,
  testLetterOf,
  toyBombe,
  trueBombePosition,
  type Stop,
} from './bombe'
import { cribbedMessage, dayKey } from './generators'
import { closures, menuFromCrib, menuFromEdges, type Menu } from './menu'
import { positionIndex, positionString } from './tables'

/** Ellsbury's crib (23 letters): its menus have 2–5 closures, as operational menus did. */
const CRIB = 'WETTERVORHERSAGEBISKAYA'

interface Case {
  day: MachineConfig
  menu: Menu
  cipher: string
  offset: number
  truth: string
  test: Letter
  partner: Letter
}

/** Closures of the piece of the menu that holds `letter`. */
function pieceClosures(menu: Menu, letter: Letter): number {
  const piece = new Set<Letter>([letter])
  for (let grew = true; grew; ) {
    grew = false
    for (const e of menu.edges) {
      if (piece.has(e.a) !== piece.has(e.b)) {
        piece.add(e.a)
        piece.add(e.b)
        grew = true
      }
    }
  }
  return closures(menuFromEdges(menu.edges.filter((e) => piece.has(e.a))))
}

/**
 * A cribbed message on a 1940 day and its menu. `minClosures` > 0 redraws (seed + 1000, …) until the test letter's
 * piece of the menu has that many closures: operational menus had several (Turing's stop table, F18).
 */
function cribCase(seed: number, crib = CRIB, length = 60, minClosures = 0): Case {
  for (let k = 0; ; k++) {
    const r = createRng(seed + 1000 * k)
    const day = dayKey(r, { era: '1940' })
    const m = cribbedMessage(r, { day, crib, length })
    const menu = menuFromCrib(m.cipher, crib, m.offset)
    const test = testLetterOf(menu)
    if (pieceClosures(menu, test) < minClosures) continue
    const S = fromPairs(day.plugboard)
    return { day, menu, cipher: m.cipher, offset: m.offset, truth: trueBombePosition(day, m.start, m.offset), test,
      partner: LETTERS[S[letterToIndex(test)]!]! }
  }
}

describe('scramblers', () => {
  it('the test letter is the busiest letter of the strongest piece of the menu', () => {
    expect(testLetterOf(menuFromCrib('WSNPNLKLSTCS', 'ATTACKATDAWN', 0))).toBe('A')
    const twoPieces = menuFromCrib('BAXYZXYZ', 'ABCDEFGH', 0) // A–B twice (1 closure) vs a 6-letter path
    expect(testLetterOf(twoPieces)).toBe('A')
  })

  it('scramblerAt is the machine without plugboard, with only the fast drum advanced', () => {
    const r = createRng(1)
    for (let k = 0; k < 100; k++) {
      const rotors = sample(r, ['I', 'II', 'III', 'IV', 'V'] as RotorName[], 3)
      const reflector = pick(r, ['A', 'B', 'C'] as const)
      const start = randLetter(r) + randLetter(r) + randLetter(r)
      const pos = int(r, 40)
      const z = scramblerAt(rotors, reflector, start, pos)
      const windows = start.slice(0, 2) + LETTERS[(letterToIndex(start[2]!) + pos) % 26]
      const machine = createMachine({ model: 'I', reflector, rotors, rings: 'AAA', positions: windows })
      expect(z).toEqual([...machinePermutation(machine)])
      expect(isInvolution(z)).toBe(true)
      expect(z.every((x, i) => x !== i)).toBe(true)
    }
  })
})

describe('propagate and the test register', () => {
  it('the toy bombe: 1 live wire for the true hypothesis, 7 for every false one, consistent everywhere', () => {
    const r = createRng(8)
    for (let s = 0; s < 100; s++) {
      const k = (3 + (s % 3)) as 3 | 4 | 5
      const toy = toyBombe(r, { n: 8, scramblers: k })
      expect(toy.menu.edges).toHaveLength(k)
      expect(toy.scramblers).toHaveLength(k)
      for (const z of toy.scramblers) expect(isInvolution(z) && z.every((x, i) => x !== i)).toBe(true)
      for (const diagonal of [false, true]) {
        const ws = propagate(toy.menu, toy.scramblers, toy.truth, { n: 8, diagonal })
        expect(liveCount(ws, toy.truth.bank)).toBe(1)
        // the truth implies one partner per letter: every bank has at most one live wire
        for (let b = 0; b < 8; b++) expect(ws.live[b]!.filter(Boolean).length).toBeLessThanOrEqual(1)
        for (const l of toy.menu.letters) expect(liveCount(ws, l)).toBe(1)
      }
      for (const w of LETTERS.slice(0, 8)) {
        if (w === toy.truth.wire) continue
        const ws = propagate(toy.menu, toy.scramblers, { bank: toy.truth.bank, wire: w }, { n: 8, diagonal: false })
        expect(liveCount(ws, toy.truth.bank)).toBe(7)
        expect(ws.live[letterToIndex(toy.truth.bank)]![letterToIndex(toy.truth.wire)]).toBe(false)
      }
    }
  })

  it('records every live wire once, in order, starting with the hypothesis', () => {
    const toy = toyBombe(createRng(2), { n: 8, scramblers: 4 })
    const ws = propagate(toy.menu, toy.scramblers, toy.truth, { n: 8, diagonal: true })
    expect(ws.order[0]).toEqual({ bank: letterToIndex(toy.truth.bank), wire: letterToIndex(toy.truth.wire), via: 'hypothesis' })
    const lit = ws.live.flatMap((row, b) => row.flatMap((on, w) => (on ? [`${b}:${w}`] : [])))
    expect(ws.order.map((e) => `${e.bank}:${e.wire}`).sort()).toEqual(lit.sort())
    for (const e of ws.order.slice(1)) expect(e.via === 'diagonal' || typeof e.via === 'number').toBe(true)
  })

  it('the 26-wire register at the true position: 1 wire for the true stecker, 25 for each false one', () => {
    for (let s = 0; s < 10; s++) {
      const c = cribCase(100 + s, CRIB, 60, 3)
      const scr = menuScramblers(c.menu, c.day.rotors, c.day.reflector, c.truth)
      for (const wire of LETTERS) {
        const ws = propagate(c.menu, scr, { bank: c.test, wire }, { n: 26, diagonal: true })
        expect(liveCount(ws, c.test)).toBe(wire === c.partner ? 1 : 25)
      }
      // a false position floods the register
      const wrong = positionString(positionIndex(c.truth) + 1000)
      const scrWrong = menuScramblers(c.menu, c.day.rotors, c.day.reflector, wrong)
      expect(liveCount(propagate(c.menu, scrWrong, { bank: c.test, wire: 'A' }, { n: 26, diagonal: true }), c.test)).toBe(26)
    }
  })

  it('the diagonal board only adds live wires, so it never adds stops (50 menus)', () => {
    const r = createRng(31)
    for (let s = 0; s < 50; s++) {
      const len = 6 + int(r, 11)
      const crib = Array.from({ length: len }, () => randLetter(r)).join('')
      const c = cribCase(3000 + s, crib, len + 20)
      const from = positionString(int(r, 17576))
      const off = runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: c.day.reflector, diagonal: false, from, limit: 250 })
      const on = runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: c.day.reflector, diagonal: true, from, limit: 250 })
      const offPositions = new Set(off.map((x) => x.positions))
      for (const stop of on) expect(offPositions.has(stop.positions)).toBe(true)
      expect(on.length).toBeLessThanOrEqual(off.length)
      // wire by wire at a few positions
      for (let k = 0; k < 3; k++) {
        const scr = menuScramblers(c.menu, c.day.rotors, c.day.reflector, positionString(int(r, 17576)))
        const hyp = { bank: c.test, wire: randLetter(r) }
        const a = propagate(c.menu, scr, hyp, { n: 26, diagonal: false })
        const b = propagate(c.menu, scr, hyp, { n: 26, diagonal: true })
        a.live.forEach((row, bank) => row.forEach((on2, w) => on2 && expect(b.live[bank]![w]).toBe(true)))
      }
    }
  })
})

describe('runBombe', () => {
  // The dev box is shared: days 0–4 scan the whole wheel order, days 5–19 the 2,000 positions around the truth
  // (the same checks; about 1.5 s + 0.3 s unloaded). The explicit timeout absorbs a heavily loaded machine.
  it('finds the true stop on 20 cribbedMessage days (diagonal board on; 5 whole wheel orders)', () => {
    let ms = 0
    for (let s = 0; s < 20; s++) {
      const c = cribCase(200 + s, CRIB, 60, 3)
      const whole = s < 5
      const t = performance.now()
      const stops = runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: c.day.reflector, diagonal: true,
        ...(whole ? {} : { from: positionString(positionIndex(c.truth) - 1000), limit: 2000 }) })
      if (whole) ms += performance.now() - t
      const stop = stops.find((x) => x.positions === c.truth)
      expect(stop, `day ${s}`).toBeDefined()
      expect(stop!.live).toBe(c.partner === 'A' ? 1 : 25)
      expect(stop!.stecker).toBe(c.partner)
      expect(stop!.testLetter).toBe(c.test)
      const check = checkStop(stop!, c.cipher, CRIB, c.offset)
      expect(check.consistent).toBe(true)
      const truePairs = new Set(c.day.plugboard.map((p) => [...p].sort().join('')))
      for (const p of check.steckers) expect(truePairs.has(p)).toBe(true)
      for (const other of stops.filter((x) => x !== stop)) {
        expect(checkStop(other, c.cipher, CRIB, c.offset).consistent).toBe(false)
      }
    }
    console.info(`[timing] runBombe, one wheel order (17,576 positions, ${CRIB}, board on): ${(ms / 5).toFixed(0)} ms per run`)
  }, 180_000)

  it('without the board: the true stop is found and checkStop rejects every false stop (20 runs)', () => {
    let falseStops = 0
    for (let s = 0; s < 20; s++) {
      const c = cribCase(400 + s, CRIB, 60, 3)
      const from = positionString(positionIndex(c.truth) - 2000)
      const stops = runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: c.day.reflector, diagonal: false, from,
        limit: 4000 })
      const stop = stops.find((x) => x.positions === c.truth)
      expect(stop, `day ${s}`).toBeDefined()
      // 1 live wire when the input wire is the true partner, else 25 (the true wire stays dead)
      expect(stop!.live).toBe(c.partner === 'A' ? 1 : 25)
      expect(stop!.stecker).toBe(c.partner)
      expect(checkStop({ ...stop!, stecker: c.partner }, c.cipher, CRIB, c.offset).consistent).toBe(true)
      for (const other of stops) {
        if (other === stop) continue
        falseStops++
        const check = checkStop(other, c.cipher, CRIB, c.offset)
        expect(check.consistent).toBe(false)
        expect(check.contradiction!.partners).toHaveLength(2)
        expect(check.contradiction!.partners[0]).not.toBe(check.contradiction!.partners[1])
      }
    }
    expect(falseStops).toBeGreaterThan(20)
  }, 180_000)

  it('reports the same live count as propagate, and the scan order and limit', () => {
    const c = cribCase(7)
    const from = 'QZX'
    const stops = runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: 'B', diagonal: false, from, limit: 800,
      inputWire: 'C' })
    let prev = -1
    for (const stop of stops) {
      const scr = menuScramblers(c.menu, c.day.rotors, 'B', stop.positions)
      const ws = propagate(c.menu, scr, { bank: c.test, wire: 'C' }, { n: 26, diagonal: false })
      expect(liveCount(ws, c.test)).toBe(stop.live)
      expect(stop.live).toBeLessThan(26)
      const k = (positionIndex(stop.positions) - positionIndex(from) + 17576) % 17576
      expect(k).toBeGreaterThan(prev)
      expect(k).toBeLessThan(800)
      prev = k
    }
    // a position that is not a stop floods the register
    const quiet = [...Array(800).keys()].map((k) => positionString(positionIndex(from) + k))
      .find((p) => !stops.some((x) => x.positions === p))!
    const ws = propagate(c.menu, menuScramblers(c.menu, c.day.rotors, 'B', quiet), { bank: c.test, wire: 'C' },
      { n: 26, diagonal: false })
    expect(liveCount(ws, c.test)).toBe(26)
    let calls = 0
    runBombe({ menu: c.menu, rotors: c.day.rotors, reflector: 'B', diagonal: true, limit: 1352, onProgress: () => calls++ })
    expect(calls).toBe(2)
  })
})

describe('checkStop', () => {
  it('names the first letter forced to take two partners', () => {
    const c = cribCase(55)
    const wrong: Stop = { rotors: c.day.rotors, positions: c.truth, testLetter: c.test,
      stecker: LETTERS[(letterToIndex(c.partner) + 1) % 26]!, live: 25, reflector: c.day.reflector }
    const check = checkStop(wrong, c.cipher, CRIB, c.offset)
    expect(check.consistent).toBe(false)
    expect(check.contradiction!.partners).toHaveLength(2)
    // without a reflector field it assumes UKW-B (1940 days use B)
    const { reflector: _r, ...bare } = { ...wrong, stecker: c.partner }
    void _r
    expect(checkStop(bare, c.cipher, CRIB, c.offset).consistent).toBe(true)
  })

  it('trueBombePosition subtracts the rings from the windows after `offset` presses', () => {
    const day: MachineConfig = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: ['B', 'A', 'C'],
      positions: ['A', 'A', 'A'], plugboard: [] }
    expect(trueBombePosition(day, 'ADU', 0)).toBe('ZDS')
    expect(trueBombePosition(day, 'ADU', 3)).toBe('AFV') // ADU → ADV → AEW → BFX, minus B A C
  })
})
