/**
 * The lesson engine on the fixture chapter (#/lab/fixture): every chapter-template assertion (PLAN §6.0
 * CHAPTER PR TEMPLATE 1–8 and the code-gate extras) plus the runner kill, gaming, corrupt-progress,
 * return-check and double-submit tests of brief 05.
 */

import AxeBuilder from '@axe-core/playwright'
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
import type { HighlightWithResult } from '../src/lesson/gateEngine'
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

/**
 * Serious or critical axe findings inside one element. The page around it, and other PRs' placeholder stubs
 * inside it ([data-stub]), are not this PR's to judge.
 */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
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
    // Round 2: Next into a gate puts the focus on its first answer control.
    await expect(page.locator('[data-role="answer"] :focus')).toHaveCount(1)
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

      // Each widget is accessible (review M2: the order list has no nested interactive roles).
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])
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
      // Round 3: L1 comes from the ANSWERED instance (c), the wrong answer and its check, not from the fresh
      // instance (l1) the learner now sees. (The code item's answer is the runner's; its highlight ignores it.)
      expect(l1.instance).not.toEqual(c.instance)
      const logic = await logicFor(l1.gateKey, id, false)
      const result = wrong === null ? undefined : logic.check(c.instance, wrong)
      const hint = (logic.highlight as HighlightWithResult).call(logic, c.instance, wrong, result).map((h) => h.part)
      await expect
        .poll(() => page.evaluate(() => [...window.__stage!.info().highlighted].sort()))
        .toEqual([...hint].sort())

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

  test('the hint ladder: L1 highlight, L2 worked example on another instance, L3 reveal and a fresh instance', async ({
    page,
  }) => {
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

    // Agent paste: the reference and the Node-computed probe pass the code item (once: its probe is constant) …
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
    // Measured in the page (from the Run click to the rollback, frame by frame), not across the test channel.
    const ms = await page.evaluate(async () => {
      const started = performance.now()
      document.querySelector<HTMLButtonElement>('[data-testid="code-run"]')!.click()
      await new Promise<void>((resolve) => {
        const check = () =>
          document.querySelector('[data-testid="rollback"]') ? resolve() : requestAnimationFrame(check)
        check()
      })
      return performance.now() - started
    })
    expect(ms).toBeLessThan(2_000)
    await expect(page.getByTestId('rollback')).toContainText(/ran too long/)
    // The page never froze: the worker was terminated, a fresh one runs the next attempt.
    await continueGate(page)
    await typeCodeAndRun(page, DOUBLE_REFERENCE, '42')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
  })

  test('too-long code is not submitted, and the prediction locks when Run starts', async ({ page }) => {
    await openGateLab(page)
    await advanceTo(page, 'double')
    const submits = (await eventsOf(page, 'item.submit')).length
    await page
      .getByTestId('code-editor')
      .fill('function double(x) {\n  const a = x\n  const b = a\n  const c = b\n  return c * 2\n}\n')
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
    expect(await eventsOf(page, 'gaming')).toEqual([
      { type: 'gaming', item: 'lab-fixture/lab:main/toy-lamp', reason: 'fast' },
    ])
    const c = await current(page)
    // Review M1: the fallback starts fresh at hint level 0, with its own widget and Submit.
    expect(c).toMatchObject({ itemId: 'toy-lamp', fallback: true, kind: 'set-machine', hintLevel: 0 })
    await expect(page.getByTestId('hint-panel')).toHaveCount(0)
    await expect(page.getByTestId('gate-submit')).toBeVisible()
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

  test('round 3: instant correct answers that pass an item never switch it to a fallback', async ({ page }) => {
    await openGateLab(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'toy-lamp', await solveInNode(page))
    await answerViaApi(page, 'toy-lamp', await solveInNode(page))
    expect(await eventsOf(page, 'gaming')).toEqual([])
    const rec = (await progress(page)).gates['lab-fixture/lab:main']!.items['toy-lamp']!
    expect(rec).toMatchObject({ passed: true, fallbackNext: false })
    expect(await current(page)).toMatchObject({ itemId: 'windows', fallback: false })
    await expect(page.getByTestId('item-toy-lamp')).not.toHaveAttribute('data-fallback', 'true')
  })

  test('ghost-pick: nothing answer-bearing during the question; the ghost appears only in the rollback', async ({
    page,
  }) => {
    await openGateLab(page)
    await advanceTo(page, 'which-wrong')
    const c = await current(page)
    // Review B1: no ghost/reference on the stage and no divergence in the instance while the question is open.
    expect(await page.evaluate(() => window.__stage!.info().ghost)).toBe(false)
    expect((c.instance as { ghost: { divergeAt: number } }).ghost.divergeAt).toBe(-1)
    expect(JSON.stringify(await page.evaluate(() => window.__course!.gate()))).not.toMatch(/"divergeAt":\d/)
    await assertNoAnswerLeak(page)
    const picked = String(await wrongAnswer(page))
    await answerViaUi(page, 'ghost-pick', picked)
    await assertRollback(page, 'path')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().ghost)).toBe(true)
    // Review m6: the rollback contrasts the pick with the faulty part, and calls red the fault, not the learner's path.
    await expect(page.getByTestId('ghost-pick-verdict')).toContainText('You picked')
    await continueGate(page)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().ghost)).toBe(false)
    await assertNoAnswerLeak(page)
  })

  test('honest 2.5 s answers never trip the ladder: the item itself climbs to L3', async ({ page }) => {
    await openGateLab(page)
    await configure(page, { minLatencyMs: 2000, burstMs: 5000 })
    // Move the lesson clock instead of waiting: after one right answer, three wrong answers each come 2.5 s
    // after their instance was shown.
    let t = Date.now() + 3_600_000
    await configure(page, { now: t })
    await answerViaApi(page, 'toy-lamp', await solveInNode(page), { continue: false })
    for (let k = 0; k < 3; k++) {
      t += 10_000
      await configure(page, { now: t })
      await continueGate(page)
      await configure(page, { now: t + 2_500 })
      await answerViaApi(page, 'toy-lamp', await wrongAnswer(page), { continue: false })
    }
    await configure(page, { now: t + 10_000 })
    await continueGate(page)
    expect(await eventsOf(page, 'gaming')).toEqual([])
    expect(await current(page)).toMatchObject({ itemId: 'toy-lamp', fallback: false, hintLevel: 3 })
    const outcomes = (await progress(page)).gates['lab-fixture/lab:main']!.items['toy-lamp']!.outcomes
    expect(outcomes.map((o) => o.result)).toEqual(['correct', 'wrong', 'wrong', 'wrong'])
    for (const o of outcomes.slice(1)) expect(o.ms).toBeGreaterThan(2_400)
  })

  test('focus follows the gate, and one live region reports each step', async ({ page }) => {
    await openGateLab(page)
    const status = page.getByTestId('gate-status')
    await expect(status).toContainText('Item 1 of 10, attempt 1')
    await page.getByTestId('answer-letter').fill(String(await wrongAnswer(page)))
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('gate-continue')).toBeFocused()
    await expect(status).toContainText('Not quite')
    await page.getByTestId('gate-continue').click()
    await expect(page.getByTestId('answer-letter')).toBeFocused()
    await expect(status).toContainText('attempt 2. Hint level 1.')
    for (let k = 0; k < 2; k++) {
      await answerViaApi(page, 'toy-lamp', await wrongAnswer(page))
    }
    // L3: the only control is "Got it", and it has the focus; afterwards the new instance's input does.
    await expect(page.getByTestId('gate-continue')).toBeFocused()
    await page.getByTestId('gate-continue').click()
    await expect(page.getByTestId('answer-letter')).toBeFocused()
    expect(await page.locator('[role="status"][aria-live="polite"]').count()).toBeGreaterThanOrEqual(1)
    expect(
      await page.locator('[data-testid="rollback"][aria-live], [data-testid="hint-panel"][aria-live]').count(),
    ).toBe(0)
  })

  test('reveals fire in scene order', async ({ page }) => {
    await enter(page, 'lab-fixture')
    await nextScene(page)
    // Review m8: committing the second bet first does not let its trigger jump the queue.
    await commitBet(page, 'steps', 'right')
    await expect(page.getByTestId('reveal-steps')).toBeDisabled()
    await expect(page.getByTestId('reveal-steps')).toContainText('after the earlier reveal')
    // Round 3 (b): its trigger cannot fire yet, so the focus goes on to the bet still open, never to <body>.
    await expect(page.locator('[data-testid^="bet-option-first-lamp-"]').first()).toBeFocused()
    const [press, step] = await sceneReveals(page)
    await commitBet(page, 'first-lamp', 'B')
    await expect(page.getByTestId('reveal-steps')).toBeDisabled()
    await fireReveal(page, press!)
    await expect(page.getByTestId('reveal-steps')).toBeEnabled()
    await fireReveal(page, step!)
    expect((await eventsOf(page, 'reveal')).map((e) => e.bet)).toEqual(['lab-fixture/first-lamp', 'lab-fixture/steps'])
    expect(await page.evaluate(() => window.__enigma!.getState().positions)).toBe('AAC')
  })

  test('round 2: focus moves on to the next control after Next and after each bet', async ({ page }) => {
    await enter(page, 'lab-fixture')
    await nextScene(page)
    // Next from the story: the first bet control has the focus, not <body>.
    await expect(page.locator('[data-testid^="bet-option-"], [data-testid^="bet-input-"]').first()).toBeFocused()
    // Committing the press bet: its key has the focus, and Enter presses it (the reveal fires).
    await commitBet(page, 'first-lamp', 'C')
    await expect(page.getByTestId('key-A')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await eventsOf(page, 'reveal')).length).toBe(1)
    // Committing the step bet: its Step button has the focus, and Enter fires it.
    await commitBet(page, 'steps', 'right')
    await expect(page.getByTestId('reveal-steps')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await eventsOf(page, 'reveal')).length).toBe(2)
    // The last bet is a number: Enter in its input commits it, and its 'play' trigger has the focus next.
    await page.getByTestId('bet-input-count').fill('11')
    await page.getByTestId('bet-input-count').press('Enter')
    await expect.poll(async () => (await eventsOf(page, 'bet.commit')).length).toBe(3)
    await expect(page.getByTestId('reveal-count')).toBeFocused()
  })

  test('round 2: Enter submits single-line answers', async ({ page }) => {
    await openGateLab(page)
    await page.getByTestId('answer-letter').fill(String(await wrongAnswer(page)))
    await page.getByTestId('answer-letter').press('Enter')
    await expect(page.getByTestId('rollback')).toBeVisible()
    await page.getByTestId('gate-continue').click()
    await advanceTo(page, 'windows')
    // Typing moves along the boxes; Enter in the last one submits.
    await page.getByTestId('answer-letters-0').focus()
    await page.keyboard.type(String(await wrongAnswer(page)))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('rollback')).toBeVisible()
    expect((await eventsOf(page, 'item.submit')).filter((e) => e.item.endsWith('/windows'))).toHaveLength(1)
  })

  test('round 2: at 390 px the nine window letters wrap only between groups of three', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openGateLab(page)
    await advanceTo(page, 'windows')
    const groups = page.getByTestId('answer-letters-group')
    await expect(groups).toHaveCount(3)
    for (let g = 0; g < 3; g++) {
      const tops = await groups
        .nth(g)
        .locator('input')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
      expect(tops).toHaveLength(3)
      expect(new Set(tops).size, `group ${g + 1} on one line`).toBe(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('round 2: starting the next bet leaves every window display at the current windows', async ({ page }) => {
    await enter(page, 'lab-fixture')
    await nextScene(page)
    const [press] = await sceneReveals(page)
    await commitBet(page, 'first-lamp', 'C')
    await fireReveal(page, press!)
    expect(await page.evaluate(() => window.__enigma!.getState().positions)).toBe('AAB')
    await expect(page.getByTestId('lamp-result')).toBeVisible()
    // Starting the step bet gates the playback at t = 0; the windows still read AAB (not the press's "before").
    await page.locator('[data-testid^="bet-option-steps-"]').first().click()
    await expect.poll(() => page.evaluate(() => window.__stage!.playback().gated)).toBe(true)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().windows)).toBe('AAB')
    // The press is still on the tape; only the lamp and the stepping of the last press are cleared.
    expect(await page.evaluate(() => window.__enigma!.getState())).toMatchObject({
      positions: 'AAB',
      input: 'A',
      lamp: null,
      lastStepping: null,
    })
    // The View keeps what the reveal showed.
    await expect(page.getByTestId('lamp-result')).toBeVisible()
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
    await editProgress(
      page,
      (p) => (p.chapters['i1-anatomy'] = { reached: 5, completed: true, tasks: [] }),
      '/lab/fixture',
    )
    await expect.poll(async () => (await where(page)).scene).toBe('story')
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    await configure(page, { now: Date.now() + 7 * 3600_000 })
    await expect(page.getByTestId('return-check')).toBeVisible()
    // Review m2: the dialog takes focus and keeps it; the chapter behind it is inert.
    const inDialog = () => page.evaluate(() => !!document.activeElement?.closest('[data-testid="return-check"]'))
    await expect.poll(inDialog).toBe(true)
    for (let k = 0; k < 12; k++) {
      await page.keyboard.press(k % 3 === 2 ? 'Shift+Tab' : 'Tab')
      expect(await inDialog(), `Tab #${k + 1} left the dialog`).toBe(true)
    }
    expect(await page.evaluate(() => !!document.querySelector('[data-testid="scene-next"]')?.closest('[inert]'))).toBe(
      true,
    )
    const [check] = await eventsOf(page, 'return-check')
    expect(check!.items).toHaveLength(2)
    for (let k = 0; k < 2; k++) {
      const g = (await gate(page))!
      expect(g.key).toMatch(/^lab-fixture\/return-\d+-\d$/)
      await answerCorrect(page)
    }
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    expect(await gate(page)).toBeNull()
  })

  test('the whole fixture walks to chapter.complete', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, 'lab-fixture')
    const focus: Record<string, string> = {
      'bets-press': 'wire',
      'bets-toggle': 'rotor-stack',
      gate: 'wire',
      puzzle: 'wire',
    }
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
