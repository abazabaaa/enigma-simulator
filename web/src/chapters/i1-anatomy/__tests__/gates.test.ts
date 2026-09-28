/**
 * Chapter i1-anatomy: generator and check tests (PLAN §6.8 brief 09). The shared lints (validate, L1 lint, guess
 * bot, CC learner, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import type { GateRecord, GenCtx, ItemLogic } from '../../../contracts/lesson'
import type { ToySpec } from '../../../contracts/machine'
import { LETTERS, createMachine, encodeLetter, validateConfig, type Letter } from '../../../engine'
import { createRng, seedFor } from '../../../lib/rng'
import { toyPress } from '../../../lib/toy'
import {
  EMPTY_GATE,
  currentItem,
  ensureCurrent,
  revealCurrent,
  shownInstance,
  submitAnswer,
  type GateCtx,
} from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import chapter from '../index'
import {
  CHAIN_KEY,
  GATES,
  MACHINE,
  PATH_I,
  PATH_M4,
  READ_ONLY,
  STAGES,
  TOY_ONE,
  TOY_TRACE_KEY,
  TOY_TWO,
  TOY_WIRE_KEY,
  explainToyLamp,
  hopChain,
  naiveChains,
  naiveLamps,
  pathBlocks,
  pathOrder,
  pathOrderM4,
  reflectorHop,
  strips,
  toyLamp,
  toySet,
  toySetSolutions,
  toyStagePerms,
  traceOf,
  type ChainInstance,
  type OrderInstance,
  type ToyLampInstance,
  type ToySetInstance,
} from '../gates'

const idx = (l: string) => LETTERS.indexOf(l as Letter)
const ctx = (id: string, attempt: number): GenCtx => ({
  key: `i1-anatomy/anatomy/${id}`,
  attempt,
  purpose: 'instance',
  previous: [],
})
const gen = <I>(l: ItemLogic<I, unknown>, s: number): I =>
  l.generate(createRng(seedFor('i1-test', l.id, s)), ctx(l.id, (s % 4) + 1))
const SEEDS = 300

/** The letter a toy press gives when the learner makes one slip at hop d and reads every other hop right. */
function slipLamp(spec: ToySpec, key: Letter, d: number, slip: (perm: readonly number[], x: number) => number): number {
  const perms = toyStagePerms(spec)
  let x = idx(key)
  perms.forEach((p, k) => (x = k === d ? slip(p, x) : p[x]!))
  return x
}

describe('the chapter machines: held, no cables, rings 01 (G14)', () => {
  it('the toys never step and have no cables', () => {
    for (const spec of [TOY_ONE, TOY_TWO]) {
      expect(spec.stepping).toBe(false)
      expect(spec.plugs).toEqual([0, 1, 2, 3, 4, 5])
      // A fixed-point-free involution.
      expect(spec.reflector.every((b, a) => b !== a && spec.reflector[b] === a)).toBe(true)
    }
    expect(TOY_ONE.rotors).toHaveLength(1)
    expect(TOY_TWO.rotors).toHaveLength(2)
  })

  it('the scenes’ bets have constant truths: C lights B on the one-rotor toy; A reaches the reflector as E', () => {
    expect(toyPress(TOY_ONE, TOY_WIRE_KEY).lamp).toBe('B')
    const press = toyPress(TOY_TWO, TOY_TRACE_KEY)
    expect(press.hops[reflectorHop(press.hops)]!.input).toBe('E')
    expect(press.hops.map((h) => h.output).join('')).toBe('AFEBADD')
  })

  it('the full machine: rings AAA, no cables, valid; K is changed seven times in eleven stages', () => {
    expect(validateConfig(MACHINE)).toEqual([])
    expect(MACHINE.rings).toEqual(['A', 'A', 'A'])
    expect(MACHINE.plugboard).toEqual([])
    const chain = traceOf(MACHINE, CHAIN_KEY)
    expect(chain.map((h) => h.stage)).toEqual(STAGES)
    expect(chain.filter((h) => h.input !== h.output)).toHaveLength(7)
    expect(chain.filter((h) => h.kind === 'plugboard' || h.kind === 'etw').every((h) => h.input === h.output)).toBe(
      true,
    )
  })

  it('every scene and item setup holds the rotors; the gate scene locks the keyboard and hides the lamps', () => {
    for (const s of chapter.scenes) if (s.setup?.locks) expect(s.setup.locks.hold, s.id).toBe(true)
    expect(chapter.scenes.at(-1)!.setup!.locks).toMatchObject({ keyboard: true, lampsHidden: true, hold: true })
    for (const item of [toyLamp, hopChain, toySet] as ItemLogic[]) {
      for (let s = 0; s < 30; s++) expect(item.setup!(gen(item, s)).locks).toEqual(READ_ONLY)
    }
  })
})

