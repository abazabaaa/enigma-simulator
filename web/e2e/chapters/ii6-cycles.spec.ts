/**
 * Chapter II.6 · cycles and the theorem (PLAN §4.4 "ii6-cycles", §6.0 CHAPTER PR TEMPLATE steps 0–8 and the code-gate
 * extras, brief 12):
 *  - the story; the hexagon (the play bet gates the product; XY = (ace)(bfd); vector 13 is paired); one more cable on
 *    the day's plugboard (the toggle bet gates it; three cables toggled leave the diagram's lengths equal, read through
 *    data attributes); CF's two 13-cycles lined up (three of the 13 splits found);
 *  - gate `cycles`: each item wrong through the UI with its rollback and L1 hint, right through its widget, the rest
 *    through the API; the stecker-set locks; cycle-lengths' prediction pairing and the agent-paste probe (the code
 *    item passes, the gate stays shut while the in-page align-pair is wrong); the ladder; a reload; the gaming
 *    fallback (stecker-set, keyboard locked); chapter.complete;
 *  - @3d: across a scene change, stecker-toggle reports focus 'plugboard' and dimmedParts in the 3D view.
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
  progress,
  reloadKeepsSeed,
  sceneReveals,
  solveInNode,
  typeCodeAndRun,
  where,
  wrongAnswer,
} from '../helpers/course'
import {
  CYCLE_LENGTHS_REFERENCE,
  DAY,
  DAY_AD,
  DEMO_CABLE,
  adOf,
  alignTruth,
  cycleLengthsProbe,
  freePairs,
  naiveAlign,
  steckerSolutions,
  withCable,
  type AlignAnswer,
  type AlignInstance,
  type CycleLengthsInstance,
  type SteckerInstance,
} from '../../src/chapters/ii6-cycles/gates'
import { alignmentPairs } from '../../src/crypto'
import { dimmedParts } from '../../src/contracts/stage'
import { formatCycles, normalizeConfig } from '../../src/engine'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'ii6-cycles'
const L = (i: number) => String.fromCharCode(65 + i)

/** §4.4: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = {
  lengths: 'cycles',
  relabel: 'cycles',
  'stecker-set': 'machine',
  'cycle-lengths': 'cycles',
  'align-pair': 'none',
}

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

const plugsNow = (page: Page) => page.evaluate(() => window.__enigma!.getState().config.plugboard)

/** Add one cable through the plugboard editor. */
async function addCable(page: Page, pair: string): Promise<void> {
  const before = (await plugsNow(page)).length
  await page.getByTestId('plug-input').fill(pair)
  await page.getByTestId('plug-add').click()
  await expect.poll(async () => (await plugsNow(page)).length).toBe(before + 1)
}

/** The custom align-pair Answer: set the offset and direction with its buttons, then submit. */
async function alignViaUi(page: Page, a: AlignAnswer): Promise<void> {
  const strip = page.getByTestId('align-pair-align')
  if ((await strip.getAttribute('data-reversed')) !== String(a.reversed)) await page.getByTestId('align-pair-align-reverse').click()
  for (let k = 0; k < 20 && (await strip.getAttribute('data-offset')) !== String(a.offset); k++) {
    await page.getByTestId('align-pair-align-right').click()
  }
  await expect(strip).toHaveAttribute('data-offset', String(a.offset))
  await expect(strip).toHaveAttribute('data-reversed', String(a.reversed))
  await page.getByTestId('gate-submit').click()
}

/** The stecker-set answer on the machine: the day's cables plus `pair`, through the editor, then Submit. */
async function steckerViaUi(page: Page, pair: string): Promise<void> {
  await addCable(page, pair)
  await page.getByTestId('gate-submit').click()
}

