/**
 * Chapter III.11 · the bombe circuit (PLAN §4.4 "iii11-bombe", §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 15):
 *  - Victory and Agnus Dei (the story corrects the myth: the diagonal board was Welchman's);
 *  - wire-8: the bet gates the current; the Step replay lights one wire per scrambler; the TestRegister's live count
 *    equals liveCount from Node for the state shown; the true partner lights 1 wire, a wrong position all 8;
 *  - wire-26: the bet gates the 26-wire bombe; 25 live, the dead wire lights 1, a wrong position 26;
 *  - diagonal: the bet gates two whole-wheel-order runs in the worker; board-on stops ≤ board-off stops;
 *  - gate `bombe`: each item wrong through the UI with its rollback and L1 hint, right through its own widget
 *    (click-through solved once through the UI), the rest through the API; axe on every item, rollback and hint;
 *    the hint ladder, a reload mid-gate, the gaming fallback (grid-probe, per trigger), chapter.complete;
 *  - @3d: under ?stage=3d from the story to the first scene (a scene change), no stage.
 * Answers are computed in Node from the pure gates.ts.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerViaApi,
  answerViaUi,
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
  B26,
  DIAG_STOPS,
  TOY8,
  b26State,
  menuToyLive,
  probeStart,
  type ClickInstance,
  type LiveAnswer,
  type ProbeInstance,
} from '../../src/chapters/iii11-bombe/gates'
import { liveCount } from '../../src/crypto/bombe'
import type { Letter } from '../../src/engine'

const CHAPTER = 'iii11-bombe'

/** PLAN §4.1 G5: chain / live count → wires; choice → none. */
const ROLLBACK: Record<string, string> = { 'click-through': 'wires', 'live-count': 'wires', 'board-myth': 'none' }

/** Serious or critical axe findings inside one element (the fixture spec's pattern). */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

const attr = async (page: Page, testId: string, name: string) => page.getByTestId(testId).getAttribute(name)
const betResults = async (page: Page) => Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))

/** click-through through its own widget: a partner per scrambler, then the verdict, then Submit. */
async function answerClick(page: Page, tokens: readonly string[]): Promise<void> {
  const k = tokens.length - 1
  for (let j = 0; j < k; j++) await page.getByTestId(`click-pick-s${j + 1}-${tokens[j]!.toUpperCase()}`).click()
  await expect(page.getByTestId('click-answer')).toHaveAttribute('data-picks', tokens.slice(0, k).join('').toUpperCase())
  await page.getByTestId(`click-verdict-${tokens[k]}`).click()
  await page.getByTestId('gate-submit').click()
  await expect(page.getByTestId('rollback')).toBeVisible()
}

/** live-count through its own widget: the two counts and the dead wire. */
async function answerLive(page: Page, a: LiveAnswer): Promise<void> {
  await page.getByTestId('answer-number-0').fill(String(a.counts[0]))
  await page.getByTestId('answer-number-1').fill(String(a.counts[1]))
  await page.getByTestId(`live-dead-${a.dead}`).click()
  await page.getByTestId('gate-submit').click()
  await expect(page.getByTestId('rollback')).toBeVisible()
}