describe('toy-lamp', () => {
  it('instances: a held two-rotor toy on A–F with no cables, and a key on the toy', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(toyLamp, s) as ToyLampInstance
      expect(i.spec).toMatchObject({ n: 6, stepping: false, plugs: [0, 1, 2, 3, 4, 5] })
      expect(i.spec.rotors).toHaveLength(2)
      expect(idx(i.key)).toBeLessThan(6)
      expect(toyLamp.solve(i)).toBe(toyPress(i.spec, i.key).lamp)
    }
  })

  it('the backward ghost is correct against toyPress: the reference up to divergeAt, then the true wiring to the learner’s lamp', () => {
    let checked = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(toyLamp, s) as ToyLampInstance
      const reference = toyPress(i.spec, i.key).hops
      const perms = toyStagePerms(i.spec)
      for (const lamp of LETTERS.slice(0, 6)) {
        if (lamp === reference.at(-1)!.output) continue
        const res = toyLamp.check(i, lamp)
        expect(res.correct).toBe(false)
        expect(res.rollback.kind).toBe('path')
        const { ghost } = res.rollback as { kind: 'path'; ghost: { hops: typeof reference; divergeAt: number } }
        const d = ghost.divergeAt
        // Before d the ghost IS the reference; at d it starts on the reference's letter and leaves it.
        expect(ghost.hops.slice(0, d)).toEqual(reference.slice(0, d))
        expect(ghost.hops[d]!.inputIndex).toBe(reference[d]!.inputIndex)
        expect(ghost.hops[d]!.outputIndex).not.toBe(reference[d]!.outputIndex)
        // After d every hop is the true component, and the path is continuous to the learner's lamp.
        for (let k = d + 1; k < ghost.hops.length; k++) {
          expect(ghost.hops[k]!.inputIndex).toBe(ghost.hops[k - 1]!.outputIndex)
          expect(perms[k]![ghost.hops[k]!.inputIndex]).toBe(ghost.hops[k]!.outputIndex)
          expect(ghost.hops[k]!.stage).toBe(reference[k]!.stage)
        }
        expect(ghost.hops.at(-1)!.output).toBe(lamp)
        // The part where it leaves the reference is never a pass-through (the empty plugboard).
        expect(ghost.hops[d]!.kind).not.toBe('plugboard')
        expect(res.feedback).toContain(`Lamp ${lamp}`)
        checked++
      }
    }
    expect(checked).toBe(SEEDS * 5)
  })

  it('a single slip is found where it happened: a skipped part, or a table read the wrong way', () => {
    let skips = 0
    let exact = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(toyLamp, s) as ToyLampInstance
      const reference = toyPress(i.spec, i.key).hops
      const lamp = idx(reference.at(-1)!.output)
      for (let d = 1; d < reference.length - 1; d++) {
        // Skip hop d (the letter passes it unchanged).
        const w = slipLamp(i.spec, i.key, d, (_p, x) => x)
        if (w === lamp) continue
        const e = explainToyLamp(i.spec, i.key, LETTERS[w]!)
        expect(e.slip, `seed ${s} hop ${d}`).toBe('skip')
        expect(e.ghost.divergeAt).toBeLessThanOrEqual(d)
        expect(e.needed[e.ghost.divergeAt]).toBe(reference[e.ghost.divergeAt]!.inputIndex)
        if (e.ghost.divergeAt === d) exact++
        skips++
      }
    }
    expect(skips).toBeGreaterThan(SEEDS * 3)
    // Most slips are placed exactly (an earlier hop explains the lamp as well only by coincidence).
    expect(exact / skips).toBeGreaterThan(0.6)
  })

  it('L1 highlights the part where the ghost left the reference, else the reflector', () => {
    const i = gen(toyLamp, 7) as ToyLampInstance
    expect(toyLamp.highlight(i, null)).toEqual([{ part: 'reflector', tone: 'hint' }])
    const lamp = toyPress(i.spec, i.key).lamp
    const wrong = LETTERS.slice(0, 6).find((l) => l !== lamp)!
    const e = explainToyLamp(i.spec, i.key, wrong)
    const part = e.ghost.hops[e.ghost.divergeAt]!.stage
    expect(toyLamp.highlight(i, wrong)[0]!.part).toBe(
      part === 'reflector' ? 'reflector' : `rotor-${part.split('-')[1]}`,
    )
  })
})

