import type { Page } from '@playwright/test'

/**
 * Open the app at a hash route with URL flags before the hash:
 *   gotoApp(page, '/lab/stage?preset=pawls', { stage: '2d' }) → ./?e2e=1&stage=2d#/lab/stage?preset=pawls
 * Waits until #root holds the page (the lazy-route fallback has gone).
 */
export async function gotoApp(
  page: Page,
  hash: string,
  { e2e = true, stage, motion }: { e2e?: boolean; stage?: '2d' | '3d'; motion?: 'reduce' | 'full' } = {},
): Promise<void> {
  const flags = new URLSearchParams()
  if (e2e) flags.set('e2e', '1')
  if (stage) flags.set('stage', stage)
  if (motion) flags.set('motion', motion)
  const route = hash.replace(/^#/, '')
  const qs = flags.toString()
  await page.goto(`./${qs ? `?${qs}` : ''}#${route.startsWith('/') ? route : `/${route}`}`)
  await waitForApp(page)
}

/** #root has rendered a page (not the route-loading fallback). */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    return !!root && root.childElementCount > 0 && !document.querySelector('[data-testid="route-loading"]')
  })
}
