import { expect, test } from './fixtures'
import { waitForApp } from './helpers/app'

// Deploy-ready checks against the production build served under the GitHub Pages base path.
const BASE = process.env.VITE_BASE ?? '/enigma-simulator/'

/** Each route of PLAN §2.3 with a heading we expect. */
const DEEP_LINKS = [
  '/',
  '/course',
  '/c/prologue',
  '/c/iii11-bombe/being-written',
  '/machine',
  '/engine',
  '/lab/stage?preset=reflector',
  '/lab/fixture',
  '/lab/fixture/intro',
  '/lab/gate/i2-stepping/stepping',
  '/lab/viz',
]

test.describe('deploy', { tag: '@smoke' }, () => {
  test('the build references its assets under the base path', async ({ request }) => {
    const res = await request.get('index.html')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toContain(`src="${BASE}assets/`)
    expect(html).not.toMatch(/(src|href)="\/(?!enigma-simulator\/)[^"]*\.(js|css)"/)
  })

  test('404.html returns 200 and boots the app', async ({ page, request }) => {
    const res = await request.get('404.html')
    expect(res.status()).toBe(200)
    expect(await res.text()).toBe(await (await request.get('index.html')).text())

    await page.goto('./404.html#/lab/stage?preset=wire')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stage lab')
    expect(await page.evaluate(() => window.__enigma?.version)).toBe(1)
  })

  test('every route deep-links under the base path', async ({ page }) => {
    for (const route of DEEP_LINKS) {
      await page.goto('about:blank')
      await page.goto(`.${'/'}#${route}`)
      await waitForApp(page)
      expect(new URL(page.url()).pathname, route).toBe(BASE)
      // Pages are replaced by later PRs: any visible heading counts.
      await expect(page.getByRole('heading').first(), route).toBeVisible()
    }
  })

  test('a path-style link becomes the hash route', async ({ page }) => {
    await page.goto('./course')
    await waitForApp(page)
    expect(new URL(page.url()).hash).toBe('#/course')
    expect(new URL(page.url()).pathname).toBe(BASE)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})
