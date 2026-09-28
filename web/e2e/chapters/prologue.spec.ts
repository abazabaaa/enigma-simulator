/**
 * Prologue · the hook (PLAN §4.4 "prologue", §6.0 CHAPTER PR TEMPLATE steps 0–3 and 8; the chapter has no gate, so
 * steps 4–7 do not apply):
 *  - every scene in order, scene-next aria-disabled until the scene is done;
 *  - each bet gates its reveal (the key, the Play button, playback gated at t 0), and resolves once it fires;
 *  - focus 'overview' and dimmedParts on both staged scenes; the lid slider opens the case;
 *  - type-a-word: five letters, then the round trip through the paper tape (clear and rewind, type the ciphertext);
 *  - brute-force: the key-space figure shows 1.59 × 10²⁰ and 1.07 × 10²³ (computed in Node from lib/keyspace);
 *  - chapter.complete fires and I.1 unlocks;
 *  - @3d: the first mechanism scene reports focus overview and dimmedParts in the 3D view, and typing lights a lamp.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  assertFocus,
  assertRevealGated,
  commitBet,
  enter,
  eventsOf,
  expectNextDisabled,
  fireReveal,
  nextScene,
  progress,
  sceneReveals,
  where,
} from '../helpers/course'
import { START } from '../../src/chapters/prologue/gates'
import { dimmedParts } from '../../src/contracts/stage'
import { createMachine, encipher, pressKey } from '../../src/engine'
import { formatSci, keyspace } from '../../src/lib/keyspace'
import type {} from '../../src/machine3d/debugApi'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const CHAPTER = 'prologue'

const betResults = async (page: Page) =>
  Object.fromEntries((await eventsOf(page, 'bet.resolve')).map((e) => [e.bet.split('/')[1]!, e.correct]))

const tape = async (page: Page, id: 'tape-input' | 'tape-output') => ((await page.getByTestId(id).textContent()) ?? '').replace(/\s/g, '')

/** Serious or critical axe findings inside one element (the lesson.spec pattern). */
async function axeSerious(page: Page, selector: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(selector).exclude('[data-stub]').analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** Type `word` with the DOM keys, one click per letter. */
async function typeKeys(page: Page, word: string): Promise<void> {
  for (const ch of word) await page.getByTestId(`key-${ch}`).click()
  await expect.poll(() => page.evaluate(() => window.__enigma!.getState().input)).toMatch(new RegExp(`${word}$`))
}

test.describe('chapter prologue', { tag: '@chapter:prologue' }, () => {
  test('scenes in order: the story, a bet before every reveal, focus, the round trip, the key space; chapter.complete unlocks I.1', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-i1-anatomy')).toHaveAttribute('data-locked', 'true')
    await enter(page, CHAPTER)

    // 1. The story: Scherbius, the static act clock; Next is always enabled.
    expect(await where(page)).toMatchObject({ chapter: CHAPTER, scene: 'scherbius', kind: 'story', index: 0, canNext: true })
    await expect(page.getByTestId('story-card')).toContainText('Arthur Scherbius')
    await expect(page.getByTestId('act-clock')).toBeVisible()
    await expect(page.getByTestId('stage')).toHaveCount(0)
    await nextScene(page)

    // type-a-word: the whole machine, the bet gates the first press.
    expect(await where(page)).toMatchObject({ scene: 'type-a-word', kind: 'explore' })
    await assertFocus(page, 'overview')
    expect(dimmedParts('overview', 'I')).toEqual([])
    await expect(page.getByTestId('type-hint')).toContainText('Type a word')
    await expectNextDisabled(page)
    const [press] = await sceneReveals(page)
    expect(press).toMatchObject({ bet: 'own-letter', trigger: 'press' })
    await assertRevealGated(page, press!)
    await expect(page.getByTestId('key-H')).toBeDisabled()
    await commitBet(page, 'own-letter', 'own')
    await fireReveal(page, press!)
    const first = pressKey(createMachine(START), 'A').output
    expect(await page.evaluate(() => window.__stage!.info().litLamp)).toBe(first)
    await expect(page.getByTestId(`lamp-${first}`)).toHaveAttribute('data-lit', 'true')
    await expect(page.getByTestId('own-letter-result')).toContainText(`A lit ${first}`)
    expect((await betResults(page))['own-letter']).toBe(false)
    await expectNextDisabled(page)

    // The lid slider opens the case: the directive changes, the focus does not.
    await page.getByTestId('lid-slider').fill('1')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.lid)).toBe('open')
    await assertFocus(page, 'overview')
    await page.getByTestId('lid-slider').fill('0')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.lid)).toBe('closed')

    // Five letters, then the round trip: clear and rewind, type the ciphertext, the word comes back.
    await page.getByTestId('tape-rewind').click()
    await expect.poll(() => tape(page, 'tape-input')).toBe('')
    await typeKeys(page, 'HELLO')
    await expect(page.getByTestId('task-type5')).toHaveAttribute('data-done', 'true')
    const cipher = encipher(createMachine(START), 'HELLO').output
    expect(await tape(page, 'tape-output')).toBe(cipher)
    await expect(page.getByTestId('task-roundtrip')).toHaveAttribute('data-done', 'false')
    await page.getByTestId('tape-rewind').click()
    await expect(page.getByTestId('roundtrip')).toContainText(`type the ciphertext`)
    await typeKeys(page, cipher)
    await expect.poll(() => tape(page, 'tape-output')).toBe('HELLO')
    await expect(page.getByTestId('roundtrip')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('task-roundtrip')).toHaveAttribute('data-done', 'true')
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])
    await nextScene(page)

    // brute-force: the Play button waits for the bet; the figure is computed by lib/keyspace.
    expect(await where(page)).toMatchObject({ scene: 'brute-force', kind: 'explore' })
    await assertFocus(page, 'overview')
    await expectNextDisabled(page)
    const [play] = await sceneReveals(page)
    expect(play).toMatchObject({ bet: 'brute', trigger: 'play' })
    await assertRevealGated(page, play!)
    await expect(page.getByTestId('keyspace-figure')).toHaveCount(0)
    await commitBet(page, 'brute', 'no')
    await fireReveal(page, play!)
    const figure = page.getByTestId('keyspace-figure')
    await expect(figure).toContainText(formatSci(keyspace()))
    await expect(figure).toContainText(formatSci(keyspace({ rings: true })))
    await expect(figure).toContainText('60 × 17,576 × 150,738,274,937,250')
    await expect(page.getByTestId('brute-force-result')).toContainText('676')
    await expect(page.getByTestId('task-seen')).toHaveAttribute('data-done', 'true')
    const years = page.getByTestId('brute-force-years')
    const before = await years.textContent()
    await page.getByTestId('rate-slider').fill('0')
    await expect(years).not.toHaveText(before ?? '')
    expect(await betResults(page)).toEqual({ 'own-letter': false, brute: true })
    expect(await axeSerious(page, '[data-testid="scene"]')).toEqual([])

    // 8. chapter.complete, and I.1 unlocks.
    await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual([CHAPTER])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/i1-anatomy')
    expect((await progress(page)).chapters[CHAPTER]).toMatchObject({ completed: true })
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-completed', 'true')
    await expect(page.getByTestId('chapter-link-i1-anatomy')).toHaveAttribute('data-locked', 'false')
  })

  test('a revisit: the bets stay committed, and the reveals fire again in any order', async ({ page }) => {
    await enter(page, CHAPTER)
    await nextScene(page)
    await commitBet(page, 'own-letter', 'other')
    await fireReveal(page, { bet: 'own-letter', trigger: 'press', key: 'Q' })
    expect((await betResults(page))['own-letter']).toBe(true)
    await page.evaluate(() => window.__course!.completeTasks())
    await nextScene(page)
    await commitBet(page, 'brute', 'year')
    // Back to the first scene and forward again: the keyboard is free, the result is shown after a press.
    await page.getByTestId('scene-back').click()
    await expect.poll(async () => (await where(page)).scene).toBe('type-a-word')
    expect(await page.evaluate(() => window.__stage!.playback().gated)).toBe(false)
    await page.getByTestId('key-B').click()
    await expect(page.getByTestId('own-letter-result')).toContainText('B lit')
    await nextScene(page)
    await fireReveal(page, { bet: 'brute', trigger: 'play' })
    await expect(page.getByTestId('keyspace-figure')).toBeVisible()
    expect((await betResults(page)).brute).toBe(false)
  })
})

test.describe('chapter prologue in 3D', { tag: ['@3d', '@chapter:prologue'] }, () => {
  test('the first scene reports focus overview and dimmedParts in 3D; the bet gates typing, then a key lights a lamp', async ({
    page,
  }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await enter(page, CHAPTER, { stage: '3d' })
    await nextScene(page)
    expect((await where(page)).scene).toBe('type-a-word')
    await expect
      .poll(
        async () => {
          const i = await page.evaluate(() => window.__stage!.info())
          return `${i.renderer}:${i.focus}`
        },
        { timeout: 30_000 },
      )
      .toBe('webgl2:overview')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual(dimmedParts('overview', 'I'))
    const [press] = await sceneReveals(page)
    await assertRevealGated(page, press!)
    await commitBet(page, 'own-letter', 'other')
    await fireReveal(page, press!)
    const lamp = pressKey(createMachine(START), 'A').output
    await expect.poll(() => page.evaluate(() => window.__stage!.info().litLamp)).toBe(lamp)
    await page.getByTestId('lid-slider').fill('2')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.lid)).toBe('cutaway')
  })
})