async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter ii6-cycles', { tag: '@chapter:ii6-cycles' }, () => {
  test('scenes in order: the story, the hexagon, one more cable, CF lined up; each bet before its reveal', async ({ page }) => {
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'theorem', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Marian Rejewski')
    await expect(page.getByTestId('story-card')).toContainText('the theorem that won World War II')
    await expect(page.getByTestId('act-clock')).toHaveCount(0)
    await nextScene(page)

    // hexagon: the play bet gates the product; XY = (ace)(bfd); the 65 indicators' products are paired too.
    expect(await where(page)).toMatchObject({ scene: 'hexagon', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    await expect(page.getByTestId('hex-x')).toHaveAttribute('data-cycles', '(ab)(cd)(ef)')
    await expect(page.getByTestId('hex-y')).toHaveAttribute('data-cycles', '(af)(bc)(de)')
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'pairs', trigger: 'play' })
    await assertRevealGated(page, play!)
    await expect(page.getByTestId('hex-trace')).toHaveCount(0)
    await commitBet(page, 'pairs', 'twos')
    await fireReveal(page, play!)
    await expect(page.getByTestId('hex-trace')).toHaveAttribute('data-step', '6')
    await expect(page.getByTestId('hex-product')).toHaveAttribute('data-cycles', '(ace)(bfd)')
    await expect(page.getByTestId('hex-product')).toHaveAttribute('data-lengths', '3.3')
    await expect(page.getByTestId('vector-ad')).toHaveAttribute('data-lengths', '10.10.2.2.1.1')
    await expect(page.getByTestId('vector-be')).toHaveAttribute('data-lengths', '9.9.3.3.1.1')
    await expect(page.getByTestId('vector-cf')).toHaveAttribute('data-lengths', '13.13')
    expect((await betResults(page)).pairs).toBe(false)
    await nextScene(page)

    // stecker-toggle: the toggle bet gates the cable; the letters relabel and the lengths stay.
    expect(await where(page)).toMatchObject({ scene: 'stecker-toggle', kind: 'explore' })
    await assertFocus(page, 'plugboard')
    await expectNextDisabled(page)
    const diagram = page.getByTestId('stecker-ad')
    await expect(diagram).toHaveAttribute('data-cycles', formatCycles(DAY_AD))
    await expect(diagram).toHaveAttribute('data-lengths', '6.6.4.4.3.3')
    await expect(page.getByTestId('plug-input')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    const [toggle] = await sceneReveals(page)
    expect(toggle).toMatchObject({ bet: 'lengths', trigger: 'toggle' })
    await assertRevealGated(page, toggle!)
    await commitBet(page, 'lengths', 'unchanged')
    await fireReveal(page, toggle!)
    await expect(page.getByTestId('stecker-result')).toBeVisible()
    const withDemo = withCable(DAY, DEMO_CABLE)
    await expect(diagram).toHaveAttribute('data-cycles', formatCycles(adOf(withDemo)))
    await expect(diagram).toHaveAttribute('data-lengths', '6.6.4.4.3.3')
    expect((await betResults(page)).lengths).toBe(true)
    await expect(page.getByTestId('plug-input')).toBeEnabled()
    // Three cables toggled by hand: the diagram relabels, its lengths never change.
    const [p1, p2] = ['BC', 'DG']
    expect(freePairs(withDemo)).toEqual(expect.arrayContaining([p1, p2]))
    await addCable(page, p1!)
    await addCable(page, p2!)
    await page.getByRole('button', { name: `Remove the cable ${DEMO_CABLE[0]}–${DEMO_CABLE[1]}` }).click()
    for (let k = 0; k < 3; k++) await expect(page.getByTestId(`stecker-change-${k}`)).toHaveAttribute('data-lengths', '6 6 4 4 3 3')
    const now = normalizeConfig({ ...DAY, plugboard: await plugsNow(page) })
    await expect(diagram).toHaveAttribute('data-cycles', formatCycles(adOf(now)))
    await expect(diagram).toHaveAttribute('data-lengths', '6.6.4.4.3.3')
    await expect(page.getByTestId('task-toggle3')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    // align: CF's two 13-cycles; read forwards no split works, read backwards each offset gives one.
    expect(await where(page)).toMatchObject({ scene: 'align', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    await expect(page.getByTestId('cf-split')).toHaveAttribute('data-valid', 'false')
    const pairs0 = await page.getByTestId('cf-align').getAttribute('data-pairs')
    await page.getByTestId('cf-align-reverse').click()
    await expect(page.getByTestId('cf-split')).toHaveAttribute('data-valid', 'true')
    await expect(page.getByTestId('cf-align')).not.toHaveAttribute('data-pairs', pairs0!)
    await page.getByTestId('cf-align-right').click()
    await page.getByTestId('cf-align-right').click()
    await expect(page.getByTestId('cf-found')).toHaveAttribute('data-count', '3')
    await expect(page.getByTestId('task-try3')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expectNextDisabled(page)
  })

  test('gate cycles: each item wrong through the UI, its rollback and L1 hint, right through its widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii7-catalogue')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(Object.keys(ROLLBACK))

    // lengths and relabel: free responses; the rollback draws the cycles and walks the missed one.
    for (const [id, kind] of [
      ['lengths', 'numbers'],
      ['relabel', 'letters'],
    ] as const) {
      const c = await current(page)
      expect(c).toMatchObject({ itemId: id, kind })
      expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])
      await assertNoAnswerLeak(page)
      await answerViaUi(page, kind, await wrongAnswer(page))
      await assertRollback(page, ROLLBACK[id]!)
      await expect(page.getByTestId(`${id}-feedback`)).toBeVisible()
      await expect(page.getByTestId(`${id}-diagram`).locator('[data-highlight="true"]').first()).toBeVisible()
      await continueGate(page)
      expect(await current(page)).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
      await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
      await expect(page.getByTestId(`${id}-hint`)).toBeVisible()
      await assertNoAnswerLeak(page)
      await answerViaUi(page, kind, await solveInNode(page))
      await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
      await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-passed', 'false')
      await continueGate(page)
      await assertNoAnswerLeak(page)
      expect((await answerViaApi(page, id, await solveInNode(page), { continue: false })).correct).toBe(true)
      await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-passed', 'true')
      await continueGate(page)
    }

    // stecker-set: keyboard locked, lamps hidden, the stage on the plugboard; moving a cable submits nothing.
    let c = await current(page)
    expect(c).toMatchObject({ itemId: 'stecker-set', kind: 'set-machine' })
    await assertFocus(page, 'plugboard')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
    expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
    expect(await axeSerious(page, '[data-testid="item-stecker-set"]')).toEqual([])
    let inst = c.instance as SteckerInstance
    const submits = (await eventsOf(page, 'item.submit')).length
    const naive = [inst.x, inst.y].sort().join('')
    const wrongPair = freePairs(inst.setup.machine).includes(naive)
      ? naive
      : freePairs(inst.setup.machine).find((p) => !steckerSolutions(inst.setup.machine, inst.x, inst.y).includes(p))!
    await addCable(page, wrongPair)
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
    await assertNoAnswerLeak(page)
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, ROLLBACK['stecker-set']!)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(['plugboard'])
    expect(await pressThrows(page)).toBe(true)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'stecker-set', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('stecker-set-hint')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toContain('plugboard')
    inst = c.instance as SteckerInstance
    await expect.poll(async () => (await plugsNow(page)).length).toBe(inst.setup.machine.plugboard.length)
    await assertNoAnswerLeak(page)
    await steckerViaUi(page, steckerSolutions(inst.setup.machine, inst.x, inst.y)[0]!)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-stecker-set')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    expect((await answerViaApi(page, 'stecker-set', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-stecker-set')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // cycle-lengths (code): Run waits for the prediction; prediction and hidden cases must both be right.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'cycle-lengths', kind: 'code' })
    expect(await axeSerious(page, '[data-testid="item-cycle-lengths"]')).toEqual([])
    const run = page.getByTestId('code-run')
    await expect(run).toBeDisabled()
    await page.getByTestId('code-editor').fill(CYCLE_LENGTHS_REFERENCE)
    await expect(run).toBeDisabled()
    await page.getByTestId('gate-prediction').fill('13 13')
    await expect(run).toBeEnabled()
    await page.getByTestId('gate-prediction').fill('')
    await expect(run).toBeDisabled()
    await assertNoAnswerLeak(page)
    const probe = cycleLengthsProbe(c.instance as CycleLengthsInstance).split(' ').map(Number)
    await typeCodeAndRun(page, CYCLE_LENGTHS_REFERENCE, [probe[0]! + 1, ...probe.slice(1)].join(' '))
    await assertRollback(page, ROLLBACK['cycle-lengths']!)
    await expect(page.getByTestId('cycle-lengths-feedback')).toBeVisible()
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'cycle-lengths', hintLevel: 1 })
    await expect(page.getByTestId('cycle-lengths-hint')).toBeVisible()
    // Wrong code (not sorted) with the right prediction: wrong.
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(
      page,
      CYCLE_LENGTHS_REFERENCE.replace('return out.sort((a, b) => b - a)', 'return out'),
      cycleLengthsProbe(c.instance as CycleLengthsInstance),
    )
    await assertRollback(page, 'cycles')
    await expect(page.getByTestId('rollback')).toContainText('expected')
    await continueGate(page)
    // Right through the editor, the prediction typed as an array: W W C, not passed yet.
    c = await current(page)
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(page, CYCLE_LENGTHS_REFERENCE, `[${cycleLengthsProbe(c.instance as CycleLengthsInstance).split(' ').join(', ')}]`)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-cycle-lengths')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // The agent paste (reference + the Node-computed prediction) passes the code item: W C C …
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await expect(page.getByTestId('item-cycle-lengths')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // … but while the in-page align-pair is wrong the gate stays shut.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'align-pair', kind: 'custom' })
    expect(await axeSerious(page, '[data-testid="item-align-pair"]')).toEqual([])
    await assertNoAnswerLeak(page)
    const ai = c.instance as AlignInstance
    await alignViaUi(page, naiveAlign(ai))
    await assertRollback(page, ROLLBACK['align-pair']!)
    await expect(page.getByTestId('align-pair-feedback')).toBeVisible()
    expect((await gate(page))!.passed).toBe(false)
    await expect(page.getByTestId('gate')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'align-pair', hintLevel: 1 })
    await expect(page.getByTestId('align-pair-hint')).toBeVisible()
    await assertNoAnswerLeak(page)
    const sol = (await solveInNode(page)) as AlignAnswer
    const next = c.instance as AlignInstance
    expect(sol.reversed).toBe(true)
    await alignViaUi(page, sol)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    const shown = alignmentPairs(next.a, next.b, sol.offset, true).map(([u, v]) => [L(u), L(v)].sort().join('')).sort()
    expect(shown).toEqual(alignTruth(next))
    await expect(page.getByTestId('item-align-pair')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    expect((await answerViaApi(page, 'align-pair', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-align-pair')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/cycles`])
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/ii7-catalogue')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii7-catalogue')).toHaveAttribute('data-locked', 'false')
  })

  test('lengths: the hint ladder (L1, L2 on another instance, L3 reveal) and a reload mid-gate', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/lengths'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    await answerViaApi(page, 'lengths', await wrongAnswer(page))
    await reloadKeepsSeed(page)
  })

  test('gaming: two instant answers bring the stecker-set fallback, keyboard locked, answered on the plugboard', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 600_000 })
    await answerViaApi(page, 'lengths', await wrongAnswer(page))
    await answerViaApi(page, 'lengths', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/cycles/lengths`, reason: 'fast' }])
    await configure(page, { minLatencyMs: 0 })
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'lengths', fallback: true, kind: 'set-machine', hintLevel: 0 })
    await expect(page.getByTestId('item-lengths')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    const inst = c.instance as SteckerInstance
    await steckerViaUi(page, steckerSolutions(inst.setup.machine, inst.x, inst.y)[0]!)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/cycles`]!.items['lengths']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'lengths', fallback: false, kind: 'numbers' })
  })
})

test.describe('chapter ii6-cycles in 3D', { tag: ['@3d', '@chapter:ii6-cycles'] }, () => {
  test('across scene changes, stecker-toggle reports focus plugboard and dimmedParts; its bet gates the cable', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    await completeScene(page)
    expect((await where(page)).scene).toBe('stecker-toggle')
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:plugboard')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('plugboard', 'I'))
    const [toggle] = await sceneReveals(page)
    await assertRevealGated(page, toggle!)
    await commitBet(page, 'lengths', 'unchanged')
    await fireReveal(page, toggle!)
    await expect(page.getByTestId('stecker-ad')).toHaveAttribute('data-lengths', '6.6.4.4.3.3')
    await expect(page.getByTestId('stecker-ad')).toHaveAttribute('data-cycles', formatCycles(adOf(withCable(DAY, DEMO_CABLE))))
  })
})
