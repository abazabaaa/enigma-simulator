import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'

/** One URL per route in PLAN §2.3 (App.tsx). */
const ROUTES = [
  '/',
  '/course',
  '/c/prologue',
  '/c/i2-stepping/being-written',
  '/machine',
  '/engine',
  '/lab/stage',
  '/lab/stage?preset=wire&locks=keyboard&model=M4&ghost=demo',
  '/lab/stage?preset=toy&toy=8',
  '/lab/fixture',
  '/lab/fixture/scene-1',
  '/lab/gate/i2-stepping/stepping',
  '/lab/viz',
] as const

test.describe('smoke', { tag: '@smoke' }, () => {
  test('every route loads with a heading and no console errors', async ({ page, stage }) => {
    for (const route of ROUTES) {
      await gotoApp(page, route, { stage })
      // Later PRs replace the page stubs: any visible heading counts.
      await expect(page.getByRole('heading').first(), route).toBeVisible()
      await expect(page.getByTestId('route-loading')).toHaveCount(0)
    }
  })

  test('the test hooks are installed', async ({ page }) => {
    await gotoApp(page, '/')
    const hooks = await page.evaluate(() => ({
      enigma: window.__enigma?.version,
      stage: typeof window.__stage?.info,
      symbol: getComputedStyle(document.documentElement).getPropertyValue('--sym-N-dark').trim(),
    }))
    expect(hooks).toEqual({ enigma: 1, stage: 'function', symbol: '#60a5fa' })
  })

  test('headless Chromium renders WebGL 2 with SwiftShader', async ({ page }) => {
    await gotoApp(page, '/')
    const gpu = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      if (!gl) return null
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        version: String(gl.getParameter(gl.VERSION)),
        renderer: String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
      }
    })
    test.info().annotations.push({ type: 'webgl-renderer', description: gpu?.renderer ?? 'none' })
    console.log(`WEBGL_debug_renderer_info: ${gpu?.renderer}`)
    expect(gpu?.version).toContain('WebGL 2')
    expect(gpu?.renderer).toMatch(/SwiftShader/i)
  })
})
