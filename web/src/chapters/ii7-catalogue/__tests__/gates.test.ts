/**
 * Chapter ii7-catalogue: the scenes' truths (the cyclometer's lamps, the catalogue's cards), the key's normalisation,
 * the card table (re-derived from the built catalogue), the gate's generators and checks, and the MISCONCEPTION BOTS:
 * copying the lengths in the order the cycles are written, taking the first setting on the card, and setting the
 * cables from one mismatch never pass an item.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { Choice, ItemKey, MachineConfig } from '../../../contracts/core'
import type { GateLogic, GateRecord, ItemLogic } from '../../../contracts/lesson'
import {
  CATALOGUE_ORDERS,
  buildCatalogue,
  catalogueStats,
  characteristicAt,
  products,
  productsFromMachine,
  type Catalogue,
} from '../../../crypto'
import { createMachine, encipher, formatCycles, normalizeConfig, validateConfig } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import {
  CARD_TABLE,
  CYCLO_AD,
  CYCLO_CHARACTERISTIC,
  CYCLO_DAY,
  CYCLO_KEY,
  GATES,
  LAMPS_TRUTH,
  MAX_PLUGS,
  PARSONS_BLOCKS,
  POSSIBLE_CHARACTERISTICS,
  TRANSFER_TABLE,
  areTwins,
  bucketChoice,
  characteristicOf,
  cycleOf,
  cyclometerWindows,
  dayCharacteristic,
  dayIndicators,
  decodeCards,
  decryptWith,
  encodeCard,
  firstCandidate,
  firstPairCable,
  idx,
  keyOf,
  litLamps,
  lookup,
  lookupTransfer,
  naiveSignature,
  neededCables,
  normalizeKey,
  parseKey,
  permAt,
  plugSolver,
  rejewskiParsons,
  setPlugs,
  signature,
  sixWindows,
  weightedMedian,
  type LookupInstance,
  type PlugsInstance,
  type SignatureInstance,
} from '../gates'

const SEEDS = 300
const SEARCH_SEEDS = 300

const gen = <I>(l: ItemLogic<I, unknown>, s: number, attempt = 1): I =>
  l.generate(createRng(seedFor('ii7-test', l.id, s)), {
    key: `ii7-catalogue/catalogue/${l.id}` as ItemKey,
    attempt,
    purpose: 'instance',
    previous: [],
  })

/** A learner answering every instance (fallback included) with `naive`, for up to 12 attempts per run. */
function naivePasses(logic: GateLogic, naive: (i: unknown, l: ItemLogic) => unknown, runs = 60): number {
  let passes = 0
  for (let run = 0; run < runs; run++) {
    const ctx: GateCtx = { key: 'ii7-catalogue/naive', logic, salt: `naive-${run}` }
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

/** The constant answer that is right most often (among every item's solutions over `seeds` instances), and its hit rate. */
function bestConstant(l: ItemLogic, seeds = 300): { answer: unknown; rate: number } {
  const inst = Array.from({ length: seeds }, (_, s) => gen(l, s))
  const counts = new Map<string, number>()
  for (const i of inst) {
    const k = JSON.stringify(l.solve(i))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  let best = { answer: JSON.parse(top[0]![0]) as unknown, rate: -1 }
  for (const [k] of top) {
    const answer = JSON.parse(k) as unknown
    const rate = inst.filter((i) => l.check(i, answer).correct).length / seeds
    if (rate > best.rate) best = { answer, rate }
  }
  return best
}

let catalogue: Catalogue
beforeAll(() => {
  catalogue = buildCatalogue({ reflector: 'A' })
})

const cardOf = (i: LookupInstance) => catalogue.get(dayCharacteristic(i)) ?? []
const onCard = (card: readonly { rotors: readonly string[]; positions: string }[], cfg: MachineConfig) =>
  card.some((e) => e.rotors.join('-') === cfg.rotors.join('-') && e.positions === cfg.positions.join(''))

describe('the cyclometer', () => {
  it('its day is valid, moves only the right rotor in six presses, and the two sets stand three apart', () => {
    expect(validateConfig(CYCLO_DAY)).toEqual([])
    expect(sixWindows(CYCLO_DAY)).toEqual(['MZI', 'MZJ', 'MZK', 'MZL', 'MZM', 'MZN'])
    expect(cyclometerWindows(CYCLO_DAY, 0)).toEqual(['MZI', 'MZL'])
    expect(cyclometerWindows(CYCLO_DAY, 1)).toEqual(['MZJ', 'MZM'])
    expect(cyclometerWindows(CYCLO_DAY, 2)).toEqual(['MZK', 'MZN'])
  })

  it('the two sets make AD, BE and CF exactly as the kit does', () => {
    const p = productsFromMachine(CYCLO_DAY)
    expect([...CYCLO_AD]).toEqual(p.AD)
    expect(formatCycles(CYCLO_AD)).toBe('(axcy)(bwvpiztmj)(dfqlgsuro)(ehnk)')
    for (const k of [1, 2] as const) {
      const [a, d] = cyclometerWindows(CYCLO_DAY, k)
      const lit = litLamps(permAt(CYCLO_DAY, a), permAt(CYCLO_DAY, d), 0)
      const prod = k === 1 ? p.BE : p.CF
      expect(lit.cycle).toEqual(cycleOf(prod, 0))
    }
    expect(CYCLO_CHARACTERISTIC).toBe('AD:9.9.4.4 BE:8.8.5.5 CF:8.8.5.5')
  })

  it('a key lights its cycle and a different partner cycle of the same length; the bet on A is 8', () => {
    const [a, d] = cyclometerWindows(CYCLO_DAY, 0)
    const first = permAt(CYCLO_DAY, a)
    const second = permAt(CYCLO_DAY, d)
    for (let x = 0; x < 26; x++) {
      const { cycle, partner } = litLamps(first, second, x)
      expect(partner.length).toBe(cycle.length)
      expect(partner.some((y) => cycle.includes(y))).toBe(false)
    }
    const lit = litLamps(first, second, idx(CYCLO_KEY))
    expect(lit.cycle.map((x) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x]).join('')).toBe('AXCY')
    expect(lit.partner.map((x) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x]).sort().join('')).toBe('EHKN')
    expect(LAMPS_TRUTH).toBe('8')
  })
})

describe('the catalogue scene', () => {
  it('105,456 settings over 20,882 characteristics of 1,030,301 possible; the median day sits on a card of 20', () => {
    const s = catalogueStats(catalogue)
    expect(s.entries).toBe(105456)
    expect(s.distinct).toBe(20882)
    expect(POSSIBLE_CHARACTERISTICS).toBe(1030301)
    expect(weightedMedian(s.histogram)).toBe(20)
    expect(bucketChoice(weightedMedian(s.histogram))).toBe('ten')
    expect([bucketChoice(1), bucketChoice(2), bucketChoice(40), bucketChoice(600)]).toEqual(['one', 'one', 'ten', 'thousand'])
  })

  it("the cyclometer day's card lists 6 settings, the day among them", () => {
    const card = catalogue.get(CYCLO_CHARACTERISTIC)!
    expect(card).toHaveLength(6)
    expect(card.map((e) => `${e.rotors.join('-')}:${e.positions}`)).toContain('I-II-III:MZH')
  })
})

describe('keys (signature normalisation)', () => {
  it('normalizeKey and parseKey read a key however it is spaced or cased; keyOf never sorts', () => {
    expect(normalizeKey(' ad : 9 . 9.4.4   be:8.8.5.5 cf:8.8.5.5 ')).toBe('AD:9.9.4.4 BE:8.8.5.5 CF:8.8.5.5')
    expect(parseKey('AD:9.9.4.4 BE:8.8.5.5 CF:8.8.5.5')).toEqual([
      [9, 9, 4, 4],
      [8, 8, 5, 5],
      [8, 8, 5, 5],
    ])
    expect(parseKey('AD:9.9.4.4 CF:8.8.5.5')).toBeNull()
    expect(keyOf([[4, 9, 4, 9], [8], [13, 13]])).toBe('AD:4.9.4.9 BE:8 CF:13.13')
  })

  it('signature accepts the key however it is spaced, and rejects the right lengths in the wrong order', () => {
    for (let s = 0; s < 50; s++) {
      const i = gen(signature, s) as SignatureInstance
      const key = characteristicOf(i.products)
      expect(signature.check(i, key.toLowerCase().replace(/ /g, '   ')).correct).toBe(true)
      const r = signature.check(i, naiveSignature(i.products))
      expect(r.correct).toBe(false)
      expect(r.rollback.kind).toBe('cycles')
      expect(r.feedback).toMatch(/longest first/)
    }
  })

  it('MISCONCEPTION BOT: copying the lengths in written order is wrong on every one of 300 instances', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(signature, s) as SignatureInstance
      expect(naiveSignature(i.products)).not.toBe(characteristicOf(i.products))
      expect(signature.check(i, naiveSignature(i.products)).correct).toBe(false)
    }
    const logic: GateLogic = { items: [signature as ItemLogic], fallback: lookup as ItemLogic }
    expect(naivePasses(logic, (i, l) => (l.id === 'signature' ? naiveSignature((i as SignatureInstance).products) : l.sampleAnswer(i, () => 0.5)))).toBe(0)
  })
})