describe('hop-chain', () => {
  it('has exactly 11 stages; the plugboard stages (no cables) and the entry wheel are identity', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(hopChain, s) as ChainInstance
      expect(i.stages.map((x) => x.id)).toEqual(STAGES)
      expect(i.stages).toHaveLength(11)
      expect(validateConfig(i.config)).toEqual([])
      expect(i.config.rings).toEqual(['A', 'A', 'A'])
      expect(i.config.plugboard).toEqual([])
      expect(new Set(i.config.rotors).size).toBe(3)
      expect(i.config.rotors.every((r) => ['I', 'II', 'III', 'IV', 'V'].includes(r))).toBe(true)
      const trace = encodeLetter(createMachine(i.config), i.key).trace
      for (const h of trace.filter((x) => x.kind === 'plugboard' || x.kind === 'etw')) expect(h.output).toBe(h.input)
      expect(hopChain.solve(i)).toEqual(trace.map((h) => h.output))
    }
  })

  it('the strips shown are the tables each hop reads (forward down, backward up)', () => {
    for (let s = 0; s < 50; s++) {
      const i = gen(hopChain, s) as ChainInstance
      const tables = Object.fromEntries(strips(i.config).map((x) => [x.part, x.perm]))
      for (const h of traceOf(i.config, i.key)) {
        const part = h.kind === 'rotor' ? `rotor-${h.stage.split('-')[1]}` : h.kind
        const t = tables[part]!
        if (h.stage.endsWith('-bwd')) expect(t[h.outputIndex]).toBe(h.inputIndex)
        else expect(t[h.inputIndex]).toBe(h.outputIndex)
      }
    }
  })

  it('a wrong chain splits from the reference at the first wrong hop; L1 names that hop’s part', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(hopChain, s) as ChainInstance
      const good = hopChain.solve(i) as string[]
      const k = 2 + (s % 9)
      const bad = good.map((t, j) => (j === k ? LETTERS[(idx(t) + 1) % 26]! : t))
      const res = hopChain.check(i, bad)
      expect(res.correct).toBe(false)
      expect(res.rollback).toMatchObject({ kind: 'path', ghost: { divergeAt: k } })
      const stage = STAGES[k]!
      const part = stage.startsWith('rotor')
        ? `rotor-${stage.split('-')[1]}`
        : stage.startsWith('etw')
          ? 'etw'
          : stage.startsWith('plug')
            ? 'plugboard'
            : 'reflector'
      expect(hopChain.highlight(i, bad)).toEqual([{ part, tone: 'hint' }])
      expect(
        hopChain.check(
          i,
          good.map((t) => t.toLowerCase()),
        ).correct,
      ).toBe(true)
    }
  })
})

describe('path-order and path-order-m4', () => {
  it('have 11 and 13 blocks, one per crossing; only the Greek rotor and the thin reflector are new on the M4', () => {
    expect(pathBlocks(PATH_I)).toHaveLength(11)
    expect(pathBlocks(PATH_M4)).toHaveLength(13)
    const i = gen(pathOrderM4, 3) as OrderInstance
    expect(i.blocks).toHaveLength(13)
    expect(i.blocks.filter((b) => b.id.startsWith('greek'))).toHaveLength(2)
    expect((gen(pathOrder, 3) as OrderInstance).blocks).toHaveLength(11)
    expect(pathOrder).toMatchObject({ rule: { kind: 'once' }, constantAnswer: true })
    expect(pathOrderM4).toMatchObject({ rule: { kind: 'once' }, transfer: true, constantAnswer: true })
  })

  it('never shows the blocks already in order; blocks of one part are interchangeable', () => {
    for (const item of [pathOrder, pathOrderM4]) {
      for (let s = 0; s < SEEDS; s++) {
        const i = gen(item, s) as OrderInstance
        expect(
          item.check(
            i,
            i.blocks.map((b) => b.id),
          ).correct,
        ).toBe(false)
      }
      const i = gen(item, 1) as OrderInstance
      const good = item.solve(i) as string[]
      expect(item.check(i, good).correct).toBe(true)
      // The two plugboard blocks swapped: the same order of parts.
      const swapped = good.map((id) =>
        id === 'plugboard-1' ? 'plugboard-2' : id === 'plugboard-2' ? 'plugboard-1' : id,
      )
      expect(item.check(i, swapped).correct).toBe(true)
      // The reflector moved one place: wrong, and the rollback marks the first misplaced part.
      const moved = [...good]
      const r = moved.indexOf('reflector')
      ;[moved[r - 1], moved[r]] = [moved[r]!, moved[r - 1]!]
      expect(item.check(i, moved).rollback).toEqual({ kind: 'order', firstWrong: r - 1 })
      // A block twice, or an unknown block, is wrong.
      expect(item.check(i, [...good.slice(0, -1), good[0]!]).correct).toBe(false)
      expect(
        item.check(
          i,
          good.map((x) => (x === 'etw-1' ? 'etw-3' : x)),
        ).correct,
      ).toBe(false)
    }
  })

  it('shows no stage while the blocks are on screen (the stage would give the order away)', () => {
    expect(pathOrder.setup!(gen(pathOrder, 0))).toEqual({ stage: null })
    expect(pathOrderM4.setup!(gen(pathOrderM4, 0))).toEqual({ stage: null })
  })
})

