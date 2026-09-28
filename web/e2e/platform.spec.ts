import { ALL_PARTS, STAGE_PRESETS, STAGE_PRESET_IDS, dimmedParts } from '../src/contracts/stage'
import { MACHINE_3D_READY } from '../src/machine3d/ready'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import type { Page } from '@playwright/test'

// dimmedParts and STAGE_PRESETS are imported IN NODE from the pure src/contracts/stage.ts: the page
// must report exactly what the contract computes.

const info = (page: Page) => page.evaluate(() => window.__stage!.info())

/** Wait until the mounted view has reported for `focus`. */
async function reported(page: Page, focus: string) {
  await expect.poll(async () => (await info(page)).focus).toBe(focus)
  return info(page)
}

test.describe('platform', { tag: '@platform' }, () => {
  test('#/lab/stage?preset=pawls reports the 2D view, directive and contract dimming', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=pawls', { stage })
    const i = await reported(page, 'pawls')
    // 'placeholder' while Stage2D is the 02 stub; 'svg' once 04's view lands.
    expect(['placeholder', 'svg']).toContain(i.renderer)
    if (i.renderer === 'placeholder') await expect(page.getByTestId('stage-placeholder')).toBeVisible()
    expect(i.directive).toEqual(STAGE_PRESETS.pawls)
    expect(i.dimmed).toEqual(dimmedParts('pawls', 'I'))
    await expect(page.getByTestId('stage')).toHaveAttribute('data-focus', 'pawls')
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', i.renderer)
    expect(await page.evaluate(() => window.__stage!.stats())).toBeNull()
  })

  test('every preset reports its focus and dimmedParts, on the I and the M4', async ({ page, stage }) => {
    for (const model of ['I', 'M4'] as const) {
      for (const id of STAGE_PRESET_IDS) {
        await gotoApp(page, `/lab/stage?preset=${id}&model=${model}`, { stage })
        const { focus } = STAGE_PRESETS[id]
        const i = await reported(page, focus)
        expect(i.directive, `${id} on ${model}`).toEqual(STAGE_PRESETS[id])
        expect(i.dimmed, `${id} on ${model}`).toEqual(dimmedParts(focus, model))
      }
    }
    expect(ALL_PARTS('M4')).toContain('rotor-greek')
  })

  test('&locks=keyboard makes __enigma.pressKey reject, naming the lock', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire&locks=keyboard,positions', { stage })
    await expect.poll(() => page.evaluate(() => window.__enigma!.getState().positions)).toBe('ADU')
    await expect(page.evaluate(() => window.__enigma!.pressKey('A'))).rejects.toThrow(/keyboard/)
    const s = await page.evaluate(() => window.__enigma!.getState())
    expect(s).toMatchObject({ positions: 'ADU', input: '', lamp: null })
  })

  test('a press plays through the stage: lamp, windows and hop agree with __enigma', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire', { stage })
    await reported(page, 'wire')
    const lamp = await page.evaluate(() => window.__enigma!.pressKey('A'))
    const state = await page.evaluate(() => window.__enigma!.getState())
    expect(state.lastStepping).toMatchObject({ before: 'ADU', after: 'ADV' })
    // Reduced motion (the 2d project) makes playback instant.
    await expect.poll(async () => (await info(page)).litLamp).toBe(lamp)
    const i = await info(page)
    expect(i).toMatchObject({ windows: 'ADV', hop: 10, t: 12, seq: 1 })
    const playback = await page.evaluate(() => window.__stage!.playback())
    expect(playback).toEqual({ t: 12, hops: 11, seq: 1, playing: false, gated: false })
  })

  test('with full motion the clock animates the press to the lamp', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire', { stage, motion: 'full' })
    await reported(page, 'wire')
    await page.evaluate(() => window.__enigma!.pressKey('A'))
    const first = await page.evaluate(() => window.__stage!.playback())
    expect(first.t).toBeLessThan(12)
    // 400 ms stepping + 11 × 150 ms hops at speed 1.
    await expect.poll(() => page.evaluate(() => window.__stage!.playback()), { timeout: 10_000 }).toMatchObject({
      t: 12,
      playing: false,
    })
    expect((await info(page)).litLamp).toBe(await page.evaluate(() => window.__enigma!.getState().lamp))
  })

  test('&locks=hold encodes without stepping', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=rotors&locks=hold', { stage })
    await reported(page, 'rotor-stack')
    await page.evaluate(() => [...'ABC'].forEach((l) => window.__enigma!.pressKey(l)))
    expect(await page.evaluate(() => window.__enigma!.getState())).toMatchObject({
      positions: 'ADU',
      input: 'ABC',
      lastStepping: { before: 'ADU', after: 'ADU', doubleStep: false },
    })
  })

  test('ghost=demo and toy=8 reach the stage', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire&ghost=demo', { stage })
    await expect.poll(async () => (await info(page)).ghost).toBe(true)

    await gotoApp(page, '/lab/stage?preset=toy&toy=8', { stage })
    await expect.poll(async () => (await info(page)).directive?.source).toBe('toy')
    await page.getByTestId('toy-key-C').click()
    await expect.poll(async () => (await info(page)).litLamp).toMatch(/^[A-H]$/)
    expect((await info(page)).windows).toMatch(/^[A-H]{3}$/)
  })

  test('the key-space line is computed by lib/keyspace', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage', { stage })
    await expect(page.getByTestId('keyspace')).toContainText('1.59 × 10²⁰')
  })
})

test.describe('platform 3D', { tag: ['@platform', '@3d'] }, () => {
  test('?stage=3d without the 3D view still renders the 2D placeholder', async ({ page }) => {
    test.skip(MACHINE_3D_READY, 'the 3D view exists: machine3d.spec covers ?stage=3d')
    await gotoApp(page, '/lab/stage?preset=pawls', { stage: '3d' })
    const i = await reported(page, 'pawls')
    expect(['placeholder', 'svg']).toContain(i.renderer)
    expect(i.dimmed).toEqual(dimmedParts('pawls', 'I'))
    await expect(page.locator('canvas')).toHaveCount(0)
  })
})
