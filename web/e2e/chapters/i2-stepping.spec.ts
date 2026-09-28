/**
 * Chapter I.2 · stepping (PLAN §4.4 "i2-stepping", §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 07 extras):
 *  - every scene in order, every bet gating its reveal, focus and dimming, tasks through real actions;
 *  - at ADU the three Step bets gate three reveals, and the windows go ADV, AEW, BFX;
 *  - at the rotor-layers scene the ring spinbutton shows 05 after the reveal while the window letter stays;
 *  - gate `stepping`: a wrong answer through the UI and its rollback (the windows rollback replays the press on
 *    the machine), the L1 hint, a correct answer through the widget, the rest through the API, the pass rule;
 *  - set-machine locks, the hint ladder, a reload mid-gate, the gaming fallback, chapter.complete;
 *  - @3d: the first mechanism scene reports focus 'pawls' and dimmedParts in the 3D view.
 * Answers are computed in Node from the pure gates.ts.
 */

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
  completeTasks,
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
  setMachine,
  solveInNode,
  where,
  wrongAnswer,
} from '../helpers/course'
import { stepsFrom } from '../../src/chapters/i2-stepping/gates'
import type { Rollback } from '../../src/contracts/lesson'
import type { PartId } from '../../src/contracts/stage'
import { dimmedParts } from '../../src/contracts/stage'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'i2-stepping'

