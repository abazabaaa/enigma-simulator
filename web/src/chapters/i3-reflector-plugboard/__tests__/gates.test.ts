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
  SELF_DISTRACTORS,
  START,
  composeCases,
  composeInverse,
  composeProbe,
  handsOn,
  lampFor,
  selfPositions,
  selfWired,
  plugOne,
  plugToHit,
  reflectorPairs,
  scrambler,
  selfHits,
  wayOutCable,
  whyNoSelf,
  type ComposeInstance,
  type HandsOnInstance,
  type PlugInstance,
  type SelfInstance,
} from '../gates'
import type { GateRecord } from '../../../contracts/lesson'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'
import { passingRun } from '../../../lesson/kinds'

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
      expect(solution.plugboard.join('')).not.toContain(i.k)
      expect(solution.plugboard).toEqual([wayOutCable(i)])
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

  it('every instance needs the way back: the in-only cable K–E₀(T) and the direct cable K–T never pass (300 seeds)', () => {
    for (const item of [plugToHit, plugOne]) {
      for (let s = 0; s < SEEDS; s++) {
        const i = gen(item, s) as PlugInstance
        const e0 = scrambler(i.setup.machine)
        for (const cable of [i.k + LETTERS[e0[idx(i.t)]!], i.k + i.t]) {
          const res = item.check(i, { ...i.setup.machine, plugboard: [cable] })
          expect(res, `seed ${s}: ${cable}`).toMatchObject({ correct: false, rollback: { kind: 'machine', field: 'plugboard' } })
        }
      }
    }
    // A cable on K lights T sometimes (K–E₀(T)), but K's socket must stay empty.
    const i = gen(plugToHit, 1) as PlugInstance
    const inOnly = { ...i.setup.machine, plugboard: [i.k + LETTERS[scrambler(i.setup.machine)[idx(i.t)]!]] }
    expect(lampFor(inOnly, i.k)).toBe(i.t)
    expect(plugToHit.check(i, inOnly).feedback).toMatch(/socket empty/)
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
  it('once, constant answer; the wording, the distractors and the anchoring press vary per instance', () => {
    const labels = new Set<string>()
    const sets = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(whyNoSelf, s) as SelfInstance
      expect(i.options).toHaveLength(4)
      expect(i.options.filter((o) => o.id === 'reflector')).toHaveLength(1)
      expect(i.options.filter((o) => o.misconception)).toHaveLength(3)
      labels.add(i.options.find((o) => o.id === 'reflector')!.label)
      sets.add(i.options.map((o) => o.id).sort().join())
      expect(lampFor({ ...SEARCH_START, positions: i.windows }, i.key)).toBe(i.lamp)
      expect(whyNoSelf.check(i, 'reflector').correct).toBe(true)
    }
    expect(labels.size).toBe(3)
    expect(sets.size).toBeGreaterThan(5)
    expect(whyNoSelf).toMatchObject({ rule: { kind: 'once' }, constantAnswer: true, kind: 'choice' })
  })

  it('a distractor\'s feedback says why it is wrong without naming the right option', () => {
    const i = gen(whyNoSelf, 2) as SelfInstance
    for (const d of SELF_DISTRACTORS) {
      const res = whyNoSelf.check(i, d.id)
      expect(res).toMatchObject({ correct: false, rollback: { kind: 'none' } })
      expect(res.feedback).toBeTruthy()
      expect(res.feedback).not.toMatch(/reflector|pairs|wire/i)
    }
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

describe('hands-on, the in-page fallback', () => {
  const at = (from: string, s: number): HandsOnInstance =>
    handsOn.generate(createRng(seedFor('hands-on', from, s)), {
      key: `i3-reflector-plugboard/reflector/${from}`,
      attempt: 2,
      purpose: 'fallback',
      previous: [],
    })

  it('tests the skill of the item that triggered it', () => {
    for (let s = 0; s < 100; s++) {
      expect(at('plug-to-hit', s).variant).toBe('plug')
      expect(at('compose-inverse', s).variant).toBe('compose')
      expect(at('why-no-self', s).variant).toBe('self')
    }
    expect(handsOn).toMatchObject({ kind: 'custom', inPage: true })
  })

  it('plug: one cable, K kept empty; compose: q-first is wrong; self: exactly one window lights the key itself', () => {
    for (let s = 0; s < SEEDS; s++) {
      const plug = at('plug-to-hit', s) as Extract<HandsOnInstance, { variant: 'plug' }>
      expect(plug.maxPlugs).toBe(1)
      expect(handsOn.check(plug, handsOn.solve(plug)).correct).toBe(true)
      expect(handsOn.setup!(plug).locks).toMatchObject({ keyboard: true, lampsHidden: true, plugboard: false })
      const c = at('compose-inverse', s) as Extract<HandsOnInstance, { variant: 'compose' }>
      const p = [...c.p].map(idx)
      const q = [...c.q].map(idx)
      expect(handsOn.solve(c)).toBe(compose(p, q).map((x) => LETTERS[x]).join(''))
      const qFirst = compose(q, p).map((x) => LETTERS[x]).join('')
      expect(handsOn.check(c, qFirst)).toMatchObject({ correct: false, rollback: { kind: 'perm' } })
      const t = at('why-no-self', s) as Extract<HandsOnInstance, { variant: 'self' }>
      expect(selfWired(t.spec)).toHaveLength(2)
      expect(selfPositions(t)).toHaveLength(1)
      expect(handsOn.check(t, handsOn.solve(t)).correct).toBe(true)
      for (let w = 0; w < 6; w++) if (w !== selfPositions(t)[0]) expect(handsOn.check(t, w).rollback.kind).toBe('machine')
    }
  })
})

// ---------------------------------------------------------------------------
// Misconception bots: a learner right about everything except one idea, answering like the guess bot (10 s per
// answer, the L3 reveal when it comes, at most 6 attempts per item). None ever passes the gate.
// ---------------------------------------------------------------------------

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
type Answerer = (l: ItemLogic, i: unknown) => unknown

function botPasses(answer: Answerer, run: number, stepMs = 10_000): { gate: boolean; items: Record<string, boolean> } {
  const ctx: GateCtx = { key: 'i3-reflector-plugboard/reflector', logic: GATES.reflector!, salt: `misconception:${run}` }
  let rec: GateRecord = EMPTY_GATE
  let now = 1
  for (;;) {
    rec = ensureCurrent(ctx, rec, now)
    const item = currentItem(ctx.logic, rec)
    const passed = Object.fromEntries(Object.entries(rec.items).map(([k, v]) => [k, v.passed]))
    if (!item) return { gate: true, items: passed }
    const it = rec.items[item.id]!
    if (it.attempt > 6) return { gate: false, items: passed }
    now += stepMs
    if (hintLevel(it, false) === 3) rec = revealCurrent(ctx, rec, item.id, now).gate
    else {
      const shown = shownInstance(ctx, item, it)
      rec = submitAnswer(ctx, rec, item.id, clone(answer(shown.logic, shown.instance)), now).gate
    }
  }
}

/** The right answer everywhere, except where `wrong` says otherwise. */
const knowsAllBut =
  (wrong: (l: ItemLogic, i: unknown) => unknown | undefined): Answerer =>
  (l, i) =>
    wrong(l, i) ?? l.solve(i)

const plugOf = (i: unknown): PlugInstance | null => ((i as { unlocked?: unknown }).unlocked ? (i as PlugInstance) : null)
const inOnlyCable = (i: PlugInstance) => ({ ...i.setup.machine, plugboard: [i.k + LETTERS[scrambler(i.setup.machine)[idx(i.t)]!]] })

const BOTS: Record<string, Answerer> = {
  // The current crosses the plugboard only on the way in: join K to the letter E₀ turns into T.
  'plugboard once': knowsAllBut((_l, i) => (plugOf(i) ? inOnlyCable(plugOf(i)!) : undefined)),
  // A cable from K to T makes K light T.
  'cable K to T': knowsAllBut((_l, i) => (plugOf(i) ? { ...plugOf(i)!.setup.machine, plugboard: [plugOf(i)!.k + plugOf(i)!.t] } : undefined)),
  // compose(p, q) applies q first.
  'q first': knowsAllBut((l, i) => {
    const c = i as ComposeInstance & { variant?: string }
    if (l.id === 'compose-inverse') {
      const q = [...c.q].map(idx)
      const p = [...c.p].map(idx)
      return { probe: LETTERS[p[q[3]!]!], run: passingRun(composeCases(c).length, c.seed) }
    }
    if (c.variant === 'compose') return compose([...c.q].map(idx), [...c.p].map(idx)).map((x) => LETTERS[x]).join('')
    return undefined
  }),
  // The plugboard is what stops a letter lighting itself.
  'the plugboard prevents it': knowsAllBut((l) => (l.id === 'why-no-self' ? 'plugboard' : undefined)),
}

describe('misconception bots: none passes gate reflector (300 runs each)', () => {
  it.each(Object.entries(BOTS))('%s', (_name, bot) => {
    for (let run = 0; run < SEEDS; run++) expect(botPasses(bot, run).gate, `run ${run}`).toBe(false)
  })

  it('answering fast (so every other instance is the fallback) does not help: the fallback tests the same idea', () => {
    for (const name of ['plugboard once', 'cable K to T', 'q first']) {
      for (let run = 0; run < 100; run++) expect(botPasses(BOTS[name]!, run, 500).gate, `${name} run ${run}`).toBe(false)
    }
  })

  it('the right learner passes (the bots are fair)', () => {
    expect(botPasses((l, i) => l.solve(i), 0).gate).toBe(true)
  })
})

describe('gate reflector', () => {
  it('holds plug-to-hit, why-no-self and compose-inverse in order, with the hands-on fallback (in page, custom)', () => {
    const g = GATES.reflector!
    expect(g.items.map((i) => i.id)).toEqual(['plug-to-hit', 'why-no-self', 'compose-inverse'])
    expect(g.items.map((i) => i.rule.kind)).toEqual(['window', 'once', 'window'])
    expect(g.items.map((i) => i.kind)).toEqual(['set-machine', 'choice', 'code'])
    expect(g.fallback).toMatchObject({ id: 'hands-on', kind: 'custom', inPage: true })
  })

  it('every generated machine uses rotors I–V (the Enigma I of Act I)', () => {
    for (let s = 0; s < 50; s++) {
      const m = (gen(plugToHit, s) as PlugInstance).setup.machine
      expect(m.rotors.every((r) => ROTORS[r] && !['VI', 'VII', 'VIII'].includes(r))).toBe(true)
      expect(m.model).toBe('I')
    }
  })
})
