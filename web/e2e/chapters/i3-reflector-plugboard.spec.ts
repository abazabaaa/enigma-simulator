/**
 * Chapter I.3 · reflector, plugboard, reciprocity (PLAN §4.4 "i3-reflector-plugboard", §6.0 CHAPTER PR TEMPLATE
 * steps 0–8 and the code-gate extras, brief 10):
 *  - every scene in order, every bet gating its reveal, focus and dimming, tasks through real actions: the 13 wires
 *    lit, both plugboard rows of the trace, a round trip on the tape, 30 presses and the 17,576-position search;
 *  - gate `reflector`: each item wrong through the UI with its rollback and L1 hint, right through the real widget
 *    (cables through the plugboard editor, the choice, code typed into the editor), the rest through the API;
 *  - the code gate: Run needs the prediction, the reference with a wrong prediction fails, wrong code with the right
 *    prediction fails, the agent paste passes the code item but never the gate without the in-page item;
 *  - set-machine locks, the hint ladder, a reload mid-gate, the gaming fallback, chapter.complete;
 *  - @3d: the first mechanism scene reports focus 'reflector' and dimmedParts.
 * Answers are computed in Node from the pure gates.ts.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  agentPasteProbe,
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
  typeCodeAndRun,
  where,
  wrongAnswer,
} from '../helpers/course'
import { COMPOSE_REFERENCE, DEMO_CABLES, composeProbe, type ComposeInstance } from '../../src/chapters/i3-reflector-plugboard/gates'
import { dimmedParts } from '../../src/contracts/stage'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'i3-reflector-plugboard'

/** §4.1 G5 table: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = { 'plug-to-hit': 'machine', 'why-no-self': 'none', 'compose-inverse': 'none' }

const state = (page: Page) => page.evaluate(() => window.__enigma!.getState())

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

/** Plug cables through the plugboard editor (plug-input, plug-add). */
async function plugViaUi(page: Page, pairs: readonly string[]): Promise<void> {
  for (const pair of pairs) {
    await page.getByTestId('plug-input').fill(pair)
    await page.getByTestId('plug-add').click()
    await expect.poll(async () => (await state(page)).config.plugboard).toContain(pair)
  }
}

/** Type letters on the DOM keyboard. */
async function typeKeys(page: Page, text: string): Promise<void> {
  for (const ch of text) await page.getByTestId(`key-${ch}`).click()
}

