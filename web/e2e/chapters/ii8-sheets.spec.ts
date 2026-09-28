/**
 * Chapter II.8 · Zygalski sheets (PLAN §4.4 "ii8-sheets", optional; §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 13):
 *  - the story; the females (the survive bet gates the first sheet: about 40% holes, from the kit); the light table
 *    (stack the day's 51 × 51 sheets until at most two settings are lit; the isolate bet gates the scale-up: about 12
 *    females for 105,456 settings);
 *  - gate `sheets`: each estimate wrong through the number field, its rollback and L1 hint, right through the field,
 *    the rest through the API; chapter.complete and III.9 next;
 *  - the ladder, a reload, and the gaming fallback stack-to-one (a light table stacked until one setting is lit) on
 *    #/lab/gate; II.8 never blocks III.9;
 *  - @3d: across scene changes the chapter mounts no stage and loses no context.
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
  editProgress,
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
import { firstAlone, idx, sceneDay, stackSolve, type StackInstance } from '../../src/chapters/ii8-sheets/gates'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'ii8-sheets'

/** The rollback kind of each item (numbers estimates: 'none', with the learner's own answer explained). */
const ROLLBACK: Record<string, string> = { 'females-needed': 'none', survivors: 'none' }

async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

const betResults = async (page: Page) =>
  Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))

async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 5 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

async function openGateLab(page: Page): Promise<void> {
  await gotoApp(page, `/lab/gate/${CHAPTER}/sheets`, { stage: '2d' })
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  await current(page)
}

