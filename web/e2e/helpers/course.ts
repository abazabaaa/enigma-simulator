/**
 * E2E helpers for lesson pages (PLAN §6.0 chapter template, §6.4). State is read through window.__course,
 * __stage and __enigma; answers are computed IN NODE by importing the pure gates.ts of the chapter (or the
 * fixture, or the recall pool), never read from the page.
 *
 *   await enter(page, 'i2-stepping')                     // gotoApp + configure + unlockAll
 *   await commitBet(page, 'first-press', 'right')        // through the UI
 *   const answer = await solveInNode(page)               // logic.solve(instance), computed in Node
 *   await answerViaApi(page, itemId, answer)             // __course.answer + continue
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures'
import { gotoApp, waitForApp } from './app'
import type { AnyChapterId, ModelName } from '../../src/contracts/core'
import type { CheckResult, ItemLogic, ItemRuntimeView, RevealSpec } from '../../src/contracts/lesson'
import type { LessonEvent } from '../../src/contracts/progress'
import type { Focus } from '../../src/contracts/stage'
import { dimmedParts } from '../../src/contracts/stage'
import { createRng } from '../../src/lib/rng'

export type GateState = NonNullable<ReturnType<NonNullable<Window['__course']>['gate']>>

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

export const where = (page: Page) => page.evaluate(() => window.__course!.where())
export const gate = (page: Page) => page.evaluate(() => window.__course!.gate())
export const events = (page: Page) => page.evaluate(() => window.__course!.events()) as Promise<LessonEvent[]>
export const progress = (page: Page) => page.evaluate(() => window.__course!.progress())

/** The event variant(s) whose `type` can be T ('scene.enter' and 'scene.complete' share one variant). */
export type EventOf<T extends LessonEvent['type']> = LessonEvent extends infer E
  ? E extends { type: infer U }
    ? T extends U
      ? E
      : never
    : never
  : never

export async function eventsOf<T extends LessonEvent['type']>(page: Page, type: T): Promise<EventOf<T>[]> {
  return (await events(page)).filter((e) => e.type === type) as EventOf<T>[]
}

/** The current item of the page's active gate (throws when there is none). */
export async function current(page: Page): Promise<ItemRuntimeView & { gateKey: string }> {
  await expect
    .poll(async () => (await gate(page))?.current?.attempt ?? 0, { message: 'the current item is shown' })
    .toBeGreaterThan(0)
  const g = (await gate(page))!
  return { ...g.current!, gateKey: g.key }
}