describe('double-step twins', () => {
  it('II-I-III NQI and ORI stand alike after the first press and encipher alike; the table avoids such first entries', () => {
    const a = { rotors: ['II', 'I', 'III'] as const, positions: 'NQI' }
    const b = { rotors: ['II', 'I', 'III'] as const, positions: 'ORI' }
    expect(areTwins(a, b)).toBe(true)
    expect(areTwins(a, { ...b, positions: 'ORJ' })).toBe(false)
    const cfg = (s: typeof a) => normalizeConfig({ ...CYCLO_DAY, rotors: [...s.rotors], positions: s.positions })
    expect(encipher(createMachine(cfg(a)), 'HOEHEXKOMPANIE').output).toBe(encipher(createMachine(cfg(b)), 'HOEHEXKOMPANIE').output)
    expect(characteristicAt(a.rotors, 'A', a.positions)).toBe(characteristicAt(b.rotors, 'A', b.positions))
  })
})

describe('the card table (data.ts), re-derived from the catalogue', () => {
  it('720 settings, each on a card of 2 to 5 settings and never its first; codes round-trip', () => {
    expect(CARD_TABLE).toHaveLength(720)
    for (const s of CARD_TABLE) {
      const key = characteristicAt(s.rotors, 'A', s.positions)
      const card = catalogue.get(key)!
      const at = card.findIndex((e) => e.rotors.join('-') === s.rotors.join('-') && e.positions === s.positions)
      expect(card.length).toBeGreaterThanOrEqual(2)
      expect(card.length).toBeLessThanOrEqual(5)
      expect(at).toBeGreaterThan(0)
      expect(areTwins(card[0]!, s)).toBe(false)
      expect(decodeCards(encodeCard(s))).toEqual([s])
    }
    expect(new Set(CARD_TABLE.map((s) => s.rotors.join('-'))).size).toBe(6)
  })

  it('the transfer table never holds I-II-III, the order of every scene', () => {
    expect(TRANSFER_TABLE.length).toBeGreaterThan(500)
    expect(TRANSFER_TABLE.some((s) => s.rotors.join('-') === 'I-II-III')).toBe(false)
  })
})

