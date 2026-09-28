/**
 * Chapter i3-reflector-plugboard: generator and check tests (PLAN §6.9 brief 10). The shared lints (validate, L1
 * lint, guess bot, CC learner, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import type { CodeAnswer } from '../../../contracts/code'
import type { GenCtx, ItemLogic } from '../../../contracts/lesson'
import { countLines } from '../../../code/runner'
import { executeRequest } from '../../../code/runnerCore'
import { summarizeRun } from '../../../code/summary'
import { LETTERS, ROTORS, compose, createMachine, fixedPoints, isInvolution, pressKey, validateConfig, type MachineConfig } from '../../../engine'
import { codeTaskOf } from '../../../lesson/kinds'
import { createRng, sample, seedFor } from '../../../lib/rng'
import {
  COMPOSE_REFERENCE,
  DEMO_CABLES,
  DEMO_KEY,
  GATES,
  PLUG_START,
  RECIPROCITY_START,
  SEARCH_START,
  SELF_OPTIONS,
  START,
  composeCases,
  composeInverse,
  composeProbe,
  lampFor,
  plugOne,
  plugToHit,
  reflectorPairs,
  scrambler,
  selfHits,
  whyNoSelf,
  type ComposeInstance,
  type PlugInstance,
} from '../gates'

const ctx = (id: string, attempt: number): GenCtx => ({ key: `i3-reflector-plugboard/reflector/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number): I => l.generate(createRng(seedFor('i3-test', l.id, s)), ctx(l.id, (s % 4) + 1))
const idx = (l: string) => LETTERS.indexOf(l as (typeof LETTERS)[number])
const SEEDS = 300

/** Run learner code against an instance's cases, as the CodeItem does (in Node, without a worker). */
function runCases(source: string, i: ComposeInstance) {
  const task = codeTaskOf(composeInverse as ItemLogic)!
  const cases = task.cases(i)
  const res = executeRequest({
    id: 1,
    source,
    provided: task.provided,
    fnNames: task.fnNames,
    calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
    timeoutMs: 1500,
  })
  return summarizeRun(cases, res, i.seed)
}

describe('the chapter machines', () => {
  it('the reflector B is 13 wires joining all 26 contacts in pairs', () => {
    const pairs = reflectorPairs('B')
    expect(pairs).toHaveLength(13)
    expect(new Set(pairs.join('')).size).toBe(26)
    expect(pairs[0]).toBe('AY')
  })

  it('pressing A with the demo cables crosses a cable on the way in and another on the way out', () => {
    expect(DEMO_CABLES).toHaveLength(2)
    const r = pressKey(createMachine(PLUG_START), DEMO_KEY)
    const first = r.trace[0]!
    const last = r.trace.at(-1)!
    expect(first.kind === 'plugboard' && first.plugged).toBe(true)
    expect(last.kind === 'plugboard' && last.plugged).toBe(true)
    // Without the cables the same key lights another lamp.
    expect(pressKey(createMachine(START), DEMO_KEY).output).not.toBe(r.output)
  })

  it('every scene machine validates; the self-search scene has cables and rings', () => {
    for (const c of [START, PLUG_START, RECIPROCITY_START, SEARCH_START]) expect(validateConfig(c)).toEqual([])
    expect(SEARCH_START.plugboard.length).toBe(3)
    expect(SEARCH_START.rings.join('')).not.toBe('AAA')
  })

  it('reciprocity: at any position, if K lights X then X lights K (random configurations)', () => {
    const r = createRng(7)
    for (let n = 0; n < 50; n++) {
      const c = { ...RECIPROCITY_START, positions: sample(r, LETTERS, 3) }
      for (const k of LETTERS) {
        const x = pressKey(createMachine(c), k).output
        expect(pressKey(createMachine(c), x).output).toBe(k)
      }
    }
  })

  it('the self-search finds no position where A lights A (all 17,576)', () => {
    expect(selfHits(SEARCH_START, 0, 17_576)).toBe(0)
    expect(selfHits(START, 0, 17_576, 'Q')).toBe(0)
  })
})

