/**
 * Chapter IV · the capstone, "the day key" (PLAN §4.4 "iv-capstone", §6.0 CHAPTER PR TEMPLATE steps 0–8, brief 16):
 *  - every scene in order: recall across the three acts, the story (a training exercise; nothing timed), and both
 *    tool scenes by real actions, each route run end to end on its practice day (catalogue and bombe in workers);
 *  - gates `polish` and `british` (puzzle): each item wrong through the UI with its rollback, NO hint after 1 wrong
 *    answer and L1 after 2, then right through the real controls (rotors, windows and cables set with the controls);
 *    set-machine locks; axe on the question, the rollback and the hint; chapter.complete completes the course;
 *  - the ladder (assertLadder, puzzle), a reload keeps the day, a retry draws a new day, the gaming fallback;
 *  - the capstone unlocks after III.12;
 *  - @3d: the set-the-machine stage in 3D, kept across scene changes.
 * Answers are computed in Node from the pure gates.ts (the day rebuilt from the instance's seed).
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerViaApi,
  answerViaUi,
  assertFocus,
  assertLadder,
  assertNoAnswerLeak,
  assertRollback,
  completeTasks,
  configure,
  continueGate,
  current,
  editProgress,
  enter,
  eventsOf,
  expectNextDisabled,
  gate,
  logicFor,
  nextScene,
  passGate,
  progress,
  reloadKeepsSeed,
  settled,
  solveInNode,
  where,
  wrongAnswer,
} from '../helpers/course'
import { CHAPTERS } from '../../src/content/registry'
import { partList } from '../../src/lesson/partNames'
import type { MachineConfig } from '../../src/contracts/core'
import { dimmedParts } from '../../src/contracts/stage'
import {
  PRACTICE_BRITISH_SEED,
  PRACTICE_POLISH_SEED,
  britishDay,
  britishSolution,
  characteristicOf,
  parseKey,
  polishDay,
  productsOf,
  type BritishMenuInstance,
  type MenuAnswer,
} from '../../src/chapters/iv-capstone/gates'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'iv-capstone'
const SLOTS = ['left', 'middle', 'right'] as const

/** §4.1 G5: the rollback kind of each item. */
const ROLLBACK: Record<string, string> = {
  'polish-card': 'cycles',
  'polish-key': 'machine',
  'british-menu': 'crib',
  'british-key': 'machine',
  'read-intercepts': 'machine',
}

// ---------------------------------------------------------------------------
// Drivers for the chapter's own controls
// ---------------------------------------------------------------------------

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

/** AD, BE, CF: letter 1 → 4, 2 → 5, 3 → 6 (option values are 0-based letter places). */
async function choosePairing(page: Page): Promise<void> {
  for (const [k, n] of (['AD', 'BE', 'CF'] as const).entries()) await page.getByTestId(`pairing-${n}`).selectOption({ value: String(k + 3) })
}

/** Type a characteristic 'AD:… BE:… CF:…' into the three key fields. */
async function typeKey(page: Page, key: string): Promise<void> {
  const lists = parseKey(key)!
  for (const [k, n] of (['AD', 'BE', 'CF'] as const).entries()) await page.getByTestId(`key-${n}`).fill(lists[k]!.join(' '))
}

/** Set rotors (selects), windows (spinbuttons, by typing the letter) and cables (plug-input) through the controls. */
async function setMachineUi(
  page: Page,
  cfg: Pick<MachineConfig, 'rotors' | 'positions' | 'plugboard'>,
  o: { rotors?: boolean; global?: boolean } = {},
): Promise<void> {
  if (o.rotors !== false) {
    for (let pass = 0; pass < 2; pass++) {
      for (const [k, slot] of SLOTS.entries()) await page.getByTestId(`rotor-select-${slot}`).selectOption(cfg.rotors[k]!)
    }
    for (const [k, slot] of SLOTS.entries()) {
      const spin = page.getByTestId(`rotor-pos-${slot}`)
      await spin.focus()
      await page.keyboard.press(cfg.positions[k]!)
      await expect(spin).toHaveAttribute('aria-valuetext', cfg.positions[k]!)
    }
  }
  while (await page.getByTestId('plug-remove-0').count()) await page.getByTestId('plug-remove-0').click()
  if (cfg.plugboard.length) {
    await page.getByTestId('plug-input').fill(cfg.plugboard.join(' '))
    await page.getByTestId('plug-add').click()
  }
  // The tool scenes work on a private machine; the gate items on the course machine (__enigma).
  if (o.global === false) return
  const state = await page.evaluate(() => window.__enigma!.getState())
  expect(state.config.rotors).toEqual([...cfg.rotors])
  expect(state.positions).toBe(cfg.positions.join(''))
  expect([...state.config.plugboard].sort()).toEqual([...cfg.plugboard].map((p) => [...p].sort().join('')).sort())
}

