/**
 * Chapter I.1 · anatomy of a key press (PLAN §4.4 "i1-anatomy", §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 09):
 *  - every scene in order; each bet gates its press (toy-key-* on the toy, key-* on the machine), resolves once it
 *    fires, and the playback reaches the end; focus 'wire' and dimmedParts on every staged scene;
 *  - the circuit build-up, the toy trace scrubbed into the reflector's hop, K followed hop by hop on the full machine
 *    (the stage outlines each part and the playback stops at each hop), Q's lamp with the speed and scrub tasks;
 *  - gate `anatomy`: each item wrong through the UI with its rollback (the toy lamp's single-slip ghost against the
 *    gold reference, the chain's ghost, the order), the L1 hint, a correct answer through the widget, the rest
 *    through the API, and the pass rule; the ladder; a reload mid-gate; the gaming fallback (toy-set: keyboard
 *    locked, lamps hidden, answered with the rotor pickers); chapter.complete;
 *  - @3d: the first mechanism scene reports focus 'wire' and dimmedParts in the 3D view, and its bet gates the toy.
 * Answers are computed in Node from the pure gates.ts.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerViaApi,
  answerViaUi,
  assertFocus,
  assertLadder,
  assertNoAnswerLeak,
  assertRevealGated,
  assertRollback,
  commitBet,
  completeScene,
  configure,
  continueGate,
  current,
  enter,
  eventsOf,
  expectNextDisabled,
  fireReveal,
  gate,
  logicFor,
  nextScene,
  progress,
  reloadKeepsSeed,
  sceneReveals,
  solveInNode,
  where,
  wrongAnswer,
} from '../helpers/course'
import {
  CHAIN_KEY,
  MACHINE,
  PATH_KEY,
  TOY_ONE,
  TOY_TRACE_KEY,
  TOY_TWO,
  TOY_WIRE_KEY,
  reflectorHop,
  toyStagePerms,
  traceOf,
} from '../../src/chapters/i1-anatomy/gates'
import type { Rollback } from '../../src/contracts/lesson'
import { dimmedParts } from '../../src/contracts/stage'
import { LETTERS } from '../../src/engine'
import { partForStage } from '../../src/lesson/kinds/helpers'
import { toyPress } from '../../src/lib/toy'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'i1-anatomy'

/** §4.1 G5 table: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = {
  'toy-lamp': 'path',
  'hop-chain': 'path',
  'path-order': 'order',
  'path-order-m4': 'order',
}

const WIRE = dimmedParts('wire', 'I')

/** __enigma.pressKey(key) throws (the keyboard is locked). */
const pressThrows = (page: Page, key = 'A') =>
  page.evaluate((k) => {
    try {
      window.__enigma!.pressKey(k)
      return false
    } catch {
      return true
    }
  }, key)

const betResults = async (page: Page) =>
  Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))
const info = (page: Page) => page.evaluate(() => window.__stage!.info())
const playbackAtEnd = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const p = window.__stage!.playback()
        return !p.playing && p.hops > 0 && p.t === 1 + p.hops
      }),
    )
    .toBe(true)

/** Serious or critical axe findings inside one element (the lesson.spec pattern). */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** Walk the explore scenes (bets and triggers through the UI) up to the gate. */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 8 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
  await expect.poll(async () => (await gate(page))?.current?.attempt ?? 0).toBeGreaterThan(0)
}