/** §4.1 G5 table: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = {
  windows: 'windows',
  'middle-steps': 'machine',
  'first-letter': 'none',
  'ring-probe': 'none',
  'windows-m3': 'windows',
}

const windowsNow = (page: Page) => page.evaluate(() => window.__enigma!.getState().positions)

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

const betResults = async (page: Page) => Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))

/** Walk the explore scenes (bets and triggers through the UI) up to the gate. */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter i2-stepping', { tag: '@chapter:i2-stepping' }, () => {
  test('scenes in order: the story, a bet before every reveal, focus and dimming, tasks by real actions', async ({ page }) => {
    await enter(page, CHAPTER)
    // The story: a card naming Rejewski; Next is always enabled.
    expect(await where(page)).toMatchObject({ scene: 'rejewski-p', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Marian Rejewski')
    await nextScene(page)

    // step-first: the bet gates the first key press; any key fires the reveal (review m2).
    expect(await where(page)).toMatchObject({ scene: 'step-first', kind: 'explore' })
    await assertFocus(page, 'pawls')
    await expectNextDisabled(page)
    const [press] = await sceneReveals(page)
    expect(press).toEqual({ bet: 'first-press', trigger: 'press' })
    await assertRevealGated(page, press!)
    expect(await pressThrows(page, 'Q')).toBe(true)
    expect(await windowsNow(page)).toBe('AAA')
    await commitBet(page, 'first-press', 'right')
    await page.getByTestId('key-Q').click()
    await expect.poll(async () => (await eventsOf(page, 'reveal')).map((e) => e.bet)).toEqual(['i2-stepping/first-press'])
    expect(await windowsNow(page)).toBe('AAB')
    await expect(page.getByTestId('step-first-worked')).toContainText('Your key Q')
    await expect(page.getByTestId('notch-offset')).toContainText('III at D (turnover V)')
    await expect(page.getByTestId('trace-step')).toHaveAttribute('data-before', 'AAA')
    await expect(page.getByTestId('trace-step')).toHaveAttribute('data-after', 'AAB')
    await expect(page.getByTestId('step-first-worked')).toBeVisible()
    await expectNextDisabled(page)
    await page.getByTestId('key-B').click()
    await expect(page.getByTestId('task-press1')).toHaveAttribute('data-done', 'true')
    expect(await windowsNow(page)).toBe('AAC')
    await nextScene(page)

    // double-step: three Step bets gate three reveals from ADU; the windows go ADV, AEW, BFX.
    expect(await where(page)).toMatchObject({ scene: 'double-step', kind: 'explore' })
    await assertFocus(page, 'pawls')
    await expectNextDisabled(page)
    expect(await windowsNow(page)).toBe('ADU')
    const steps = await sceneReveals(page)
    expect(steps.map((r) => [r.bet, r.trigger])).toEqual([
      ['adu', 'step'],
      ['adv', 'step'],
      ['aew', 'step'],
    ])
    const want = [
      ['right', 'ADV', false],
      ['right-middle', 'AEW', false],
      ['all', 'BFX', true],
    ] as const
    for (const [k, r] of steps.entries()) {
      await assertRevealGated(page, r)
      // While the next bet is open the windows show the machine as it is now, not the last press's "before".
      if (k > 0) await expect(page.getByTestId('rotor-pos-right')).toHaveAttribute('aria-valuetext', want[k - 1]![1][2]!)
      expect(await pressThrows(page), 'the keyboard stays locked: only Step presses').toBe(true)
      // A fired Step cannot press again while this bet is open.
      if (k > 0) await expect(page.getByTestId(`reveal-${steps[k - 1]!.bet}`)).toBeDisabled()
      await commitBet(page, r.bet, want[k]![0])
      await fireReveal(page, r)
      expect(await windowsNow(page)).toBe(want[k]![1])
      await expect(page.getByTestId('trace-step')).toHaveAttribute('data-double-step', String(want[k]![2]))
      expect(await page.evaluate(() => window.__stage!.info().litLamp), 'the lamps are hidden').toBeNull()
    }
    expect(await betResults(page)).toMatchObject({ 'first-press': true, adu: true, adv: true, aew: true })
    await expect(page.getByTestId('task-reach-bfx')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('double-step-explained')).toContainText('the double step')
    await expect(page.getByTestId('double-step-now')).toHaveAttribute('aria-live', 'polite')
    await expect(page.getByTestId('double-step-now')).toContainText('(double step)')
    await nextScene(page)

    // ring-vs-core: the toggle turns the right ring 01 → 05; the window letter does not move.
    expect(await where(page)).toMatchObject({ scene: 'ring-vs-core', kind: 'explore' })
    await assertFocus(page, 'ring-right')
    await expectNextDisabled(page)
    const [toggle] = await sceneReveals(page)
    expect(toggle).toMatchObject({ trigger: 'toggle' })
    await assertRevealGated(page, toggle!)
    await expect(page.getByTestId('ring-right')).toHaveAttribute('aria-valuetext', '01')
    await commitBet(page, 'ring-window', 'window')
    // Key A at AAA with ring 01 (the rotors are held in this scene).
    await page.getByTestId('key-A').click()
    await fireReveal(page, toggle!)
    await expect(page.getByTestId('ring-right')).toHaveAttribute('aria-valuetext', '05')
    await expect(page.getByTestId('rotor-pos-right')).toHaveAttribute('aria-valuetext', 'A')
    expect(await windowsNow(page)).toBe('AAA')
    // The displayed offset agrees with the prose: four places back (review m3).
    await expect(page.getByTestId('ring-now')).toContainText('−4 places')
    expect((await betResults(page))['ring-window']).toBe(false)
    await expectNextDisabled(page)
    // The same key at the same windows with ring 05, then a ring changed by hand.
    await page.getByTestId('key-A').click()
    await expect(page.getByTestId('task-compare-lamps')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('ring-compare')).toContainText('01 01 05')
    await page.getByTestId('ring-right').focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('ring-right')).toHaveAttribute('aria-valuetext', '06')
    await expect(page.getByTestId('task-change-ring')).toHaveAttribute('data-done', 'true')
    expect(await windowsNow(page)).toBe('AAA')
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await assertFocus(page, 'pawls')
    await expectNextDisabled(page)
  })

  test('gate stepping: each item wrong through the UI, its rollback and L1 hint, right through the widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i3-reflector-plugboard')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    for (const id of items) {
      const c = await current(page)
      expect(c.itemId).toBe(id)
      const item = page.getByTestId(`item-${id}`)
      await expect(item).toHaveAttribute('data-current', 'true')
      await assertFocus(page, 'pawls', (c.instance as { config?: { model: 'I' | 'M3' } }).config?.model ?? 'I')

      if (c.kind === 'set-machine') {
        // 6. The keyboard is locked, the lamps hidden, and moving the controls submits nothing.
        await expect(page.getByTestId('key-A')).toBeDisabled()
        expect(await pressThrows(page)).toBe(true)
        expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
        expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
        const submits = (await eventsOf(page, 'item.submit')).length
        const l = await logicFor(c.gateKey, c.itemId, false)
        expect(await setMachine(page, JSON.parse(JSON.stringify(l.sampleAnswer(c.instance, () => 0.37))))).toBe('ui')
        expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
      } else if (c.kind === 'letters') {
        // A prediction: no trial press is possible.
        expect(await pressThrows(page)).toBe(true)
      }

      // a. One wrong answer through the UI, its rollback, then the L1 hint.
      await assertNoAnswerLeak(page)
      const wrong = await wrongAnswer(page)
      await answerViaUi(page, c.kind, wrong)
      await assertRollback(page, ROLLBACK[id]!)
      if (ROLLBACK[id] === 'windows') {
        // The rollback steps the machine itself: the press where the learner first went wrong is replayed.
        const rb = (await page.evaluate(() => window.__course!.lastCheck()))!.result.rollback as Extract<Rollback, { kind: 'windows' }>
        const press = stepsFrom(rb.from, 3)[rb.firstWrong]!
        await expect.poll(() => page.evaluate(() => window.__enigma!.getState().lastStepping?.before)).toBe(press.before)
        expect(await windowsNow(page)).toBe(press.after)
        await expect(page.getByTestId('windows-diff').locator('[data-first-wrong="true"]')).toHaveCount(1)
        const carrier: PartId[] = press.moved.includes('left')
          ? ['notch-middle', 'pawl-left']
          : press.moved.includes('middle')
            ? ['notch-right', 'pawl-middle']
            : ['pawl-right']
        await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(carrier)
        expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
      }
      if (c.kind === 'set-machine') {
        // The rollback shows the learner's own setting on the machine, where the failed predicate is highlighted.
        const own = (wrong as { positions: string[] }).positions.join('')
        await expect.poll(() => windowsNow(page)).toBe(own)
        await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(['notch-right', 'pawl-middle'])
        expect(await pressThrows(page)).toBe(true)
      }
      await continueGate(page)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      const logic = await logicFor(l1.gateKey, id, false)
      const hint = logic.highlight(l1.instance, wrong).map((h) => h.part)
      await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(expect.arrayContaining(hint))
      // Back at the new instance's start windows once the rollback is gone.
      const i1 = l1.instance as { config?: { positions: string[] }; setup?: { machine: { positions: string[] } } }
      const start = i1.config ?? i1.setup?.machine
      if (start) await expect.poll(() => windowsNow(page)).toBe(start.positions.join(''))

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
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual(['i2-stepping/stepping'])
    expect((await eventsOf(page, 'item.passed')).length).toBe(items.length)

    // 8. chapter.complete, and the next chapter unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/i3-reflector-plugboard')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i3-reflector-plugboard')).toHaveAttribute('data-locked', 'false')
  })

  test('double-step: Steps fire in order, and a fired Step never presses past an open bet', async ({ page }) => {
    await enter(page, CHAPTER)
    await completeScene(page)
    await completeScene(page)
    expect((await where(page)).scene).toBe('double-step')
    // The third bet first: its Step still waits for the first two.
    await commitBet(page, 'aew', 'all')
    await expect(page.getByTestId('reveal-aew')).toBeDisabled()
    await commitBet(page, 'adu', 'right')
    await fireReveal(page, { bet: 'adu', trigger: 'step', key: 'A' })
    expect(await windowsNow(page)).toBe('ADV')
    await expect(page.getByTestId('reveal-aew')).toBeDisabled()
    // The second bet is open: the first Step cannot press again.
    await expect(page.getByTestId('reveal-adu')).toBeDisabled()
    await page.getByTestId('reveal-adu').click({ force: true })
    expect(await windowsNow(page)).toBe('ADV')
    await commitBet(page, 'adv', 'right')
    await fireReveal(page, { bet: 'adv', trigger: 'step', key: 'A' })
    expect(await windowsNow(page)).toBe('AEW')
    await fireReveal(page, { bet: 'aew', trigger: 'step', key: 'A' })
    expect(await windowsNow(page)).toBe('BFX')
    expect(await betResults(page)).toMatchObject({ adu: true, adv: false, aew: true })
    await expect(page.getByTestId('task-reach-bfx')).toHaveAttribute('data-done', 'true')
    // Every Step has fired: a Step is now a repeat press, and the machine can start again at ADU.
    await page.getByTestId('reveal-adu').click()
    await expect.poll(() => windowsNow(page)).toBe('BFY')
    await page.getByTestId('double-step-restart').click()
    expect(await windowsNow(page)).toBe('ADU')
  })

  test('the hint ladder on windows: L1 highlight, L2 worked example on another instance, L3 reveal', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    await expect(page.getByTestId('item-windows')).toHaveAttribute('data-passed', 'false')
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/windows'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await answerViaApi(page, 'windows', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'windows', await solveInNode(page))
    await answerViaApi(page, 'windows', await solveInNode(page))
    expect((await current(page)).itemId).toBe('middle-steps')
    await reloadKeepsSeed(page)
    // The set-machine item comes back with its own start windows on the machine.
    const c = await current(page)
    const start = (c.instance as { setup: { machine: { positions: string[] } } }).setup.machine.positions.join('')
    await expect.poll(() => windowsNow(page)).toBe(start)
  })

  test('gaming: two instant answers bring the left-steps fallback, keyboard locked, answered on the machine', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'windows', await wrongAnswer(page))
    await answerViaApi(page, 'windows', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: 'i2-stepping/stepping/windows', reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'windows', fallback: true, kind: 'set-machine' })
    await expect(page.getByTestId('item-windows')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    await configure(page, { minLatencyMs: 0 })
    const solution = (await solveInNode(page)) as { positions: string[]; plugboard: string[] }
    await answerViaUi(page, 'set-machine', solution)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates['i2-stepping/stepping']!.items['windows']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'windows', fallback: false, kind: 'letters' })
  })
})