export async function configure(
  page: Page,
  o: Parameters<NonNullable<Window['__course']>['configure']>[0],
): Promise<void> {
  await page.evaluate((opts) => window.__course!.configure(opts), o)
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function chapterPath(chapter: AnyChapterId): string {
  return chapter === 'lab-fixture' ? '/lab/fixture' : `/c/${chapter}`
}

/**
 * Open a chapter (#/c/<id>, or #/lab/fixture) with ?e2e=1 and the 2D stage, then configure({ minLatencyMs 0,
 * burstMs 0, playback 'instant' }) and, for chapters after the prologue, unlockAll().
 */
export async function enter(
  page: Page,
  chapter: AnyChapterId,
  o: { scene?: string; unlock?: boolean; stage?: '2d' | '3d'; configure?: boolean } = {},
): Promise<void> {
  const path = `${chapterPath(chapter)}${o.scene ? `/${o.scene}` : ''}`
  await gotoApp(page, path, { stage: o.stage ?? '2d' })
  await page.waitForFunction(() => !!window.__course)
  if (o.configure !== false) await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  if (o.unlock ?? chapter !== 'prologue') await page.evaluate(() => window.__course!.unlockAll())
  await expect.poll(async () => (await where(page)).scene, { message: `${chapter} opened` }).not.toBeNull()
}

/** Jump to a scene already reached (through the URL), and wait until it shows. */
export async function sceneTo(page: Page, scene: string): Promise<void> {
  const w = await where(page)
  await page.evaluate((hash) => (location.hash = hash), `#${chapterPath(w.chapter!)}/${scene}`)
  await expect.poll(async () => (await where(page)).scene).toBe(scene)
}

/** Click scene-next (asserting it is enabled first) and wait for the next scene or the chapter's completion. */
export async function nextScene(page: Page): Promise<void> {
  const before = await where(page)
  const next = page.getByTestId('scene-next')
  await expect(next).toHaveAttribute('aria-disabled', 'false')
  const completions = (await eventsOf(page, 'chapter.complete')).length
  await next.click()
  await expect
    .poll(async () => {
      const w = await where(page)
      return w.index > before.index || (await eventsOf(page, 'chapter.complete')).length > completions
    })
    .toBe(true)
}

/** scene-next is aria-disabled until the scene can advance. */
export async function expectNextDisabled(page: Page, disabled = true): Promise<void> {
  await expect(page.getByTestId('scene-next')).toHaveAttribute('aria-disabled', String(disabled))
}

// ---------------------------------------------------------------------------
// Bets and reveals (G10)
// ---------------------------------------------------------------------------

/** The scene's reveal specs (from the scene's data-reveals attribute). */
export async function sceneReveals(page: Page): Promise<RevealSpec[]> {
  return JSON.parse((await page.getByTestId('scene').getAttribute('data-reveals')) ?? '[]') as RevealSpec[]
}

/** Pick an option (or type a number) without committing: this starts the bet. */
export async function chooseBet(page: Page, bet: string, value: string): Promise<void> {
  const input = page.getByTestId(`bet-input-${bet}`)
  if (await input.count()) await input.fill(value)
  else await page.getByTestId(`bet-option-${bet}-${value}`).click()
}

/** Commit a bet through the UI (bet-option-* or bet-input-*, then bet-commit-*). */
export async function commitBet(page: Page, bet: string, value: string): Promise<void> {
  await chooseBet(page, bet, value)
  await page.getByTestId(`bet-commit-${bet}`).click()
  await expect.poll(async () => (await eventsOf(page, 'bet.commit')).some((e) => e.bet.endsWith(`/${bet}`))).toBe(true)
}

/** The first option of a bet (the walker's choice). */
export async function firstBetOption(page: Page, bet: string): Promise<string> {
  if (await page.getByTestId(`bet-input-${bet}`).count()) return '1'
  const id = await page.locator(`[data-testid^="bet-option-${bet}-"]`).first().getAttribute('data-testid')
  return id!.slice(`bet-option-${bet}-`.length)
}

/**
 * G10 before a bet: the trigger is disabled, the playback is gated with t = 0, and for a press trigger
 * __enigma.pressKey throws. For a scene's later reveals the gate closes once the learner starts that bet, so
 * this first picks an option (without committing).
 */
export async function assertRevealGated(page: Page, reveal: RevealSpec): Promise<void> {
  const reveals = await sceneReveals(page)
  if (reveals[0]?.bet !== reveal.bet) await chooseBet(page, reveal.bet, await firstBetOption(page, reveal.bet))
  await expect.poll(() => page.evaluate(() => window.__stage!.playback().gated)).toBe(true)
  expect(await page.evaluate(() => window.__stage!.playback().t)).toBe(0)
  if (reveal.trigger === 'press') {
    const key = reveal.key ?? 'A'
    const dom = page.getByTestId(`key-${key}`)
    if (await dom.count()) await expect(dom).toBeDisabled()
    const threw = await page.evaluate((k) => {
      try {
        window.__enigma!.pressKey(k)
        return false
      } catch {
        return true
      }
    }, key)
    expect(threw, '__enigma.pressKey throws while the bet is pending').toBe(true)
  } else {
    await expect(page.getByTestId(`reveal-${reveal.bet}`)).toBeDisabled()
  }
}

/** Fire a reveal through its trigger (a key for press, reveal-<bet> otherwise); machine presses play to the end. */
export async function fireReveal(page: Page, reveal: RevealSpec): Promise<void> {
  const before = (await eventsOf(page, 'reveal')).length
  if (reveal.trigger === 'press') {
    const key = reveal.key ?? 'A'
    const dom = page.getByTestId(`key-${key}`)
    const toy = page.getByTestId(`toy-key-${key}`)
    if (await dom.count()) await dom.click()
    else if (await toy.count()) await toy.click()
    else await page.evaluate((k) => window.__enigma!.pressKey(k), key)
  } else {
    await page.getByTestId(`reveal-${reveal.bet}`).click()
  }
  await expect
    .poll(async () => (await eventsOf(page, 'reveal')).length, { message: `reveal ${reveal.bet} fired` })
    .toBe(before + 1)
  if (reveal.trigger === 'press' || reveal.trigger === 'step') {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const p = window.__stage!.playback()
          return !p.gated && !p.playing && p.hops > 0 && p.t === 1 + p.hops
        }),
      )
      .toBe(true)
  }
}

