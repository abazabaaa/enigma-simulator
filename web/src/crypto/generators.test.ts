import { describe, expect, it } from 'vitest'
import { createMachine, encipher, step, validateConfig, type RotorName } from '../engine'
import { createRng } from '../lib/rng'
import { runBombeAsync } from './bombeClient'
import { runBombe, trueBombePosition } from './bombe'
import { crashes } from './cribs'
import { cribbedMessage, dayKey, type Era } from './generators'
import { menuFromCrib } from './menu'
import { productsFromMachine } from './rejewski'
import { SHEET_SIZE, femaleSheet } from './sheets'

describe('dayKey', () => {
  it.each(['1932', '1936', '1940'] as Era[])('%s days pass validateConfig and follow the era', (era) => {
    for (let s = 0; s < 300; s++) {
      const day = dayKey(createRng(s), { era })
      expect(validateConfig(day)).toEqual([])
      expect(day.model).toBe('I')
      expect(new Set(day.rotors).size).toBe(3)
      if (era === '1940') {
        expect(day.reflector).toBe('B')
        expect(day.plugboard).toHaveLength(10)
        for (const r of day.rotors) expect(['I', 'II', 'III', 'IV', 'V']).toContain(r)
      } else {
        expect(day.reflector).toBe('A')
        expect(day.plugboard).toHaveLength(6)
        expect([...day.rotors].sort()).toEqual(['I', 'II', 'III'])
      }
    }
  })

  it('honours plugs, rings and orders, and is deterministic', () => {
    const orders: RotorName[][] = [['IV', 'II', 'V'], ['I', 'V', 'III']]
    for (let s = 0; s < 100; s++) {
      const day = dayKey(createRng(s), { era: '1940', plugs: s % 14, rings: 'AAA', orders })
      expect(validateConfig(day)).toEqual([])
      expect(day.plugboard).toHaveLength(s % 14)
      expect(day.rings).toEqual(['A', 'A', 'A'])
      expect(orders.map((o) => o.join())).toContain(day.rotors.join())
    }
    expect(dayKey(createRng(5), { era: '1936' })).toEqual(dayKey(createRng(5), { era: '1936' }))
    expect(() => dayKey(createRng(1), { era: '1936', orders: [['VI', 'I', 'II']] })).toThrow(RangeError)
  })
})

describe('cribbedMessage', () => {
  it('hides the crib at `offset`, deciphers, and keeps the middle rotor still over the crib (300 seeds)', () => {
    const cribs = ['ATTACKATDAWN', 'WETTERVORHERSAGE', 'KEINEBESONDERENEREIGNISSE', 'ANX']
    for (let s = 0; s < 300; s++) {
      const r = createRng(700 + s)
      const day = dayKey(r, { era: s % 3 ? '1940' : '1936' })
      const crib = cribs[s % cribs.length]!
      const length = crib.length + (s % 40)
      const m = cribbedMessage(r, { day, crib, length })
      expect(m.plain).toHaveLength(length)
      expect(m.cipher).toHaveLength(length)
      expect(m.plain.slice(m.offset, m.offset + crib.length)).toBe(crib)
      expect(crashes(m.cipher, crib, m.offset)).toEqual([])
      const setting = { ...day, positions: m.start.split('') as never }
      expect(validateConfig(setting)).toEqual([])
      expect(encipher(createMachine(setting), m.cipher).output).toBe(m.plain)
      // presses offset + 1 … offset + crib.length: the middle (and left) window never moves
      let state = createMachine(setting)
      for (let k = 0; k < m.offset; k++) state = step(state).state
      const [left, middle] = state.positions
      for (let k = 0; k < crib.length; k++) {
        state = step(state).state
        expect([state.positions[0], state.positions[1]]).toEqual([left, middle])
      }
      expect(trueBombePosition(day, m.start, m.offset)).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('rejects a crib longer than the message', () => {
    const day = dayKey(createRng(1), { era: '1940' })
    expect(() => cribbedMessage(createRng(1), { day, crib: 'ABCDEF', length: 5 })).toThrow(RangeError)
  })
})

describe('femaleSheet', () => {
  it('marks exactly the Grundstellungen whose AD has a fixed point, repeated to 51 × 51', () => {
    const rotors: RotorName[] = ['II', 'III', 'I']
    const sheet = femaleSheet({ rotors, reflector: 'B', left: 'K' })
    expect(sheet).toHaveLength(SHEET_SIZE * SHEET_SIZE)
    for (let i = 0; i < SHEET_SIZE; i++) {
      for (let j = 0; j < SHEET_SIZE; j++) expect(sheet[i * SHEET_SIZE + j]).toBe(sheet[(i % 26) * SHEET_SIZE + (j % 26)])
    }
    for (const [m, r] of [[0, 0], [4, 21], [13, 7], [25, 25], [3, 16]] as const) {
      const positions = ['K', String.fromCharCode(65 + m), String.fromCharCode(65 + r)] as never
      const { AD } = productsFromMachine({ model: 'I', reflector: 'B', rotors, rings: ['A', 'A', 'A'], positions,
        plugboard: ['QW', 'ER'] })
      expect(sheet[m * SHEET_SIZE + r]).toBe(AD.some((x, i) => x === i))
    }
    const open = sheet.slice(0, 26 * SHEET_SIZE).filter(Boolean).length / (26 * SHEET_SIZE)
    expect(open).toBeGreaterThan(0.2)
    expect(open).toBeLessThan(0.7)
  })
})

describe('runBombeAsync (bombeClient)', () => {
  it('without Worker it runs on the main thread and returns runBombe’s stops', async () => {
    const r = createRng(12)
    const day = dayKey(r, { era: '1940' })
    const m = cribbedMessage(r, { day, crib: 'WETTERVORHERSAGEBISKAYA', length: 40 })
    const menu = menuFromCrib(m.cipher, 'WETTERVORHERSAGEBISKAYA', m.offset)
    const o = { menu, rotors: day.rotors, reflector: day.reflector, diagonal: false, from: 'MMM', limit: 500 }
    let last = 0
    const stops = await runBombeAsync({ ...o, onProgress: (d) => (last = d) })
    expect(stops).toEqual(runBombe(o))
    expect(last).toBe(500)
    const ac = new AbortController()
    ac.abort()
    await expect(runBombeAsync(o, ac.signal)).rejects.toThrow(/aborted/)
  })
})
