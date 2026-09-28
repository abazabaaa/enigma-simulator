/**
 * The routes the release specs visit (a11y, layout, release): every route of PLAN §2.3 (App.tsx) with the query
 * variants that change the page, plus every chapter of the registry. `settle` waits until a route has drawn.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures'
import { CHAPTERS } from '../../src/content/registry'
import type { ChapterMeta } from '../../src/contracts/lesson'

export interface RouteCase {
  readonly name: string
  /** The hash route, without the leading '#'. */
  readonly hash: string
}

export const PLATFORM_ROUTES: readonly RouteCase[] = [
  { name: 'home', hash: '/' },
  { name: 'course map', hash: '/course' },
  { name: 'sandbox', hash: '/machine' },
  { name: 'engine', hash: '/engine' },
  { name: 'stage lab', hash: '/lab/stage' },
  { name: 'stage lab: wire and ghost', hash: '/lab/stage?preset=wire&ghost=demo' },
  { name: 'stage lab: M4 plugboard, keyboard locked', hash: '/lab/stage?preset=plugboard&model=M4&locks=keyboard' },
  { name: 'stage lab: 8-letter toy', hash: '/lab/stage?preset=toy&toy=8' },
  { name: 'fixture chapter', hash: '/lab/fixture' },
  { name: 'fixture gate', hash: '/lab/gate/lab-fixture/main' },
  { name: 'chapter gate lab', hash: '/lab/gate/i2-stepping/stepping' },
  { name: 'viz lab', hash: '/lab/viz' },
  // Without unlockAll a later chapter shows its lock page.
  { name: 'a locked chapter', hash: '/c/iv-capstone' },
]

/** The chapters in course order. */
export const ORDERED_CHAPTERS: readonly ChapterMeta[] = [...CHAPTERS].sort((a, b) => a.order - b.order)

/**
 * The page has drawn: no route-loading fallback, a visible heading, and a stage (if any) past its pending state
 * with its placeholder gone.
 */
export async function settle(page: Page): Promise<void> {
  await expect(page.getByTestId('route-loading')).toHaveCount(0)
  await expect(page.getByRole('heading').first()).toBeVisible()
  for (const stage of await page.getByTestId('stage').all()) {
    await expect(stage).not.toHaveAttribute('data-renderer', 'pending', { timeout: 30_000 })
  }
  await expect(page.getByText('Loading the machine…')).toHaveCount(0, { timeout: 30_000 })
}
