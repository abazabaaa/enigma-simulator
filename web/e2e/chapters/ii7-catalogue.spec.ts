/**
 * Chapter II.7 · the cyclometer and the catalogue (PLAN §4.4 "ii7-catalogue", §6.0 CHAPTER PR TEMPLATE steps 0–8,
 * brief 13):
 *  - the story; the cyclometer (the lamps bet gates key A, the only key before the reveal; A lights its 4-cycle and
 *    the partner, 8 lamps; AD, BE and CF measured key by key give the day's characteristic); the catalogue built in the
 *    page in a worker in under 10 s (the bucket bet gates the build), its histogram and the day's card;
 *  - gate `catalogue`: each item wrong through the UI with its rollback and L1 hint, right through its own widget (the
 *    lookup once through the real UI: build the key, query the card, set the rotors with the selectors and the windows
 *    with the spinbuttons, submit), the rest through the API; the set-machine locks; chapter.complete, II.8 and III.9
 *    unlocked (II.8 is optional);
 *  - the ladder, a reload, the gaming fallback (lookup, keyboard locked) on #/lab/gate; the delayed recall (§4.2);
 *  - @3d: across scene changes the chapter's first scenes mount no stage, and the lookup's rotors show in 3D.
 * Answers are computed in Node from the pure gates.ts.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerCorrect,
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
  editProgress,
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
  CYCLO_CHARACTERISTIC,
  CYCLO_DAY,
  L,
  PRODUCTS,
  cyclometerWindows,
  dayCharacteristic,
  litLamps,
  naiveSignature,
  parseKey,
  permAt,
  type LookupInstance,
  type SignatureInstance,
} from '../../src/chapters/ii7-catalogue/gates'
import type { MachineConfig } from '../../src/contracts/core'
import { dimmedParts } from '../../src/contracts/stage'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'ii7-catalogue'

/** §4.4: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = {
  signature: 'cycles',
  lookup: 'machine',
  'set-plugs': 'machine',
  'lookup-transfer': 'machine',
  'rejewski-parsons': 'order',
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

const machineNow = (page: Page) =>
  page.evaluate(() => {
    const s = window.__enigma!.getState()
    return { rotors: s.config.rotors.join('-'), positions: s.positions, plugboard: [...s.config.plugboard].sort().join(' ') }
  })

/** Keys whose cycles (with their partners) cover every letter of product k, from the engine in Node. */
function coveringKeys(k: 0 | 1 | 2): string[] {
  const [a, d] = cyclometerWindows(CYCLO_DAY, k)
  const [first, second] = [permAt(CYCLO_DAY, a), permAt(CYCLO_DAY, d)]
  const seen = new Set<number>()
  const keys: string[] = []
  for (let x = 0; x < 26; x++) {
    if (seen.has(x)) continue
    const { cycle, partner } = litLamps(first, second, x)
    for (const y of [...cycle, ...partner]) seen.add(y)
    keys.push(L(x))
  }
  return keys
}

/** Type a key's lengths into a key builder (its AD, BE and CF fields), as the learner does. */
async function typeKey(page: Page, testId: string, key: string): Promise<void> {
  const lists = parseKey(key)!
  for (const [k, name] of PRODUCTS.entries()) await page.getByTestId(`${testId}-${name}`).fill(lists[k]!.join(' '))
  await expect(page.getByTestId(`${testId}-key`)).toHaveText(key)
}

/** The rotor order through the three selectors, the windows through the spinbuttons (typing a letter). */
async function setRotors(page: Page, rotors: readonly string[], positions: string): Promise<void> {
  for (const [k, slot] of (['left', 'middle', 'right'] as const).entries()) {
    await page.getByTestId(`rotor-select-${slot}`).selectOption(rotors[k]!)
  }
  for (const [k, slot] of (['left', 'middle', 'right'] as const).entries()) {
    const spin = page.getByTestId(`rotor-pos-${slot}`)
    await spin.focus()
    await page.keyboard.press(positions[k]!)
    await expect(spin).toHaveAttribute('aria-valuetext', positions[k]!)
  }
  await expect.poll(async () => { const m = await machineNow(page); return `${m.rotors} ${m.positions}` }).toBe(`${rotors.join('-')} ${positions}`)
}

