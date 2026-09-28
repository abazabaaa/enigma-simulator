/**
 * The course walk (@walk, CI projects 'walk' in 2D and 'walk-3d' in 3D): from empty storage, every chapter in
 * registry order through the UI, with no console errors. Scene-next, bets and their triggers go through the UI; tasks that need free
 * exploration use completeTasks; gate items use __course.answer with answers computed in Node. Chapters
 * unlock one by one (no unlockAll), so placeholders are walked too: each is a single story scene.
 */

import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { configure, progress, walkChapter, where } from './helpers/course'
import { CHAPTERS } from '../src/content/registry'

test.describe('course walk', { tag: '@walk' }, () => {
  test('every chapter, in order, from empty storage', async ({ page, stage }) => {
    // 4 min in CI (PLAN §7.1); the 3D walk (project walk-3d) renders every scene with SwiftShader and gets more.
    test.setTimeout(stage === '3d' ? 480_000 : 240_000)
    await gotoApp(page, '/course', { stage })
    await expect(page.getByTestId('course-map')).toBeVisible()
    const ordered = [...CHAPTERS].sort((a, b) => a.order - b.order)
    // Every scene with a stage draws it with the project's renderer: the SVG view, or the 3D view (never a fallback).
    const renderers = new Set<string>()
    const recordRenderer = async () => {
      const el = page.getByTestId('stage').first()
      if (!(await el.count())) return
      await expect(el).not.toHaveAttribute('data-renderer', 'pending', { timeout: 30_000 })
      renderers.add((await el.getAttribute('data-renderer')) ?? 'none')
    }
    await page.getByTestId(`chapter-link-${ordered[0]!.id}`).click()
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    for (const [k, meta] of ordered.entries()) {
      await expect.poll(async () => (await where(page)).chapter, { message: `${meta.id} opens` }).toBe(meta.id)
      expect((await where(page)).locked).toBe(false)
      await walkChapter(page, { onScene: recordRenderer })
      const next = ordered[k + 1]
      if (next) {
        await expect(page.getByTestId('chapter-next-link')).toHaveAttribute('href', `#/c/${next.id}`)
        await page.getByTestId('chapter-next-link').click()
      }
    }
    const done = (await progress(page)).chapters
    for (const meta of ordered) expect(done[meta.id]?.completed, `${meta.id} complete`).toBe(true)
    expect([...renderers], 'the stage renderer of every scene').toEqual([stage === '3d' ? 'webgl2' : 'svg'])
  })
})