/** Slide the crib to `offset` (arrow keys on the strip) and add `links` to the menu. */
async function menuUi(page: Page, answer: MenuAnswer, cribLength: number): Promise<void> {
  const slider = page.getByTestId('crib-strip-slider')
  const strip = page.getByTestId('crib-strip')
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(strip).toHaveAttribute('data-offset', '0')

  // One key at a time (each moves the crib from the offset the strip shows): PageUp moves it 5, ArrowRight 1.
  for (let at = 0; at < answer.offset; ) {
    const step = answer.offset - at >= 5 ? 5 : 1
    // The scene's focus-on-enter settles a few frames late: keep the slider focused for every key.
    await slider.focus()
    await page.keyboard.press(step === 5 ? 'PageUp' : 'ArrowRight')
    at += step
    await expect(strip).toHaveAttribute('data-offset', String(at))
  }
  // Every link, then the ones the menu leaves out.
  await page.getByTestId('menu-all').click()
  for (let pos = 1; pos <= cribLength; pos++) if (!answer.links.includes(pos)) await page.getByTestId(`menu-graph-remove-${pos}`).click()
  await expect(page.getByTestId('menu-builder')).toHaveAttribute('data-links', [...answer.links].sort((a, b) => a - b).join(','))
}

/** Enter an answer of the current item through its real controls, then submit. */
async function answerThroughUi(page: Page, itemId: string, answer: unknown): Promise<void> {
  const submit = page.getByTestId('gate-submit')
  if (itemId === 'polish-card') {
    await choosePairing(page)
    await typeKey(page, String(answer))
  } else if (itemId === 'british-menu') {
    const c = await current(page)
    await menuUi(page, answer as MenuAnswer, (c.instance as BritishMenuInstance).crib.length)
  } else if (itemId === 'read-intercepts') {
    await answerViaUi(page, 'letters', answer)
    return
  } else {
    const c = await current(page)
    await setMachineUi(page, answer as MachineConfig, { rotors: !c.fallback })
  }
  await expect(submit).toBeEnabled()
  await submit.click()
}

/** A gate alone (#/lab/gate), with the e2e configuration: the same GateRunner and item bindings as the chapter. */
async function openGateLab(page: Page, id: 'polish' | 'british'): Promise<void> {
  await gotoApp(page, `/lab/gate/${CHAPTER}/${id}`, { stage: '2d' })
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  await current(page)
}

/** From the chapter's start (entered) to a scene: recall and gates through the API, tasks marked. */
async function walkTo(page: Page, scene: string): Promise<void> {
  for (let k = 0; k < 8 && (await where(page)).scene !== scene; k++) {
    const w = await where(page)
    if (w.kind === 'gate' || w.kind === 'recall') await passGate(page)
    if (w.kind === 'explore') await completeTasks(page)
    await nextScene(page)
  }
  expect((await where(page)).scene).toBe(scene)
}

/**
 * Template step 4 for the current item: one wrong answer through the UI and its rollback; no hint after it
 * (puzzle gate); a second wrong answer, then hint L1 (text and stage highlight); a right answer through the real
 * controls; data-passed exactly when the rule is met; the rest of a window item through the API. Axe runs on the
 * question, the rollback and the hint.
 */