// ---------------------------------------------------------------------------
// Answers computed in Node
// ---------------------------------------------------------------------------

interface GatesModule {
  GATES: Record<string, { items: readonly ItemLogic[]; fallback: ItemLogic; puzzle?: true }>
}

/** The pure logic behind the active gate's current (or given) item: chapter gates.ts, the fixture, or the recall pool. */
export async function logicFor(gateKey: string, itemId: string, fallback: boolean): Promise<ItemLogic> {
  const [chapter, rawGate] = gateKey.split('/') as [string, string]
  const gateId = rawGate.replace(/^lab:/, '')
  if (gateId === 'recall' || gateId.startsWith('return-')) {
    const pool = await import('../../src/lesson/recall/pool.ts')
    const l = fallback ? pool.RECALL_FALLBACK : pool.RECALL_LOGIC[itemId]
    if (!l) throw new Error(`No recall item ${itemId}`)
    return l
  }
  const mod: GatesModule =
    chapter === 'lab-fixture'
      ? await import('../../src/lesson/fixture/gates.ts')
      : await import(`../../src/chapters/${chapter}/gates.ts`)
  const g = mod.GATES[gateId]
  if (!g) throw new Error(`No gate ${gateId} in ${chapter}`)
  const l = fallback ? g.fallback : g.items.find((i) => i.id === itemId)
  if (!l) throw new Error(`No item ${itemId} in ${gateKey}`)
  return l
}

/** logic.solve(instance) for the current item, computed in Node from __course.gate(). */
export async function solveInNode(page: Page): Promise<unknown> {
  const c = await current(page)
  const l = await logicFor(c.gateKey, c.itemId, c.fallback)
  return JSON.parse(JSON.stringify(l.solve(c.instance)))
}

/** A wrong answer near the solution (logic.mutate), computed in Node; checked to be wrong. */
export async function wrongAnswer(page: Page, seed = 1): Promise<unknown> {
  const c = await current(page)
  const l = await logicFor(c.gateKey, c.itemId, c.fallback)
  const good = l.solve(c.instance)
  for (let k = 0; k < 20; k++) {
    const a = l.mutate(c.instance, good, createRng(seed + k))
    if (!l.check(c.instance, a).correct) return JSON.parse(JSON.stringify(a))
  }
  throw new Error(`Could not find a wrong answer for ${c.itemId}`)
}

/** Submit through __course.answer (the UI's path), then continue past the feedback. */
export async function answerViaApi(
  page: Page,
  itemId: string,
  answer: unknown,
  o: { continue?: boolean } = {},
): Promise<CheckResult> {
  const res = await page.evaluate(([id, a]) => window.__course!.answer(id as string, a), [itemId, answer] as const)
  await expect(page.getByTestId('rollback')).toBeVisible()
  if (o.continue !== false) await continueGate(page)
  return res
}

/** gate-continue (after feedback, or "Got it" at L3). */
export async function continueGate(page: Page): Promise<void> {
  await page.getByTestId('gate-continue').first().click()
}

/** Answer the current item correctly (solveInNode + answerViaApi). */
export async function answerCorrect(page: Page): Promise<CheckResult> {
  const c = await current(page)
  const res = await answerViaApi(page, c.itemId, await solveInNode(page))
  expect(res.correct, `${c.itemId}: the Node-side solution was judged wrong`).toBe(true)
  return res
}

/** Pass the page's active gate through the API (the walk; the remaining instances of the template). */
export async function passGate(page: Page, o: { max?: number } = {}): Promise<void> {
  for (let k = 0; k < (o.max ?? 200); k++) {
    const g = await gate(page)
    if (!g) throw new Error('No gate on the page')
    if (g.passed) return
    const c = await current(page)
    if (c.hintLevel === 3) {
      await continueGate(page)
      continue
    }
    await answerCorrect(page)
  }
  throw new Error('The gate did not pass')
}

// ---------------------------------------------------------------------------
// Answers through the real widgets
// ---------------------------------------------------------------------------

