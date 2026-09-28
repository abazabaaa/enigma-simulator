import { ALL_PARTS, STAGE_PRESETS, STAGE_PRESET_IDS, dimmedParts } from '../src/contracts/stage'
import type { ModelName } from '../src/engine'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { enigma, playback, stageInfo } from './helpers/machine'

/**
 * Stage2D on #/lab/stage (PLAN §2.6, G11): every preset reports renderer 'svg', the preset's focus
 * and exactly dimmedParts(focus, model) — imported here in Node from the same pure contract — and
 * reduced motion makes the playback clock jump to the end.
 */

test.describe('Stage2D', { tag: '@area:machine-ui' }, () => {
  for (const model of ['I', 'M4'] as const satisfies readonly ModelName[]) {
    test(`every preset reports svg, its focus and dimmedParts (${model})`, async ({ page, stage }) => {
      for (const id of STAGE_PRESET_IDS) {
        await gotoApp(page, `/lab/stage?preset=${id}&model=${model}`, { stage })
        const { focus, source } = STAGE_PRESETS[id]
        const host = page.getByTestId('stage')
        await expect(host).toHaveAttribute('data-renderer', 'svg')
        await expect(host).toHaveAttribute('data-focus', focus)
        await expect(page.getByTestId('stage-placeholder')).toHaveCount(0)
        await expect.poll(() => stageInfo(page).then((i) => i.directive?.focus), id).toBe(focus)
        const info = await stageInfo(page)
        expect(info.renderer, id).toBe('svg')
        expect(info.focus, id).toBe(focus)
        expect(info.dimmed, id).toEqual(dimmedParts(focus, model))
        // A toy preset shows the toy's windows (the dimming still follows the machine's model).
        if (source === 'machine') expect(info.windows, id).toBe((await enigma(page)).positions)
        else expect(info.windows, id).toMatch(/^[A-F]{2}$/)
        // The drawing dims exactly the reported parts (a toy draws only its own 1–3 rotors).
        const drawn = await page
          .locator('[data-testid="stage2d"] [data-part]')
          .evaluateAll((gs) => gs.map((g) => [(g as SVGGElement).dataset.part!, (g as SVGGElement).dataset.dimmed === 'true'] as const))
        for (const [part, dim] of drawn) expect(dim, `${id} ${part}`).toBe(info.dimmed.includes(part as never))
        if (source === 'machine') expect(drawn.map(([part]) => part).sort(), id).toEqual([...ALL_PARTS(model)].sort())
      }
    })
  }

  test('a toy stage and a ghost report as well', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=toy&toy=8', { stage })
    await expect.poll(() => stageInfo(page).then((i) => i.renderer)).toBe('svg')
    let info = await stageInfo(page)
    expect(info).toMatchObject({ focus: 'wire', dimmed: dimmedParts('wire', 'I'), litLamp: null })
    expect(info.windows).toMatch(/^[A-H]{3}$/)
    await page.getByTestId('toy-key-C').click()
    await expect.poll(() => stageInfo(page).then((i) => i.litLamp)).toMatch(/^[A-H]$/)
    info = await stageInfo(page)
    expect(info.pathPoints).toBe(2 + 2 * 9) // 3 rotors: 9 hops (plug, 3 fwd, reflector, 3 bwd, plug)

    await gotoApp(page, '/lab/stage?preset=wire&ghost=demo', { stage })
    await expect.poll(() => stageInfo(page).then((i) => i.ghost)).toBe(true)
    await expect(page.getByTestId('stage2d-ghost')).toHaveCount(1)
    await expect(page.getByTestId('stage2d-reference')).toHaveCount(1)
  })

  test('a press reports the lamp, the windows, the last hop and the whole path', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire', { stage })
    await page.getByTestId('key-A').click()
    const s = await enigma(page)
    await expect.poll(() => stageInfo(page).then((i) => i.litLamp)).toBe(s.lamp)
    const info = await stageInfo(page)
    expect(info).toMatchObject({ windows: s.positions, hop: 10, pathPoints: 24 })
    await expect(page.getByTestId('stage2d-path')).toHaveAttribute('data-points', '24')
  })

  test('reduced motion makes t jump to the end; full motion animates', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=wire', { stage, motion: 'reduce' })
    await page.getByTestId('playback-speed').selectOption('0.25')
    await page.getByTestId('key-E').click()
    const reduced = await playback(page)
    expect(reduced).toMatchObject({ t: 1 + reduced.hops, playing: false })
    expect(reduced.hops).toBe(11)
    expect((await stageInfo(page)).litLamp).toBe((await enigma(page)).lamp)

    await gotoApp(page, '/lab/stage?preset=wire', { stage, motion: 'full' })
    await page.getByTestId('playback-speed').selectOption('0.25')
    await page.getByTestId('key-E').click()
    const moving = await playback(page)
    expect(moving.playing).toBe(true)
    expect(moving.t).toBeLessThan(1 + moving.hops)
    expect((await stageInfo(page)).litLamp).toBeNull()
    // Speed 'instant' finishes the running animation at once.
    await page.getByTestId('playback-speed').selectOption('instant')
    await expect.poll(() => playback(page)).toMatchObject({ t: 12, playing: false })
    await expect.poll(() => stageInfo(page).then((i) => i.litLamp)).toBe((await enigma(page)).lamp)
  })
})