test.describe('chapter ii8-sheets', { tag: '@chapter:ii8-sheets' }, () => {
  test('scenes in order: the story, females and their sheet, the light table converging', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'zygalski', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Henryk Zygalski')
    await nextScene(page)

    // females: the survive bet gates the first sheet.
    expect(await where(page)).toMatchObject({ scene: 'females', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    await expect(page.getByTestId('females-traffic')).toHaveAttribute('data-females', '14')
    expect(await page.locator('[data-testid="females-traffic"] [data-female="true"]').count()).toBeGreaterThanOrEqual(28)
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'survive', trigger: 'play' })
    await assertRevealGated(page, play!)
    await expect(page.getByTestId('females-sheet')).toHaveCount(0)
    await commitBet(page, 'survive', '90')
    await fireReveal(page, play!)
    await expect(page.getByTestId('females-sheet')).toBeVisible()
    const share = Number(await page.getByTestId('females-share').getAttribute('data-share'))
    expect(share).toBeGreaterThan(0.37)
    expect(share).toBeLessThan(0.43)
    expect(await betResults(page)).toMatchObject({ survive: false })
    await nextScene(page)

    // light-table: stack until at most two settings are lit; the isolate bet gates the scale-up.
    expect(await where(page)).toMatchObject({ scene: 'light-table', kind: 'explore' })
    await expectNextDisabled(page)
    const [scale] = await sceneReveals(page)
    expect(scale).toMatchObject({ bet: 'isolate', trigger: 'play' })
    const lit = page.getByTestId('light-table-settings')
    await expect(lit).toHaveAttribute('data-count', '676')
    const day = sceneDay()
    const k = firstAlone(day.day.rotors, idx(day.day.rings[0]!), day.females)!
    let counts: number[] = []
    for (let n = 0; n < k; n++) {
      await page.getByTestId('light-table-add').click()
      await expect(page.getByTestId('light-table')).toHaveAttribute('data-shown', String(n + 1))
      counts.push(Number(await lit.getAttribute('data-count')))
    }
    counts = [676, ...counts]
    // Each sheet keeps some of what was lit, never more; the day's own setting is the last light.
    for (let n = 1; n < counts.length; n++) expect(counts[n]).toBeLessThanOrEqual(counts[n - 1]!)
    expect(counts.at(-1)).toBe(1)
    await expect(lit).toHaveAttribute('aria-live', 'polite')
    await expect(page.getByTestId('task-converge')).toHaveAttribute('data-done', 'true')
    await expectNextDisabled(page)
    await assertRevealGated(page, scale!)
    await commitBet(page, 'isolate', '12')
    await fireReveal(page, scale!)
    await expect(page.getByTestId('light-table-scale')).toHaveAttribute('data-needed', '12')
    expect(await betResults(page)).toMatchObject({ isolate: true })
    await nextScene(page)
    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
  })

  test('gate sheets: each estimate wrong, its rollback and L1 hint, right through the field; chapter.complete, III.9 next', async ({
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
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])

      // a. One wrong answer through the number field: its rollback explains the learner's own number.
      await assertNoAnswerLeak(page)
      await answerViaUi(page, 'numbers', await wrongAnswer(page))
      await assertRollback(page, ROLLBACK[id]!)
      await expect(page.getByTestId('rollback')).toContainText(id === 'females-needed' ? 'would still let light through' : 'sheets, not')
      await continueGate(page)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      await expect(page.getByTestId('item-prompt')).toContainText(id === 'females-needed' ? 'log(N/2)' : 'The shares multiply')

      // b. A correct instance through the field; d. the window passes after one more (c. through the API).
      await assertNoAnswerLeak(page)
      await answerViaUi(page, 'numbers', await solveInNode(page))
      await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
      await expect(item).toHaveAttribute('data-passed', 'false')
      await continueGate(page)
      await assertNoAnswerLeak(page)
      expect((await answerViaApi(page, id, await solveInNode(page), { continue: false })).correct).toBe(true)
      await expect(item).toHaveAttribute('data-passed', 'true')
      await continueGate(page)
    }
    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/sheets`])

    // 8. chapter.complete; the next chapter is III.9.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/iii9-cribs')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
  })

  test('the hint ladder on females-needed: L1, L2 worked example on another instance, L3 reveal', async ({ page }) => {
    await openGateLab(page)
    await assertLadder(page, { highlights: false })
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/females-needed'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await openGateLab(page)
    await answerViaApi(page, 'females-needed', await wrongAnswer(page))
    await reloadKeepsSeed(page)
  })

  test('gaming: two instant answers bring stack-to-one, stacked on the light table until one setting is lit', async ({ page }) => {
    await openGateLab(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'females-needed', await wrongAnswer(page))
    await answerViaApi(page, 'females-needed', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/lab:sheets/females-needed`, reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'females-needed', fallback: true, kind: 'custom' })
    await expect(page.getByTestId('item-females-needed')).toHaveAttribute('data-fallback', 'true')
    await configure(page, { minLatencyMs: 0 })
    expect(await axeSerious(page, '[data-testid="item-females-needed"]')).toEqual([])
    const [k, setting] = stackSolve(c.instance as StackInstance)
    for (let n = 0; n < k; n++) await page.getByTestId('stack-table-add').click()
    await expect(page.getByTestId('stack-lit')).toHaveAttribute('data-count', '1')
    await expect(page.getByTestId('stack-lit')).toContainText(`right ring ${String((setting % 26) + 1).padStart(2, '0')}`)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/lab:sheets`]!.items['females-needed']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'females-needed', fallback: false, kind: 'numbers' })
  })

  test('II.8 is optional: with II.7 complete and II.8 not, III.9 is open', async ({ page }) => {
    await enter(page, CHAPTER)
    await editProgress(page, (p) => (p.chapters['ii7-catalogue'] = { reached: 3, completed: true, tasks: [] }), '/course')
    await expect(page.getByTestId('chapter-link-ii8-sheets')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('chapter-link-iii9-cribs')).toHaveAttribute('data-locked', 'false')
    await gotoApp(page, '/c/iii9-cribs')
    await expect(page.getByTestId('locked-page')).toHaveCount(0)
  })
})

test.describe('chapter ii8-sheets in 3D', { tag: ['@3d', '@chapter:ii8-sheets'] }, () => {
  test('across scene changes the chapter mounts no stage and keeps working', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(90_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('females')
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await completeScene(page)
    expect((await where(page)).scene).toBe('light-table')
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await page.getByTestId('light-table-add').click()
    await expect(page.getByTestId('light-table')).toHaveAttribute('data-shown', '1')
    expect(await page.evaluate(() => window.__stage!.stats())).toBeNull()
  })
})
