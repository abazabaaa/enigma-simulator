/**
 * The course walk (@walk, CI project 'walk'): from empty storage, every chapter in registry order through the
 * UI, with no console errors. Scene-next, bets and their triggers go through the UI; tasks that need free
 * exploration use completeTasks; gate items use __course.answer with answers computed in Node. Chapters
 * unlock one by one (no unlockAll), so placeholders are walked too: each is a single story scene.
 */

import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { configure, progress, walkChapter, where } from './helpers/course'
import { CHAPTERS } from '../src/content/registry'

test.describe('course walk', { tag: '@walk' }, () => {
  test('every chapter, in order, from empty storage', async ({ page }) => {
    test.setTimeout(240_000)
    await gotoApp(page, '/course')
    await expect(page.getByTestId('course-map')).toBeVisible()
    const ordered = [...CHAPTERS].sort((a, b) => a.order - b.order)
    await page.getByTestId(`chapter-link-${ordered[0]!.id}`).click()
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    for (const [k, meta] of ordered.entries()) {
      await expect.poll(async () => (await where(page)).chapter, { message: `${meta.id} opens` }).toBe(meta.id)
      expect((await where(page)).locked).toBe(false)
      await walkChapter(page)
      const next = ordered[k + 1]
      if (next) {
        await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', `#/c/${next.id}`)
        await page.getByTestId('chapter-next-link').click()
      }
    }
    const done = (await progress(page)).chapters
    for (const meta of ordered) expect(done[meta.id]?.completed, `${meta.id} complete`).toBe(true)
  })
})