test.describe('chapter i1-anatomy', { tag: '@chapter:i1-anatomy' }, () => {
  test('scenes in order: the story, the toy built up, a bet before every press, focus and dimming, the chain hop by hop', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    // The story: Knox; no act clock in I.1.
    expect(await where(page)).toMatchObject({ scene: 'knox', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Dilly Knox')
    await expect(page.getByTestId('act-clock')).toHaveCount(0)
    await nextScene(page)

    // toy-wire: the circuit built up (battery, key, bulb → six wires → scrambled → folded), then the bet on C.
    expect(await where(page)).toMatchObject({ scene: 'toy-wire', kind: 'explore' })
    await assertFocus(page, 'wire')
    expect((await info(page)).directive?.source).toBe('toy')
    await expectNextDisabled(page)
    const build = page.getByTestId('circuit-build')
    await expect(build).toHaveAttribute('data-step', '1')
    await page.getByTestId('build-key-key').click()
    await expect(page.getByTestId('build-lamp')).toHaveText('The bulb lights.')
    await page.getByTestId('build-next').click()
    await page.getByTestId('build-key-A').click()
    await expect(page.getByTestId('build-lamp')).toHaveText('A lights A.')
    await page.getByTestId('build-next').click()
    await page.getByTestId('build-key-A').click()
    const scrambled = LETTERS[toyStagePerms(TOY_ONE)[1]![0]!]
    await expect(page.getByTestId('build-lamp')).toHaveText(`A lights ${scrambled}.`)
    await page.getByTestId('build-next').click()
    await expect(build).toHaveAttribute('data-step', '4')
    await expect(page.getByTestId('build-next')).toBeDisabled()

    const [wire] = await sceneReveals(page)
    expect(wire).toMatchObject({ bet: 'toy-lamp', trigger: 'press', key: TOY_WIRE_KEY })
    await assertRevealGated(page, wire!)
    await expect(page.getByTestId(`toy-key-${TOY_WIRE_KEY}`)).toBeDisabled()
    const lamp1 = toyPress(TOY_ONE, TOY_WIRE_KEY).lamp
    await commitBet(page, 'toy-lamp', lamp1)
    // The reveal is bound to C: until C has been pressed it is the only key (the stage's keys are off).
    await expect(page.getByTestId(`toy-key-${TOY_WIRE_KEY}`)).toBeEnabled()
    await expect(page.getByTestId('toy-key-A')).toBeDisabled()
    expect((await info(page)).directive?.interactive).toBe(false)
    await fireReveal(page, wire!)
    await expect(page.getByTestId('toy-key-A')).toBeEnabled()
    await expect.poll(async () => (await info(page)).directive?.interactive).toBe(true)
    expect(await page.evaluate(() => window.__stage!.playback().hops)).toBe(5)
    expect((await info(page)).litLamp).toBe(lamp1)
    await expect(page.getByTestId(`toy-lamp-${lamp1}`)).toHaveAttribute('data-lit', 'true')
    await expect(page.getByTestId('toy-wire-result')).toContainText(`lamp ${lamp1}`)
    await expectNextDisabled(page)
    await page.getByTestId('toy-key-A').click()
    await page.getByTestId('toy-key-F').click()
    await expect(page.getByTestId('task-press3')).toHaveAttribute('data-done', 'true')
    expect((await info(page)).windows).toBe('A')
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    await nextScene(page)

    // toy-trace: two rotors, the trace; the bet asks which letter enters the reflector.
    expect(await where(page)).toMatchObject({ scene: 'toy-trace', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [trace] = await sceneReveals(page)
    expect(trace).toMatchObject({ bet: 'toy-path', trigger: 'press', key: TOY_TRACE_KEY })
    await assertRevealGated(page, trace!)
    await expect(page.getByTestId('playback-scrub')).toBeDisabled()
    const press2 = toyPress(TOY_TWO, TOY_TRACE_KEY)
    const r = reflectorHop(press2.hops)
    await commitBet(page, 'toy-path', 'A')
    await expect(page.getByTestId('toy-key-B')).toBeDisabled()
    await fireReveal(page, trace!)
    expect((await betResults(page))['toy-path']).toBe(false)
    await expect(page.getByTestId(`trace-row-${r}`)).toHaveAttribute('data-stage', 'reflector')
    await expect(page.getByTestId(`trace-row-${r}`)).toHaveAttribute('data-input', press2.hops[r]!.input)
    await expect(page.getByTestId(`trace-row-${press2.hops.length - 1}`)).toHaveAttribute('data-output', press2.lamp)
    // Scrub back into the reflector's hop: the rows after it go dark, the stage reports that hop.
    await page.getByTestId('playback-scrub').fill(String(1 + r + 0.5))
    await expect(page.getByTestId('task-scrub-reflector')).toHaveAttribute('data-done', 'true')
    expect((await info(page)).hop).toBe(r)
    await expect(page.getByTestId(`trace-row-${r}`)).toHaveAttribute('data-lit', 'true')
    await expect(page.getByTestId(`trace-row-${r + 1}`)).toHaveAttribute('data-lit', 'false')
    for (const k of ['B', 'C']) await page.getByTestId(`toy-key-${k}`).click()
    await expect(page.getByTestId('task-press3')).toHaveAttribute('data-done', 'true')
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    await nextScene(page)

    // worked-chain: free presses (no bet); K followed hop by hop; the stage outlines each part and stops at each hop.
    expect(await where(page)).toMatchObject({ scene: 'worked-chain', kind: 'explore' })
    await assertFocus(page, 'wire')
    expect(await page.evaluate(() => window.__stage!.playback().gated)).toBe(false)
    expect(await pressThrows(page, 'A')).toBe(false)
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    const chain = traceOf(MACHINE, CHAIN_KEY)
    for (const [k, hop] of chain.entries()) {
      await page.getByTestId('chain-next').click()
      await expect(page.getByTestId(`chain-hop-${k}`)).toHaveAttribute('data-shown', 'true')
      await expect(page.getByTestId(`chain-hop-${k}`)).toContainText(`${hop.input} → ${hop.output}`)
      await expect.poll(async () => (await info(page)).highlighted).toEqual([partForStage(hop.stage)])
      if (k < chain.length - 1) expect((await info(page)).hop).toBe(k)
    }
    await expect(page.getByTestId('chain-next')).toBeDisabled()
    await expect(page.getByTestId('task-all-hops')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('chain-summary')).toContainText('changed 7 times')
    expect((await info(page)).litLamp).toBe(chain.at(-1)!.output)
    expect(await page.evaluate(() => window.__enigma!.getState().positions)).toBe(MACHINE.positions.join(''))
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    await nextScene(page)
    expect((await info(page)).highlighted).toEqual([])

    // path-26: keys, lamps, trace, playback; the bet on Q gates the keyboard.
    expect(await where(page)).toMatchObject({ scene: 'path-26', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [q] = await sceneReveals(page)
    expect(q).toMatchObject({ bet: 'q-lamp', trigger: 'press', key: PATH_KEY })
    await assertRevealGated(page, q!)
    const qLamp = traceOf(MACHINE, PATH_KEY).at(-1)!.output
    await commitBet(page, 'q-lamp', qLamp)
    // Q is the only key until it has been pressed; then the whole keyboard.
    await expect(page.getByTestId(`key-${PATH_KEY}`)).toBeEnabled()
    await expect(page.getByTestId('key-A')).toHaveCount(0)
    expect((await info(page)).directive?.interactive).toBe(false)
    await fireReveal(page, q!)
    await expect(page.getByTestId('key-A')).toBeEnabled()
    expect((await info(page)).directive?.interactive).toBe(true)
    expect((await betResults(page))['q-lamp']).toBe(true)
    await expect(page.getByTestId(`lamp-${qLamp}`)).toHaveAttribute('data-lit', 'true')
    await expect(page.getByTestId('trace-row-10')).toHaveAttribute('data-output', qLamp)
    await expect(page.getByTestId('trace-step')).toHaveAttribute('data-after', MACHINE.positions.join(''))
    await page.getByTestId('playback-speed').selectOption('0.5')
    await expect(page.getByTestId('task-speed')).toHaveAttribute('data-done', 'true')
    await page.getByTestId('playback-scrub').fill('6.5')
    await expect(page.getByTestId('task-scrub')).toHaveAttribute('data-done', 'true')
    expect((await info(page)).hop).toBe(5)
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expectNextDisabled(page)
  })

  test('gate anatomy: each item wrong through the UI, its rollback and L1 hint, right through the widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    for (const id of items) {
      const c = await current(page)
      expect(c.itemId).toBe(id)
      const item = page.getByTestId(`item-${id}`)
      await expect(item).toHaveAttribute('data-current', 'true')
      // The item's stage: the toy for toy-lamp, the machine for hop-chain, none while the blocks are shown.
      if (c.kind === 'order') {
        await expect(page.getByTestId('stage')).toHaveCount(0)
      } else {
        await assertFocus(page, 'wire')
        await expect.poll(async () => (await info(page)).directive?.source).toBe(id === 'toy-lamp' ? 'toy' : 'machine')
        expect((await info(page)).directive?.interactive).toBe(false)
      }
      // A prediction: no trial press, no lamp.
      expect(await pressThrows(page)).toBe(true)
      expect((await info(page)).litLamp).toBeNull()
      // Each item and its widget are accessible.
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])

      // a. One wrong answer through the UI, its rollback, then the L1 hint.
      await assertNoAnswerLeak(page)
      let wrong: unknown
      if (c.kind === 'order') {
        // The blocks as shown are never in order: submitting them untouched is a wrong answer through the UI.
        wrong = (c.instance as { blocks: { id: string }[] }).blocks.map((b) => b.id)
        await page.getByTestId('gate-submit').click()
      } else {
        wrong = await wrongAnswer(page)
        await answerViaUi(page, c.kind, wrong)
      }
      await assertRollback(page, ROLLBACK[id]!)
      if (ROLLBACK[id] === 'path') {
        // The learner's path (red) against the reference (gold), with the divergence marked.
        const rb = (await page.evaluate(() => window.__course!.lastCheck()))!.result.rollback as Extract<
          Rollback,
          { kind: 'path' }
        >
        expect((await info(page)).ghost).toBe(true)
        await expect(page.getByTestId('stage2d-ghost')).toBeVisible()
        await expect(page.getByTestId('stage2d-reference')).toBeVisible()
        await expect(page.getByTestId('rollback').locator('[data-diverge="true"]')).toHaveCount(1)
        await expect
          .poll(async () => (await info(page)).highlighted)
          .toEqual([partForStage(rb.ghost.hops[rb.ghost.divergeAt]!.stage)])
        if (id === 'toy-lamp') await expect(page.getByTestId('rollback')).toContainText(`Lamp ${String(wrong)}`)
      } else {
        await expect(page.getByTestId('rollback').locator('[data-first-wrong="true"]')).toHaveCount(1)
      }
      await continueGate(page)
      expect((await info(page)).ghost).toBe(false)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      const logic = await logicFor(l1.gateKey, id, false)
      const hint = logic.highlight(l1.instance, wrong).map((h) => h.part)
      if (hint.length)
        await expect.poll(async () => (await info(page)).highlighted).toEqual(expect.arrayContaining(hint))

      // b. A correct instance through the real widget.
      await assertNoAnswerLeak(page)
      await answerViaUi(page, l1.kind, await solveInNode(page))
      await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')

      // d. data-passed turns true exactly when the rule is met: once → now; window (W C) → after one more.
      const once = logic.rule.kind === 'once'
      await expect(item).toHaveAttribute('data-passed', String(once))
      await continueGate(page)
      if (!once) {
        // c. The remaining instance through the API.
        await assertNoAnswerLeak(page)
        const after = await answerViaApi(page, id, await solveInNode(page), { continue: false })
        expect(after.correct).toBe(true)
        await expect(item).toHaveAttribute('data-passed', 'true')
        await continueGate(page)
      }
    }
    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual(['i1-anatomy/anatomy'])
    expect((await eventsOf(page, 'item.passed')).length).toBe(items.length)
    // Every submit was scored with the §4.1 rollback kind of its item.
    for (const e of await eventsOf(page, 'item.submit')) {
      if (!e.correct) expect(e.rollback).toBe(ROLLBACK[e.item.split('/')[2]!])
    }

    // 8. chapter.complete, and the next chapter unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/i2-stepping')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    // The learner's own course map (unlockAll only opens chapters for e2e): the prologue is not done, I.1 is.
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i1-anatomy')).toHaveAttribute('data-completed', 'true')
    await expect(page.getByTestId('chapter-link-i2-stepping')).toHaveAttribute('data-locked', 'false')
  })

  test('the hint ladder on toy-lamp: L1 highlight, L2 worked example on another instance, L3 reveal', async ({
    page,
  }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    await expect(page.getByTestId('item-toy-lamp')).toHaveAttribute('data-passed', 'false')
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/toy-lamp'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    // The toy item comes back with its own toy on the stage.
    const toy = (await current(page)).instance as { spec: { positions: number[] } }
    await expect.poll(async () => (await info(page)).windows).toBe(toy.spec.positions.map((p) => LETTERS[p]).join(''))
    await answerViaApi(page, 'toy-lamp', await solveInNode(page))
    await answerViaApi(page, 'toy-lamp', await solveInNode(page))
    expect((await current(page)).itemId).toBe('hop-chain')
    await reloadKeepsSeed(page)
    // The chain item comes back with its own machine: windows, rotors.
    const c = await current(page)
    const cfg = (c.instance as { config: { positions: string[]; rotors: string[] } }).config
    await expect.poll(() => page.evaluate(() => window.__enigma!.getState().positions)).toBe(cfg.positions.join(''))
    expect(await page.evaluate(() => window.__enigma!.getState().config.rotors)).toEqual(cfg.rotors)
  })

  test('gaming: two instant answers bring the toy-set fallback, keyboard locked, lamps hidden, answered with the pickers', async ({
    page,
  }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([
      { type: 'gaming', item: 'i1-anatomy/anatomy/toy-lamp', reason: 'fast' },
    ])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'toy-lamp', fallback: true, kind: 'custom' })
    await expect(page.getByTestId('item-toy-lamp')).toHaveAttribute('data-fallback', 'true')
    // In-page and constructive: the keyboard is locked and the lamps are covered.
    expect(await pressThrows(page)).toBe(true)
    expect((await info(page)).litLamp).toBeNull()
    await expect(page.getByTestId('toy-set')).toBeVisible()
    expect(await axeSerious(page, '[data-testid="item-toy-lamp"]')).toEqual([])
    await configure(page, { minLatencyMs: 0 })
    const target = (await solveInNode(page)) as number[]
    const submits = (await eventsOf(page, 'item.submit')).length
    for (const [k, slot] of ['middle', 'right'].entries()) {
      const want = LETTERS[target[k]!]!
      for (let n = 0; n < 6 && (await page.getByTestId(`toy-set-${slot}-window`).textContent()) !== want; n++) {
        await page.getByTestId(`toy-set-${slot}-inc`).click()
      }
      await expect(page.getByTestId(`toy-set-${slot}-window`)).toHaveText(want)
    }
    // The stage follows the pickers; turning them submits nothing.
    await expect.poll(async () => (await info(page)).windows).toBe(target.map((p) => LETTERS[p]).join(''))
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
    await assertNoAnswerLeak(page)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates['i1-anatomy/anatomy']!.items['toy-lamp']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'toy-lamp', fallback: false, kind: 'letter' })

    // Gaming again: this time the start setting is submitted (never a solution), and the rollback says what it lights.
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await configure(page, { minLatencyMs: 0 })
    expect(await current(page)).toMatchObject({ fallback: true, kind: 'custom' })
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, 'machine')
    await expect(page.getByTestId('rollback')).toContainText(/At windows [A-F]{2}, C lights [A-F], not E\./)
    await continueGate(page)
    expect(await current(page)).toMatchObject({ itemId: 'toy-lamp', fallback: false, kind: 'letter' })
  })
})