describe('plug-to-hit and plug-one', () => {
  it.each([
    ['plug-to-hit', plugToHit, 2],
    ['plug-one', plugOne, 1],
  ] as const)('%s: a solution with at most %s cables exists for every seed (300)', (_id, item, max) => {
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(item, s) as PlugInstance
      expect(i.maxPlugs).toBe(max)
      const m = i.setup.machine
      expect(validateConfig(m)).toEqual([])
      expect(m.plugboard).toEqual([])
      expect(m.rotors.every((x) => ['I', 'II', 'III', 'IV', 'V'].includes(x))).toBe(true)
      expect(i.k).not.toBe(i.t)
      // The unplugged scrambler does not already send K to T.
      expect(lampFor(m, i.k)).not.toBe(i.t)
      const solution = item.solve(i) as MachineConfig
      expect(solution.plugboard.length).toBeLessThanOrEqual(max)
      expect(lampFor(solution, i.k)).toBe(i.t)
      expect(item.check(i, solution).correct).toBe(true)
    }
  })

  it('E₀ (the scrambler after the step) is a fixed-point-free involution, and the prompt table is its next press', () => {
    for (let s = 0; s < 50; s++) {
      const i = gen(plugToHit, s) as PlugInstance
      const e0 = scrambler(i.setup.machine)
      expect(isInvolution(e0)).toBe(true)
      expect(fixedPoints(e0)).toEqual([])
      expect(LETTERS[e0[idx(i.k)]!]).toBe(lampFor(i.setup.machine, i.k))
    }
  })

  it('the predicate agrees with the engine for random sets of 0–2 cables', () => {
    const r = createRng(11)
    let right = 0
    for (let s = 0; s < 200; s++) {
      const i = gen(plugToHit, s) as PlugInstance
      const cfgs = [plugToHit.sampleAnswer(i, r), plugToHit.solve(i)] as MachineConfig[]
      for (const cfg of cfgs) {
        const truth = pressKey(createMachine(cfg), i.k).output === i.t
        const res = plugToHit.check(i, cfg)
        expect(res.correct).toBe(truth)
        if (!res.correct) expect(res.rollback.kind).toBe('machine')
        if (truth) right++
      }
    }
    expect(right).toBeGreaterThanOrEqual(200)
  })

  it('refuses more cables than allowed, and any change outside the plugboard', () => {
    const i = gen(plugOne, 3) as PlugInstance
    const solution = plugOne.solve(i) as MachineConfig
    const used = solution.plugboard.join('')
    const free = LETTERS.filter((l) => !used.includes(l))
    const two = { ...solution, plugboard: [...solution.plugboard, free[0]! + free[1]!] }
    expect(plugOne.check(i, two)).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'plugboard' } })
    const turned = { ...solution, positions: ['A', 'A', solution.positions[2] === 'A' ? 'B' : 'A'] } as MachineConfig
    expect(plugOne.check(i, turned).correct).toBe(false)
  })

  it('shows the plugboard stage, unlocks only the plugboard, locks the keyboard and hides the lamps', () => {
    const i = gen(plugToHit, 0) as PlugInstance
    const setup = plugToHit.setup!(i)
    expect(setup.stage).toBe('plugboard')
    expect(setup.locks).toMatchObject({ plugboard: false, positions: true, rings: true, keyboard: true, lampsHidden: true })
    expect(plugToHit.highlight(i, null)).toEqual([{ part: 'plugboard', tone: 'hint' }])
  })
})

describe('why-no-self', () => {
  it('is shuffled, once, constant, and every distractor explains itself (rollback none)', () => {
    const orders = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(whyNoSelf, s) as { options: typeof SELF_OPTIONS }
      orders.add(i.options.map((o) => o.id).join())
      expect(i.options).toHaveLength(4)
      expect(i.options.find((o) => o.id === 'plugboard')).toMatchObject({ misconception: true })
      expect(whyNoSelf.check(i, 'reflector').correct).toBe(true)
      for (const o of i.options.filter((x) => x.id !== 'reflector')) {
        const res = whyNoSelf.check(i, o.id)
        expect(res).toMatchObject({ correct: false, rollback: { kind: 'none' } })
        expect(res.feedback).toBeTruthy()
      }
    }
    expect(orders.size).toBeGreaterThan(10)
    expect(whyNoSelf).toMatchObject({ rule: { kind: 'once' }, constantAnswer: true, kind: 'choice' })
  })
})