async function templateItem(page: Page, id: string): Promise<void> {
  const c = await current(page)
  expect(c.itemId).toBe(id)
  const item = page.getByTestId(`item-${id}`)
  await expect(item).toHaveAttribute('data-current', 'true')

  if (c.kind === 'set-machine') {
    // 6. Keyboard locked, lamps hidden, and moving the controls submits nothing.
    await assertFocus(page, 'rotor-stack')
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    await expect(page.getByTestId('lampboard')).toHaveAttribute('data-hidden', 'true')
    expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
    const submits = (await eventsOf(page, 'item.submit')).length
    await page.getByTestId('rotor-pos-right').focus()
    await page.keyboard.press('ArrowUp')
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
  }

  // a. One wrong answer through the UI, and its rollback.
  await assertNoAnswerLeak(page)
  const wrong = await wrongAnswer(page)
  await answerThroughUi(page, id, wrong)
  await assertRollback(page, ROLLBACK[id]!)
  // The chapter's own rollback views (cycles, crib); set-machine and letters use the lesson's shared rollback.
  if (c.kind === 'custom') expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])
  await continueGate(page)
  // Puzzle gate: no hint after one wrong answer, and a new day.
  const second = await current(page)
  expect(second).toMatchObject({ itemId: id, hintLevel: 0 })
  expect(second.seed).not.toBe(c.seed)
  await expect(page.getByTestId('hint-panel')).toHaveCount(0)
  await expect(page.getByTestId('item-hint')).toHaveCount(0)
  // A second wrong answer: now L1, highlighted from the day that was answered (review round 3), not the fresh one.
  const wrong2 = await wrongAnswer(page, 7)
  const answered = second.instance
  await answerViaApi(page, id, wrong2)
  const l1 = await current(page)
  expect(l1).toMatchObject({ itemId: id, hintLevel: 1, passed: false })
  await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
  await expect(page.getByTestId('item-hint')).toBeVisible()
  const logic = await logicFor(l1.gateKey, id, false)
  const hint = logic.highlight(answered, wrong2).map((h) => h.part)
  await expect.poll(() => page.evaluate(() => [...window.__stage!.info().highlighted].sort())).toEqual([...hint].sort())
  await expect(page.getByTestId('hint-panel')).toContainText(hint.length ? `look at the highlighted ${partList(hint)}` : 'take it one step at a time')
  expect(await axeSerious(page, `[data-testid="item-${id}"]`)).toEqual([])

  // b. A correct instance through the real controls.
  await assertNoAnswerLeak(page)
  const solution = await solveInNode(page)
  await answerThroughUi(page, id, solution)
  await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
  // d. once → passed now; window (W W C) → after one more.
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

// ---------------------------------------------------------------------------

