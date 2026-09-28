/**
 * Phone layout (PR 17, @area:layout): at 390×844 no route scrolls the page sideways — the platform pages, the labs,
 * the course map, the sandbox and every chapter's first scene. Wide content (the 2D stage, the viz, tables) scrolls
 * inside its own box, which stays within the viewport; a stage, where there is one, is visible.
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { enter } from './helpers/course'
import { ORDERED_CHAPTERS, PLATFORM_ROUTES, settle } from './helpers/routes'

const PHONE = { width: 390, height: 844 }

interface Layout {
  viewport: number
  scrollWidth: number
  /** Outermost horizontal scrollers that reach outside the viewport. */
  outside: string[]
  /** Scrollers that are wider than their box (they scroll inside it). */
  scrolling: number
}

async function layout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const SCROLLER = '[data-testid="stage2d-scroll"], .overflow-x-auto, .overflow-auto'
    const viewport = document.documentElement.clientWidth
    const all = [...document.querySelectorAll<HTMLElement>(SCROLLER)]
    const outer = all.filter((el) => !el.parentElement?.closest(SCROLLER))
    const shown = outer.filter((el) => el.getBoundingClientRect().width > 0)
    const name = (el: HTMLElement) => el.dataset.testid ?? el.getAttribute('aria-label') ?? el.className.slice(0, 60)
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      outside: shown
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.left < -1 || r.right > viewport + 1
        })
        .map(name),
      scrolling: shown.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
    }
  })
}

async function expectPhoneLayout(page: Page, what: string): Promise<void> {
  const l = await layout(page)
  expect(l.scrollWidth, `${what}: the page does not scroll sideways`).toBeLessThanOrEqual(l.viewport)
  expect(l.outside, `${what}: scrollers stay inside the viewport`).toEqual([])
  const stage = page.getByTestId('stage').first()
  if (await stage.count()) await expect(stage, `${what}: the stage is visible`).toBeVisible()
}

test.describe('phone layout', { tag: ['@area:release', '@area:layout'] }, () => {
  test.use({ viewport: PHONE })

  test('every platform route fits 390 px; wide content scrolls inside its box', async ({ page, stage }) => {
    test.setTimeout(120_000)
    for (const r of PLATFORM_ROUTES) {
      await gotoApp(page, r.hash, { stage })
      await settle(page)
      await expectPhoneLayout(page, `${r.name} (#${r.hash})`)
    }
  })

  test('the 2D stage and the viz scroll inside their boxes at 390 px', async ({ page }) => {
    await gotoApp(page, '/lab/stage?preset=overview', { stage: '2d' })
    await settle(page)
    const scroll = page.getByTestId('stage2d-scroll')
    await expect(scroll).toHaveAttribute('data-scrollable', 'true')
    const box = await scroll.evaluate((el) => ({ w: el.clientWidth, sw: el.scrollWidth, r: el.getBoundingClientRect().right }))
    expect(box.sw).toBeGreaterThan(box.w)
    expect(box.r).toBeLessThanOrEqual(PHONE.width)

    await gotoApp(page, '/lab/viz', { stage: '2d' })
    await settle(page)
    const l = await layout(page)
    expect(l.scrollWidth).toBeLessThanOrEqual(l.viewport)
    expect(l.outside).toEqual([])
    expect(l.scrolling, 'at least one viz is wider than the phone and scrolls in its box').toBeGreaterThan(0)
  })

  for (const meta of ORDERED_CHAPTERS) {
    test(`${meta.id}: the first scene fits 390 px`, async ({ page }) => {
      await enter(page, meta.id)
      await settle(page)
      await expectPhoneLayout(page, meta.id)
    })
  }
})