/** Set a machine config through the controls when they exist (04's RotorControls), else through __enigma. */
export async function setMachine(
  page: Page,
  cfg: { positions: readonly string[]; plugboard: readonly string[] } & Record<string, unknown>,
): Promise<'ui' | 'api'> {
  const slots = cfg.positions.length === 4 ? ['greek', 'left', 'middle', 'right'] : ['left', 'middle', 'right']
  const hasSpin = await page.getByTestId(`rotor-pos-${slots.at(-1)}`).count()
  const plugsNow = await page.evaluate(() => window.__enigma!.getState().config.plugboard.join(' '))
  const plugsOk = [...cfg.plugboard].sort().join(' ') === plugsNow.split(' ').filter(Boolean).sort().join(' ')
  if (hasSpin && plugsOk) {
    for (const [k, slot] of slots.entries()) {
      const spin = page.getByTestId(`rotor-pos-${slot}`)
      for (let n = 0; n < 26 && (await spin.getAttribute('aria-valuetext')) !== cfg.positions[k]; n++) {
        await spin.focus()
        await page.keyboard.press('ArrowUp')
      }
    }
    const got = await page.evaluate(() => window.__enigma!.getState().positions)
    if (got === cfg.positions.join('')) return 'ui'
  }
  await page.evaluate((c) => window.__enigma!.setConfig(c as never), cfg)
  return 'api'
}

/** Enter `answer` through the generic widget of `kind` and press gate-submit (code items: typeCodeAndRun). */
export async function answerViaUi(page: Page, kind: ItemRuntimeView['kind'], answer: unknown): Promise<void> {
  const submit = page.getByTestId('gate-submit')
  switch (kind) {
    case 'letter':
      await page.getByTestId('answer-letter').fill(String(answer))
      break
    case 'letters':
      for (const [k, ch] of [...String(answer)].entries()) await page.getByTestId(`answer-letters-${k}`).fill(ch)
      break
    case 'numbers': {
      const list = answer as number[]
      const free = page.getByTestId('answer-numbers')
      if (await free.count()) await free.fill(list.join(' '))
      else for (const [k, n] of list.entries()) await page.getByTestId(`answer-number-${k}`).fill(String(n))
      break
    }
    case 'choice':
      await page.getByTestId(`answer-choice-${String(answer)}`).check()
      break
    case 'order': {
      const target = answer as string[]
      for (const [k, id] of target.entries()) {
        const item = page.getByTestId(`answer-order-${id}`)
        const at = Number(await item.getAttribute('data-index'))
        for (let n = at; n > k; n--) {
          await page.getByTestId(`answer-order-${id}`).focus()
          await page.keyboard.press('Alt+ArrowUp')
        }
        await expect(page.getByTestId(`answer-order-${id}`)).toHaveAttribute('data-index', String(k))
      }
      break
    }
    case 'chain': {
      const c = await current(page)
      const stages = (c.instance as { stages: { id: string }[] }).stages
      for (const [k, s] of stages.entries())
        await page.getByTestId(`answer-chain-${s.id}`).fill(String((answer as string[])[k]))
      break
    }
    case 'set-machine':
      await setMachine(page, answer as never)
      break
    case 'ghost-pick':
      await page.getByTestId(`ghost-pick-${String(answer)}`).click()
      break
    case 'code': {
      const a = answer as { source: string; probe: string }
      await typeCodeAndRun(page, a.source, a.probe)
      return
    }
    case 'custom':
      throw new Error('custom items: drive the chapter’s own Answer, then click gate-submit')
  }
  await expect(submit).toBeEnabled()
  await submit.click()
}

/** Type `source` into code-editor and `probe` into gate-prediction, then Run; waits for the result. */
export async function typeCodeAndRun(page: Page, source: string, probe: string): Promise<void> {
  const editor = page.getByTestId('code-editor')
  await expect(editor).toBeVisible()
  await editor.fill(source)
  const run = page.getByTestId('code-run')
  await page.getByTestId('gate-prediction').fill(probe)
  await expect(run).toBeEnabled()
  await run.click()
  await expect(page.getByTestId('rollback').or(page.getByTestId('code-result'))).toBeVisible({ timeout: 10_000 })
}

/**
 * The agent-paste probe (§7.2 R5): paste the task's reference solution and the Node-computed probe into the
 * code item. Returns the code item's result; the caller then checks that the gate stays unpassed while the
 * in-page item is wrong.
 */
