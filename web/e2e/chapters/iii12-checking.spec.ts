/**
 * Chapter III.12 · stop → checking machine → key (PLAN §4.4 "iii12-checking", §6.0 CHAPTER PR TEMPLATE steps 0–8,
 * brief 15):
 *  - the Wrens and Hut 6 (story);
 *  - stops: the bet gates one wheel-order run in the worker; its stop list is the unit-tested STOP_LIST;
 *  - checking-machine: focus and dimming of the 'checking' stage; free presses on the plugless machine (held); a false
 *    stop checked by hand through the desk until a letter has two partners, the true stop checked to the end;
 *  - gate `checking`: stop-verdict wrong through the UI (machine rollback) and its L1 hint, right through the checking
 *    desk; set-key with its locks (keyboard, lamps, no submit on moves), wrong (the stop as the start) and right
 *    through the machine's own controls with the preview; axe on items, rollbacks and hints; the hint ladder, a
 *    reload mid-gate, the gaming fallback (stop-verdict on the desk), chapter.complete;
 *  - @3d: from the stop list to the checking machine (a scene change) in 3D.
 * Answers are computed in Node from the pure gates.ts.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerViaApi,
  assertFocus,
  assertNoAnswerLeak,
  assertRevealGated,
  assertRollback,
  commitBet,
  completeScene,
  completeTasks,
  firstBetOption,
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
import {
  STOP_LIST,
  canonicalLog,
  keyScenario,
  sceneCheckData,
  type CheckStep,
  type KeyInstance,
  type StopAnswer,
  type StopInstance,
} from '../../src/chapters/iii12-checking/gates'
import { dimmedParts } from '../../src/contracts/stage'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'iii12-checking'

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

const windowsNow = (page: Page) => page.evaluate(() => window.__enigma!.getState().positions)

/** Work deductions on the checking desk: pick the column, press the known partner, note the lamp. */
async function deskSteps(page: Page, steps: readonly CheckStep[]): Promise<void> {
  const desk = page.getByTestId('checking-desk')
  const base = Number(await desk.getAttribute('data-steps'))
  for (const [k, s] of steps.entries()) {
    await page.getByTestId(`check-col-${s.pos}`).click()
    await page.getByTestId(`key-${s.press}`).click()
    await expect(page.getByTestId('check-press')).toContainText(`lamp ${s.partner} lit`)
    await page.getByTestId(`check-record-${s.letter}`).click()
    await expect(desk).toHaveAttribute('data-steps', String(base + k + 1))
  }
}

/** stop-verdict through the desk: the deductions, the verdict and the letter, then Submit. */
async function answerStop(page: Page, a: StopAnswer): Promise<void> {
  await deskSteps(page, a.log)
  await page.getByTestId(`check-verdict-${a.verdict}`).click()
  await page.getByTestId('check-letter').selectOption(a.letter)
  await page.getByTestId('gate-submit').click()
  await expect(page.getByTestId('rollback')).toBeVisible()
}

/** The machine's own controls: rotor selects, cables typed into the plugboard, window letters typed on the spinbuttons. */
async function setKeyControls(page: Page, cfg: { rotors: readonly string[]; positions: readonly string[]; plugboard: readonly string[] }): Promise<void> {
  for (const [k, slot] of ['left', 'middle', 'right'].entries()) await page.getByTestId(`rotor-select-${slot}`).selectOption(cfg.rotors[k]!)
  const plugs = await page.evaluate(() => window.__enigma!.getState().config.plugboard.length)
  for (let k = 0; k < plugs; k++) await page.getByTestId('plug-remove-0').click()
  await page.getByTestId('plug-input').fill(cfg.plugboard.join(' '))
  await page.getByTestId('plug-add').click()
  await expect(page.getByTestId('plug-error')).toHaveText('')
  for (const [k, slot] of ['left', 'middle', 'right'].entries()) {
    await page.getByTestId(`rotor-pos-${slot}`).focus()
    await page.keyboard.press(cfg.positions[k]!)
    await expect(page.getByTestId(`rotor-pos-${slot}`)).toHaveAttribute('aria-valuetext', cfg.positions[k]!)
  }
  const state = await page.evaluate(() => window.__enigma!.getState())
  expect(state.config.rotors).toEqual([...cfg.rotors])
  expect(state.positions).toBe(cfg.positions.join(''))
  expect([...state.config.plugboard].sort()).toEqual([...cfg.plugboard].sort())
}

