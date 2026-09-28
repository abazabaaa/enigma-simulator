/**
 * Chapter i4-permutations: generator and check tests (PLAN §6.9 brief 10). The shared lints (validate, L1 lint,
 * guess bot, CC learner, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import type { CodeAnswer, CodeRunSummary } from '../../../contracts/code'
import type { GenCtx, ItemLogic } from '../../../contracts/lesson'
import { countLines } from '../../../code/runner'
import { executeRequest } from '../../../code/runnerCore'
import { summarizeRun } from '../../../code/summary'
import {
  LETTERS,
  createMachine,
  encodeLetter,
  machinePermutation,
  positionsToString,
  pressKey,
  step,
  validateConfig,
  withPositions,
} from '../../../engine'
import { codeTaskOf } from '../../../lesson/kinds'
import { createRng, randLetter, randomConfig, sample, seedFor } from '../../../lib/rng'
import {
  BUGS,
  FACTORS,
  GATES,
  KEYPRESS_REFERENCE,
  NOTATION_START,
  PROBE_HOP,
  STAGES,
  claimedHop,
  drawWhichWrong,
  faultyHop,
  firstDivergence,
  hopChainFull,
  keypress,
  keypressCases,
  keypressHops,
  keypressProbe,
  partialProduct,
  referenceHops,
  stateOf,
  whichWrong,
  windowsAfterStep,
  type ChainFullInstance,
  type KeypressInstance,
  type WhichWrongInstance,
} from '../gates'

const ctx = (id: string, attempt: number): GenCtx => ({ key: `i4-permutations/keypress/${id}`, attempt, purpose: 'instance', previous: [] })
const gen = <I>(l: ItemLogic<I, unknown>, s: number): I => l.generate(createRng(seedFor('i4-test', l.id, s)), ctx(l.id, (s % 4) + 1))
const SEEDS = 300
const task = codeTaskOf(keypress as ItemLogic)!

/** Run learner code against a keypress instance's cases, as the CodeItem does (in Node, without a worker). */
function run(source: string, i: KeypressInstance): CodeRunSummary {
  const cases = task.cases(i)
  const res = executeRequest({
    id: 1,
    source,
    provided: task.provided,
    fnNames: task.fnNames,
    calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
    timeoutMs: 1500,
    instrument: 'keypress-parts',
  })
  return summarizeRun(cases, res, i.seed)
}

/** The reference with one line swapped for a buggy one. */
const buggy = (from: string, to: string): string => {
  expect(KEYPRESS_REFERENCE).toContain(from)
  return KEYPRESS_REFERENCE.replace(from, to)
}
const SWAPPED = buggy("['right', 'middle', 'left']", "['right', 'left', 'middle']").replace("['left', 'middle', 'right']", "['middle', 'left', 'right']")

describe("Rejewski's notation", () => {
  it('E = S·H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹·S⁻¹ composed left to right is the machine at its windows (random machines)', () => {
    expect(FACTORS.map((f) => `${f.sym}${f.inv ? '⁻¹' : ''}`).join('·')).toBe('S·H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹·S⁻¹')
    const r = createRng(3)
    for (let n = 0; n < 100; n++) {
      const state = withPositions(createMachine(randomConfig(r, { rings: 'random' })), sample(r, LETTERS, 3).join(''))
      expect(partialProduct(state, FACTORS.length)).toEqual([...machinePermutation(state)])
    }
    expect(validateConfig(NOTATION_START)).toEqual([])
  })
})

