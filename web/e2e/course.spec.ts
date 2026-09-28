/**
 * The course map and the route guards (PLAN §2.3, §6.4 course.spec): lock states, a deep link to a locked
 * chapter, a deep link beyond `reached`, the back button, reset and export.
 */

import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { configure, enter, eventsOf, nextScene, progress, where } from './helpers/course'
import { CHAPTER_IDS } from '../src/contracts/core'

test.describe('course map and route guards', { tag: '@area:lesson' }, () => {
  test('the course map lists every chapter with its lock state', async ({ page }) => {
    await gotoApp(page, '/course')
    await expect(page.getByTestId('course-map')).toBeVisible()
    for (const id of CHAPTER_IDS) await expect(page.getByTestId(`chapter-link-${id}`)).toHaveAttribute('href', `#/c/${id}`)
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('chapter-link-i1-anatomy')).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('bets-summary')).toHaveAttribute('data-made', '0')
  })

  test('a deep link to a locked chapter shows locked-page; completing the previous one unlocks it', async ({ page }) => {
    await gotoApp(page, '/c/i1-anatomy')
    await expect(page.getByTestId('locked-page')).toBeVisible()
    expect(await where(page)).toMatchObject({ chapter: 'i1-anatomy', locked: true, scene: null })
    await expect(page.getByTestId('locked-page').getByRole('link', { name: /A new key every day/ })).toHaveAttribute('href', '#/c/prologue')

    await gotoApp(page, '/c/prologue')
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    for (let k = 0; k < 20 && !(await eventsOf(page, 'chapter.complete')).length; k++) await nextScene(page)
    expect((await eventsOf(page, 'chapter.complete')).map((e) => e.chapter)).toEqual(['prologue'])
    await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', '#/c/i1-anatomy')
    await page.getByTestId('chapter-next-link').click()
    await expect(page.getByTestId('locked-page')).toHaveCount(0)
    await expect.poll(async () => (await where(page)).chapter).toBe('i1-anatomy')
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-completed', 'true')
    await expect(page.getByTestId('chapter-link-i1-anatomy')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('chapter-link-i2-stepping')).toHaveAttribute('data-locked', 'true')
  })

  test('unlockAll opens every chapter for e2e, and only with ?e2e=1', async ({ page }) => {
    await gotoApp(page, '/c/iii11-bombe')
    await expect(page.getByTestId('locked-page')).toBeVisible()
    await page.evaluate(() => window.__course!.unlockAll())
    await expect(page.getByTestId('locked-page')).toHaveCount(0)
    await expect.poll(async () => (await where(page)).chapter).toBe('iii11-bombe')
    // The map still shows the learner's real lock states.
    await gotoApp(page, '/course')
    await expect(page.getByTestId('chapter-link-iii11-bombe')).toHaveAttribute('data-locked', 'true')

    await page.goto('./?e2e=0#/course')
    await expect(page.getByTestId('course-map')).toBeVisible()
    const errors = await page.evaluate(() =>
      (['unlockAll', 'completeTasks', 'resetProgress'] as const).map((k) => {
        try {
          window.__course![k]()
          return 'ran'
        } catch (e) {
          return (e as Error).message
        }
      }),
    )
    expect(errors).toEqual(['e2e only', 'e2e only', 'e2e only'])
  })

  test('a deep link beyond reached (or to an unknown scene) redirects to the furthest scene reached', async ({ page }) => {
    await enter(page, 'lab-fixture', { scene: 'gate' })
    expect(await where(page)).toMatchObject({ scene: 'story', index: 0 })
    await expect(page).toHaveURL(/#\/lab\/fixture\/story$/)
    await nextScene(page)
    expect((await where(page)).scene).toBe('bets-press')
    await page.evaluate(() => (location.hash = '#/lab/fixture/puzzle'))
    await expect.poll(async () => (await where(page)).scene).toBe('bets-press')
    await expect(page).toHaveURL(/#\/lab\/fixture\/bets-press$/)
    await page.evaluate(() => (location.hash = '#/lab/fixture/no-such-scene'))
    await expect(page).toHaveURL(/#\/lab\/fixture\/bets-press$/)
    // A reached scene is fine.
    await page.evaluate(() => (location.hash = '#/lab/fixture/story'))
    await expect.poll(async () => (await where(page)).scene).toBe('story')
    expect((await progress(page)).chapters['lab-fixture']).toMatchObject({ reached: 1 })
  })

  test('the back button and scene-back move within the reached scenes; scene-next is a no-op when blocked', async ({ page }) => {
    await enter(page, 'lab-fixture')
    await nextScene(page)
    expect((await where(page)).scene).toBe('bets-press')
    await expect(page.getByTestId('scene-next')).toHaveAttribute('aria-disabled', 'true')
    // Playwright treats aria-disabled as disabled: force the click to prove it does nothing.
    await page.getByTestId('scene-next').click({ force: true })
    expect(await where(page)).toMatchObject({ scene: 'bets-press', canNext: false })
    expect(await page.evaluate(() => window.__course!.next())).toBe(false)
    await page.goBack()
    await expect.poll(async () => (await where(page)).scene).toBe('story')
    await page.goForward()
    await expect.poll(async () => (await where(page)).scene).toBe('bets-press')
    await page.getByTestId('scene-back').click()
    await expect.poll(async () => (await where(page)).scene).toBe('story')
    await expect(page.getByTestId('scene-back')).toBeDisabled()
  })

  test('reset (with a confirmation) and export as JSON', async ({ page }) => {
    await enter(page, 'lab-fixture')
    await nextScene(page)
    await page.evaluate(() => window.__course!.bet('first-lamp', 'B'))
    await gotoApp(page, '/course')
    await expect(page.getByTestId('bets-summary')).toHaveAttribute('data-made', '1')

    const download = page.waitForEvent('download')
    await page.getByTestId('course-export').click()
    const file = await (await download).path()
    const exported = JSON.parse(await readFile(file, 'utf8'))
    expect(exported).toMatchObject({ version: 1, bets: { 'lab-fixture/first-lamp': { value: 'B' } } })

    await page.getByTestId('course-reset').click()
    await page.getByTestId('course-reset-cancel').click()
    expect(Object.keys((await progress(page)).bets)).toHaveLength(1)
    await page.getByTestId('course-reset').click()
    await page.getByTestId('course-reset-confirm').click()
    await expect(page.getByTestId('bets-summary')).toHaveAttribute('data-made', '0')
    expect(await progress(page)).toMatchObject({ chapters: {}, bets: {}, gates: {} })
  })
})