/** Serious or critical axe findings inside one element (other PRs' placeholder stubs excluded), as lesson.spec does. */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** Walk the explore scenes (bets and triggers through the UI) up to the gate. */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter i3-reflector-plugboard', { tag: '@chapter:i3-reflector-plugboard' }, () => {
  test('scenes in order: the story, a bet before every reveal, focus and dimming, tasks by real actions', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'bletchley', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Alan Turing')
    await expect(page.getByTestId('story-card')).toContainText('Gordon Welchman')
    await nextScene(page)

    // reflector-pairs: the bet gates Play; the 13 wires light; the worked example lists them.
    expect(await where(page)).toMatchObject({ scene: 'reflector-pairs', kind: 'explore' })
    await assertFocus(page, 'reflector')
    await expectNextDisabled(page)
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'pairs', trigger: 'play' })
    await assertRevealGated(page, play!)
    await expect(page.getByTestId('reflector-circle')).toHaveAttribute('data-lit', '0')
    await commitBet(page, 'pairs', '13')
    await expectNextDisabled(page)
    await fireReveal(page, play!)
    await expect(page.getByTestId('reflector-circle')).toHaveAttribute('data-lit', '13')
    await expect(page.getByTestId('reflector-pairs-list')).toContainText('(ay)')
    await expect(page.getByTestId('task-seen')).toHaveAttribute('data-done', 'true')
    expect((await betResults(page)).pairs).toBe(true)
    expect((await state(page)).config.plugboard, 'no cables in the reflector scene').toEqual([])
    await nextScene(page)

    // plugboard-twice: the bet gates key A; the trace shows a cable on the way in and one on the way out.
    expect(await where(page)).toMatchObject({ scene: 'plugboard-twice', kind: 'explore' })
    await assertFocus(page, 'plugboard')
    await expectNextDisabled(page)
    const [press] = await sceneReveals(page)
    expect(press).toMatchObject({ bet: 'twice', trigger: 'press', key: 'A' })
    await assertRevealGated(page, press!)
    await commitBet(page, 'twice', 'twice')
    await fireReveal(page, press!)
    const first = page.getByTestId('trace-row-0')
    const last = page.getByTestId('trace-row-10')
    await expect(first).toHaveAttribute('data-stage', 'plugboard-in')
    await expect(last).toHaveAttribute('data-stage', 'plugboard-out')
    for (const row of [first, last]) expect(await row.getAttribute('data-input')).not.toBe(await row.getAttribute('data-output'))
    await expect(page.getByTestId('plugboard-worked')).toContainText('twice')
    expect((await betResults(page)).twice).toBe(true)
    await expectNextDisabled(page)
    const used = DEMO_CABLES.join('')
    const free = [...'QWERTZUIOPASDFGHJKLYXCVBNM'].filter((l) => !used.includes(l))
    const own = [free[0]! + free[1]!, free[2]! + free[3]!]
    await plugViaUi(page, own)
    await expect(page.getByTestId('task-add2')).toHaveAttribute('data-done', 'true')
    await page.getByTestId(`key-${own[1]![0]}`).click()
    await expect(page.getByTestId('task-press-plugged')).toHaveAttribute('data-done', 'true')
    await expect(first).toHaveAttribute('data-output', own[1]![1]!)
    await nextScene(page)

    // reciprocity: free presses; type a word, rewind, type the ciphertext, read the word.
    expect(await where(page)).toMatchObject({ scene: 'reciprocity', kind: 'explore', canNext: false })
    await assertFocus(page, 'wire')
    await typeKeys(page, 'WETTER')
    const cipher = (await state(page)).output
    expect(cipher).toHaveLength(6)
    await page.getByTestId('tape-rewind').click()
    await expect.poll(async () => (await state(page)).input).toBe('')
    await typeKeys(page, cipher)
    expect((await state(page)).output).toBe('WETTER')
    await expect(page.getByTestId('task-roundtrip')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('reciprocity-result')).toContainText('WETTER')
    await nextScene(page)

    // self-search: the bet gates Run and the keys; after 30 presses "give up" runs the search: 17,576 tried, 0 hits.
    expect(await where(page)).toMatchObject({ scene: 'self-search', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [run] = await sceneReveals(page)
    expect(run).toMatchObject({ bet: 'self', trigger: 'run' })
    await assertRevealGated(page, run!)
    expect(await pressThrows(page), 'the keyboard waits for the bet too').toBe(true)
    await commitBet(page, 'self', 'no')
    await expect(page.getByTestId('rotor-pos-right')).toBeEnabled()
    await page.getByTestId('rotor-pos-right').focus()
    await page.keyboard.press('ArrowUp')
    await typeKeys(page, 'AAAAA')
    await page.evaluate(() => {
      for (let k = 0; k < 24; k++) window.__enigma!.pressKey('A')
    })
    await expect(page.getByTestId('self-give-up')).toHaveCount(0)
    await page.getByTestId('key-A').click()
    await expect(page.getByTestId('self-manual')).toHaveAttribute('data-presses', '30')
    await expect(page.getByTestId('self-manual')).toHaveAttribute('data-self', '0')
    await page.getByTestId('self-give-up').click()
    await expect(page.getByTestId('self-counter')).toHaveAttribute('data-count', '17576')
    await expect(page.getByTestId('self-hits')).toHaveAttribute('data-hits', '0')
    await expect(page.getByTestId('task-searched')).toHaveAttribute('data-done', 'true')
    expect((await eventsOf(page, 'reveal')).at(-1)).toMatchObject({ bet: `${CHAPTER}/self`, trigger: 'run' })
    expect((await betResults(page)).self).toBe(true)
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await assertFocus(page, 'plugboard')
    await expectNextDisabled(page)
  })

  test('gate reflector: each item wrong through the UI, its rollback and L1 hint, right through the widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i4-permutations')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(Object.keys(ROLLBACK))

    // plug-to-hit (set-machine): locked keyboard, hidden lamps; plugging cables submits nothing.
    let c = await current(page)
    expect(c).toMatchObject({ itemId: 'plug-to-hit', kind: 'set-machine' })
    expect(await axeSerious(page, '[data-testid="item-plug-to-hit"]')).toEqual([])
    await assertFocus(page, 'plugboard')
    await expect(page.getByTestId('plug-e0')).toBeVisible()
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
    expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
    const submits = (await eventsOf(page, 'item.submit')).length
    const wrong = (await wrongAnswer(page)) as { plugboard: string[] }
    await assertNoAnswerLeak(page)
    await plugViaUi(page, wrong.plugboard)
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
    // a. Wrong through the UI: the rollback keeps the learner's cable on the machine and names the lamp it lit.
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, 'machine')
    await expect(page.getByTestId('rollback')).toContainText(`lights`)
    await expect.poll(async () => (await state(page)).config.plugboard).toEqual(wrong.plugboard)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(['plugboard'])
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'plug-to-hit', hintLevel: 1, passed: false })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('plug-hint')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toContain('plugboard')
    expect((await state(page)).config.plugboard, 'a fresh instance starts without cables').toEqual([])
    // b. Right through the plugboard editor.
    await assertNoAnswerLeak(page)
    await plugViaUi(page, ((await solveInNode(page)) as { plugboard: string[] }).plugboard)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-plug-to-hit')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // c. The remaining instance through the API; d. passed exactly now (W C C).
    await assertNoAnswerLeak(page)
    expect((await answerViaApi(page, 'plug-to-hit', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-plug-to-hit')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // why-no-self (choice, once): the distractor, its explanation, then the reflector.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'why-no-self', kind: 'choice' })
    expect(await axeSerious(page, '[data-testid="item-why-no-self"]')).toEqual([])
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'choice', 'plugboard')
    await assertRollback(page, 'none')
    await expect(page.getByTestId('rollback')).toContainText('reflector')
    await continueGate(page)
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toContain('reflector')
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'choice', 'reflector')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-why-no-self')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // compose-inverse (code): Run waits for the prediction; the prediction and the hidden cases must both be right.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'compose-inverse', kind: 'code' })
    expect(await axeSerious(page, '[data-testid="item-compose-inverse"]')).toEqual([])
    const run = page.getByTestId('code-run')
    await expect(run).toBeDisabled()
    await page.getByTestId('code-editor').fill(COMPOSE_REFERENCE)
    await expect(run).toBeDisabled()
    await page.getByTestId('gate-prediction').fill('A')
    await expect(run).toBeEnabled()
    await page.getByTestId('gate-prediction').fill('')
    await expect(run).toBeDisabled()
    // The reference with a wrong prediction: wrong (rollback none, with the reason).
    await assertNoAnswerLeak(page)
    const want = composeProbe(c.instance as ComposeInstance)
    const wrongProbe = 'ABCDEF'.replace(want, '')[0]!
    await typeCodeAndRun(page, COMPOSE_REFERENCE, wrongProbe)
    await assertRollback(page, 'none')
    await expect(page.getByTestId('rollback')).toContainText('prediction')
    await expect(page.getByTestId('gate-prediction')).toHaveCount(0)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'compose-inverse', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('compose-hint')).toBeVisible()
    // Wrong code (q applied first) with the right prediction: wrong, and the first failing case is named.
    const qFirst = COMPOSE_REFERENCE.replace('p.map((x) => q[x])', 'q.map((x) => p[x])')
    await typeCodeAndRun(page, qFirst, composeProbe(c.instance as ComposeInstance))
    await assertRollback(page, 'none')
    await expect(page.getByTestId('rollback')).toContainText('expected')
    await continueGate(page)
    // Right through the editor: W W C, not passed yet.
    c = await current(page)
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(page, COMPOSE_REFERENCE, composeProbe(c.instance as ComposeInstance))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-compose-inverse')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // The agent paste (reference + the Node-computed prediction) passes the code item: W C C.
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await expect(page.getByTestId('item-compose-inverse')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/reflector`])
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/i4-permutations')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i4-permutations')).toHaveAttribute('data-locked', 'false')
  })

  test('the agent paste never passes the gate while the in-page item is wrong; the gaming fallback is plug-one', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    // The code item is not reachable before the in-page item: an agent's answer for it is refused.
    const refused = await page.evaluate(() => {
      try {
        window.__course!.answer('compose-inverse', { probe: 'A', run: { status: 'pass', passed: 1, total: 1, instanceSeed: 0 } })
        return false
      } catch {
        return true
      }
    })
    expect(refused).toBe(true)
    // Two instant wrong answers: gaming, then the one-cable fallback, on the machine with the keyboard locked.
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'plug-to-hit', await wrongAnswer(page))
    await answerViaApi(page, 'plug-to-hit', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/reflector/plug-to-hit`, reason: 'fast' }])
    const fb = await current(page)
    expect(fb).toMatchObject({ itemId: 'plug-to-hit', fallback: true, kind: 'set-machine' })
    expect((fb.instance as { maxPlugs: number }).maxPlugs).toBe(1)
    await expect(page.getByTestId('item-plug-to-hit')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    await configure(page, { minLatencyMs: 0 })
    // Two cables are refused by the fallback.
    const one = (await solveInNode(page)) as { plugboard: string[] }
    const used = one.plugboard.join('')
    const extra = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((l) => !used.includes(l)).slice(0, 2).join('')
    await plugViaUi(page, [...one.plugboard, extra])
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, 'machine')
    await expect(page.getByTestId('rollback')).toContainText('at most 1 cable')
    await continueGate(page)
    expect((await gate(page))!.passed).toBe(false)
    expect(await page.getByTestId('gate').getAttribute('data-passed')).toBe('false')
    const rec = (await progress(page)).gates[`${CHAPTER}/reflector`]!.items['plug-to-hit']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'wrong', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'plug-to-hit', fallback: false })
  })

  test('the hint ladder on plug-to-hit, and a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/plug-to-hit'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    // The set-machine item comes back with its own machine (no cables, its windows).
    const c = await current(page)
    const m = (c.instance as { setup: { machine: { positions: string[] } } }).setup.machine
    await expect.poll(async () => (await state(page)).positions).toBe(m.positions.join(''))
    expect((await state(page)).config.plugboard).toEqual([])
    const l = await logicFor(c.gateKey, c.itemId, false)
    expect(l.check(c.instance, await solveInNode(page)).correct).toBe(true)
  })
})

test.describe('chapter i3-reflector-plugboard in 3D', { tag: ['@3d', '@chapter:i3-reflector-plugboard'] }, () => {
  test('the first mechanism scene reports focus reflector and dimmedParts; its bet gates Play', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('reflector-pairs')
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:reflector')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('reflector', 'I'))
    const [play] = await sceneReveals(page)
    await assertRevealGated(page, play!)
    await commitBet(page, 'pairs', '13')
    await fireReveal(page, play!)
    await expect(page.getByTestId('task-seen')).toHaveAttribute('data-done', 'true')
  })
})