describe('the provided parts and the TypeScript press', () => {
  it('keypressHops without a bug is the engine trace (500 random presses)', () => {
    const r = createRng(5)
    for (let n = 0; n < 500; n++) {
      const c = randomConfig(r, { rings: 'random' })
      const key = randLetter(r)
      const want = pressKey(createMachine(c), key).trace
      const got = keypressHops(c, key, null)
      expect(got.map((h) => [h.stage, h.input, h.output])).toEqual(want.map((h) => [h.stage, h.input, h.output]))
    }
  })

  it('the keypress reference passes all cases (40 instances), within 12 lines, and records the engine path', () => {
    expect(countLines(KEYPRESS_REFERENCE, 'enigmaKeypress')).toBeLessThanOrEqual(12)
    for (let s = 0; s < 40; s++) {
      const i = gen(keypress, s) as KeypressInstance
      const summary = run(KEYPRESS_REFERENCE, i)
      expect(summary, `seed ${s}`).toMatchObject({ status: 'pass', passed: summary.total, total: 36, instanceSeed: i.seed })
      expect(summary.hops!.map((h) => h.output)).toEqual(referenceHops(i.state, i.key).map((h) => h.output))
      expect(keypress.check(i, { probe: keypressProbe(i), run: summary }).correct).toBe(true)
    }
  })

  it('the cases hold the BDZGO sequence, 30 random machines near turnovers (double steps included) and one hop-by-hop case', () => {
    const i = gen(keypress, 1) as KeypressInstance
    const cases = keypressCases(i)
    expect(cases.slice(0, 5).map((c) => (c.expect as { output: string }).output).join('')).toBe('BDZGO')
    expect(cases.filter((c) => c.label.startsWith('random')).length).toBe(30)
    expect(cases.filter((c) => c.compare === 'hops')).toHaveLength(1)
    const doubles = cases.filter((c) => {
      const [s] = c.args as [ReturnType<typeof stateOf>]
      return step(createMachine({ model: 'I', ...s, rings: s.rings, positions: s.positions })).doubleStep
    })
    expect(doubles.length).toBeGreaterThan(0)
  })

  it.each([
    ['middle and left swapped', SWAPPED],
    ['no step', buggy('const next = parts.step(state)', 'const next = state')],
    ['step after encoding', buggy('  const next = parts.step(state)\n', '').replace('  return {', '  const next = parts.step(state)\n  return {')],
    ['reflector skipped', buggy('  c = parts.reflect(c)\n', '')],
    ['plugboard once', buggy('c = parts.plugOut(parts.etwOut(c))', 'c = parts.etwOut(c)')],
    ['unstepped windows returned', buggy('positions: next.positions', 'positions: state.positions')],
    ['keys reversed', buggy("['left', 'middle', 'right']", "['right', 'middle', 'left']")],
  ])('wrong code fails the cases: %s', (_label, source) => {
    const i = gen(keypress, 2) as KeypressInstance
    const summary = run(source, i)
    expect(summary.status).not.toBe('pass')
    expect(keypress.check(i, { probe: keypressProbe(i), run: summary }).correct).toBe(false)
  })
})

describe('keypress (code item)', () => {
  it('the prediction varies with the instance: the letter leaving M⁻¹ of the engine trace', () => {
    const probes = new Set<string>()
    for (let s = 0; s < 100; s++) {
      const i = gen(keypress, s) as KeypressInstance
      const want = pressKey(createMachine({ model: 'I', ...i.state }), i.key).trace[PROBE_HOP]!
      expect(want.stage).toBe('rotor-middle-bwd')
      expect(task.probe(i).expected).toBe(want.output)
      probes.add(want.output)
    }
    expect(probes.size).toBeGreaterThan(15)
  })

  it('the stage shows the press after its step, so the reference path is the engine trace', () => {
    const i = gen(keypress, 4) as KeypressInstance
    const setup = keypress.setup!(i)
    const m = createMachine(setup.machine!)
    expect(positionsToString(m)).toBe(windowsAfterStep(createMachine({ model: 'I', ...i.state }).config))
    expect(encodeLetter(m, i.key).trace.map((h) => h.output)).toEqual(referenceHops(i.state, i.key).map((h) => h.output))
    expect(setup.locks).toMatchObject({ keyboard: true, lampsHidden: true })
  })

  it('rollback path: a buggy run draws its own hops from the first wrong one; a wrong prediction marks M⁻¹', () => {
    const i = gen(keypress, 6) as KeypressInstance
    const bad = run(SWAPPED, i)
    const res = keypress.check(i, { probe: keypressProbe(i), run: bad })
    expect(res.correct).toBe(false)
    expect(res.rollback.kind).toBe('path')
    if (res.rollback.kind === 'path') {
      expect(res.rollback.ghost.hops[3]!.stage).toBe('rotor-left-fwd')
      expect(res.rollback.ghost.divergeAt).toBe(3)
    }
    const good = run(KEYPRESS_REFERENCE, i)
    const want = keypressProbe(i)
    const wrong = LETTERS[(LETTERS.indexOf(want) + 1) % 26]!
    const res2 = keypress.check(i, { probe: wrong, run: good } as CodeAnswer)
    expect(res2).toMatchObject({ correct: false, rollback: { kind: 'path', ghost: { divergeAt: PROBE_HOP } } })
    if (res2.rollback.kind === 'path') expect(res2.rollback.ghost.hops[PROBE_HOP]!.output).toBe(wrong)
    // A syntax error still rolls back as a path (the prediction against the engine's path).
    const broken = run('function enigmaKeypress(state, key, parts) {\n  return {\n', i)
    expect(broken.status).toBe('error')
    expect(keypress.check(i, { probe: want, run: broken }).rollback.kind).toBe('path')
  })
})