describe('lookup and lookup-transfer', () => {
  it('the indicators show every letter in every place, so their products are the day’s own', () => {
    for (let s = 0; s < 60; s++) {
      const day = normalizeConfig({ ...CYCLO_DAY, plugboard: ['AB', 'CD', 'EF'], positions: 'QRS' })
      const ind = dayIndicators(createRng(seedFor('ind', s)), day)
      expect(ind).toHaveLength(60)
      const p = products(ind)
      const m = productsFromMachine(day)
      expect(p.conflicts).toEqual([])
      expect([p.AD, p.BE, p.CF]).toEqual([m.AD, m.BE, m.CF])
    }
  })

  it('the transfer’s wheel order is never I-II-III (300 seeds), and it gives only raw indicators', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(lookupTransfer, s) as LookupInstance
      expect(i.products).toBeNull()
      expect(lookupTransfer.solve(i).rotors.join('-')).not.toBe('I-II-III')
    }
    expect(lookupTransfer.transfer).toBe(true)
    expect(lookupTransfer.rule.kind).toBe('once')
  })

  it('the candidates for each generated day include the truth, and no instance carries its setting', () => {
    for (const l of [lookup, lookupTransfer]) {
      for (let s = 0; s < SEEDS; s++) {
        const i = gen(l, s) as LookupInstance
        const truth = l.solve(i)
        const card = cardOf(i)
        expect(card.length).toBeGreaterThanOrEqual(2)
        expect(onCard(card, truth)).toBe(true)
        expect(l.check(i, truth).correct).toBe(true)
        // The instance's machine starts at I-II-III AAA; the day's setting is nowhere in it.
        expect(i.setup.machine.rotors.join('-')).toBe('I-II-III')
        expect(i.setup.machine.positions.join('')).toBe('AAA')
        expect(JSON.stringify(i)).not.toContain(`"${truth.positions.join('')}"`)
      }
    }
  })

  it('MISCONCEPTION BOT: the first setting on the card is wrong on every one of 300 instances; so is every other wrong one', () => {
    for (const l of [lookup, lookupTransfer]) {
      for (let s = 0; s < SEEDS; s++) {
        const i = gen(l, s) as LookupInstance
        const card = cardOf(i)
        const first = firstCandidate(i, card)
        const r = l.check(i, first)
        expect(r.correct).toBe(false)
        expect(r.rollback.kind).toBe('machine')
        if (s < 60) {
          // Only the day, or its double-step twin (which enciphers alike), reads the test message.
          const truth = l.solve(i)
          const day = { rotors: truth.rotors, positions: truth.positions.join('') }
          for (const e of card) {
            const cfg = normalizeConfig({ ...i.setup.machine, rotors: [...e.rotors], positions: e.positions })
            const right = (e.rotors.join('-') === day.rotors.join('-') && e.positions === day.positions) || areTwins(e, day)
            expect(l.check(i, cfg).correct).toBe(right)
          }
        }
      }
    }
    const logic: GateLogic = { items: [lookup as ItemLogic], fallback: lookup as ItemLogic }
    expect(naivePasses(logic, (i) => firstCandidate(i as LookupInstance, cardOf(i as LookupInstance)))).toBe(0)
  })

  it('a setting off the card is told so; the locked reflector, rings and cables cannot be changed', () => {
    const i = gen(lookup, 3) as LookupInstance
    const truth = lookup.solve(i)
    const off = normalizeConfig({ ...truth, positions: 'AAA' })
    expect(lookup.check(i, off).feedback).toMatch(/not on the day's card/)
    expect(lookup.check(i, { ...truth, plugboard: [] }).correct).toBe(false)
    expect(lookup.check(i, { ...truth, rings: ['B', 'A', 'A'] }).correct).toBe(false)
  })
})