describe('toy-set (the fallback)', () => {
  it('a solution exists for all 300 seeds, and the start is not one', () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(toySet, s) as ToySetInstance
      expect(i).toMatchObject({ key: 'C', target: 'E' })
      expect(i.spec).toMatchObject({ n: 6, stepping: false, plugs: [0, 1, 2, 3, 4, 5] })
      const solutions = toySetSolutions(i.spec, i.key, i.target)
      expect(solutions.length, `seed ${s}`).toBeGreaterThan(0)
      expect(toySet.check(i, [...i.spec.positions]).correct).toBe(false)
      for (const p of solutions) {
        expect(toyPress({ ...i.spec, positions: p }, i.key).lamp).toBe(i.target)
        expect(toySet.check(i, p).correct).toBe(true)
      }
    }
  })

  it('a wrong setting says what it lights, on the rotors; malformed answers are wrong', () => {
    const i = gen(toySet, 4) as ToySetInstance
    const bad = toySet.mutate(i, toySet.solve(i), createRng(1))
    const res = toySet.check(i, bad)
    expect(res.correct).toBe(false)
    expect(res.rollback).toMatchObject({
      kind: 'machine',
      field: 'positions',
      highlight: ['rotor-middle', 'rotor-right'],
    })
    expect((res.rollback as { message: string }).message).toMatch(/^At windows [A-F]{2}, C lights [A-F], not E\.$/)
    for (const a of [null, [], [1], [0, 6], [0, -1], ['a', 'b'], [0.5, 1]])
      expect(toySet.check(i, a as never).correct).toBe(false)
  })

  it('is the gate’s in-page fallback; the gate holds its four items in order', () => {
    const g = GATES.anatomy!
    expect(g.items.map((x) => x.id)).toEqual(['toy-lamp', 'hop-chain', 'path-order', 'path-order-m4'])
    expect(g.items.map((x) => x.rule.kind)).toEqual(['window', 'window', 'once', 'once'])
    expect(g.fallback).toMatchObject({ id: 'toy-set', kind: 'custom', inPage: true })
  })
})

// ---------------------------------------------------------------------------
// The misconception bot: a learner with one of the misconceptions, through the real gate engine
// ---------------------------------------------------------------------------

/**
 * Run gate `anatomy` answering the current item with `answer` until it passes or `maxAttempts` answers have been
 * given (the ladder's L3 is revealed, as the guess bot does). Fallback instances (after a gaming signal) are
 * answered with the toy-set's start setting, the "turn nothing" strategy. Returns whether `itemId` passed.
 */
function misconceptionBotPasses(
  itemId: string,
  answer: (instance: unknown) => unknown,
  run: number,
  maxAttempts = 12,
): boolean {
  const ctx: GateCtx = { key: 'i1-anatomy/anatomy', logic: GATES.anatomy!, salt: `misconception:${itemId}:${run}` }
  let rec: GateRecord = EMPTY_GATE
  let now = 1
  for (;;) {
    rec = ensureCurrent(ctx, rec, now)
    const item = currentItem(ctx.logic, rec)
    if (!item || item.id !== itemId) return rec.items[itemId]?.passed ?? false
    const it = rec.items[item.id]!
    if (it.attempt > maxAttempts) return false
    now += 10_000
    if (hintLevel(it, false) === 3) {
      rec = revealCurrent(ctx, rec, item.id, now).gate
      continue
    }
    const shown = shownInstance(ctx, item, it)
    const a = shown.fallback ? [...(shown.instance as ToySetInstance).spec.positions] : answer(shown.instance)
    rec = submitAnswer(ctx, rec, item.id, JSON.parse(JSON.stringify(a)), now).gate
  }
}