/** Build the key, query the card, and return its settings as the tool lists them. */
async function queryCard(page: Page, key: string): Promise<string[]> {
  await typeKey(page, 'lookup-key', key)
  const query = page.getByTestId('catalogue-query')
  await expect(query).toBeEnabled({ timeout: 15_000 })
  await query.click()
  const card = page.getByTestId('catalogue-card')
  await expect(card).toHaveAttribute('data-key', key)
  const n = Number(await card.getAttribute('data-count'))
  expect(n).toBeGreaterThanOrEqual(2)
  return Promise.all(Array.from({ length: n }, (_, k) => page.getByTestId(`catalogue-candidate-${k}`).innerText()))
}

/** Add cables through the plugboard editor. */
async function addCables(page: Page, pairs: readonly string[]): Promise<void> {
  const before = (await machineNow(page)).plugboard.split(' ').filter(Boolean).length
  await page.getByTestId('plug-input').fill(pairs.join(' '))
  await page.getByTestId('plug-add').click()
  await expect.poll(async () => (await machineNow(page)).plugboard.split(' ').filter(Boolean).length).toBe(before + pairs.length)
}

/** Set-machine items (template step 6): keyboard locked, lamps hidden, moving a control submits nothing. */
async function assertSetMachineLocks(page: Page): Promise<void> {
  await expect(page.getByTestId('key-A')).toBeDisabled()
  expect(await pressThrows(page)).toBe(true)
  expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
  expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
  const submits = (await eventsOf(page, 'item.submit')).length
  const spin = page.getByTestId('rotor-pos-right')
  if (await spin.isEnabled()) {
    await spin.focus()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowDown')
  } else {
    await page.getByTestId('plug-input').fill('QZ')
    await page.getByTestId('plug-add').click()
    await page.getByTestId('plug-pair-0').getByRole('button').click()
  }
  expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
}

async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 5 && (await where(page)).kind !== 'gate'; k++) await completeScene(page)
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

/** Gate `catalogue` alone (#/lab/gate), with the e2e configuration: the ladder, reload and gaming tests. */
async function openGateLab(page: Page): Promise<void> {
  await gotoApp(page, `/lab/gate/${CHAPTER}/catalogue`, { stage: '2d' })
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  await current(page)
}