describe('set-plugs', () => {
  it('the fast decrypt equals the engine’s encipher for any cables', () => {
    for (let s = 0; s < 40; s++) {
      const i = gen(setPlugs, s) as PlugsInstance
      const r = createRng(seedFor('plugs-eq', s))
      const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].sort(() => r() - 0.5)
      const plugs = Array.from({ length: s % 7 }, (_, k) => letters[2 * k]! + letters[2 * k + 1]!)
      const engine = encipher(createMachine({ ...i.setup.machine, plugboard: plugs }), i.message).output
      expect(decryptWith(i, plugs)).toBe(engine)
    }
  })

  it('every instance: rotors and ground setting set, no cables; the method solves it within 6 cables; 3 or more are needed', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(setPlugs, s) as PlugsInstance
      expect(i.setup.machine.plugboard).toEqual([])
      expect(i.unlocked).toEqual(['plugboard'])
      expect(i.maxPlugs).toBe(MAX_PLUGS)
      expect(decryptWith(i, [])).not.toBe(i.plain)
      const plugs = plugSolver(i)!
      expect(plugs.length).toBeLessThanOrEqual(MAX_PLUGS)
      expect(decryptWith(i, plugs)).toBe(i.plain)
      expect(neededCables(i, plugs).length).toBeGreaterThanOrEqual(3)
      expect(setPlugs.check(i, setPlugs.solve(i)).correct).toBe(true)
    }
  })

  it('MISCONCEPTION BOT: the cable from the first wrong letter alone is wrong on every one of 300 instances', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(setPlugs, s) as PlugsInstance
      const r = setPlugs.check(i, firstPairCable(i))
      expect(r.correct).toBe(false)
      expect(r.rollback).toMatchObject({ kind: 'machine', field: 'plugboard' })
    }
  })

  it('more than six cables, or a turned rotor, is refused', () => {
    const i = gen(setPlugs, 1) as PlugsInstance
    const good = setPlugs.solve(i)
    const used = new Set(good.plugboard.join(''))
    const free = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => !used.has(c))
    const extra = Array.from({ length: 7 - good.plugboard.length }, (_, k) => free[2 * k]! + free[2 * k + 1]!)
    expect(setPlugs.check(i, { ...good, plugboard: [...good.plugboard, ...extra] }).feedback).toMatch(/at most 6/)
    expect(setPlugs.check(i, { ...good, positions: ['A', 'A', 'A'] }).correct).toBe(false)
  })
})