export async function agentPasteProbe(page: Page): Promise<{ correct: boolean }> {
  const c = await current(page)
  const l = await logicFor(c.gateKey, c.itemId, c.fallback)
  const { codeTaskOf } = await import('../../src/lesson/kinds/index.ts')
  const task = codeTaskOf(l)
  if (!task) throw new Error(`${c.itemId} is not a code item`)
  await typeCodeAndRun(page, task.reference, task.probe(c.instance).expected)
  const correct = (await page.getByTestId('rollback').getAttribute('data-correct')) === 'true'
  return { correct }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/** rollback[data-kind] after a wrong answer. */
export async function assertRollback(page: Page, kind: string): Promise<void> {
  await expect(page.getByTestId('rollback')).toHaveAttribute('data-kind', kind)
  await expect(page.getByTestId('rollback')).toHaveAttribute('data-correct', 'false')
}

/** __stage.info().focus is `focus` and dimmed equals dimmedParts(focus, model), computed in Node. */
export async function assertFocus(page: Page, focus: Focus, model: ModelName = 'I'): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__stage!.info().focus)).toBe(focus)
  expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts(focus, model))
}

function serialisations(solution: unknown): string[] {
  const out: string[] = []
  if (typeof solution === 'string' && solution.length >= 4) out.push(solution)
  if (Array.isArray(solution) && solution.length >= 3) {
    if (solution.every((x) => typeof x === 'string' && x.length === 1)) out.push(solution.join(''))
    if (solution.every((x) => typeof x === 'number'))
      out.push(solution.join(' '), solution.join(', '), solution.join(','))
  }
  return out.filter((s) => s.length >= 4)
}

/**
 * No answer leaks into the page before a submit: no answer-like attributes, no hidden input holding the answer,
 * the serialised answer nowhere in the text or markup (worked examples of other instances aside), and a code
 * item's reference solution never rendered.
 */
export async function assertNoAnswerLeak(page: Page): Promise<void> {
  const c = await current(page)
  const l = await logicFor(c.gateKey, c.itemId, c.fallback)
  const solution = l.solve(c.instance)
  const scan = await page.evaluate(() => {
    const root = document.body.cloneNode(true) as HTMLElement
    // Worked examples show other instances; the editor and inputs hold the learner's own text.
    root.querySelectorAll('[data-testid="worked-example"], textarea, input').forEach((e) => e.remove())
    const attrs: string[] = []
    root.querySelectorAll('*').forEach((el) => {
      for (const a of el.getAttributeNames())
        if (/^data-(answer|solution|expected|correct-answer)$/.test(a)) attrs.push(a)
    })
    const hidden = [...document.querySelectorAll('input[type="hidden"]')].map((i) => (i as HTMLInputElement).value)
    return { html: root.innerHTML, text: root.innerText ?? root.textContent ?? '', attrs, hidden }
  })
  expect(scan.attrs, 'answer-like attributes').toEqual([])
  // Choices, blocks, parts and machine settings are on screen by design: only free-response answers are scanned.
  const scanned = ['letters', 'chain', 'numbers'].includes(l.kind) ? serialisations(solution) : []
  for (const s of scanned) {
    expect(scan.text.includes(s), `the answer "${s}" is in the page text`).toBe(false)
    expect(scan.html.includes(s), `the answer "${s}" is in the markup`).toBe(false)
    expect(scan.hidden).not.toContain(s)
  }
  if (l.kind === 'code') {
    const { codeTaskOf } = await import('../../src/lesson/kinds/index.ts')
    const ref = codeTaskOf(l)?.reference ?? ''
    const body = ref
      .split('\n')
      .map((x) => x.trim())
      .filter((x) => x && !/^function|^}$|^\/\//.test(x))
    for (const line of body) expect(scan.html.includes(line), `the reference line "${line}" is rendered`).toBe(false)
  }
}

/**
 * The hint ladder (rule 4) on the current item, through wrong answers via the API:
 * L1 (highlight on the stage), L2 (worked example on another instance), L3 (the reveal; "Got it" records
 * 'revealed' and draws a fresh instance). Puzzle gates give no hint before attempt 3.
 */
