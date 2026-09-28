/**
 * The e2e test object. Every spec imports { test, expect } from here (never from @playwright/test):
 *  - worker option `stage` ('2d' | '3d'), set per project in playwright.config.ts;
 *  - an automatic guard that fails the test on any console error, uncaught page error, failed
 *    same-origin request or same-origin HTTP error response;
 *  - WebGL context losses are recorded in window.__contextLost and fail the test unless it calls
 *    allowContextLoss() first.
 */

import { test as base, expect } from '@playwright/test'
import type {} from '../src/contracts/hooks'
import type {} from '../src/debug/windowApi'

export type StageName = '2d' | '3d'

declare global {
  interface Window {
    /** WebGL contexts lost on this page (recorded by the fixture's init script). */
    __contextLost?: number
  }
}

interface TestFixtures {
  /** Call before deliberately losing a WebGL context (e.g. the fallback test). */
  allowContextLoss: () => void
  guard: void
}

interface WorkerFixtures {
  stage: StageName
}

export const test = base.extend<TestFixtures & { guardState: { contextLossAllowed: boolean } }, WorkerFixtures>({
  stage: ['2d', { option: true, scope: 'worker' }],

  guardState: async ({}, use) => {
    await use({ contextLossAllowed: false })
  },

  allowContextLoss: async ({ guardState }, use) => {
    await use(() => {
      guardState.contextLossAllowed = true
    })
  },

  guard: [
    async ({ page, baseURL, guardState }, use) => {
      const origin = new URL(baseURL ?? 'http://127.0.0.1/').origin
      const sameOrigin = (url: string) => {
        try {
          return new URL(url).origin === origin
        } catch {
          return false
        }
      }
      const problems: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
      })
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
      page.on('requestfailed', (req) => {
        const why = req.failure()?.errorText ?? ''
        // Navigations and page teardown abort in-flight requests; that is not a failure.
        if (sameOrigin(req.url()) && !why.includes('ERR_ABORTED')) problems.push(`requestfailed: ${req.url()} ${why}`)
      })
      page.on('response', (res) => {
        if (sameOrigin(res.url()) && res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`)
      })
      await page.addInitScript(() => {
        window.__contextLost = 0
        window.addEventListener('webglcontextlost', () => (window.__contextLost = (window.__contextLost ?? 0) + 1), true)
      })

      await use()

      const lost = await page.evaluate(() => window.__contextLost ?? 0).catch(() => 0)
      if (lost > 0 && !guardState.contextLossAllowed) problems.push(`webglcontextlost × ${lost}`)
      expect(problems, 'console errors, page errors, failed requests or lost WebGL contexts').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