describe('the misconception bot never passes (300 runs per misconception)', () => {
  const MISCONCEPTIONS_LAMP = [
    'stops before the reflector',
    'stops after the reflector',
    'reads the tables downwards on the way back',
    'the reflector does not swap',
    'reads every table the wrong way',
    'forgets the middle rotor',
    'forgets the right rotor',
  ]

  it('toy-lamp: every instance needs the whole round trip (no misconception gives the lamp)', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const attempt of [1, 2, 3, 4]) {
        const i = toyLamp.generate(createRng(seedFor('naive', s, attempt)), ctx('toy-lamp', attempt)) as ToyLampInstance
        const naive = naiveLamps(i.spec, i.key)
        expect(naive).toHaveLength(MISCONCEPTIONS_LAMP.length)
        for (const [k, lamp] of naive.entries())
          expect(toyLamp.check(i, lamp).correct, `${MISCONCEPTIONS_LAMP[k]} (seed ${s})`).toBe(false)
      }
    }
  })

  it.each(MISCONCEPTIONS_LAMP.map((m, k) => [m, k] as const))('toy-lamp: a learner who %s never passes', (_m, k) => {
    for (let run = 0; run < SEEDS; run++) {
      expect(
        misconceptionBotPasses(
          'toy-lamp',
          (i) => naiveLamps((i as ToyLampInstance).spec, (i as ToyLampInstance).key)[k],
          run,
        ),
      ).toBe(false)
    }
  })

  it('the naive lamps are what the misconceptions give (checked on the one-rotor-each-way path by hand)', () => {
    // TOY_TWO, key A: A → right F → middle E → reflector B → middle back A → right back D.
    const naive = naiveLamps(TOY_TWO, 'A')
    expect(naive[0]).toBe('E') // stops before the reflector
    expect(naive[1]).toBe('B') // stops after it
    expect(naive[3]).toBe(toyPress({ ...TOY_TWO, reflector: [0, 1, 2, 3, 4, 5] }, 'A').lamp) // no swap
  })

  const MISCONCEPTIONS_CHAIN = [
    'reads the strips downwards on the way back',
    'crosses the rotors left to right on the way in',
  ]

  it.each(MISCONCEPTIONS_CHAIN.map((m, k) => [m, k] as const))('hop-chain: a learner who %s never passes', (_m, k) => {
    // Reach hop-chain first: toy-lamp answered right.
    for (let run = 0; run < SEEDS; run++) {
      const ctxG: GateCtx = {
        key: 'i1-anatomy/anatomy',
        logic: GATES.anatomy!,
        salt: `misconception-chain:${k}:${run}`,
      }
      let rec: GateRecord = EMPTY_GATE
      let now = 1
      let passed = false
      for (let step = 0; step < 40; step++) {
        rec = ensureCurrent(ctxG, rec, now)
        const item = currentItem(ctxG.logic, rec)
        if (!item) break
        if (item.id !== 'toy-lamp' && item.id !== 'hop-chain') break
        const it = rec.items[item.id]!
        if (item.id === 'hop-chain' && it.attempt > 12) break
        now += 10_000
        if (hintLevel(it, false) === 3) {
          rec = revealCurrent(ctxG, rec, item.id, now).gate
          continue
        }
        const shown = shownInstance(ctxG, item, it)
        const a = shown.fallback
          ? [...(shown.instance as ToySetInstance).spec.positions]
          : item.id === 'toy-lamp'
            ? toyLamp.solve(shown.instance as ToyLampInstance)
            : naiveChains((shown.instance as ChainInstance).config, (shown.instance as ChainInstance).key)[k]
        rec = submitAnswer(ctxG, rec, item.id, JSON.parse(JSON.stringify(a)), now).gate
        passed = rec.items['hop-chain']?.passed ?? false
      }
      expect(rec.items['toy-lamp']?.passed, `run ${run}`).toBe(true)
      expect(passed, `run ${run}`).toBe(false)
    }
  })
})
