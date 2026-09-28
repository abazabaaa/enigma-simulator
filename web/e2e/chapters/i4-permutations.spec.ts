/**
 * Chapter I.4 · Enigma as permutations (PLAN §4.4 "i4-permutations", §6.0 CHAPTER PR TEMPLATE steps 0–8 and the
 * code-gate extras, brief 10):
 *  - every scene in order: Rejewski's symbols in their parts' colours (focus highlights the part), the bet before
 *    Play (a key, then its lamp's key: the letter comes back), the tables composed factor by factor into E;
 *  - gate `keypress`: the code item (Run needs the prediction; the reference with a wrong prediction fails; code with
 *    the middle and left rotors swapped fails with a path rollback and a ghost on the stage; the agent paste passes the
 *    code item but the gate stays unpassed while the in-page which-wrong is wrong); which-wrong draws no ghost while the
 *    question is open, only in its rollback; hop-chain-full through its own inputs, with the rollback drawn at the true
 *    windows; chapter.complete, Act II unlocks, and the delayed two-item recall of Act I (the return-visit check);
 *  - the gaming fallback (which-wrong, in page), the hint ladder, a reload mid-gate;
 *  - @3d: the first mechanism scene reports focus 'wire' and dimmedParts.
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
import {
  COMPONENT_PART,
  FACTORS,
  KEYPRESS_REFERENCE,
  SYMBOLS_KEY,
  faultyHop,
  keypressProbe,
  windowsAfterStep,
  type ChainFullInstance,
  type KeypressInstance,
  type WhichWrongInstance,
} from '../../src/chapters/i4-permutations/gates'
import { dimmedParts } from '../../src/contracts/stage'
import { LETTERS, createMachine, machinePermutation, withPositions } from '../../src/engine'
import { partForStage } from '../../src/lesson/kinds/helpers'
import { SYM_FOR_PART } from '../../src/lib/symbols'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'i4-permutations'
const HOURS = 3_600_000

/** §4.1 G5 table: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = { keypress: 'path', 'which-wrong': 'path', 'hop-chain-full': 'path' }

/** The reference with the middle and left rotors swapped both ways. */
const SWAPPED = KEYPRESS_REFERENCE.replace("['right', 'middle', 'left']", "['right', 'left', 'middle']").replace(
  "['left', 'middle', 'right']",
  "['middle', 'left', 'right']",
)

const state = (page: Page) => page.evaluate(() => window.__enigma!.getState())
const stageInfo = (page: Page) => page.evaluate(() => window.__stage!.info())

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

