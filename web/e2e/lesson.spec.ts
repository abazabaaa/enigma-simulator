/**
 * The lesson engine on the fixture chapter (#/lab/fixture): every chapter-template assertion (PLAN §6.0
 * CHAPTER PR TEMPLATE 1–8 and the code-gate extras) plus the runner kill, gaming, corrupt-progress,
 * return-check and double-submit tests of brief 05.
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { gotoApp, waitForApp } from './helpers/app'
import {
  agentPasteProbe,
  answerCorrect,
  answerViaApi,
  answerViaUi,
  assertFocus,
  assertLadder,
  assertNoAnswerLeak,
  assertRevealGated,
  assertRollback,
  commitBet,
  configure,
  continueGate,
  editProgress,
  current,
  enter,
  eventsOf,
  expectNextDisabled,
  fireReveal,
  gate,
  logicFor,
  nextScene,
  passGate,
  progress,
  reloadKeepsSeed,
  sceneReveals,
  setMachine,
  solveInNode,
  typeCodeAndRun,
  walkChapter,
  where,
  wrongAnswer,
} from './helpers/course'
import { DOUBLE_REFERENCE } from '../src/lesson/fixture/gates'
import { PROGRESS_CORRUPT_KEY, PROGRESS_KEY } from '../src/contracts/progress'

/** Open gate `main` alone (#/lab/gate) with the e2e configuration. */
async function openGateLab(page: Page, gateId = 'main'): Promise<void> {
  await gotoApp(page, `/lab/gate/lab-fixture/${gateId}`, { stage: '2d' })
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  await current(page)
}

/** Answer items through the API until `itemId` is current. */
async function advanceTo(page: Page, itemId: string): Promise<void> {
  for (let k = 0; k < 40 && (await current(page)).itemId !== itemId; k++) await answerCorrect(page)
  expect((await current(page)).itemId).toBe(itemId)
}

/** Drive the custom toy-set Answer to position `p` and submit. */
async function answerToySet(page: Page, p: number): Promise<void> {
  const inc = page.getByTestId('toy-set-inc')
  for (let k = 0; k < p; k++) await inc.click()
  await page.getByTestId('gate-submit').click()
}

const ROLLBACK: Record<string, string> = {
  'toy-lamp': 'path',
  windows: 'windows',
  lengths: 'cycles',
  self: 'none',
  'press-order': 'order',
  'toy-chain': 'path',
  'middle-steps': 'machine',
  'which-wrong': 'path',
  double: 'none',
  'toy-set': 'machine',
}

