/**
 * Chapter II.5 · indicators → AD, BE, CF (PLAN §4.4 "ii5-indicators", §6.0 CHAPTER PR TEMPLATE steps 0–8 and the
 * code-gate extras, brief 12):
 *  - the Act I recall, the story with its act clock, a key typed twice on the day's machine (the press bet gates the
 *    keyboard; the six lamps pair up 1 & 4, 2 & 5, 3 & 6), the 65 indicators filling AD, BE, CF after the play bet;
 *  - gate `indicators`: each item wrong through the UI with its rollback and L1 hint, right through its widget,
 *    the rest through the API; build-ad's prediction pairing and the agent-paste probe; the hint ladder; a reload;
 *    the gaming fallback (fill-ad, in-page); chapter.complete;
 *  - @3d: across a scene change, the double-key scene reports focus 'wire' and dimmedParts in the 3D view.
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
  nextScene,
  passGate,
  progress,
  reloadKeepsSeed,
  sceneReveals,
  solveInNode,
  typeCodeAndRun,
  where,
  wrongAnswer,
} from '../helpers/course'
import {
  AD65,
  BUILD_AD_REFERENCE,
  DAY,
  STEP_ORDER,
  buildAdProbe,
  type BuildAdInstance,
  type FillAdInstance,
} from '../../src/chapters/ii5-indicators/gates'
import { encryptIndicator } from '../../src/crypto'
import { dimmedParts } from '../../src/contracts/stage'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'ii5-indicators'
const L = (i: number) => String.fromCharCode(65 + i)

/** §4.1 G5 table (and §4.4): the rollback kind of each item. */
const ROLLBACK: Record<string, string> = { 'fill-ad': 'perm', 'ad-fixed-point': 'none', 'build-ad': 'perm', 'rejewski-steps': 'order' }

/** Serious or critical axe findings inside one element (the fixture spec's pattern). */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

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

/** The custom fill-ad Answer: type `letters` into the outlined cells (in target order), then submit. */
async function fillAdViaUi(page: Page, letters: readonly string[]): Promise<void> {
  const i = (await current(page)).instance as FillAdInstance
  for (const [k, t] of i.targets.entries()) await page.getByTestId(`fill-ad-table-input-${L(t)}`).fill(letters[k]!)
  await expect(page.getByTestId('gate-submit')).toBeEnabled()
  await page.getByTestId('gate-submit').click()
}