test.describe('chapter i1-anatomy in 3D', { tag: ['@3d', '@chapter:i1-anatomy'] }, () => {
  test('the first mechanism scene reports focus wire and dimmedParts in 3D; its bet gates the toy', async ({
    page,
  }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('toy-wire')
    await expect
      .poll(
        async () => {
          const i = await info(page)
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:wire')
    expect((await info(page)).dimmed).toEqual(WIRE)
    await expect
      .poll(
        async () => {
          const parts = await page.evaluate(() => window.__machine3d?.parts() ?? null)
          if (!parts) return false
          const drawn = WIRE.filter((p) => parts.present.includes(p))
          return [...parts.dimmed].sort().join() === [...drawn].sort().join() && parts.present.length > 5
        },
        { timeout: 30_000 },
      )
      .toBe(true)
    const [press] = await sceneReveals(page)
    await assertRevealGated(page, press!)
    await expect(page.getByTestId(`toy-key-${TOY_WIRE_KEY}`)).toBeDisabled()
    await commitBet(page, 'toy-lamp', 'A')
    await fireReveal(page, press!)
    await playbackAtEnd(page)
    await expect.poll(async () => (await info(page)).litLamp).toBe(toyPress(TOY_ONE, TOY_WIRE_KEY).lamp)
    // Across a scene change the 3D view stays (two rotors now), with the same focus.
    await page.evaluate(() => window.__course!.completeTasks())
    await nextScene(page)
    expect((await where(page)).scene).toBe('toy-trace')
    await expect
      .poll(async () => `${(await info(page)).renderer}:${(await info(page)).focus}`, { timeout: 30_000 })
      .toBe('webgl2:wire')
    expect((await info(page)).windows).toBe('AA')
  })
})