test.describe('chapter i2-stepping in 3D', { tag: ['@3d', '@chapter:i2-stepping'] }, () => {
  /** The 3D view reports this focus (and stays the 3D view: no fallback to 2D). */
  async function in3d(page: Page, focus: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe(`webgl2:${focus}`)
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts(focus as 'pawls', 'I'))
  }

  test('the mechanism scenes stay in 3D across scene changes: focus and dimmedParts; the bet gates the press', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(120_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('step-first')
    await in3d(page, 'pawls')
    // The live scene dims exactly those parts.
    await expect
      .poll(
        async () => {
          const parts = await page.evaluate(() => window.__machine3d?.parts() ?? null)
          if (!parts) return false
          const drawn = dimmedParts('pawls', 'I').filter((p) => parts.present.includes(p))
          return [...parts.dimmed].sort().join() === [...drawn].sort().join() && parts.present.length > 10
        },
        { timeout: 30_000 },
      )
      .toBe(true)
    const [press] = await sceneReveals(page)
    await assertRevealGated(page, press!)
    await commitBet(page, 'first-press', 'right')
    await fireReveal(page, press!)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().windows)).toBe('AAB')
    await completeTasks(page)
    await nextScene(page)

    // Scene change 1: the 3D view is kept (no context loss, no fall back to 2D).
    expect((await where(page)).scene).toBe('double-step')
    await in3d(page, 'pawls')
    await completeScene(page)

    // Scene change 2: the ring layers, still in 3D.
    expect((await where(page)).scene).toBe('ring-vs-core')
    await in3d(page, 'ring-right')
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', 'webgl2')
  })
})