/** Walk the recall and the explore scenes (bets and triggers through the UI) up to the gate. */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter ii5-indicators', { tag: '@chapter:ii5-indicators' }, () => {
  test('scenes in order: recall, the story, a key typed twice, the 65 indicators, each bet before its reveal', async ({ page }) => {
    await enter(page, CHAPTER)
    // 1. The Act I recall: its gate holds scene-next until passed (answered in Node, recall pool included).
    expect(await where(page)).toMatchObject({ scene: 'recall', kind: 'recall', index: 0, canNext: false })
    await expectNextDisabled(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(['r-windows', 'r-hop-trio', 'r-plug-to-hit'])
    await passGate(page)
    await nextScene(page)

    // The story, with the act clock.
    expect(await where(page)).toMatchObject({ scene: 'warsaw', kind: 'story', canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Marian Rejewski')
    await expect(page.getByTestId('story-card')).toContainText('Hans-Thilo Schmidt')
    await expect(page.getByTestId('act-clock')).toHaveAttribute('aria-label', /9 December 1932/)
    await nextScene(page)

    // double-key: the bet gates the keyboard; the key typed twice gives halves that differ in every letter.
    expect(await where(page)).toMatchObject({ scene: 'double-key', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [press] = await sceneReveals(page)
    expect(press).toMatchObject({ bet: 'halves', trigger: 'press' })
    expect(press!.key).toBeUndefined()
    await assertRevealGated(page, press!)
    expect(await pressThrows(page, 'Q'), 'every key waits for the bet').toBe(true)
    await commitBet(page, 'halves', 'match')
    await fireReveal(page, press!)
    for (const k of 'BLABL') await page.getByTestId(`key-${k}`).click()
    const indicator = encryptIndicator(DAY, 'ABL')
    await expect(page.getByTestId('double-key-worked')).toContainText(`${indicator.slice(0, 3)} ${indicator.slice(3)}`)
    for (let k = 0; k < 6; k++) await expect(page.getByTestId(`double-key-lamp-${k + 1}`)).toHaveText(indicator[k]!)
    for (let k = 0; k < 3; k++) expect(indicator[k]).not.toBe(indicator[k + 3])
    await expect(page.getByTestId('task-type-key-twice')).toHaveAttribute('data-done', 'true')
    expect((await betResults(page)).halves).toBe(false)
    await expect(page.getByTestId('trace-step')).toBeVisible()
    await nextScene(page)

    // ad-from-65: no stage; the table waits for the bet; five cells by hand; Play fills AD, BE and CF.
    expect(await where(page)).toMatchObject({ scene: 'ad-from-65', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    await expect(page.getByTestId('ad-own')).toHaveAttribute('data-editable', 'false')
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'ad-fixed', trigger: 'play' })
    await assertRevealGated(page, play!)
    await commitBet(page, 'ad-fixed', 'yes')
    await expect(page.getByTestId('ad-own')).toHaveAttribute('data-editable', 'true')
    for (const x of [0, 1, 2, 3, 4]) await page.getByTestId(`ad-own-cell-${x}`).locator('input').fill(L(AD65[x]!))
    await expect(page.getByTestId('task-fill5')).toHaveAttribute('data-done', 'true')
    await expectNextDisabled(page)
    await fireReveal(page, play!)
    await expect(page.getByTestId('ad-arrivals')).toHaveAttribute('data-arrived', '65')
    await expect(page.getByTestId('ad-cycles')).toContainText('(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    await expect(page.getByTestId('ad-cycles')).toContainText('(abviktjgfcqny)(duzrehlxwpsmo)')
    await expect(page.getByTestId('ad-conflict')).toContainText('SYZ SCW')
    await expect(page.getByTestId('ad-table-cell-3')).toHaveAttribute('data-value', 'V')
    await expect(page.getByTestId('task-fill-all')).toHaveAttribute('data-done', 'true')
    expect((await betResults(page))['ad-fixed']).toBe(true)
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
  })

  test('gate indicators: each item wrong through the UI, its rollback and L1 hint, right through its widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii6-cycles')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(Object.keys(ROLLBACK))

    // fill-ad (custom, in-page): a wrong cell through the table, the defining indicator slides into it.
    let c = await current(page)
    expect(c).toMatchObject({ itemId: 'fill-ad', kind: 'custom' })
    expect(await axeSerious(page, '[data-testid="item-fill-ad"]')).toEqual([])
    await assertNoAnswerLeak(page)
    const good = (await solveInNode(page)) as string[]
    const wrongFill = (await wrongAnswer(page)) as string[]
    await fillAdViaUi(page, wrongFill)
    await assertRollback(page, ROLLBACK['fill-ad']!)
    const bad = (c.instance as FillAdInstance).targets.find((_, k) => wrongFill[k] !== good[k])!
    await expect(page.getByTestId(`fill-ad-why-${L(bad)}`)).toBeVisible()
    await expect(page.getByTestId('fill-ad-yours-cell-' + bad)).toHaveAttribute('data-value', wrongFill[(c.instance as FillAdInstance).targets.indexOf(bad)]!)
    await continueGate(page)
    expect(await current(page)).toMatchObject({ itemId: 'fill-ad', hintLevel: 1, passed: false })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('fill-ad-hint')).toBeVisible()
    await assertNoAnswerLeak(page)
    await fillAdViaUi(page, (await solveInNode(page)) as string[])
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-fill-ad')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    await assertNoAnswerLeak(page)
    expect((await answerViaApi(page, 'fill-ad', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-fill-ad')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // ad-fixed-point (once, the misconception probe): the distractor's feedback does not give the answer away.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'ad-fixed-point', kind: 'choice' })
    expect(await axeSerious(page, '[data-testid="item-ad-fixed-point"]')).toEqual([])
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'choice', 'faulty')
    await assertRollback(page, 'none')
    await expect(page.getByTestId('rollback')).toContainText('Which presses does AD combine?')
    await continueGate(page)
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await answerViaUi(page, 'choice', 'product')
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-ad-fixed-point')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // build-ad (code): Run waits for the prediction; the prediction and the hidden cases must both be right.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'build-ad', kind: 'code' })
    expect(await axeSerious(page, '[data-testid="item-build-ad"]')).toEqual([])
    const run = page.getByTestId('code-run')
    await expect(run).toBeDisabled()
    await page.getByTestId('code-editor').fill(BUILD_AD_REFERENCE)
    await expect(run).toBeDisabled()
    await page.getByTestId('gate-prediction').fill('A')
    await expect(run).toBeEnabled()
    await page.getByTestId('gate-prediction').fill('')
    await expect(run).toBeDisabled()
    // The reference with a wrong prediction (the letter itself): wrong, and the predicted cell's indicator shows.
    await assertNoAnswerLeak(page)
    const instance = c.instance as BuildAdInstance
    expect(buildAdProbe(instance)).not.toBe(instance.letter)
    await typeCodeAndRun(page, BUILD_AD_REFERENCE, instance.letter)
    await assertRollback(page, ROLLBACK['build-ad']!)
    await expect(page.getByTestId(`build-ad-why-${instance.letter}`)).toBeVisible()
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'build-ad', hintLevel: 1 })
    await expect(page.getByTestId('build-ad-hint')).toBeVisible()
    // Wrong code (letter 2 instead of letter 4) with the right prediction: wrong, the failing case named.
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(page, BUILD_AD_REFERENCE.replace('s[3]', 's[1]'), buildAdProbe(c.instance as BuildAdInstance))
    await assertRollback(page, 'perm')
    await expect(page.getByTestId('rollback')).toContainText('expected')
    await continueGate(page)
    // Right through the editor: W W C, not passed yet.
    c = await current(page)
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(page, BUILD_AD_REFERENCE, buildAdProbe(c.instance as BuildAdInstance))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-build-ad')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // The agent paste (reference + the Node-computed prediction) passes the code item: W C C.
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await expect(page.getByTestId('item-build-ad')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // rejewski-steps (order, once).
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'rejewski-steps', kind: 'order' })
    expect(await axeSerious(page, '[data-testid="item-rejewski-steps"]')).toEqual([])
    const swapped = [...STEP_ORDER]
    ;[swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!]
    await answerViaUi(page, 'order', swapped)
    await assertRollback(page, ROLLBACK['rejewski-steps']!)
    await continueGate(page)
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await answerViaUi(page, 'order', await solveInNode(page))
    await expect(page.getByTestId('item-rejewski-steps')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/recall`, `${CHAPTER}/indicators`])
    // 8. chapter.complete, and the next chapter unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/ii6-cycles')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii6-cycles')).toHaveAttribute('data-locked', 'false')
  })

  test('a reload keeps the instance; the ladder on build-ad; the agent paste never passes while the in-page item is wrong', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    // The code item is not reachable before the in-page item: an agent's answer for it is refused.
    const refused = await page.evaluate(() => {
      try {
        window.__course!.answer('build-ad', { probe: 'A', run: { status: 'pass', passed: 1, total: 1, instanceSeed: 0 } })
        return false
      } catch {
        return true
      }
    })
    expect(refused).toBe(true)
    // 7. A reload mid-gate keeps the seed and the instance.
    await answerViaApi(page, 'fill-ad', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'fill-ad', await solveInNode(page))
    await answerViaApi(page, 'fill-ad', await solveInNode(page))
    await answerViaApi(page, 'ad-fixed-point', 'product')

    // The ladder on build-ad (a code item; its worked examples never show the reference).
    expect((await current(page)).itemId).toBe('build-ad')
    await assertLadder(page)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/build-ad'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])

    // Every answer from here on counts as instant, so the second one is a gaming signal.
    await configure(page, { minLatencyMs: 600_000 })
    // The agent paste passes one build-ad instance …
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await continueGate(page)
    // … then an instant wrong answer: gaming, and the in-page fill-ad fallback takes the code item's place.
    await answerViaApi(page, 'build-ad', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/indicators/build-ad`, reason: 'fast' }])
    await configure(page, { minLatencyMs: 0 })
    const fb = await current(page)
    expect(fb).toMatchObject({ itemId: 'build-ad', fallback: true, kind: 'custom', hintLevel: 0 })
    await expect(page.getByTestId('item-build-ad')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('fill-ad-table')).toBeVisible()
    await expect(page.getByTestId('code-editor')).toHaveCount(0)
    // The in-page fallback answered wrong: the agent's code answers alone never pass the gate.
    await fillAdViaUi(page, (await wrongAnswer(page)) as string[])
    await assertRollback(page, 'perm')
    await continueGate(page)
    expect((await gate(page))!.passed).toBe(false)
    await expect(page.getByTestId('gate')).toHaveAttribute('data-passed', 'false')
    await expect(page.getByTestId('item-build-ad')).toHaveAttribute('data-passed', 'false')
    const rec = (await progress(page)).gates[`${CHAPTER}/indicators`]!.items['build-ad']!
    expect(rec.outcomes.slice(-3).map((o) => [o.result, o.fallback])).toEqual([
      ['correct', false],
      ['wrong', false],
      ['wrong', true],
    ])
    // Back to the code item itself, at a fresh instance.
    expect(await current(page)).toMatchObject({ itemId: 'build-ad', fallback: false, kind: 'code' })
  })
})

test.describe('chapter ii5-indicators in 3D', { tag: ['@3d', '@chapter:ii5-indicators'] }, () => {
  test('across a scene change, double-key reports focus wire and dimmedParts; its bet gates the keyboard', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    // The recall is passed in 2D (its three items each mount their own stage); the story and the scene change
    // into double-key run in 3D.
    await enter(page, CHAPTER)
    await passGate(page)
    await nextScene(page)
    await gotoApp(page, `/c/${CHAPTER}/warsaw`, { stage: '3d' })
    await expect.poll(async () => (await where(page)).scene).toBe('warsaw')
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('double-key')
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:wire')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('wire', 'I'))
    const [press] = await sceneReveals(page)
    await assertRevealGated(page, press!)
    await commitBet(page, 'halves', 'differ')
    await fireReveal(page, press!)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().windows)).not.toBe(DAY.positions.join(''))
  })
})
