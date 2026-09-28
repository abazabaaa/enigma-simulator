/**
 * Chapter III.10 · menus and loops (PLAN §4.4 "iii10-menus", §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 14):
 *  - Turing's story;
 *  - the menu-builder: the closures bet gates adding links; links added one by one with the keyboard (the counter
 *    follows E − V + C), the reveal adds the last and the closure counter reads 3;
 *  - the loop scene: the contradiction bet resolved from the bombe kit, following an assumption by hand, then the stop
 *    bet and Turing's table;
 *  - gate `menus`: each item wrong through the UI with its menu rollback and L1 hint, right through the widget, the
 *    rest through the API; the pass rule; the hint ladder, a reload mid-gate, the gaming fallback, chapter.complete;
 *  - @3d: the chapter under ?stage=3d across a scene change.
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
  nextScene,
  progress,
  reloadKeepsSeed,
  sceneReveals,
  solveInNode,
  where,
  wrongAnswer,
} from '../helpers/course'
import { closures, menuFromEdges } from '../../src/crypto/menu'
import { LOOP_TOY, V14_MENU, contradicts, menuSolution, type MenuInstance } from '../../src/chapters/iii10-menus/gates'

const CHAPTER = 'iii10-menus'

/** Serious or critical axe findings inside the current item (its rollback and hint states). */
async function axeItem(page: Page, id: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(`[data-testid="item-${id}"]`).analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** PLAN §4.4: every item of gate `menus` rolls back as `menu` (the MenuGraph with the loop in question). */
const ROLLBACK: Record<string, string> = { 'build-menu': 'menu', closures: 'menu', 'loop-return': 'menu' }

/** Add links to a MenuGraph through its buttons, with the keyboard (Enter on each). */
async function addLinks(page: Page, graph: string, positions: readonly number[]): Promise<void> {
  for (const pos of positions) {
    const button = page.getByTestId(`${graph}-add-${pos}`)
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveCount(0)
  }
}

/** build-menu through its own widget: these links, then submit. */
async function answerBuildMenu(page: Page, positions: readonly number[]): Promise<void> {
  await addLinks(page, 'build-menu-graph', positions)
  await expect(page.getByTestId('build-menu-answer')).toHaveAttribute('data-chosen', [...positions].sort((a, b) => a - b).join(','))
  await page.getByTestId('gate-submit').click()
  await expect(page.getByTestId('rollback')).toBeVisible()
}

async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter iii10-menus', { tag: '@chapter:iii10-menus' }, () => {
  test('scenes in order: the story, the closures bet and the menu built link by link, the loop and the stop table', async ({
    page,
  }) => {
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'turing', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Alan Turing')
    await expect(page.getByTestId('story-card')).toContainText('Welchman')
    await nextScene(page)

    // menu-builder: vector 14 with no crash; the bet gates every link.
    expect(await where(page)).toMatchObject({ scene: 'menu-builder', kind: 'explore' })
    await expectNextDisabled(page)
    expect(await page.getByTestId('stage').count(), 'a 2D-only scene: no stage').toBe(0)
    await expect(page.getByTestId('menu-builder-strip')).toHaveAttribute('data-crash-count', '0')
    const graph = page.getByTestId('menu-builder-graph')
    await expect(graph).toHaveAttribute('data-closures', '0')
    const [toggle] = await sceneReveals(page)
    expect(toggle).toMatchObject({ bet: 'closures', trigger: 'toggle' })
    await assertRevealGated(page, toggle!)
    await expect(page.locator('[data-testid^="menu-builder-graph-add-"]')).toHaveCount(0)
    await commitBet(page, 'closures', '3')

    // Links 1 … 11 one at a time: the counter is E − V + C of the links so far.
    const edges = [...V14_MENU.edges].sort((a, b) => a.pos - b.pos)
    for (let k = 1; k < edges.length; k++) {
      await addLinks(page, 'menu-builder-graph', [k])
      const want = closures(menuFromEdges(edges.slice(0, k)))
      await expect(graph).toHaveAttribute('data-closures', String(want))
    }
    await expect(page.getByTestId('menu-builder-log')).toContainText('joined two letters already connected')
    await expectNextDisabled(page)
    // The reveal adds the last link: the closure counter reads 3.
    await fireReveal(page, toggle!)
    await expect(graph).toHaveAttribute('data-edges', '12')
    await expect(graph).toHaveAttribute('data-closures', '3')
    await expect(page.getByTestId('menu-builder-graph-closures')).toContainText('Closures: 3')
    expect((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet, e.correct])).toContainEqual([`${CHAPTER}/closures`, true])
    await expect(page.getByTestId('task-add-all')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('menu-builder-result')).toContainText('12 − 10 + 1')
    await page.getByTestId('menu-loop-ATLK').click()
    await expect(graph.locator('[data-loop="true"]')).toHaveCount(4)
    // Delete removes a link again (the counter drops), Enter puts it back.
    await page.getByTestId('menu-builder-graph-remove-10').focus()
    await page.keyboard.press('Delete')
    await expect(graph).toHaveAttribute('data-closures', '2')
    await addLinks(page, 'menu-builder-graph', [10])
    await expect(graph).toHaveAttribute('data-closures', '3')
    await nextScene(page)

    // loop: which assumption contradicts itself round A–T–L–K (the truth from the kit's propagation) …
    expect(await where(page)).toMatchObject({ scene: 'loop', kind: 'explore' })
    await expectNextDisabled(page)
    const reveals = await sceneReveals(page)
    expect(reveals.map((r) => [r.bet, r.trigger])).toEqual([
      ['contradicts', 'run'],
      ['stops', 'play'],
    ])
    await assertRevealGated(page, reveals[0]!)
    await expect(page.getByTestId('loop-result')).toHaveCount(0)
    await expect(page.getByTestId('follow-loop')).toHaveCount(0)
    const wrong = LOOP_TOY.options.filter((x) => contradicts(x))
    expect(wrong).toHaveLength(1)
    await commitBet(page, 'contradicts', wrong[0]!)
    await fireReveal(page, reveals[0]!)
    for (const x of LOOP_TOY.options) {
      await expect(page.getByTestId(`loop-option-${x}`)).toHaveAttribute('data-contradicts', String(contradicts(x)))
    }
    // … an assumption of the learner's own, link by link …
    await page.getByTestId('follow-pick-W').click()
    for (let k = 0; k < 4; k++) await page.getByTestId('follow-next').click()
    await expect(page.getByTestId('follow-verdict')).toBeVisible()
    await expect(page.getByTestId('task-follow-loop')).toHaveAttribute('data-done', 'true')
    // The second closure T–N–S: of the two survivors of the first loop, only one survives both.
    const survivors = LOOP_TOY.options.filter((x) => !contradicts(x))
    expect(survivors).toHaveLength(2)
    for (const x of survivors) {
      await expect(page.getByTestId(`loop2-option-${x}`)).toHaveAttribute('data-contradicts', String(contradicts(x, true)))
    }
    await expect(page.getByTestId('second-loop-result')).toContainText('2 survivors of one loop, 1 of two')
    await expectNextDisabled(page)
    // … and Turing's table after the stop bet.
    await assertRevealGated(page, reveals[1]!)
    await expect(page.getByTestId('stop-table')).toHaveCount(0)
    await commitBet(page, 'stops', '2.2')
    await fireReveal(page, reveals[1]!)
    await expect(page.getByTestId('stop-row-3')).toContainText('2.2')
    await expect(page.getByTestId('stop-row-1')).toContainText('1,500')
    await expect(page.getByTestId('stop-row-0')).toContainText('40,000')
    const results = Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))
    expect(results).toMatchObject({ closures: true, contradicts: true, stops: true })
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expectNextDisabled(page)
  })

  test('gate menus: each item wrong through the UI, its rollback and L1 hint, right through the widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iii11-bombe')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    for (const id of items) {
      const c = await current(page)
      expect(c.itemId).toBe(id)
      const item = page.getByTestId(`item-${id}`)
      await expect(item).toHaveAttribute('data-current', 'true')

      // a. One wrong answer through the UI, its rollback, then the L1 hint (axe on the rollback and on the hint state,
      //    which shows the same prompt and widget as the question).
      await assertNoAnswerLeak(page)
      if (c.kind === 'custom') {
        // A working menu plus the link at the turnover: wrong.
        const i = c.instance as MenuInstance
        await expect(page.getByTestId(`build-menu-graph-add-${i.turnover}`)).toContainText('!')
        await expect(page.getByTestId('build-menu-windows')).toContainText(`${i.windows[0]}`)
        await expect(page.getByTestId('build-menu-windows')).toContainText(`${i.windows[1]}`)
        await answerBuildMenu(page, [...menuSolution(i), i.turnover])
      } else {
        await answerViaUi(page, c.kind, await wrongAnswer(page))
      }
      await assertRollback(page, ROLLBACK[id]!)
      await expect(page.getByTestId('menu-feedback')).toBeVisible()
      expect(await axeItem(page, id)).toEqual([])
      await continueGate(page)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      await expect(page.getByTestId('item-hint')).toBeVisible()
      expect(await axeItem(page, id)).toEqual([])

      // b. A correct instance through the real widget.
      await assertNoAnswerLeak(page)
      if (l1.kind === 'custom') await answerBuildMenu(page, (await solveInNode(page)) as number[])
      else await answerViaUi(page, l1.kind, await solveInNode(page))
      await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')

      // d. data-passed turns true exactly when the rule is met (W C: not yet).
      await expect(item).toHaveAttribute('data-passed', 'false')
      await continueGate(page)
      // c. The remaining instance through the API.
      await assertNoAnswerLeak(page)
      const after = await answerViaApi(page, id, await solveInNode(page), { continue: false })
      expect(after.correct).toBe(true)
      await expect(item).toHaveAttribute('data-passed', 'true')
      await continueGate(page)
    }
    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/menus`])

    // 8. chapter.complete, and III.11 unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/iii11-bombe')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iii11-bombe')).toHaveAttribute('data-locked', 'false')
  })

  test('the hint ladder on build-menu, and a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    await expect(page.getByTestId('item-build-menu')).toHaveAttribute('data-passed', 'false')
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/build-menu'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    // L1 and L2 again (axe on the worked example), then a reload.
    await answerViaApi(page, 'build-menu', await wrongAnswer(page))
    await answerViaApi(page, 'build-menu', await wrongAnswer(page))
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '2')
    await expect(page.getByTestId('worked-example')).toBeVisible()
    expect(await axeItem(page, 'build-menu')).toEqual([])
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'build-menu', await solveInNode(page))
    await answerViaApi(page, 'build-menu', await solveInNode(page))
    expect((await current(page)).itemId).toBe('closures')
    await reloadKeepsSeed(page)
  })

  test('gaming: two instant answers bring the build-menu fallback, answered on its graph', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await answerViaApi(page, 'build-menu', await solveInNode(page))
    await answerViaApi(page, 'build-menu', await solveInNode(page))
    expect((await current(page)).itemId).toBe('closures')
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'closures', await wrongAnswer(page))
    await answerViaApi(page, 'closures', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/menus/closures`, reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'closures', fallback: true, kind: 'custom', hintLevel: 0 })
    await expect(page.getByTestId('item-closures')).toHaveAttribute('data-fallback', 'true')
    await configure(page, { minLatencyMs: 0 })
    await answerBuildMenu(page, menuSolution(c.instance as MenuInstance))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/menus`]!.items['closures']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'closures', fallback: false, kind: 'numbers' })
  })
})

test.describe('chapter iii10-menus in 3D', { tag: ['@3d', '@chapter:iii10-menus'] }, () => {
  test('under ?stage=3d: from the story to the menu-builder, keyboard-built, no stage and no WebGL errors', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    expect((await where(page)).scene).toBe('turing')
    await nextScene(page)
    expect((await where(page)).scene).toBe('menu-builder')
    expect(await page.getByTestId('stage').count()).toBe(0)
    await commitBet(page, 'closures', '2')
    await addLinks(page, 'menu-builder-graph', [1, 2, 3, 12])
    await expect(page.getByTestId('menu-builder-graph')).toHaveAttribute('data-closures', '1')
    await fireReveal(page, { bet: 'closures', trigger: 'toggle' })
    await expect(page.getByTestId('menu-builder-graph')).toHaveAttribute('data-closures', '3')
    expect((await eventsOf(page, 'bet.resolve')).map((e) => e.correct)).toEqual([false])
  })
})