test.describe('chapter iv-capstone', { tag: '@chapter:iv-capstone' }, () => {
  test('unlocked after III.12; scenes in order: recall, the story, both routes end to end; chapter.complete', async ({ page }) => {
    test.setTimeout(90_000)
    // A fresh learner: the capstone is locked until III.12 (the last required chapter before it) is complete.
    // stage=2d here and none in editProgress: every edit starts from a full page load (the progress is re-read).
    await gotoApp(page, '/course', { stage: '2d' })
    await expect(page.getByTestId(`chapter-link-${CHAPTER}`)).toHaveAttribute('data-locked', 'true')
    await page.evaluate(() => localStorage.setItem('enigma.progress.v1', JSON.stringify(window.__course!.progress())))
    const before = CHAPTERS.filter((c) => c.id !== CHAPTER && c.id !== 'iii12-checking').map((c) => c.id)
    // editProgress runs the edit's source in the page, so the ids are written into it.
    const completeAll = new Function('p', `for (const id of ${JSON.stringify(before)}) p.chapters[id] = { reached: 0, completed: true, tasks: [] }`)
    await editProgress(page, completeAll as (p: Record<string, any>) => void, '/course')
    await expect(page.getByTestId(`chapter-link-${CHAPTER}`)).toHaveAttribute('data-locked', 'true')
    await gotoApp(page, '/course', { stage: '2d' })
    await editProgress(page, (p) => void (p.chapters['iii12-checking'] = { reached: 0, completed: true, tasks: [] }), '/course')
    await expect(page.getByTestId(`chapter-link-${CHAPTER}`)).toHaveAttribute('data-locked', 'false')
    await page.getByTestId(`chapter-link-${CHAPTER}`).click()
    await settled(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    // Recall: one item from each act; Next waits for the gate.
    expect(await where(page)).toMatchObject({ scene: 'recall', kind: 'recall', index: 0, canNext: false })
    await expectNextDisabled(page)
    expect((await gate(page))!.items).toHaveLength(3)
    await passGate(page)
    await nextScene(page)

    // The story: openly a training exercise; the catalogue at Bletchley is an anachronism; the clock times nothing.
    expect(await where(page)).toMatchObject({ scene: 'midnight', kind: 'story', canNext: true })
    const story = page.getByTestId('story-card')
    for (const s of ['training exercise', 'bends history', '15 September 1938', '1 May 1940', 'Marian Rejewski', 'Alan Turing'])
      await expect(story).toContainText(s)
    await expect(page.getByTestId('act-clock')).toContainText('nothing here is timed')
    await nextScene(page)

    // polish-tools: the whole Polish route on the practice day, through the tools.
    expect(await where(page)).toMatchObject({ scene: 'polish-tools', kind: 'explore' })
    await expectNextDisabled(page)
    const pd = polishDay(PRACTICE_POLISH_SEED)
    await choosePairing(page)
    await expect(page.getByTestId('cycles-AD')).toHaveAttribute('data-lengths', /\d/)
    await typeKey(page, characteristicOf(productsOf(pd.indicators)))
    await page.getByTestId('catalogue-look-up').click()
    await expect(page.getByTestId('catalogue-query')).toHaveAttribute('data-count', String(pd.row.card.length), { timeout: 30_000 })
    await expect(page.getByTestId('task-open-tools')).toHaveAttribute('data-done', 'true')
    // The doubled-key test picks the day off its card.
    const own = pd.row.card.findIndex((s) => s.rotors.join('-') === pd.day.rotors.join('-') && s.positions === pd.day.positions.join(''))
    const pairs = await Promise.all(pd.row.card.map((_, k) => page.getByTestId(`card-row-${k}`).getAttribute('data-pairs')))
    expect(Math.max(...pairs.map(Number))).toBe(Number(pairs[own]))
    await page.getByTestId(`card-set-${own}`).click()
    // The cable finder, best cable each time, until every indicator reads doubled.
    for (let k = 0; k < 6 && (await page.getByTestId('doubled-panel').getAttribute('data-doubled')) !== '70'; k++) {
      await page.getByTestId('cable-rank').click()
      await page.getByTestId('cable-ranking').locator('button').first().click()
    }
    await expect(page.getByTestId('doubled-panel')).toHaveAttribute('data-doubled', '70')
    await expect(page.getByTestId('first-indicator')).toContainText(pd.messageKey + pd.messageKey)
    for (const [k, slot] of SLOTS.entries()) {
      await page.getByTestId(`rotor-pos-${slot}`).focus()
      await page.keyboard.press(pd.messageKey[k]!)
    }
    await expect(page.getByTestId('trial-preview-text')).toHaveText(pd.plain)
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'polish', kind: 'gate', canNext: false })
    await passGate(page)
    await nextScene(page)

    // british-tools: crib, menu, the bombe over three orders in the worker, the checking machine, the reading.
    expect(await where(page)).toMatchObject({ scene: 'british-tools', kind: 'explore' })
    await expectNextDisabled(page)
    const bd = britishDay(PRACTICE_BRITISH_SEED)
    await menuUi(page, { offset: bd.offset, links: [...bd.menu] }, bd.crib.length)
    await page.getByTestId('bombe-run').click()
    await expect(page.getByTestId('bombe-bench')).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
    const trueId = `${bd.key.rotors.join('-')}@${bd.stop.positions}`
    await page.getByTestId(`stop-check-${trueId}`).click()
    await expect(page.getByTestId(`stop-${trueId}`)).toHaveAttribute('data-consistent', 'true')
    await expect(page.getByTestId('task-open-tools')).toHaveAttribute('data-done', 'true')
    // A false stop is refused by the checking machine.
    const ids = await page.locator('li[data-consistent]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(5)))
    const falseId = ids.find((id) => id !== trueId)!
    expect(falseId).toBeDefined()
    await page.getByTestId(`stop-check-${falseId}`).click()
    await expect(page.getByTestId(`stop-${falseId}`)).toHaveAttribute('data-consistent', 'false')
    // Use the true stop: its rotors and the checked cables go in; the enciphered key then reads as the message key.
    await page.getByTestId(`stop-use-${trueId}`).click()
    await expect(page.getByTestId('enc-key-read')).toContainText(bd.messageKey)
    for (const [k, slot] of SLOTS.entries()) {
      await page.getByTestId(`rotor-pos-${slot}`).focus()
      await page.keyboard.press(bd.messageKey[k]!)
    }
    // The cables the reading adds (II.7's rule: the letter shown and the letter the word needs).
    const sol = britishSolution(bd)
    const extra = sol.plugboard.filter((c) => !bd.checked.includes(c))
    expect(extra.length).toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('trial-preview-text')).not.toHaveText(bd.plain)
    await page.getByTestId('plug-input').fill(extra.join(' '))
    await page.getByTestId('plug-add').click()
    await expect(page.getByTestId('trial-preview-text')).toHaveText(bd.plain)
    await expect(page.getByTestId('enc-key-read')).toContainText(bd.messageKey)
    await nextScene(page)
    expect(await where(page)).toMatchObject({ scene: 'british', kind: 'gate', canNext: false })
    await passGate(page)
    // 8. chapter.complete: the last chapter, so no next link; the course map shows the course complete.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-complete')).toBeVisible()
    await expect(page.getByTestId('chapter-next-link')).toHaveCount(0)
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual(
      ['recall', 'polish', 'british'].map((g) => `${CHAPTER}/${g}`),
    )
    await gotoApp(page, '/course')
    await expect(page.getByTestId(`chapter-link-${CHAPTER}`)).toHaveAttribute('data-completed', 'true')
  })

  test('gate polish (gate lab): each item wrong through the UI, no hint after 1, L1 after 2, right through the controls', async ({
    page,
  }) => {
    await openGateLab(page, 'polish')
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(['polish-card', 'polish-key'])
    await templateItem(page, 'polish-card')
    await templateItem(page, 'polish-key')
    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/lab:polish`])
  })

  test('gate british (gate lab): each item wrong through the UI, no hint after 1, L1 after 2, right through the controls', async ({
    page,
  }) => {
    await openGateLab(page, 'british')
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(['british-menu', 'british-key', 'read-intercepts'])
    await templateItem(page, 'british-menu')
    await templateItem(page, 'british-key')
    await templateItem(page, 'read-intercepts')
    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/lab:british`])
  })

  test('the puzzle ladder on polish-card: no hint at attempts 1–2, then L1, L2 on another day, L3 and a fresh day', async ({ page }) => {
    await openGateLab(page, 'polish')
    await assertLadder(page, { puzzle: true })
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/polish-card'))
    expect(shows.map((s) => s.hintLevel)).toEqual([0, 0, 1, 2, 3, 0])
    // Every show is a new day: the five attempts and the fresh one after "Got it".
    expect(new Set(shows.map((s) => s.seed)).size).toBe(shows.length)
    // Axe on the worked examples: L2 (another day) and L3 (this day's solution).
    for (let k = 0; k < 3; k++) await answerViaApi(page, 'polish-card', await wrongAnswer(page, 20 + k))
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '2')
    await expect(page.getByTestId('worked-polish-card')).toBeVisible()
    expect(await axeSerious(page, '[data-testid="item-polish-card"]')).toEqual([])
    await answerViaApi(page, 'polish-card', await wrongAnswer(page, 30))
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '3')
    expect(await axeSerious(page, '[data-testid="item-polish-card"]')).toEqual([])
  })

  test('a reload keeps the day; a retry draws a new day; gaming brings the cables-only fallback', async ({ page }) => {
    await openGateLab(page, 'british')
    const first = await current(page)
    await reloadKeepsSeed(page)
    // Every answer counts as fast (a generous threshold: the box may be loaded, and the rule is "under minLatencyMs").
    await configure(page, { minLatencyMs: 60_000 })
    // Two instant wrong answers: a new day each time, then the gaming fallback.
    await answerViaApi(page, 'british-menu', await wrongAnswer(page))
    const retry = await current(page)
    expect(retry.seed).not.toBe(first.seed)
    expect((retry.instance as BritishMenuInstance).cipher).not.toBe((first.instance as BritishMenuInstance).cipher)
    await answerViaApi(page, 'british-menu', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: 'iv-capstone/lab:british/british-menu', reason: 'fast' }])
    const fb = await current(page)
    expect(fb).toMatchObject({ itemId: 'british-menu', fallback: true, kind: 'set-machine' })
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    await configure(page, { minLatencyMs: 0 })
    await page.getByTestId('given-stop-check').click()
    await expect(page.getByTestId('given-stop-steckers')).toBeVisible()
    await answerThroughUi(page, 'british-plugs', await solveInNode(page))
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates['iv-capstone/lab:british']!.items['british-menu']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
  })

})

test.describe('chapter iv-capstone in 3D', { tag: ['@3d', '@chapter:iv-capstone'] }, () => {
  async function in3d(page: Page): Promise<void> {
    await expect
      .poll(async () => {
        const i = await page.evaluate(() => window.__stage!.info())
        return `${i.renderer}:${i.focus}`
      }, { timeout: 30_000 })
      .toBe('webgl2:rotor-stack')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('rotor-stack', 'I'))
  }

  test('the set-the-machine stage stays in 3D across scene changes', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(150_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await walkTo(page, 'polish')
    await answerViaApi(page, 'polish-card', await solveInNode(page))
    expect((await current(page)).itemId).toBe('polish-key')
    await in3d(page)
    await passGate(page)
    // Scene changes: the gate → the British tools (no stage) → the British gate, whose key item shows the stage again.
    await nextScene(page)
    await completeTasks(page)
    await nextScene(page)
    await answerViaApi(page, 'british-menu', await solveInNode(page))
    expect((await current(page)).itemId).toBe('british-key')
    await in3d(page)
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', 'webgl2')
  })
})