describe('rejewski-parsons', () => {
  it('six blocks, never shown in order, one constant answer', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(rejewskiParsons, s) as { blocks: readonly Choice[] }
      expect(i.blocks.map((b) => b.id).join()).not.toBe(PARSONS_BLOCKS.map((b) => b.id).join())
      expect(rejewskiParsons.check(i, rejewskiParsons.solve(i)).correct).toBe(true)
    }
    expect(rejewskiParsons.solve(gen(rejewskiParsons, 0))).toEqual(['collect', 'products', 'lengths', 'lookup', 'set', 'plugs'])
  })
})

describe('gate catalogue', () => {
  it('holds the items of §4.4 in order, with lookup as the fallback', () => {
    expect(GATES.catalogue!.items.map((i) => [i.id, i.kind, i.rule.kind])).toEqual([
      ['signature', 'custom', 'window'],
      ['lookup', 'set-machine', 'window'],
      ['set-plugs', 'set-machine', 'once'],
      ['lookup-transfer', 'set-machine', 'once'],
      ['rejewski-parsons', 'order', 'once'],
    ])
    expect(GATES.catalogue!.fallback.id).toBe('lookup')
    expect(GATES.catalogue!.items.every((i) => i.kind !== 'code')).toBe(true)
  })

  it('MODAL CONSTANT BOT: the answer that is right most often, typed every time, passes < 1% (the gate, and signature alone)', () => {
    const logic = GATES.catalogue!
    const answers = new Map([...logic.items, logic.fallback].map((l) => [l.id, bestConstant(l, l.kind === 'set-machine' ? 100 : SEARCH_SEEDS)]))
    for (const [id, b] of answers) if (id !== 'rejewski-parsons') expect(b.rate, `${id}: best constant hit rate`).toBeLessThan(0.05)
    const constant = (_i: unknown, l: ItemLogic) => answers.get(l.id)!.answer
    expect(naivePasses(logic, constant, 300)).toBeLessThan(3)
    expect(naivePasses({ items: [signature as ItemLogic], fallback: signature as ItemLogic }, constant, 300)).toBeLessThan(3)
  })

  it('every order of the catalogue appears among the lookup days', () => {
    const orders = new Set<string>()
    for (let s = 0; s < 200; s++) orders.add(lookup.solve(gen(lookup, s) as LookupInstance).rotors.join('-'))
    expect(orders.size).toBe(CATALOGUE_ORDERS.length)
  })
})