/** Serious or critical axe findings inside one element (other PRs' placeholder stubs excluded), as lesson.spec does. */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** Walk the explore scenes (bets and triggers through the UI) up to the gate. */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 5 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter i4-permutations', { tag: '@chapter:i4-permutations' }, () => {
  test("scenes in order: the story, Rejewski's coloured symbols, the bet before Play, the tables composed into E", async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'notation', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Marian Rejewski')
    await nextScene(page)

    // symbols: each symbol has its part's colour and highlights that part on the stage.
    expect(await where(page)).toMatchObject({ scene: 'symbols', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'inverse', trigger: 'play' })
    await assertRevealGated(page, play!)
    expect(await pressThrows(page), 'the keyboard waits for the bet').toBe(true)
    for (const [k, f] of FACTORS.entries()) {
      const button = page.getByTestId(`sym-${k}`)
      await expect(button).toHaveAttribute('data-sym', f.sym)
      const part = COMPONENT_PART[f.sym]
      expect(SYM_FOR_PART[part]).toBe(f.sym)
      // The symbol is drawn in its slot colour: the same CSS token the stage uses for the part.
      const colours = await button.locator('[data-sym]').evaluate((el, sym) => {
        const probe = document.createElement('span')
        probe.style.color = `var(--sym-${sym})`
        document.body.append(probe)
        const want = getComputedStyle(probe).color
        probe.remove()
        return { got: getComputedStyle(el).color, want }
      }, f.sym)
      expect(colours.got).toBe(colours.want)
      await button.focus()
      await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual([part])
    }
    await expect(page.getByTestId('task-hover-all')).toHaveAttribute('data-done', 'true')
    await commitBet(page, 'inverse', 'returns')
    await fireReveal(page, play!)
    await expect(page.getByTestId('symbols-back')).toBeVisible()
    const s = await state(page)
    expect(s.input).toBe(`${SYMBOLS_KEY}${s.output[0]}`)
    expect(s.output[1]).toBe(SYMBOLS_KEY)
    expect(s.positions, 'the rotors are held').toBe(s.config.positions.join(''))
    expect((await betResults(page)).inverse).toBe(true)
    await nextScene(page)

    // tables: the six components at the current windows, composed factor by factor into E.
    expect(await where(page)).toMatchObject({ scene: 'tables', kind: 'explore', canNext: false })
    await assertFocus(page, 'wire')
    for (let k = 0; k < FACTORS.length; k++) {
      await expect(page.getByTestId('compose-steps')).toHaveAttribute('data-k', String(k))
      await page.getByTestId('compose-next').click()
      await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual([COMPONENT_PART[FACTORS[k]!.sym]])
    }
    await expect(page.getByTestId('compose-next')).toBeDisabled()
    await expect(page.getByTestId('compose-result')).toContainText('This product is E')
    await expect(page.getByTestId('task-compose-all')).toHaveAttribute('data-done', 'true')
    // The composed table is the machine's permutation at these windows, and a press agrees with it.
    const t = await state(page)
    const e = machinePermutation(withPositions(createMachine(t.config), t.positions))
    for (const i of [0, 7, 25]) {
      await expect(page.getByTestId(`compose-product-cell-${i}`)).toHaveAttribute('data-value', LETTERS[e[i]!]!)
    }
    await page.getByTestId('key-Q').click()
    expect((await state(page)).lamp).toBe(LETTERS[e[16]!])
    // Turning a rotor redraws the tables.
    const before = await page.getByTestId('table-N-cell-0').getAttribute('data-value')
    await page.getByTestId('rotor-pos-right').focus()
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => page.getByTestId('table-N-cell-0').getAttribute('data-value')).not.toBe(before)
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
  })

  test('gate keypress: code, ghost-pick and chain wrong through the UI with path rollbacks, right through the widgets; Act I recall', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii5-indicators')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(Object.keys(ROLLBACK))

    // keypress (code): Run waits for the prediction.
    let c = await current(page)
    expect(c).toMatchObject({ itemId: 'keypress', kind: 'code' })
    expect(await axeSerious(page, '[data-testid="item-keypress"]')).toEqual([])
    await assertFocus(page, 'wire')
    const run = page.getByTestId('code-run')
    await expect(run).toBeDisabled()
    await page.getByTestId('code-editor').fill(KEYPRESS_REFERENCE)
    await expect(run).toBeDisabled()
    await page.getByTestId('gate-prediction').fill('Q')
    await expect(run).toBeEnabled()
    await page.getByTestId('gate-prediction').fill('')
    await expect(run).toBeDisabled()
    // The stage holds this press after its step (the prompt says where), with no path and no ghost yet.
    const k0 = c.instance as KeypressInstance
    await expect.poll(async () => (await state(page)).positions).toBe(windowsAfterStep(createMachine({ model: 'I', ...k0.state }).config))
    expect((await stageInfo(page)).ghost).toBe(false)
    // The reference with a wrong prediction: wrong; the rollback marks the predicted letter at M⁻¹.
    await assertNoAnswerLeak(page)
    const want = keypressProbe(k0)
    await typeCodeAndRun(page, KEYPRESS_REFERENCE, LETTERS[(LETTERS.indexOf(want) + 1) % 26]!)
    await assertRollback(page, 'path')
    await expect(page.getByTestId('rollback').locator('[data-diverge="true"]')).toHaveCount(1)
    await expect.poll(async () => (await stageInfo(page)).ghost).toBe(true)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'keypress', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('keypress-hint')).toBeVisible()
    await expect.poll(async () => (await stageInfo(page)).highlighted).toContain('rotor-middle')
    expect((await stageInfo(page)).ghost).toBe(false)
    // Code with the middle and left rotors swapped, and the right prediction: wrong, and the stage draws its path.
    await typeCodeAndRun(page, SWAPPED, keypressProbe(c.instance as KeypressInstance))
    await assertRollback(page, 'path')
    await expect.poll(async () => (await stageInfo(page)).ghost).toBe(true)
    // Hop 4 of the learner's path went through the left rotor, where the middle one belongs: that part is outlined.
    await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual(['rotor-left'])
    const rb = (await page.evaluate(() => window.__course!.lastCheck()))!.result.rollback
    expect(rb).toMatchObject({ kind: 'path', ghost: { divergeAt: 3 } })
    if (rb.kind === 'path') expect(rb.ghost.hops.map((h) => h.stage).slice(2, 5)).toEqual(['rotor-right-fwd', 'rotor-left-fwd', 'rotor-middle-fwd'])
    await expect(page.getByTestId('rollback')).toContainText('Left rotor, hop 4')
    expect(await axeSerious(page, '[data-testid="item-keypress"]')).toEqual([])
    await continueGate(page)
    // Right through the editor: W W C, not passed yet.
    c = await current(page)
    await assertNoAnswerLeak(page)
    await typeCodeAndRun(page, KEYPRESS_REFERENCE, keypressProbe(c.instance as KeypressInstance))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-keypress')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // The agent paste passes the code item (W C C) …
    expect((await agentPasteProbe(page)).correct).toBe(true)
    await expect(page.getByTestId('item-keypress')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // which-wrong (ghost-pick): no ghost and no divergence in the question; the ghost only in the rollback.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'which-wrong', kind: 'ghost-pick' })
    expect(await axeSerious(page, '[data-testid="item-which-wrong"]')).toEqual([])
    const w0 = c.instance as WhichWrongInstance
    expect(w0.ghost.divergeAt).toBe(-1)
    expect((await stageInfo(page)).ghost).toBe(false)
    await expect(page.getByTestId('stage2d-ghost')).toHaveCount(0)
    await expect(page.getByTestId('which-wrong-hops').locator('li')).toHaveCount(11)
    await assertNoAnswerLeak(page)
    const truth = (await solveInNode(page)) as string
    const wrongPart = truth === 'etw' ? 'plugboard' : 'etw'
    await answerViaUi(page, 'ghost-pick', wrongPart)
    await assertRollback(page, 'path')
    await expect.poll(async () => (await stageInfo(page)).ghost).toBe(true)
    await expect(page.getByTestId('stage2d-ghost')).toHaveCount(1)
    await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual([partForStage(w0.ghost.hops[faultyHop(w0)]!.stage)])
    // … but with the in-page item wrong the gate stays unpassed.
    expect((await gate(page))!.passed).toBe(false)
    expect(await page.getByTestId('gate').getAttribute('data-passed')).toBe('false')
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'which-wrong', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    const logic = await logicFor(c.gateKey, 'which-wrong', false)
    await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual(logic.highlight(c.instance, wrongPart).map((h) => h.part))
    expect((await stageInfo(page)).ghost).toBe(false)
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'ghost-pick', await solveInNode(page))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-which-wrong')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    expect((await answerViaApi(page, 'which-wrong', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-which-wrong')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // hop-chain-full (chain, its own inputs): the machine shows the start windows; the rollback moves it to the true ones.
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'hop-chain-full', kind: 'chain' })
    expect(await axeSerious(page, '[data-testid="item-hop-chain-full"]')).toEqual([])
    const h0 = c.instance as ChainFullInstance
    await expect.poll(async () => (await state(page)).positions).toBe(h0.config.positions.join(''))
    await assertNoAnswerLeak(page)
    const wrong = (await wrongAnswer(page, 3)) as string[]
    await answerViaUi(page, 'chain', wrong)
    await assertRollback(page, 'path')
    await expect.poll(async () => (await stageInfo(page)).ghost).toBe(true)
    await expect.poll(async () => (await state(page)).positions).toBe(windowsAfterStep(h0.config))
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'hop-chain-full', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    const chain = await logicFor(c.gateKey, 'hop-chain-full', false)
    await expect.poll(async () => (await stageInfo(page)).highlighted).toEqual(chain.highlight(c.instance, wrong).map((h) => h.part))
    await expect.poll(async () => (await state(page)).positions).toBe((c.instance as ChainFullInstance).config.positions.join(''))
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'chain', await solveInNode(page))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-hop-chain-full')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    expect((await answerViaApi(page, 'hop-chain-full', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-hop-chain-full')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/keypress`])
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/ii5-indicators')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })

    // Act I is complete: a return six hours on opens with two Act I recall items (§4.2).
    await configure(page, { now: Date.now() + 7 * HOURS })
    await expect(page.getByTestId('return-check')).toBeVisible()
    const check = (await eventsOf(page, 'return-check')).at(-1)!
    expect(check.items).toHaveLength(2)
    for (const key of check.items) expect(['r-windows', 'r-hop-trio']).toContain(key.split('/').at(-1))
    for (let k = 0; k < 2; k++) {
      await expect(page.getByTestId('return-check')).toHaveAttribute('data-step', String(k))
      const r = await current(page)
      expect(r.gateKey).toContain(`${CHAPTER}/return-`)
      await answerViaApi(page, r.itemId, await solveInNode(page))
    }
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii5-indicators')).toHaveAttribute('data-locked', 'false')
  })

  test('gaming: two instant answers bring the which-wrong fallback, in page, answered through the part buttons', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'keypress', await wrongAnswer(page))
    await answerViaApi(page, 'keypress', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/keypress/keypress`, reason: 'fast' }])
    const fb = await current(page)
    expect(fb).toMatchObject({ itemId: 'keypress', fallback: true, kind: 'ghost-pick' })
    await expect(page.getByTestId('item-keypress')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('which-wrong-answer')).toBeVisible()
    expect(await pressThrows(page)).toBe(true)
    expect((await stageInfo(page)).ghost).toBe(false)
    await configure(page, { minLatencyMs: 0 })
    await answerViaUi(page, 'ghost-pick', await solveInNode(page))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/keypress`]!.items['keypress']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'keypress', fallback: false, kind: 'code' })
  })

  test('the hint ladder on keypress, and a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    await toGate(page)
    await assertLadder(page)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/keypress'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'keypress', await solveInNode(page))
    await answerViaApi(page, 'keypress', await solveInNode(page))
    expect((await current(page)).itemId).toBe('which-wrong')
    await reloadKeepsSeed(page)
  })
})

test.describe('chapter i4-permutations in 3D', { tag: ['@3d', '@chapter:i4-permutations'] }, () => {
  test('the first mechanism scene reports focus wire and dimmedParts; its bet gates Play', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('symbols')
    await expect
      .poll(
        async () => {
          const i = await stageInfo(page)
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:wire')
    expect((await stageInfo(page)).dimmed).toEqual(dimmedParts('wire', 'I'))
    const [play] = await sceneReveals(page)
    await assertRevealGated(page, play!)
    await commitBet(page, 'inverse', 'returns')
    await fireReveal(page, play!)
    await expect(page.getByTestId('symbols-back')).toBeVisible()
  })
})
