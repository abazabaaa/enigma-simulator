/**
 * The review walk (PLAN §7.2 R2): `E2E_PORT=51NN npm run review -- --grep "<tags>"`.
 * One test per chapter, tagged @chapter:<id> (the fixture also @area:lesson). For each scene in scope it
 * writes screenshots at 1280×800 and 390×844, with motion reduced and full (and 3D when MACHINE_3D_READY):
 *   review-artifacts/<NN>/screens/<chapter>-<scene>-<width>-<mode>.png     (mode: reduce | full | reduce-3d | full-3d)
 * gate scenes add <chapter>-<scene>-rollback-1280-reduce.png and <chapter>-<scene>-hint2-1280-reduce.png,
 * and the run writes console.json, stage.json (__stage.info() and stats() per scene) and axe.json.
 * NN is REVIEW_PR (default 05). The walk then completes each scene the way walk.spec does.
 */

import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { gotoApp } from '../helpers/app'
import {
  answerViaApi,
  chapterPath,
  completeScene,
  configure,
  continueGate,
  current,
  enter,
  eventsOf,
  where,
  wrongAnswer,
} from '../helpers/course'
import { CHAPTERS } from '../../src/content/registry'
import type { AnyChapterId } from '../../src/contracts/core'
import { MACHINE_3D_READY } from '../../src/machine3d/ready'

const NN = process.env.REVIEW_PR ?? '05'
const OUT = join('review-artifacts', NN)
const SCREENS = join(OUT, 'screens')
const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const
const MOTIONS = ['reduce', 'full'] as const
/**
 * Per chapter: screenshots at two sizes and two motions (plus 3D) of every scene, axe, and the gates. Load-sensitive:
 * a long chapter passed 240 s at load average 20+ on the shared box, so PR 17 raised it; the checks are unchanged.
 */
const REVIEW_TIMEOUT = 600_000

const consoleLog: { chapter: string; scene: string | null; type: string; text: string }[] = []
const stageLog: { chapter: string; scene: string; renderer: string; info: unknown; stats: unknown }[] = []
const axeLog: {
  chapter: string
  scene: string
  violations: { id: string; impact: string | null; help: string; targets: string[] }[]
}[] = []

async function shoot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: join(SCREENS, `${name}.png`), fullPage: true })
}

/**
 * Waits until the stage has drawn with its final renderer: the 3D view (webgl2) or its 2D fallback, not the
 * "Loading the machine…" placeholder, then lets a few frames settle. (Round 2: the first 3D shot was blank.)
 */
async function stageLoaded(page: Page): Promise<void> {
  const stage = page.getByTestId('stage').first()
  await expect(stage).not.toHaveAttribute('data-renderer', 'pending', { timeout: 30_000 })
  await expect(stage.getByText('Loading the machine…')).toHaveCount(0)
  const renderer = await stage.getAttribute('data-renderer')
  await expect.poll(() => page.evaluate(() => window.__stage?.info().renderer ?? null)).toBe(renderer)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0
        const tick = (): void => void (++n >= 4 ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
  )
}

async function captureScene(page: Page, chapter: AnyChapterId, scene: string): Promise<void> {
  const base = `${chapter}-${scene}`
  for (const size of SIZES) {
    await page.setViewportSize(size)
    for (const motion of MOTIONS) {
      await page.emulateMedia({ reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' })
      await shoot(page, `${base}-${size.width}-${motion}`)
    }
  }
  await page.setViewportSize(SIZES[0])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  stageLog.push({
    chapter,
    scene,
    renderer: '2d',
    info: await page.evaluate(() => window.__stage?.info() ?? null),
    stats: await page.evaluate(() => window.__stage?.stats() ?? null),
  })
  const axe = await new AxeBuilder({ page }).analyze()
  axeLog.push({
    chapter,
    scene,
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      targets: v.nodes.map((n) => String(n.target)),
    })),
  })

  if (MACHINE_3D_READY && (await page.getByTestId('stage').count())) {
    await gotoApp(page, `${chapterPath(chapter)}/${scene}`, { stage: '3d' })
    // A chapter loads lazily after the route: wait for its scene before the shots.
    await expect.poll(async () => (await where(page)).scene).toBe(scene)
    await stageLoaded(page)
    for (const motion of MOTIONS) {
      await page.emulateMedia({ reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' })
      await shoot(page, `${base}-1280-${motion}-3d`)
    }
    stageLog.push({
      chapter,
      scene,
      renderer: '3d',
      info: await page.evaluate(() => window.__stage?.info() ?? null),
      stats: await page.evaluate(() => window.__stage?.stats() ?? null),
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoApp(page, `${chapterPath(chapter)}/${scene}`, { stage: '2d' })
    // A chapter loads lazily after the route: wait for its scene (and gate) before going on. (Found by PR 07.)
    await expect.poll(async () => (await where(page)).scene).toBe(scene)
  }

  const w = await where(page)
  if (w.kind === 'gate' || w.kind === 'recall') await expect(page.getByTestId('gate').first()).toBeVisible()
  if ((w.kind === 'gate' || w.kind === 'recall') && (await page.getByTestId('gate').count())) {
    // The first item's rollback and its L2 hint, for the R4 teaching pass.
    const c = await current(page)
    await answerViaApi(page, c.itemId, await wrongAnswer(page), { continue: false })
    await shoot(page, `${base}-rollback-1280-reduce`)
    await continueGate(page)
    const again = await current(page)
    if (again.itemId === c.itemId && again.hintLevel < 2) {
      await answerViaApi(page, c.itemId, await wrongAnswer(page))
      if ((await current(page)).hintLevel === 2) await shoot(page, `${base}-hint2-1280-reduce`)
    }
  }
}

async function reviewChapter(page: Page, chapter: AnyChapterId): Promise<void> {
  page.on('console', (m) => consoleLog.push({ chapter, scene: null, type: m.type(), text: m.text() }))
  page.on('pageerror', (e) => consoleLog.push({ chapter, scene: null, type: 'pageerror', text: e.message }))
  await enter(page, chapter)
  await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
  for (let guard = 0; guard < 40; guard++) {
    await completeScene(page, { onScene: (scene) => captureScene(page, chapter, scene) })
    if ((await eventsOf(page, 'chapter.complete')).some((e) => e.chapter === chapter)) return
  }
  throw new Error(`${chapter} did not complete`)
}

test.beforeAll(async () => {
  await mkdir(SCREENS, { recursive: true })
})

test.afterAll(async () => {
  await mkdir(OUT, { recursive: true })
  await writeFile(join(OUT, 'console.json'), JSON.stringify(consoleLog, null, 2))
  await writeFile(join(OUT, 'stage.json'), JSON.stringify(stageLog, null, 2))
  await writeFile(join(OUT, 'axe.json'), JSON.stringify(axeLog, null, 2))
})

test.describe('review walk', () => {
  test('lab-fixture', { tag: ['@chapter:lab-fixture', '@area:lesson'] }, async ({ page }) => {
    test.setTimeout(REVIEW_TIMEOUT)
    await reviewChapter(page, 'lab-fixture')
    expect(consoleLog.filter((m) => m.type === 'error' || m.type === 'pageerror')).toEqual([])
  })

  for (const meta of [...CHAPTERS].sort((a, b) => a.order - b.order)) {
    test(meta.id, { tag: `@chapter:${meta.id}` }, async ({ page }) => {
      test.setTimeout(REVIEW_TIMEOUT)
      await reviewChapter(page, meta.id)
    })
  }
})
