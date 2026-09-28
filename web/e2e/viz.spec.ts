import AxeBuilder from '@axe-core/playwright'
import { REJEWSKI_65, characteristic, products } from '../src/crypto/rejewski'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'

// Expected values are computed IN NODE from the pure crypto kit, never typed in.
const P65 = products(REJEWSKI_65)
const AD = P65.AD as number[]

const VIEWS = [
  'cycle-diagram',
  'cycle-diagram-hexagon',
  'cycle-align',
  'light-table',
  'crib-strip',
  'crib-strip-v14',
  'menu-graph',
  'wire-grid-toy',
  'test-register-toy',
  'wire-grid-26',
  'test-register-26',
] as const

test.describe('viz lab', { tag: ['@area:crypto', '@area:viz'] }, () => {
  test('#/lab/viz renders every view with its fixture data', async ({ page, stage }) => {
    await gotoApp(page, '/lab/viz', { stage })
    await expect(page.getByRole('heading', { name: 'Visualisation lab' })).toBeVisible()
    for (const id of VIEWS) await expect(page.getByTestId(id), id).toBeVisible()

    const cycles = page.getByTestId('cycle-diagram')
    await expect(cycles).toHaveAttribute('data-cycles', '(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    await expect(cycles).toHaveAttribute('data-lengths', '10.10.2.2.1.1')
    expect(characteristic(AD, P65.BE as number[], P65.CF as number[])).toBe('AD:10.10.2.2.1.1 BE:9.9.3.3.1.1 CF:13.13')
    await expect(page.getByTestId('cycle-diagram-hexagon')).toHaveAttribute('data-cycles', '(ace)(bfd)')
    await expect(page.getByTestId('crib-strip-v14')).toHaveAttribute('data-crash-count', '0')
    await expect(page.getByTestId('test-register-toy')).toHaveAttribute('data-live-count', '1')

    // picking a letter highlights its cycle; relabelling keeps the lengths
    await page.getByTestId('cycle-diagram-letter-D').press('Enter')
    await expect(cycles.locator('[data-highlight="true"]')).toHaveAttribute('data-cycle', 'dvpfkxgzyo')
    await page.getByTestId('lab-relabel').check()
    await expect(cycles).toHaveAttribute('data-lengths', '10.10.2.2.1.1')
    await expect(cycles).not.toHaveAttribute('data-cycles', '(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')

    // the 26-wire register: 1 or 25 live at the true position, all 26 at a false one
    const register = page.getByTestId('test-register-26')
    expect(['1', '25']).toContain(await register.getAttribute('data-live-count'))
    await page.getByTestId('bombe26-position').click()
    await expect(register).toHaveAttribute('data-live-count', '26')

    // the toy: a false hypothesis lights 7 of 8
    const toyTruth = await page.getByTestId('test-register-toy').getAttribute('data-live-wires')
    const other = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].find((l) => l !== toyTruth)!
    await page.getByTestId(`toy-hyp-${other}`).click()
    await expect(page.getByTestId('test-register-toy')).toHaveAttribute('data-live-count', '7')
  })

  test('CribStrip: the arrow keys move the crib and the crash count follows', async ({ page, stage }) => {
    await gotoApp(page, '/lab/viz', { stage })
    const strip = page.getByTestId('crib-strip')
    const slider = page.getByTestId('crib-strip-slider')
    await expect(strip).toHaveAttribute('data-offset', '0')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(strip).toHaveAttribute('data-offset', '1')
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await expect(strip).toHaveAttribute('data-offset', '1')
    await page.keyboard.press('End')
    const max = await strip.getAttribute('data-max-offset')
    await expect(strip).toHaveAttribute('data-offset', max!)
    await page.keyboard.press('Home')
    await expect(strip).toHaveAttribute('data-offset', '0')
    // the crash columns shown are the crashes the kit computes
    const crashCount = Number(await strip.getAttribute('data-crash-count'))
    await expect(strip.locator('[data-crash="true"]')).toHaveCount(crashCount)
  })

  test('MenuGraph: Enter adds an edge and the closure count updates', async ({ page, stage }) => {
    await gotoApp(page, '/lab/viz', { stage })
    const graph = page.getByTestId('menu-graph')
    await expect(graph).toHaveAttribute('data-closures', '0')
    await expect(graph).toHaveAttribute('data-edges', '9')
    for (const [pos, want] of [
      [10, '1'],
      [11, '2'],
      [12, '3'],
    ] as const) {
      await page.getByTestId(`menu-graph-add-${pos}`).focus()
      await page.keyboard.press('Enter')
      await expect(graph).toHaveAttribute('data-closures', want)
      // focus follows the link to its new "−" button instead of falling to <body>
      await expect(page.getByTestId(`menu-graph-remove-${pos}`)).toBeFocused()
    }
    await expect(graph).toHaveAttribute('data-loops', 'NST AKLT ATNCW')
    await expect(page.getByTestId('menu-graph-closures')).toContainText('Closures: 3')
    await page.getByTestId('menu-graph-remove-2').focus()
    await page.keyboard.press('Delete')
    await expect(graph).toHaveAttribute('data-closures', '2')
    await expect(page.getByTestId('menu-graph-add-2')).toBeFocused()
    await expect(page.getByTestId('menu-graph-closures')).toHaveText(
      'Closures: 2 — 11 links, 10 letters, 1 piece (links − letters + pieces = 2)')
  })

  test('getCatalogue(\'A\') builds in the browser in under 10 s', async ({ page, stage }) => {
    await gotoApp(page, '/lab/viz', { stage })
    const build = page.getByTestId('catalogue-build')
    const started = Date.now()
    await page.getByTestId('catalogue-build-button').click()
    await expect(build).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
    const wall = Date.now() - started
    const ms = Number(await build.getAttribute('data-ms'))
    test.info().annotations.push({ type: 'catalogue-build-ms', description: `${ms} ms in the page (${wall} ms wall)` })
    console.info(`[timing] getCatalogue('A') in the browser: ${ms} ms (${wall} ms wall)`)
    expect(ms).toBeLessThan(10_000)
    const histogram = page.getByTestId('catalogue-histogram')
    await expect(histogram).toHaveAttribute('data-entries', '105456')
    expect(Number(await build.getAttribute('data-candidates'))).toBeGreaterThan(0)
  })

  test('at 390 px the read-only, overflowing views are focusable scrollers and axe finds nothing', async ({
    page,
    stage,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoApp(page, '/lab/viz', { stage })
    await page.getByTestId('catalogue-build-button').click()
    await expect(page.getByTestId('catalogue-build')).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
    await page.getByText('Table view').click()
    const scrollers = ['crib-strip-rollback-scroller', 'wire-grid-26-scroller', 'menu-graph-16-drawing',
      'catalogue-histogram-scroller']
    for (const id of scrollers) {
      const el = page.getByTestId(id)
      const box = await el.evaluate((e) => ({
        scroll: e.scrollWidth,
        client: e.clientWidth,
        tab: (e as HTMLElement).tabIndex,
        role: e.getAttribute('role'),
      }))
      expect(box.scroll, `${id} overflows at 390 px`).toBeGreaterThan(box.client)
      expect(box, id).toMatchObject({ tab: 0, role: 'region' })
    }
    // the page itself never scrolls sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    // a keyboard-only learner can reach the off-screen crash columns of a read-only strip
    const strip = page.getByTestId('crib-strip-rollback-scroller')
    await strip.evaluate((e) => (e.scrollLeft = 0))
    await strip.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0)
    expect(Number(await page.getByTestId('crib-strip-rollback').getAttribute('data-crash-count'))).toBeGreaterThan(0)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes`)).toEqual([])
  })

  test('axe finds no violations on #/lab/viz', async ({ page, stage }) => {
    await gotoApp(page, '/lab/viz', { stage })
    await page.getByTestId('catalogue-build-button').click()
    await expect(page.getByTestId('catalogue-build')).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
    await page.getByTestId('bombe-run-button').click()
    await expect(page.getByTestId('bombe-run')).toHaveAttribute('data-true-found', 'true', { timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes`)).toEqual([])
  })
})