export async function assertLadder(page: Page, o: { puzzle?: boolean; highlights?: boolean } = {}): Promise<void> {
  const start = await current(page)
  expect(start.hintLevel).toBe(0)
  const levels = o.puzzle ? [0, 1, 2, 3] : [1, 2, 3]
  let workedSeed: number | null = null
  for (const want of levels) {
    const c = await current(page)
    const wrong = await wrongAnswer(page, c.attempt)
    await answerViaApi(page, c.itemId, wrong)
    const now = await current(page)
    expect(now.hintLevel).toBe(want)
    if (want === 0) {
      await expect(page.getByTestId('hint-panel')).toHaveCount(0)
      continue
    }
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-hint-level', String(want))
    if (want === 1 && o.highlights !== false) {
      const l = await logicFor(now.gateKey, now.itemId, now.fallback)
      const parts = l.highlight(now.instance, wrong).map((h) => h.part)
      await expect
        .poll(() => page.evaluate(() => window.__stage!.info().highlighted))
        .toEqual(expect.arrayContaining(parts))
    }
    if (want === 2) {
      const seed = Number(await page.getByTestId('worked-example').getAttribute('data-seed'))
      expect(seed).not.toBe(now.seed)
      workedSeed = seed
      await expect
        .poll(async () => (await eventsOf(page, 'item.show')).at(-1))
        .toMatchObject({ item: now.key, attempt: now.attempt, hintLevel: 2, workedSeed: seed })
    }
    if (want === 3) {
      // The L2 worked example was neither the instance it was shown with nor this next one.
      expect(now.seed).not.toBe(workedSeed)
      await expect(page.getByTestId('gate-submit')).toHaveCount(0)
      const reveals = (await eventsOf(page, 'item.reveal')).length
      await continueGate(page)
      await expect.poll(async () => (await eventsOf(page, 'item.reveal')).length).toBe(reveals + 1)
      const after = await current(page)
      expect(after.hintLevel).toBe(0)
      expect(after.attempt).toBe(now.attempt + 1)
      expect(after.seed).not.toBe(now.seed)
      expect(after.window.at(-1)).toBe('revealed')
      await expect(page.getByTestId('hint-panel')).toHaveCount(0)
    }
  }
}

/** A reload mid-gate keeps __course.gate().current.seed and the instance. */
export async function reloadKeepsSeed(page: Page): Promise<void> {
  const before = await current(page)
  await page.reload()
  await waitForApp(page)
  const after = await current(page)
  expect(after.seed).toBe(before.seed)
  expect(after.attempt).toBe(before.attempt)
  expect(after.instance).toEqual(before.instance)
}

/**
 * Edit the stored progress before the lesson runtime loads (from #/engine, which does not load it, so no
 * pending write can overwrite the edit), then return to `hash`.
 */
export async function editProgress(page: Page, edit: (p: Record<string, any>) => void, hash: string): Promise<void> {
  await gotoApp(page, '/engine')
  await page.evaluate(
    ([key, fn]) => {
      const p = JSON.parse(localStorage.getItem(key!) ?? 'null')
      if (!p) throw new Error('no progress stored yet')
      new Function('p', `(${fn})(p)`)(p)
      localStorage.setItem(key!, JSON.stringify(p))
    },
    ['enigma.progress.v1', edit.toString()] as const,
  )
  await gotoApp(page, hash)
}

/** Every task of the current scene (e2e only). */
export async function completeTasks(page: Page): Promise<void> {
  await page.evaluate(() => window.__course!.completeTasks())
}

// ---------------------------------------------------------------------------
// Walking whole chapters (walk.spec, review)
// ---------------------------------------------------------------------------

/**
 * Complete the current scene through the UI: story → Next; explore → each reveal's bet (first option) and its
 * trigger, then completeTasks for free exploration; gate/recall → every item via the API. Then Next.
 */
export async function completeScene(page: Page, o: { onScene?: (scene: string) => Promise<void> } = {}): Promise<void> {
  const w = await where(page)
  await o.onScene?.(w.scene!)
  if (w.kind === 'explore') {
    for (const r of await sceneReveals(page)) {
      if ((await page.getByTestId(`bet-${r.bet}`).getAttribute('data-committed')) !== 'true') {
        await commitBet(page, r.bet, await firstBetOption(page, r.bet))
      }
      await fireReveal(page, r)
    }
    await completeTasks(page)
  } else if (w.kind === 'gate' || w.kind === 'recall') {
    await passGate(page)
  }
  await nextScene(page)
}

/** Walk a chapter from its current scene to chapter.complete. */
export async function walkChapter(page: Page, o: { onScene?: (scene: string) => Promise<void> } = {}): Promise<void> {
  const chapter = (await where(page)).chapter
  for (let guard = 0; guard < 40; guard++) {
    await completeScene(page, o)
    const done = (await eventsOf(page, 'chapter.complete')).some((e) => e.chapter === chapter)
    if (done) return
  }
  throw new Error(`${chapter} did not complete`)
}