test.describe('lesson engine on the fixture chapter', { tag: '@area:lesson' }, () => {
  test('scenes in order: story, bets gating every reveal, focus, tasks and recall', async ({ page }) => {
    await enter(page, 'lab-fixture')
    // 1. The story scene: a card with the static act clock; Next is always enabled.
    expect(await where(page)).toMatchObject({ scene: 'story', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Arthur Scherbius')
    await expect(page.getByTestId('act-clock')).toHaveAttribute('aria-label', /23 February 1918/)
    await nextScene(page)

    // 2. Bets gate every reveal; 3. the stage focus and dimming.
    expect(await where(page)).toMatchObject({ scene: 'bets-press', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [press, step, play] = await sceneReveals(page)
    await assertRevealGated(page, press!)
    await commitBet(page, 'first-lamp', 'C')
    await fireReveal(page, press!)
    await expect(page.getByTestId('lamp-result')).toBeVisible()
    await assertRevealGated(page, step!)
    await commitBet(page, 'steps', 'right')
    await fireReveal(page, step!)
    await assertRevealGated(page, play!)
    await commitBet(page, 'count', '11')
    await fireReveal(page, play!)
    await expect(page.getByTestId('hop-count')).toContainText('11')
    expect((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet, e.correct])).toEqual([
      ['lab-fixture/first-lamp', false],
      ['lab-fixture/steps', true],
      ['lab-fixture/count', true],
    ])
    // The task needs real presses; scene-next stays disabled until then.
    await expectNextDisabled(page)
    await page.getByTestId('key-B').click()
    await page.getByTestId('key-C').click()
    await expect(page.getByTestId('task-press2')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'bets-toggle' })
    await assertFocus(page, 'rotor-stack')
    for (const r of await sceneReveals(page)) {
      await assertRevealGated(page, r)
      await commitBet(page, r.bet, r.bet === 'search' ? 'never' : 'changes')
      await fireReveal(page, r)
    }
    await expect(page.getByTestId('search-result')).toContainText('0 times')
    await expect(page.getByTestId('task-seen')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    // The recall scene: three items from the pool, answered with solveInNode.
    expect(await where(page)).toMatchObject({ scene: 'recall', kind: 'recall', canNext: false })
    const g = (await gate(page))!
    expect(g.key).toBe('lab-fixture/recall')
    expect(g.items).toHaveLength(3)
    await passGate(page)
    expect((await progress(page)).recall).toEqual(
      Object.fromEntries(g.items.map((it) => [it.itemId, expect.objectContaining({ correct: 1, wrong: 0 })])),
    )
    await nextScene(page)
    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await assertFocus(page, 'wire')
  })

  test('gate main: every item kind through its widget, rollback, L1 hint and the pass rule', async ({ page }) => {
    test.setTimeout(60_000)
    await openGateLab(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    for (const id of items) {
      const c = await current(page)
      expect(c.itemId).toBe(id)
      const item = page.getByTestId(`item-${id}`)
      await expect(item).toHaveAttribute('data-current', 'true')

      if (c.kind === 'set-machine') {
        // 6. The keyboard is locked, the lamps hidden, and moving the controls submits nothing.
        await expect(page.getByTestId('key-A')).toBeDisabled()
        const threw = await page.evaluate(() => {
          try {
            window.__enigma!.pressKey('A')
            return false
          } catch {
            return true
          }
        })
        expect(threw).toBe(true)
        expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
        expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
        const submits = (await eventsOf(page, 'item.submit')).length
        const l = await logicFor(c.gateKey, c.itemId, false)
        await setMachine(page, JSON.parse(JSON.stringify(l.sampleAnswer(c.instance, () => 0.37))))
        expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
      }

      // a. One wrong answer through the UI, its rollback, then the L1 hint.
      await assertNoAnswerLeak(page)
      let wrong: unknown = null
      if (c.kind === 'code') {
        // The reference solution with a wrong prediction is still wrong.
        await typeCodeAndRun(page, DOUBLE_REFERENCE, '43')
      } else if (c.kind === 'custom') {
        wrong = ((await solveInNode(page)) as number) === 0 ? 1 : 0
        await answerToySet(page, wrong as number)
      } else {
        wrong = await wrongAnswer(page)
        await answerViaUi(page, c.kind, wrong)
      }
      await assertRollback(page, ROLLBACK[id]!)
      if (id === 'lengths') await expect(page.getByTestId('cycles-feedback')).toBeVisible()
      await continueGate(page)
      const l1 = await current(page)
      expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      const logic = await logicFor(l1.gateKey, id, false)
      const hint = logic.highlight(l1.instance, wrong).map((h) => h.part)
      if (hint.length) {
        await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(expect.arrayContaining([hint[0]]))
      }

      // b. A correct instance through the real widget.
      await assertNoAnswerLeak(page)
      const solution = await solveInNode(page)
      if (c.kind === 'code') await typeCodeAndRun(page, DOUBLE_REFERENCE, '42')
      else if (c.kind === 'custom') await answerToySet(page, solution as number)
      else await answerViaUi(page, c.kind, solution)
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
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual(['lab-fixture/lab:main'])
    expect((await eventsOf(page, 'item.passed')).length).toBe(items.length)
  })

  test('the hint ladder: L1 highlight, L2 worked example on another instance, L3 reveal and a fresh instance', async ({ page }) => {
    await openGateLab(page)
    await assertLadder(page)
    const shows = await eventsOf(page, 'item.show')
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    const outcomes = (await progress(page)).gates['lab-fixture/lab:main']!.items['toy-lamp']!.outcomes
    expect(outcomes.map((o) => o.result)).toEqual(['wrong', 'wrong', 'wrong', 'revealed'])
  })

  test('the puzzle ladder gives no hint before attempt 3', async ({ page }) => {
    await openGateLab(page, 'puzzle')
    await assertLadder(page, { puzzle: true })
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await openGateLab(page)
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await answerCorrect(page)
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0 })
    await advanceTo(page, 'windows')
    await reloadKeepsSeed(page)
  })

  test('code gate: prediction first, probes and the agent-paste probe', async ({ page }) => {
    test.setTimeout(45_000)
    await openGateLab(page)
    await advanceTo(page, 'double')
    const run = page.getByTestId('code-run')
    await expect(run).toBeDisabled()
    await page.getByTestId('code-editor').fill(DOUBLE_REFERENCE)
    await expect(run).toBeDisabled()
    await page.getByTestId('gate-prediction').fill('42')
    await expect(run).toBeEnabled()
    await page.getByTestId('gate-prediction').fill('')
    await expect(run).toBeDisabled()

    // Wrong code with the right probe is wrong.
    await typeCodeAndRun(page, 'function double(x) {\n  return x + 2\n}\n', '42')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'false')
    await continueGate(page)
    // The probe locks when Run starts.
    await typeCodeAndRun(page, DOUBLE_REFERENCE, '41')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'false')
    await continueGate(page)

    // Agent paste: the reference and the Node-computed probe pass the code item …
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await continueGate(page)
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await continueGate(page)
    expect(await page.getByTestId('item-double').getAttribute('data-passed')).toBe('true')
    // … but while the in-page item is wrong, the gate stays unpassed.
    expect((await current(page)).itemId).toBe('toy-set')
    await answerToySet(page, (((await solveInNode(page)) as number) + 1) % 6)
    await assertRollback(page, 'machine')
    await continueGate(page)
    expect((await gate(page))!.passed).toBe(false)
    expect(await page.getByTestId('gate').getAttribute('data-passed')).toBe('false')
    // The learner's code persisted per item.
    const saved = await page.evaluate(() => localStorage.getItem('enigma.code.lab-fixture/lab:main/double'))
    expect(saved).toBe(DOUBLE_REFERENCE)
  })

  test('an endless loop is killed within 2 s and the page stays responsive', async ({ page }) => {
    await openGateLab(page)
    await advanceTo(page, 'double')
    await page.getByTestId('code-editor').fill('function double(x) {\n  while (true) {}\n}\n')
    await page.getByTestId('gate-prediction').fill('42')
    const started = Date.now()
    await page.getByTestId('code-run').click()
    await expect(page.getByTestId('rollback')).toContainText(/ran too long/, { timeout: 2_000 })
    expect(Date.now() - started).toBeLessThan(2_000)
    // The page never froze: the worker was terminated, a fresh one runs the next attempt.
    await continueGate(page)
    await typeCodeAndRun(page, DOUBLE_REFERENCE, '42')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
  })

  test('too-long code is not submitted, and the prediction locks when Run starts', async ({ page }) => {
    await openGateLab(page)
    await advanceTo(page, 'double')
    const submits = (await eventsOf(page, 'item.submit')).length
    await page.getByTestId('code-editor').fill('function double(x) {\n  const a = x\n  const b = a\n  const c = b\n  return c * 2\n}\n')
    await page.getByTestId('gate-prediction').fill('42')
    await page.getByTestId('code-run').click()
    await expect(page.getByTestId('code-result')).toHaveAttribute('data-status', 'too-long')
    await expect(page.getByTestId('gate-prediction')).toHaveAttribute('readonly', '')
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
    // Tab in the editor inserts two spaces.
    const editor = page.getByTestId('code-editor')
    await editor.fill('x')
    await editor.press('End')
    await editor.press('Tab')
    await expect(editor).toHaveValue('x  ')
  })

  test('gaming: two instant answers switch to an in-page fallback with the keyboard locked', async ({ page }) => {
    await openGateLab(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: 'lab-fixture/lab:main/toy-lamp', reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'toy-lamp', fallback: true, kind: 'set-machine' })
    await expect(page.getByTestId('item-toy-lamp')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    await expect(page.getByTestId('set-machine')).toBeVisible()
    // The fallback's outcome is recorded on the item; then it is back to its own kind.
    await configure(page, { minLatencyMs: 0 })
    await answerViaApi(page, 'toy-lamp', await solveInNode(page))
    const rec = (await progress(page)).gates['lab-fixture/lab:main']!.items['toy-lamp']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ fallback: false, kind: 'letter' })
  })

  test('a double submit records one outcome', async ({ page }) => {
    await openGateLab(page)
    await page.getByTestId('answer-letter').fill(String(await wrongAnswer(page)))
    await page.getByTestId('gate-submit').dblclick()
    await expect(page.getByTestId('rollback')).toBeVisible()
    expect(await eventsOf(page, 'item.submit')).toHaveLength(1)
    await expect(() => page.evaluate(() => window.__course!.answer('toy-lamp', 'A'))).rejects.toThrow(/continue/)
    expect((await progress(page)).gates['lab-fixture/lab:main']!.items['toy-lamp']!.outcomes).toHaveLength(1)
  })

  test('a corrupt progress value is quarantined and a notice shown', async ({ page }) => {
    await gotoApp(page, '/course')
    await page.evaluate(([k]) => localStorage.setItem(k!, '{"version":7,"broken'), [PROGRESS_KEY])
    await page.reload()
    await waitForApp(page)
    await expect(page.getByTestId('progress-notice')).toBeVisible()
    expect(await page.evaluate(([k]) => localStorage.getItem(k!), [PROGRESS_CORRUPT_KEY])).toBe('{"version":7,"broken')
    const p = await progress(page)
    expect(p).toMatchObject({ version: 1, chapters: {}, gates: {} })
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-locked', 'false')
  })

  test('configure({ now: +7 h }) shows the return check, which clears after its two items', async ({ page }) => {
    await enter(page, 'lab-fixture')
    // A completed Act I chapter makes Act I items eligible.
    await editProgress(page, (p) => (p.chapters['i1-anatomy'] = { reached: 5, completed: true, tasks: [] }), '/lab/fixture')
    await expect.poll(async () => (await where(page)).scene).toBe('story')
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    await configure(page, { now: Date.now() + 7 * 3600_000 })
    await expect(page.getByTestId('return-check')).toBeVisible()
    const [check] = await eventsOf(page, 'return-check')
    expect(check!.items).toHaveLength(2)
    for (let k = 0; k < 2; k++) {
      const g = (await gate(page))!
      expect(g.key).toMatch(/^lab-fixture\/return-\d+-\d$/)
      await answerCorrect(page)
    }
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    expect((await gate(page))).toBeNull()
  })

  test('the whole fixture walks to chapter.complete', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, 'lab-fixture')
    const focus: Record<string, string> = { 'bets-press': 'wire', 'bets-toggle': 'rotor-stack', gate: 'wire', puzzle: 'wire' }
    await walkChapter(page, {
      onScene: async (scene) => {
        if (focus[scene]) await assertFocus(page, focus[scene] as 'wire')
      },
    })
    expect((await progress(page)).chapters['lab-fixture']).toMatchObject({ completed: true })
    await expect(page.getByTestId('chapter-complete')).toBeVisible()
    expect((await eventsOf(page, 'scene.complete')).map((e) => e.scene)).toEqual([
      'story',
      'bets-press',
      'bets-toggle',
      'recall',
      'gate',
      'puzzle',
    ])
  })
})
