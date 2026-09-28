/**
 * Accessibility (PR 17, @area:a11y): axe finds no serious or critical issue on any route — the platform pages, the
 * labs, the course map, the sandbox and every chapter's first scene — nor on a gate's rollback and hint states; and
 * the code editor never traps the keyboard (Esc, then Tab, reaches the prediction and Run).
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { answerCorrect, answerViaApi, configure, continueGate, current, enter, wrongAnswer } from './helpers/course'
import { ORDERED_CHAPTERS, PLATFORM_ROUTES, settle } from './helpers/routes'

/** Serious or critical axe findings on the whole page, as "rule: targets". */
async function axeSerious(page: Page): Promise<string[]> {
  const res = await new AxeBuilder({ page }).analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => String(n.target)).join(' ')}`)
}

/** Open the fixture's gate `main` alone and answer until `itemId` is current. */
async function openFixtureItem(page: Page, itemId: string): Promise<void> {
  await gotoApp(page, '/lab/gate/lab-fixture/main', { stage: '2d' })
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  for (let k = 0; k < 40 && (await current(page)).itemId !== itemId; k++) await answerCorrect(page)
  expect((await current(page)).itemId).toBe(itemId)
}

test.describe('accessibility', { tag: ['@area:release', '@area:a11y'] }, () => {
  test('every platform route: no serious or critical axe findings', async ({ page, stage }) => {
    test.setTimeout(180_000)
    const found: string[] = []
    for (const r of PLATFORM_ROUTES) {
      await gotoApp(page, r.hash, { stage })
      await settle(page)
      found.push(...(await axeSerious(page)).map((v) => `${r.name} (#${r.hash}): ${v}`))
    }
    expect(found).toEqual([])
  })

  for (const meta of ORDERED_CHAPTERS) {
    test(`${meta.id}: the first scene has no serious or critical axe findings`, async ({ page }) => {
      await enter(page, meta.id)
      await settle(page)
      expect(await axeSerious(page)).toEqual([])
    })
  }

  test('a gate’s rollback and hint states have no serious or critical axe findings', async ({ page }) => {
    await gotoApp(page, '/lab/gate/lab-fixture/main', { stage: '2d' })
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    const first = await current(page)
    await answerViaApi(page, first.itemId, await wrongAnswer(page), { continue: false })
    await expect(page.getByTestId('rollback')).toBeVisible()
    expect(await axeSerious(page), 'rollback').toEqual([])
    await continueGate(page)
    await answerViaApi(page, first.itemId, await wrongAnswer(page, 2))
    await expect.poll(async () => (await current(page)).hintLevel).toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('hint-panel')).toBeVisible()
    expect(await axeSerious(page), 'hint').toEqual([])
  })

  test('the code editor never traps the keyboard: Esc, then Tab, reaches the prediction and then Run', async ({
    page,
  }) => {
    await openFixtureItem(page, 'double')
    const editor = page.getByTestId('code-editor')
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(await axeSerious(page), 'the code item').toEqual([])
    const stored = () => page.evaluate(() => localStorage.getItem('enigma.code.lab-fixture/lab:main/double'))

    // Tab inside the editor indents and keeps the focus there.
    await editor.fill('x')
    await editor.press('End')
    await page.keyboard.press('Tab')
    await expect(editor).toBeFocused()
    await expect.poll(stored).toBe('x  ')

    // Esc, then Tab: out to the prediction; type it, Tab again: Run.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('gate-prediction')).toBeFocused()
    expect(await stored()).toBe('x  ')
    await page.keyboard.type('42')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('code-run')).toBeFocused()

    // And back again with Shift-Tab: the prediction, then the editor.
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByTestId('gate-prediction')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(editor).toBeFocused()
  })
})