async function answerKey(page: Page, cfg: { rotors: readonly string[]; positions: readonly string[]; plugboard: readonly string[] }): Promise<void> {
  await setKeyControls(page, cfg)
  await page.getByTestId('gate-submit').click()
  await expect(page.getByTestId('rollback')).toBeVisible()
}

/**
 * Walk to the gate: bets committed through the UI and tasks completed, but the whole-wheel-order runs are not
 * started (the first test fires every reveal); an explore scene can advance once its bets are committed.
 */
async function toGate(page: Page): Promise<void> {
  for (let k = 0; k < 6 && (await where(page)).kind !== 'gate'; k++) {
    if ((await where(page)).kind === 'explore') {
      for (const r of await sceneReveals(page)) {
        if (r.trigger === 'run') await commitBet(page, r.bet, await firstBetOption(page, r.bet))
      }
      if ((await sceneReveals(page)).some((r) => r.trigger !== 'run')) {
        await completeScene(page)
        continue
      }
      await completeTasks(page)
      await nextScene(page)
    } else await completeScene(page)
  }
  expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
}

test.describe('chapter iii12-checking', { tag: '@chapter:iii12-checking' }, () => {
  test('scenes in order: the story, the stop list after its bet, the checking machine on a false and the true stop', async ({ page }) => {
    test.setTimeout(60_000)
    await enter(page, CHAPTER)
    expect(await where(page)).toMatchObject({ scene: 'wrens', kind: 'story', index: 0, canNext: true })
    for (const t of ['Wrens', 'Gordon Welchman', 'Hut 6', 'Typex', '01 01 01']) await expect(page.getByTestId('story-card')).toContainText(t)
    await nextScene(page)

    // stops: one wheel order in the worker.
    expect(await where(page)).toMatchObject({ scene: 'stops', kind: 'explore' })
    expect(await page.getByTestId('stage').count()).toBe(0)
    await expectNextDisabled(page)
    const [run] = await sceneReveals(page)
    expect(run).toMatchObject({ bet: 'true-stops', trigger: 'run' })
    await assertRevealGated(page, run!)
    await expect(page.getByTestId('stop-list')).toHaveCount(0)
    await commitBet(page, 'true-stops', 'most-false')
    await fireReveal(page, run!)
    await expect(page.getByTestId('stop-list')).toBeVisible({ timeout: 30_000 })
    const rows = await page.getByTestId('stop-list').locator('tr[data-stop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stop')))
    expect(rows).toEqual(STOP_LIST.map((s) => s[0]))
    expect((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet, e.correct])).toEqual([[`${CHAPTER}/true-stops`, true]])
    await expect(page.getByTestId('task-see-stops')).toHaveAttribute('data-done', 'true')
    await nextScene(page)

    // checking-machine: the 'checking' stage, free presses on the plugless, held machine.
    expect(await where(page)).toMatchObject({ scene: 'checking-machine', kind: 'explore' })
    await assertFocus(page, 'wire')
    await expectNextDisabled(page)
    expect((await page.evaluate(() => window.__enigma!.getState().config.plugboard))).toEqual([])
    const before = await windowsNow(page)
    await page.getByTestId('key-A').click()
    expect(await windowsNow(page)).toBe(before)
    expect(await pressThrows(page)).toBe(false)
    // A false stop, by hand: RZW fails after a few deductions.
    await page.getByTestId('check-stop-RZW').click()
    const rzw = canonicalLog(sceneCheckData('RZW'))
    expect(rzw.conflict).not.toBeNull()
    await deskSteps(page, rzw.log)
    await expect(page.getByTestId('checking-desk')).toHaveAttribute('data-status', 'contradiction')
    await expect(page.getByTestId('check-conflict')).toContainText(rzw.conflict!.letters[0]!)
    await expect(page.getByTestId('check-result')).toContainText('this stop is false')
    await expect(page.getByTestId('task-check2')).toHaveAttribute('data-done', 'false')
    // The true stop, with the machine's own moves: every column agrees.
    await page.getByTestId('check-stop-WAB').click()
    for (let k = 0; k < 30 && (await page.getByTestId('checking-desk').getAttribute('data-status')) === 'open'; k++) {
      await page.getByTestId('check-auto').click()
    }
    await expect(page.getByTestId('checking-desk')).toHaveAttribute('data-status', 'consistent')
    await expect(page.getByTestId('check-result')).toContainText('The stop survives')
    await expect(page.getByTestId('task-check2')).toHaveAttribute('data-done', 'true')
    expect(await axeSerious(page, '[data-testid="checking-view"]')).toEqual([])
    await nextScene(page)

    expect(await where(page)).toMatchObject({ scene: 'gate', kind: 'gate', canNext: false })
    await assertFocus(page, 'wire')
  })

  test('gate checking: stop-verdict on the desk, set-key on the machine; rollbacks, hints, locks; chapter.complete', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iv-capstone')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)
    await toGate(page)
    expect((await gate(page))!.items.map((i) => i.itemId)).toEqual(['stop-verdict', 'set-key'])

    // stop-verdict · custom inPage · window.
    let c = await current(page)
    expect(c.itemId).toBe('stop-verdict')
    const sv = page.getByTestId('item-stop-verdict')
    expect(await axeSerious(page, '[data-testid="item-stop-verdict"]')).toEqual([])
    await assertNoAnswerLeak(page)
    // a. Wrong through the UI: "the key" with no check at all.
    await page.getByTestId('check-verdict-consistent').click()
    await page.getByTestId('check-letter').selectOption((c.instance as StopInstance).stop.stecker)
    await page.getByTestId('gate-submit').click()
    await assertRollback(page, 'machine')
    expect(await axeSerious(page, '[data-testid="rollback"]')).toEqual([])
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'stop-verdict', hintLevel: 1, passed: false })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    await expect(page.getByTestId('item-hint')).toBeVisible()
    await assertFocus(page, 'wire')
    // b. Right through the desk (attempt 2: a false stop).
    await assertNoAnswerLeak(page)
    const sol = (await solveInNode(page)) as StopAnswer
    expect(sol.verdict).toBe('contradiction')
    await answerStop(page, sol)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(sv).toHaveAttribute('data-passed', 'false')
    await continueGate(page)
    // c. The rest through the API (attempt 3: the true stop).
    await assertNoAnswerLeak(page)
    const third = (await solveInNode(page)) as StopAnswer
    expect(third.verdict).toBe('consistent')
    expect((await answerViaApi(page, 'stop-verdict', third, { continue: false })).correct).toBe(true)
    await expect(sv).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    // set-key · set-machine · once.
    c = await current(page)
    expect(c.itemId).toBe('set-key')
    const sc = keyScenario((c.instance as KeyInstance).seed)!
    expect(await axeSerious(page, '[data-testid="item-set-key"]')).toEqual([])
    await expect(page.getByTestId('key-A')).toBeDisabled()
    expect(await pressThrows(page)).toBe(true)
    expect(await page.locator('[data-testid^="lamp-"][data-lit="true"]').count()).toBe(0)
    expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBeNull()
    const submits = (await eventsOf(page, 'item.submit')).length
    await page.getByTestId('rotor-pos-right').focus()
    await page.keyboard.press('ArrowUp')
    expect((await eventsOf(page, 'item.submit')).length).toBe(submits)
    await expect(page.getByTestId('trial-preview')).toBeVisible()
    // a. Wrong through the controls: the stop's drum positions taken as the start.
    await assertNoAnswerLeak(page)
    await answerKey(page, { rotors: sc.day.rotors, positions: sc.stop.positions.split(''), plugboard: sc.day.plugboard })
    await assertRollback(page, 'machine')
    await expect(page.getByTestId('rollback')).toContainText(`drum positions ${sc.stop.positions}`)
    await continueGate(page)
    c = await current(page)
    expect(c).toMatchObject({ itemId: 'set-key', hintLevel: 1, passed: false })
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    // b. Right through the controls: the preview reads the plaintext.
    const key = (await solveInNode(page)) as { rotors: string[]; positions: string[]; plugboard: string[] }
    const sc2 = keyScenario((c.instance as KeyInstance).seed)!
    await assertNoAnswerLeak(page)
    await setKeyControls(page, key)
    await expect(page.getByTestId('trial-preview')).toContainText(sc2.plain)
    await page.getByTestId('gate-submit').click()
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('item-set-key')).toHaveAttribute('data-passed', 'true')
    await continueGate(page)

    await expect(page.getByTestId('gate-passed')).toBeVisible()
    expect((await eventsOf(page, 'gate.passed')).map((e) => e.gate)).toEqual([`${CHAPTER}/checking`])
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/iv-capstone')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iv-capstone')).toHaveAttribute('data-locked', 'false')
  })

  test('the hint ladder on stop-verdict: L1, L2 worked example on its own stop, L3 reveal and a fresh stop; axe on each', async ({
    page,
  }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    const first = await current(page)
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page))
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', '1')
    expect(await axeSerious(page, '[data-testid="hint-panel"]')).toEqual([])
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page, 2))
    const l2 = await current(page)
    expect(l2.hintLevel).toBe(2)
    const worked = page.getByTestId('worked-example')
    expect(Number(await worked.getAttribute('data-seed'))).not.toBe(l2.seed)
    await expect(worked).not.toContainText(`Stop ${(l2.instance as StopInstance).stop.positions} on`)
    expect(await axeSerious(page, '[data-testid="hint-panel"]')).toEqual([])
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page, 3))
    expect((await current(page)).hintLevel).toBe(3)
    await expect(page.getByTestId('gate-submit')).toHaveCount(0)
    expect(await axeSerious(page, '[data-testid="hint-panel"]')).toEqual([])
    await continueGate(page)
    const after = await current(page)
    expect(after).toMatchObject({ hintLevel: 0, attempt: 5 })
    expect(after.window.at(-1)).toBe('revealed')
    expect(after.seed).not.toBe(first.seed)
    const shows = (await eventsOf(page, 'item.show')).filter((e) => e.item.endsWith('/stop-verdict'))
    expect(shows.map((x) => x.hintLevel)).toEqual([0, 1, 2, 3, 0])
  })

  test('a reload mid-gate keeps the seed and the instance', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page))
    await reloadKeepsSeed(page)
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await answerViaApi(page, 'stop-verdict', await solveInNode(page))
    await answerViaApi(page, 'stop-verdict', await solveInNode(page))
    expect((await current(page)).itemId).toBe('set-key')
    await reloadKeepsSeed(page)
    const c = await current(page)
    await expect.poll(() => windowsNow(page)).toBe((c.instance as KeyInstance).setup.machine.positions.join(''))
  })

  test('gaming: two instant answers bring the stop-verdict fallback, worked on the desk', async ({ page }) => {
    await enter(page, CHAPTER)
    await toGate(page)
    await configure(page, { minLatencyMs: 2000 })
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page))
    await answerViaApi(page, 'stop-verdict', await wrongAnswer(page))
    expect(await eventsOf(page, 'gaming')).toEqual([{ type: 'gaming', item: `${CHAPTER}/checking/stop-verdict`, reason: 'fast' }])
    const c = await current(page)
    expect(c).toMatchObject({ itemId: 'stop-verdict', fallback: true, kind: 'custom', hintLevel: 0 })
    await expect(page.getByTestId('item-stop-verdict')).toHaveAttribute('data-fallback', 'true')
    await configure(page, { minLatencyMs: 0 })
    const sol = (await solveInNode(page)) as StopAnswer
    await answerStop(page, sol)
    await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'true')
    await continueGate(page)
    const rec = (await progress(page)).gates[`${CHAPTER}/checking`]!.items['stop-verdict']!
    expect(rec.outcomes.at(-1)).toMatchObject({ result: 'correct', fallback: true })
  })
})

test.describe('chapter iii12-checking in 3D', { tag: ['@3d', '@chapter:iii12-checking'] }, () => {
  test('from the stop list to the checking machine in 3D: focus wire, dimmed parts, a held press', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('stops')
    await commitBet(page, 'true-stops', 'all')
    await fireReveal(page, { bet: 'true-stops', trigger: 'run' })
    await expect(page.getByTestId('stop-list')).toBeVisible({ timeout: 30_000 })
    await nextScene(page)
    expect((await where(page)).scene).toBe('checking-machine')
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
    const before = await windowsNow(page)
    await page.getByTestId('key-E').click()
    await expect.poll(() => page.evaluate(() => window.__stage!.info().windows)).toBe(before)
    expect(await windowsNow(page)).toBe(before)
  })
})
