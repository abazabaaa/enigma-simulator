/**
 * Release readiness (PR 17, @area:release), against the production build served under the GitHub Pages base path
 * (VITE_BASE=/enigma-simulator/, the default of vite.config.ts and playwright.config.ts):
 *  - the bundle budgets hold (scripts/budget.mjs on this very build) and 404.html is index.html;
 *  - every route and every chapter deep-links, as a first-time visitor (no e2e flag) and unlocked;
 *  - a path-style link served through 404.html (what GitHub Pages answers for an unknown path) boots its route;
 *  - the sandbox's share URL round-trips: it opens the same machine, and the tape reads back;
 *  - the lazy chunks load only where they are needed (no CodeMirror, effects or 3D on a 2D page).
 * Zero console errors, page errors and failed requests: the fixture's guard checks every test.
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures'
import { gotoApp, waitForApp } from './helpers/app'
import { where } from './helpers/course'
import { ORDERED_CHAPTERS, PLATFORM_ROUTES, settle } from './helpers/routes'

const PAGES_BASE = '/enigma-simulator/'
const BASE = process.env.VITE_BASE ?? PAGES_BASE
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')

test.describe('release', { tag: '@area:release' }, () => {
  test('the Pages build: base path, 404.html, and every bundle budget', async ({ request }) => {
    expect(BASE, 'release specs run against the GitHub Pages base path').toBe(PAGES_BASE)
    const html = await (await request.get('index.html')).text()
    expect(html).toContain(`src="${PAGES_BASE}assets/`)
    expect(html).not.toMatch(/(src|href)="\/(?!enigma-simulator\/)[^"]*\.(js|css)"/)
    const notFound = await request.get('404.html')
    expect(notFound.status()).toBe(200)
    expect(await notFound.text()).toBe(html)
    // The webServer built dist/ for this run; budget.mjs reads its manifest and exits 1 when over budget.
    const report = execFileSync(process.execPath, ['scripts/budget.mjs'], { cwd: WEB, encoding: 'utf8' })
    expect(report).toContain('budget: ok')
    expect(report).toMatch(/code editor\s+[\d.]+\s+150\s+ok/)
  })

  test('every route deep-links under the base path for a first-time visitor', async ({ page }) => {
    test.setTimeout(120_000)
    const routes = [...PLATFORM_ROUTES.map((r) => r.hash), ...ORDERED_CHAPTERS.map((c) => `/c/${c.id}`)]
    for (const route of routes) {
      await page.goto('about:blank')
      await page.goto(`./#${route}`)
      await waitForApp(page)
      expect(new URL(page.url()).pathname, route).toBe(PAGES_BASE)
      await expect(page.getByRole('heading').first(), route).toBeVisible()
    }
  })

  test('every chapter deep-links to its first scene once unlocked', async ({ page }) => {
    test.setTimeout(120_000)
    await gotoApp(page, '/course')
    await page.evaluate(() => window.__course!.unlockAll())
    for (const meta of ORDERED_CHAPTERS) {
      await page.goto('about:blank')
      await page.goto(`./#/c/${meta.id}`)
      await waitForApp(page)
      await expect.poll(async () => (await where(page)).chapter, { message: meta.id }).toBe(meta.id)
      const w = await where(page)
      expect(w.locked, meta.id).toBe(false)
      expect(w.index, meta.id).toBe(0)
      await settle(page)
    }
  })

  test('a path-style link served through 404.html boots its route, as on GitHub Pages', async ({ page, request }) => {
    const body = await (await request.get('404.html')).text()
    // GitHub Pages answers an unknown path with 404.html (status 404); the body is what boots the app.
    const paths = ['c/i2-stepping', 'machine', 'course', 'lab/viz']
    for (const path of paths) {
      await page.route(`**${PAGES_BASE}${path}`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body }),
      )
    }
    for (const path of paths) {
      await page.goto('about:blank')
      await page.goto(`./${path}`)
      await waitForApp(page)
      const url = new URL(page.url())
      expect(url.pathname, path).toBe(PAGES_BASE)
      expect(url.hash, path).toBe(`#/${path}`)
      await expect(page.getByRole('heading').first(), path).toBeVisible()
    }
  })

  test('the share URL round-trips: the same machine opens, and the tape reads back', async ({ page, context }) => {
    await gotoApp(page, '/machine', { stage: '2d' })
    const config = {
      model: 'M3',
      reflector: 'C',
      rotors: ['VII', 'II', 'V'],
      rings: 'KEY',
      positions: 'RUN',
      plugboard: 'AQ BW CE DR FT GZ',
    } as const
    await page.evaluate((c) => window.__enigma!.setConfig({ ...c, rotors: [...c.rotors] }), config)
    const plain = 'SHAREDLINKSWORK'
    for (const l of plain) await page.keyboard.press(l)
    await expect.poll(() => page.evaluate(() => window.__enigma!.getState().input)).toBe(plain)
    const sent = await page.evaluate(() => window.__enigma!.getState())
    const url = await page.getByTestId('share-url').inputValue()
    expect(url.startsWith(`${new URL(page.url()).origin}${PAGES_BASE}#/machine?k=`)).toBe(true)

    const other = await context.newPage()
    await other.goto(url)
    await waitForApp(other)
    const opened = await other.evaluate(() => window.__enigma!.getState())
    expect(opened.config).toEqual(sent.config)
    expect(opened.positions).toBe(config.positions)
    for (const l of sent.output) await other.evaluate((k) => window.__enigma!.pressKey(k), l)
    expect((await other.evaluate(() => window.__enigma!.getState())).output).toBe(plain)
    await other.close()
  })

  test('lazy chunks load only where needed: no CodeMirror, effects or 3D view on a 2D page', async ({ page }) => {
    const scripts: string[] = []
    page.on('request', (req) => {
      if (req.resourceType() === 'script') scripts.push(new URL(req.url()).pathname)
    })
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '2d' })
    await settle(page)
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', 'svg')
    expect(scripts.filter((s) => /\/assets\/(codemirror|effects|CodeEditor)-/.test(s))).toEqual([])
    expect(await page.evaluate(() => window.__stage!.stats())).toBeNull()
  })
})