async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter iii11-bombe', { tag: '@chapter:iii11-bombe' }, () => {
  test('scenes in order: the story, each bet gating its run, the wire views, tasks by real actions', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'victory', kind: 'story', index: 0, canNext: true })
    const story = page.getByTestId('story-card')
    for (const t of ['Victory', 'Agnus Dei', 'Gordon Welchman', 'Alan Turing', 'Victory had none']) await expect(story).toContainText(t)
    await nextScene(page)

    // wire-8: the eight-letter bombe.
    expect(await where(page)).toMatchObject({ scene: 'wire-8', kind: 'explore' })
    expect(await page.getByTestId('stage').count(), 'a 2D-only scene: no stage').toBe(0)
    await expectNextDisabled(page)
    const [run8] = await sceneReveals(page)
    expect(run8).toMatchObject({ bet: 'live8', trigger: 'run' })
    await assertRevealGated(page, run8!)
    // Before the bet nothing can be stepped and nothing gives the count away.
    await expect(page.getByTestId('wire8-step')).toBeDisabled()
    await expect(page.getByTestId('wire8-hyp-A')).toBeDisabled()
    await expect(page.getByTestId('wire8-count')).toHaveText('1 wire lit')
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', '1')
    await commitBet(page, 'live8', '7')
    await fireReveal(page, run8!)
    expect((await betResults(page))['live8']).toBe(true)
    // Step: one scrambler, one more lit wire.
    const view8 = page.getByTestId('wire8-view')
    await page.getByTestId('wire8-step').click()
    await expect(view8).toHaveAttribute('data-step', '2')
    await expect(page.getByTestId('wire8-grid')).toHaveAttribute('data-step', '2')
    await page.getByTestId('wire8-step').click()
    await expect(view8).toHaveAttribute('data-step', '3')
    await page.getByTestId('wire8-run').click()
    await expect(page.getByTestId('task-run-end')).toHaveAttribute('data-done', 'true')
    // The register shows liveCount from Node for the state on screen.
    const hyp = (await attr(page, 'wire8-view', 'data-hypothesis')) as Letter
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', String(menuToyLive(TOY8.truth, hyp)))
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', '7')
    await expect(page.getByTestId('wire8-result')).toContainText(`Only wire ${TOY8.partner.toLowerCase()} stays dead`)
    // The true partner lights one wire; a wrong position lights all eight.
    await page.getByTestId(`wire8-hyp-${TOY8.partner}`).click()
    await page.getByTestId('wire8-run').click()
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', '1')
    await expect(page.getByTestId('task-true-hyp')).toHaveAttribute('data-done', 'true')
    await page.getByTestId('wire8-position-wrong').click()
    await page.getByTestId('wire8-run').click()
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', '8')
    await expect(page.getByTestId('wire8-grid')).toHaveAttribute('data-test-live', '8')
    await expect(page.getByTestId('task-wrong-pos')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    // wire-26: the real circuit.
    expect(await where(page)).toMatchObject({ scene: 'wire-26', kind: 'explore' })
    await expectNextDisabled(page)
    const [run26] = await sceneReveals(page)
    await assertRevealGated(page, run26!)
    await expect(page.getByTestId('wire26-count')).toHaveText('1 wire lit')
    await expect(page.getByTestId('wire26-crib')).toHaveCount(0)
    await expect(page.getByTestId('crib-line')).toHaveAttribute('data-offset', String(B26.offset))
    await commitBet(page, 'live26', '26')
    await fireReveal(page, run26!)
    expect((await betResults(page))['live26']).toBe(false)
    const reg26 = page.getByTestId('wire26-register')
    await expect(reg26).toHaveAttribute('data-live-count', '25')
    const pos = (await attr(page, 'wire26-view', 'data-positions'))!
    const w26 = (await attr(page, 'wire26-view', 'data-hypothesis')) as Letter
    expect(await attr(page, 'wire26-register', 'data-live-count')).toBe(String(liveCount(b26State(pos, w26, false), B26.test)))
    // The one dead wire is the true partner: put the voltage on it.
    const liveWires = (await attr(page, 'wire26-register', 'data-live-wires'))!
    const dead = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !liveWires.includes(l))!
    expect(dead).toBe(B26.partner)
    await page.getByTestId('wire26-hyp').selectOption(dead)
    await expect(reg26).toHaveAttribute('data-live-count', '1')
    await expect(page.getByTestId('task-dead-wire')).toHaveAttribute('data-done', 'true')
    await page.getByTestId('wire26-position-wrong').click()
    await expect(reg26).toHaveAttribute('data-live-count', '26')
    await expect(page.getByTestId('task-wrong-pos')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    // diagonal: two whole-wheel-order runs in the worker.
    expect(await where(page)).toMatchObject({ scene: 'diagonal', kind: 'explore' })
    await expectNextDisabled(page)
    const [runDiag] = await sceneReveals(page)
    await assertRevealGated(page, runDiag!)
    await expect(page.getByTestId('diag-run-off')).toHaveAttribute('data-done', 'false')
    await commitBet(page, 'diag', 'more')
    await fireReveal(page, runDiag!)
    await expect(page.getByTestId('diag-run-on')).toHaveAttribute('data-done', 'true', { timeout: 30_000 })
    const off = Number(await attr(page, 'diag-run-off', 'data-stops'))
    const on = Number(await attr(page, 'diag-run-on', 'data-stops'))
    expect(on).toBeLessThanOrEqual(off)
    expect([off, on]).toEqual([DIAG_STOPS.off, DIAG_STOPS.on])
    expect((await betResults(page))['diag']).toBe(false)
    await expect(page.getByTestId('task-both-runs')).toHaveAttribute('data-done', 'true')
    // The close-up: the board floods the register of a stop it removes.
    await expect(page.getByTestId('diag-register')).not.toHaveAttribute('data-live-count', '26')
    await page.getByTestId('diag-board-on').click()
    await expect(page.getByTestId('diag-register')).toHaveAttribute('data-live-count', '26')
    await expect(page.getByTestId('diag-grid')).toHaveAttribute('data-diagonal', 'true')
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expectNextDisabled(page)
  })

  test('gate bombe: each item wrong through the UI with its rollback and L1 hint, right through its widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iii12-checking')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    for (const id of items) {
      const c = await current(page)
      expect(c.itemId).toBe(id)
      const item = page.getByTestId(`item-${id}`)
      await expect(item).toHaveAttribute('data-current', 'true')
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])

      // a. One wrong answer through the UI, its rollback, then the L1 hint.
      await assertNoAnswerLeak(page)
      const wrong = await wrongAnswer(page)
      if (id === 'click-through') await answerClick(page, wrong as string[])
      else if (id === 'live-count') await answerLive(page, wrong as LiveAnswer)
      else await answerViaUi(page, c.kind, wrong)
      await assertRollback(page, ROLLBACK[id]!)
      if (ROLLBACK[id] === 'wires') {
        await expect(page.getByTestId('wires-feedback')).toBeVisible()
        expect(await axeSerious(page, '[data-testid="rollback"]')).toEqual([])
      }
      await continueGate(page)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      if (id !== 'board-myth') await expect(page.getByTestId('item-hint')).toBeVisible()
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])

      // b. A correct instance through the real widget.
      await assertNoAnswerLeak(page)
      const solution = await solveInNode(page)
      if (id === 'click-through') await answerClick(page, solution as string[])
      else if (id === 'live-count') await answerLive(page, solution as LiveAnswer)
      else await answerViaUi(page, l1.kind, solution)
      await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')

      // d. data-passed turns true exactly when the rule is met: once → now; window (W C) → after one more.
      const logic = await logicFor(l1.gateKey, id, false)
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
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/bombe`])
    expect((await eventsOf(page, 'item.passed')).length).toBe(items.length)

    // 8. chapter.complete, and the next chapter unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/iii12-checking')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iii12-checking')).toHaveAttribute('data-locked', 'false')
  })

  test('the hint ladder on click-through: L1 text, L2 worked example on its own instance, L3 reveal; axe on each', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/click-through'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    await expect(page.getByTestId('item-click-through')).toHaveAttribute('data-passed', 'false')
  })

  test('the L2 worked example draws its own instance and passes axe', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    for (let k = 0; k < 2; k++) await answerViaApi(page, 'click-through', await wrongAnswer(page))
    const c = await current(page)
    expect(c.hintLevel).toBe(2)
    const worked = page.getByTestId('worked-example')
    await expect(worked).toBeVisible()
    // Its own loop, not the current one's.
    const loop = (c.instance as ClickInstance).loop.join(' → ')
    await expect(worked.getByTestId('worked-tables')).toBeVisible()
    await expect(worked).not.toContainText(`${loop} → ${(c.instance as ClickInstance).loop[0]}, with one scrambler`)
    expect(await axeSerious(page, '[data-testid="hint-panel"]')).toEqual([])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await answerViaApi(page, 'click-through', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'click-through', await solveInNode(page))
    await answerViaApi(page, 'click-through', await solveInNode(page))
    expect((await current(page)).itemId).toBe('live-count')
    await reloadKeepsSeed(page)
  })

  test('gaming: two instant answers bring the grid-probe fallback (one trip round the loop), answered on the wire grid', async ({
    page,
  }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'click-through', await wrongAnswer(page))
    await answerViaApi(page, 'click-through', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/bombe/click-through`, reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'click-through', fallback: true, kind: 'custom', hintLevel: 0 })
    const inst = c.instance as ProbeInstance
    expect(inst.mode).toBe('trip')
    await expect(page.getByTestId('item-click-through')).toHaveAttribute('data-fallback', 'true')
    expect(await axeSerious(page, '[data-testid="item-click-through"]')).toEqual([])
    await configure(page, { minLatencyMs: 0 })
    const cells = (await solveInNode(page)) as string[]
    for (const cell of cells.filter((x) => x !== probeStart(inst))) {
      await page.getByTestId(`probe-grid-cell-${cell[0]}-${cell[1]}`).click()
    }
    await expect(page.getByTestId('probe-answer')).toHaveAttribute('data-marked', cells.filter((x) => x !== probeStart(inst)).sort().join(' '))
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/bombe`]!.items['click-through']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'click-through', fallback: false, kind: 'chain' })
  })
})

test.describe('chapter iii11-bombe in 3D', { tag: ['@3d', '@chapter:iii11-bombe'] }, () => {
  test('under ?stage=3d: from the story to the eight-wire bombe, no stage, the bet gates the current', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    expect((await where(page)).scene).toBe('victory')
    await nextScene(page)
    expect((await where(page)).scene).toBe('wire-8')
    expect(await page.getByTestId('stage').count()).toBe(0)
    const [run8] = await sceneReveals(page)
    await assertRevealGated(page, run8!)
    await commitBet(page, 'live8', '1')
    await fireReveal(page, run8!)
    await page.getByTestId('wire8-run').click()
    await expect(page.getByTestId('wire8-register')).toHaveAttribute('data-live-count', '7')
    expect((await eventsOf(page, 'bet.resolve')).map((e) => e.correct)).toEqual([false])
  })
})