describe('which-wrong', () => {
  it.each(BUGS.map((b) => [b]))('%s diverges at its claimed first hop on 300 seeds', (bug) => {
    for (let s = 0; s < SEEDS; s++) {
      const i = drawWhichWrong(createRng(seedFor('which-wrong', bug, s)), bug)
      const claim = claimedHop(bug, i.config)
      expect(claim).not.toBeNull()
      expect(firstDivergence(i.ghost.hops, keypressHops(i.config, i.key, null)), `seed ${s}`).toBe(claim)
      expect(faultyHop(i)).toBe(claim)
      expect(i.ghost.divergeAt).toBe(-1)
    }
  })

  it('the instance never carries the answer: no bug, no divergence; the ghost is labelled with the correct stages', () => {
    for (let s = 0; s < 100; s++) {
      const i = gen(whichWrong, s) as WhichWrongInstance
      expect(Object.keys(i).sort()).toEqual(['config', 'ghost', 'key', 'options'])
      expect(i.ghost.divergeAt).toBe(-1)
      expect(i.ghost.hops.map((h) => h.stage)).toEqual(STAGES)
      expect(JSON.stringify(i)).not.toMatch(/no-step|swap|ring-sign|plug-once|no-reflector|backward/)
    }
  })

  it('answers spread over the parts, and the rollback draws the true divergence', () => {
    const answers = new Map<string, number>()
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(whichWrong, s) as WhichWrongInstance
      const a = whichWrong.solve(i) as string
      answers.set(a, (answers.get(a) ?? 0) + 1)
      const res = whichWrong.check(i, a === 'etw' ? 'plugboard' : 'etw')
      expect(res).toMatchObject({ correct: false, rollback: { kind: 'path', ghost: { divergeAt: faultyHop(i) } } })
    }
    expect([...answers.keys()].sort()).toEqual(['plugboard', 'reflector', 'rotor-left', 'rotor-middle', 'rotor-right'])
    for (const n of answers.values()) expect(n).toBeGreaterThan(20)
  })
})

describe('hop-chain-full', () => {
  it('stepping precedes encoding: the first token is the windows after the step and the letters are the trace there', () => {
    let differs = 0
    for (let s = 0; s < SEEDS; s++) {
      const i = gen(hopChainFull, s) as ChainFullInstance
      const solution = hopChainFull.solve(i) as string[]
      const pressed = pressKey(createMachine(i.config), i.key)
      expect(solution[0]).toBe(positionsToString(pressed.state))
      expect(solution.slice(1)).toEqual(pressed.trace.map((h) => h.output))
      const unstepped = encodeLetter(createMachine(i.config), i.key).trace.map((h) => h.output)
      if (unstepped.join('') !== solution.slice(1).join('')) differs++
      expect(hopChainFull.check(i, solution).correct).toBe(true)
    }
    expect(differs / SEEDS).toBeGreaterThan(0.9)
  })

  it('rings are not all 01, 2–6 cables, and about half start within two presses of a turnover', () => {
    let near = 0
    for (let s = 0; s < SEEDS; s++) {
      const c = (gen(hopChainFull, s) as ChainFullInstance).config
      expect(c.rings.join('')).not.toBe('AAA')
      expect(c.plugboard.length).toBeGreaterThanOrEqual(2)
      expect(c.plugboard.length).toBeLessThanOrEqual(6)
      let m = createMachine(c)
      const moved = [0, 1].some(() => {
        const st = step(m)
        m = st.state
        return st.stepped.middle
      })
      if (moved) near++
    }
    expect(near / SEEDS).toBeGreaterThan(0.35)
  })

  it('rollback path: the learner letters split from the reference at the first wrong hop; wrong windows are explained', () => {
    const i = gen(hopChainFull, 8) as ChainFullInstance
    const good = hopChainFull.solve(i) as string[]
    const bad = [...good]
    bad[5] = LETTERS[(LETTERS.indexOf(bad[5] as never) + 1) % 26]!
    expect(hopChainFull.check(i, bad)).toMatchObject({ correct: false, rollback: { kind: 'path', ghost: { divergeAt: 4 } } })
    const windows = [good[0]!.slice(0, 2) + LETTERS[(LETTERS.indexOf(good[0]![2] as never) + 1) % 26], ...good.slice(1)]
    const res = hopChainFull.check(i, windows)
    expect(res.correct).toBe(false)
    expect(res.feedback).toMatch(/windows after the step/)
    expect(hopChainFull.highlight(i, bad)).toEqual([{ part: 'rotor-left', tone: 'hint' }])
  })
})

describe('gate keypress', () => {
  it('holds keypress, which-wrong and hop-chain-full in order; the fallback is which-wrong (in page)', () => {
    const g = GATES.keypress!
    expect(g.items.map((i) => i.id)).toEqual(['keypress', 'which-wrong', 'hop-chain-full'])
    expect(g.items.map((i) => i.kind)).toEqual(['code', 'ghost-pick', 'chain'])
    expect(g.items.every((i) => i.rule.kind === 'window')).toBe(true)
    expect(g.fallback).toBe(whichWrong)
    expect(g.items.some((i) => i.compute)).toBe(true)
  })
})