describe('compose-inverse', () => {
  const task = codeTaskOf(composeInverse as ItemLogic)!

  it('the reference passes every case of every instance (50 seeds), within 8 lines per function', () => {
    expect(countLines(COMPOSE_REFERENCE, 'compose')).toBeLessThanOrEqual(8)
    expect(countLines(COMPOSE_REFERENCE, 'inverse')).toBeLessThanOrEqual(8)
    for (let s = 0; s < 50; s++) {
      const i = gen(composeInverse, s) as ComposeInstance
      const run = runCases(COMPOSE_REFERENCE, i)
      expect(run, `seed ${s}`).toMatchObject({ status: 'pass', passed: run.total, instanceSeed: i.seed })
      expect(run.total).toBeGreaterThanOrEqual(50)
      expect(composeInverse.check(i, { probe: composeProbe(i), run }).correct).toBe(true)
    }
  })

  it('the cases cover the identity, random n = 6 and n = 26, the reflector as an involution and fixed-point-free involutions', () => {
    const cases = composeCases(gen(composeInverse, 1) as ComposeInstance)
    const labels = cases.map((c) => c.label).join('\n')
    for (const want of ['identity', 'on 6 letters', 'on 26 letters', 'compose(inverse(p), p)', 'reflector B', 'fixed-point-free', 'unplugged']) {
      expect(labels).toContain(want)
    }
    expect(cases.filter((c) => c.label.startsWith('random')).length).toBe(40)
    // The seed changes the hidden cases.
    const other = composeCases({ ...(gen(composeInverse, 1) as ComposeInstance), seed: 12345 })
    expect(JSON.stringify(other.slice(3))).not.toBe(JSON.stringify(cases.slice(3)))
  })

  it.each([
    ['q first', 'function compose(p, q) {\n  return q.map((x) => p[x])\n}\nfunction inverse(p) {\n  const out = []\n  p.forEach((x, i) => (out[x] = i))\n  return out\n}\n'],
    ['inverse returns p', 'function compose(p, q) {\n  return p.map((x) => q[x])\n}\nfunction inverse(p) {\n  return [...p]\n}\n'],
    ['inverse off by one', 'function compose(p, q) {\n  return p.map((x) => q[x])\n}\nfunction inverse(p) {\n  return p.map((x) => (x + 1) % p.length)\n}\n'],
    ['no inverse', 'function compose(p, q) {\n  return p.map((x) => q[x])\n}\n'],
  ])('wrong code fails the hidden cases: %s', (_label, source) => {
    const i = gen(composeInverse, 5) as ComposeInstance
    const run = runCases(source, i)
    expect(run.status === 'pass' && run.passed === run.total).toBe(false)
    expect(composeInverse.check(i, { probe: composeProbe(i), run }).correct).toBe(false)
  })

  it('the prediction varies with the instance and separates p-first from its misreadings', () => {
    const probes = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(composeInverse, s) as ComposeInstance
      const want = composeProbe(i)
      expect('ABCDEF').toContain(want)
      expect(task.probe(i)).toEqual({ call: 'compose(p, q)(D)', expected: want })
      const p = [...i.p].map(idx)
      const q = [...i.q].map(idx)
      expect(LETTERS[compose(p, q)[3]!]).toBe(want)
      for (const misread of [p[q[3]!]!, p[3]!, q[3]!, 3]) expect(LETTERS[misread]).not.toBe(want)
      probes.add(`${i.p}${i.q}`)
    }
    expect(probes.size).toBeGreaterThan(90)
  })

  it('the rule: the reference with a wrong prediction is wrong; a failing run with the right prediction is wrong', () => {
    const i = gen(composeInverse, 9) as ComposeInstance
    const run = runCases(COMPOSE_REFERENCE, i)
    const want = composeProbe(i)
    const wrongProbe = LETTERS[(idx(want) + 1) % 6]!
    expect(composeInverse.check(i, { probe: wrongProbe, run } as CodeAnswer)).toMatchObject({ correct: false, rollback: { kind: 'none' } })
    const bad = runCases('function compose(p, q) {\n  return q.map((x) => p[x])\n}\nfunction inverse(p) {\n  return p\n}\n', i)
    const res = composeInverse.check(i, { probe: want, run: bad })
    expect(res).toMatchObject({ correct: false, rollback: { kind: 'none' } })
    expect(res.feedback).toMatch(/expected/)
  })
})

describe('gate reflector', () => {
  it('holds plug-to-hit, why-no-self and compose-inverse in order, with the plug-one fallback (in page)', () => {
    const g = GATES.reflector!
    expect(g.items.map((i) => i.id)).toEqual(['plug-to-hit', 'why-no-self', 'compose-inverse'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'once', 'window'])
    expect(g.items.map((i) => i.kind)).toEqual(['set-machine', 'choice', 'code'])
    expect(g.fallback).toMatchObject({ id: 'plug-one', kind: 'set-machine', inPage: true })
  })

  it('every generated machine uses rotors I–V (the Enigma I of Act I)', () => {
    for (let s = 0; s < 50; s++) {
      const m = (gen(plugToHit, s) as PlugInstance).setup.machine
      expect(m.rotors.every((r) => ROTORS[r] && !['VI', 'VII', 'VIII'].includes(r))).toBe(true)
      expect(m.model).toBe('I')
    }
  })
})