test.describe('chapter ii7-catalogue', { tag: '@chapter:ii7-catalogue' }, () => {
  test('scenes in order: the story, the cyclometer lights whole cycles, the catalogue builds in the page', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'cyclometer-story', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Marian Rejewski')
    await nextScene(page)

    // The cyclometer: no stage; the lamps bet gates key A, the only key before the reveal.
    expect(await where(page)).toMatchObject({ scene: 'cyclometer', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    const [press] = await sceneReveals(page)
    expect(press).toEqual({ bet: 'lamps', trigger: 'press', key: 'A' })
    await assertRevealGated(page, press!)
    await expect(page.getByTestId('cyclometer-set-1')).toHaveAttribute('data-windows', 'MZI')
    await expect(page.getByTestId('cyclometer-set-2')).toHaveAttribute('data-windows', 'MZL')
    await commitBet(page, 'lamps', '1')
    await expect(page.getByTestId('key-B')).toBeDisabled()
    await expect(page.getByTestId('key-A')).toBeEnabled()
    await fireReveal(page, press!)
    await expect(page.getByTestId('cyclometer-lamps')).toHaveAttribute('data-lit', 'ACEHKNXY')
    await expect(page.getByTestId('cyclometer-result')).toContainText('Key A lit 8 lamps')
    await expect(page.getByTestId('cyclometer-result')).toHaveAttribute('aria-live', 'polite')
    expect(await betResults(page)).toMatchObject({ lamps: false })
    await expect(page.getByTestId('key-B')).toBeEnabled()
    await expectNextDisabled(page)
    // Measure AD, BE and CF key by key: every lamp of a product once gives its lengths, and all three the key.
    for (const k of [0, 1, 2] as const) {
      await page.getByTestId(`cyclometer-product-${PRODUCTS[k]}`).click()
      const [a, d] = cyclometerWindows(CYCLO_DAY, k)
      await expect(page.getByTestId('cyclometer-set-1')).toHaveAttribute('data-windows', a)
      await expect(page.getByTestId('cyclometer-set-2')).toHaveAttribute('data-windows', d)
      for (const key of coveringKeys(k)) await page.getByTestId(`key-${key}`).click()
      await expect(page.getByTestId(`cyclometer-found-${PRODUCTS[k]}`)).toHaveAttribute('data-letters', '26')
    }
    await expect(page.getByTestId('task-press3')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('cyclometer-characteristic')).toContainText(CYCLO_CHARACTERISTIC)
    await nextScene(page)

    // The catalogue: the bet gates the build; the worker files 105,456 settings in under 10 s.
    expect(await where(page)).toMatchObject({ scene: 'catalogue', kind: 'explore' })
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await expectNextDisabled(page)
    const [run] = await sceneReveals(page)
    expect(run).toMatchObject({ bet: 'bucket', trigger: 'run' })
    await assertRevealGated(page, run!)
    await expect(page.getByTestId('catalogue-build')).toHaveAttribute('data-state', 'idle')
    await commitBet(page, 'bucket', 'one')
    await fireReveal(page, run!)
    await expect(page.getByTestId('catalogue-build')).toHaveAttribute('data-state', 'done', { timeout: 10_000 })
    expect(Number(await page.getByTestId('catalogue-build').getAttribute('data-ms'))).toBeLessThan(10_000)
    await expect(page.getByTestId('catalogue-summary')).toHaveAttribute('data-distinct', '20882')
    await expect(page.getByTestId('catalogue-summary')).toHaveAttribute('data-median', '20')
    await expect(page.getByTestId('catalogue-histogram')).toHaveAttribute('data-entries', '105456')
    await expect(page.getByTestId('catalogue-histogram')).toHaveAttribute('data-highlight-bin', '5–8')
    await expect(page.getByTestId('catalogue-day-card')).toHaveAttribute('data-count', '6')
    await expect(page.getByTestId('catalogue-day-card')).toContainText('I-II-III · MZH')
    await expect(page.getByTestId('task-built')).toHaveAttribute('data-done', 'true')
    expect(await betResults(page)).toMatchObject({ bucket: false })
    await nextScene(page)
    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await expectNextDisabled(page)
  })

  test('gate catalogue: each item wrong through the UI, its rollback and L1 hint, right through its widget; chapter.complete', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii8-sheets')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    const items = (await gate(page))!.items.map((i) => i.itemId)
    expect(items).toEqual(Object.keys(ROLLBACK))

    // signature (custom): the lengths in written order through the key builder, then the key longest first.
    let c = await current(page)
    expect(c.itemId).toBe('signature')
    expect(await axeSerious(page, '[data-testid="item-signature"]')).toEqual([])
    await assertNoAnswerLeak(page)
    const sig = c.instance as SignatureInstance
    await typeKey(page, 'signature-key', naiveSignature(sig.products))
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, ROLLBACK.signature!)
    await expect(page.getByTestId('rollback')).toContainText('longest first')
    await expect(page.getByTestId('cycles-feedback')).toBeVisible()
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'signature', hintLevel: 1, passed: false })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('item-prompt')).toContainText('longest to shortest')
    await assertNoAnswerLeak(page)
    await typeKey(page, 'signature-key', (await solveInNode(page)) as string)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-signature')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    await assertNoAnswerLeak(page)
    expect((await answerViaApi(page, 'signature', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-signature')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // lookup (set-machine): the first setting on the card is wrong; the right one is found through the real UI.
    c = await current(page)
    expect(c.itemId).toBe('lookup')
    await assertFocus(page, 'rotor-stack')
    await assertSetMachineLocks(page)
    expect(await axeSerious(page, '[data-testid="item-lookup"]')).toEqual([])
    await assertNoAnswerLeak(page)
    let inst = c.instance as LookupInstance
    let card = await queryCard(page, dayCharacteristic(inst))
    const [firstRotors, firstPositions] = card[0]!.split(' · ') as [string, string]
    await setRotors(page, firstRotors.split('-'), firstPositions)
    await expect(page.getByTestId('trial-preview')).toHaveAttribute('data-reads', 'false')
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, ROLLBACK.lookup!)
    await expect(page.getByTestId('rollback')).toContainText(`begins`)
    await expect.poll(async () => (await machineNow(page)).positions).toBe(firstPositions)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'lookup', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    const hint = (await logicFor(c.gateKey, 'lookup', false)).highlight(c.instance, null).map((h) => h.part)
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(expect.arrayContaining(hint))
    await expect(page.getByTestId('item-prompt')).toContainText('The highlighted rotors are what you set')
    await expect.poll(async () => machineNow(page)).toMatchObject({ rotors: 'I-II-III', positions: 'AAA' })
    await assertNoAnswerLeak(page)
    inst = c.instance as LookupInstance
    const truth = (await solveInNode(page)) as MachineConfig
    card = await queryCard(page, dayCharacteristic(inst))
    expect(card).toContain(`${truth.rotors.join('-')} · ${truth.positions.join('')}`)
    await setRotors(page, truth.rotors, truth.positions.join(''))
    await expect(page.getByTestId('trial-preview')).toHaveAttribute('data-reads', 'true')
    await expect(page.getByTestId('trial-preview')).toContainText(inst.crib)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-lookup')).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    await assertNoAnswerLeak(page)
    expect((await answerViaApi(page, 'lookup', await solveInNode(page), { continue: false })).correct).toBe(true)
    await expect(page.getByTestId('item-lookup')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // set-plugs (set-machine, once): one needed cable short, then every cable through the plugboard editor.
    c = await current(page)
    expect(c.itemId).toBe('set-plugs')
    await assertFocus(page, 'plugboard')
    await assertSetMachineLocks(page)
    expect(await axeSerious(page, '[data-testid="item-set-plugs"]')).toEqual([])
    await assertNoAnswerLeak(page)
    const short = (await wrongAnswer(page)) as MachineConfig
    await addCables(page, short.plugboard)
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, ROLLBACK['set-plugs']!)
    await expect(page.getByTestId('rollback')).toContainText('letters are right')
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'set-plugs', hintLevel: 1 })
    await expect.poll(() => page.evaluate(() => window.__stage!.info().highlighted)).toEqual(expect.arrayContaining(['plugboard']))
    await expect(page.getByTestId('item-prompt')).toContainText('The highlighted plugboard')
    await expect.poll(async () => (await machineNow(page)).plugboard).toBe('')
    await assertNoAnswerLeak(page)
    const plugs = (await solveInNode(page)) as MachineConfig
    await addCables(page, plugs.plugboard)
    await expect(page.getByTestId('trial-preview')).toHaveAttribute('data-right', String((c.instance as { plain: string }).plain.length))
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-set-plugs')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // lookup-transfer (set-machine, once): only the raw indicators; another wheel order than I-II-III.
    c = await current(page)
    expect(c.itemId).toBe('lookup-transfer')
    await assertFocus(page, 'rotor-stack')
    await assertSetMachineLocks(page)
    await expect(page.getByTestId('day-products')).toHaveCount(0)
    await expect(page.getByTestId('transfer-workbench')).toBeVisible()
    expect(await axeSerious(page, '[data-testid="item-lookup-transfer"]')).toEqual([])
    await assertNoAnswerLeak(page)
    const off = (await wrongAnswer(page)) as MachineConfig
    await setRotors(page, off.rotors, off.positions.join(''))
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, ROLLBACK['lookup-transfer']!)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'lookup-transfer', hintLevel: 1 })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await assertNoAnswerLeak(page)
    const t = (await solveInNode(page)) as MachineConfig
    expect(t.rotors.join('-')).not.toBe('I-II-III')
    await page.getByTestId('transfer-sort-0').click()
    card = await queryCard(page, dayCharacteristic(c.instance as LookupInstance))
    expect(card).toContain(`${t.rotors.join('-')} · ${t.positions.join('')}`)
    await setRotors(page, t.rotors, t.positions.join(''))
    await expect(page.getByTestId('trial-preview')).toHaveAttribute('data-reads', 'true')
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-lookup-transfer')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // rejewski-parsons (order, once): through the order widget.
    c = await current(page)
    expect(c.itemId).toBe('rejewski-parsons')
    expect(await axeSerious(page, '[data-testid="item-rejewski-parsons"]')).toEqual([])
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'order', await wrongAnswer(page))
    await assertRollback(page, ROLLBACK['rejewski-parsons']!)
    await continueGate(page)
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await assertNoAnswerLeak(page)
    await answerViaUi(page, 'order', await solveInNode(page))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-rejewski-parsons')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/catalogue`])
    expect((await eventsOf(page, 'item.passed')).length).toBe(items.length)

    // 8. chapter.complete; the next chapter is II.8, and III.9 unlocks too (II.8 is optional).
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/ii8-sheets')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-ii8-sheets')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('chapter-link-iii9-cribs')).toHaveAttribute('data-locked', 'false')
  })

  test('the hint ladder on signature: L1, L2 worked example on another instance, L3 reveal', async ({ page }) => {
    await openGateLab(page)
    await assertLadder(page, { highlights: false })
    await expect(page.getByTestId('item-signature')).toHaveAttribute('data-passed', 'false')
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/signature'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 1, 2, 3, 0])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await openGateLab(page)
    await answerViaApi(page, 'signature', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await expect(page.getByTestId('signature-key')).toBeVisible()
  })

  test('gaming: two instant answers bring the lookup fallback, keyboard locked, answered on the machine', async ({ page }) => {
    await openGateLab(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'signature', await wrongAnswer(page))
    await answerViaApi(page, 'signature', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/lab:catalogue/signature`, reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'signature', fallback: true, kind: 'set-machine' })
    await expect(page.getByTestId('item-signature')).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    await configure(page, { minLatencyMs: 0 })
    const truth = (await solveInNode(page)) as MachineConfig
    await setRotors(page, truth.rotors, truth.positions.join(''))
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/lab:catalogue`]!.items['signature']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
    expect(await current(page)).toMatchObject({ itemId: 'signature', fallback: false, kind: 'custom' })
  })

  test('delayed recall (§4.2): with II.7 complete, a return visit asks the Act II items', async ({ page }) => {
    await enter(page, CHAPTER)
    await editProgress(page, (p) => (p.chapters['ii7-catalogue'] = { reached: 3, completed: true, tasks: [] }), `/c/${CHAPTER}`)
    await expect.poll(async () => (await where(page)).scene).toBe('cyclometer-story')
    await expect(page.getByTestId('return-check')).toHaveCount(0)
    await configure(page, { now: Date.now() + 7 * 3600_000 })
    await expect(page.getByTestId('return-check')).toBeVisible()
    const [check] = await eventsOf(page, 'return-check')
    expect(check!.items.map((k) => k.split('/').at(-1)).sort()).toEqual(['r-compose', 'r-lengths'])
    for (let k = 0; k < 2; k++) await answerCorrect(page)
    await expect(page.getByTestId('return-check')).toHaveCount(0)
  })
})

test.describe('chapter ii7-catalogue in 3D', { tag: ['@3d', '@chapter:ii7-catalogue'] }, () => {
  test('across scene changes the first scenes mount no stage; the lookup shows its rotors in 3D', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(120_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('cyclometer')
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await completeScene(page)
    expect((await where(page)).scene).toBe('catalogue')
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await completeScene(page)
    expect((await where(page)).scene).toBe('gate')
    await answerCorrect(page)
    await answerCorrect(page)
    expect((await current(page)).itemId).toBe('lookup')
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:rotor-stack')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('rotor-stack', 'I'))
    expect(await pressThrows(page)).toBe(true)
  })
})
