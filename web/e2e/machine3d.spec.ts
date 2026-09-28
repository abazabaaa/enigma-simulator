import { STAGE_PRESETS, STAGE_PRESET_IDS, dimmedParts, type StagePresetId } from '../src/contracts/stage'
import type { ClientRect, Machine3DDebugApi, PointKind } from '../src/machine3d/debugApi'
import { makeLayout } from '../src/machine3d/layout'
import { frameShot } from '../src/machine3d/shots'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import type { Page } from '@playwright/test'

// The 3D machine (PR 06). State only, never pixels: window.__stage (contract), window.__enigma and,
// with ?e2e=1, window.__machine3d (src/machine3d/debugApi.ts) for the live scene.

const info = (page: Page) => page.evaluate(() => window.__stage!.info())
const stats = (page: Page) => page.evaluate(() => window.__stage!.stats())
type Api = Machine3DDebugApi

/** Calls window.__machine3d[method](...args) in the page. */
function m3d<K extends keyof Api>(page: Page, method: K, ...args: Parameters<Api[K]>): Promise<ReturnType<Api[K]>> {
  return page.evaluate(([m, a]) => (window.__machine3d![m] as (...x: unknown[]) => unknown)(...a), [method, args] as [
    K,
    unknown[],
  ]) as Promise<ReturnType<Api[K]>>
}

/** Wait until the 3D view has reported `focus`. */
async function reported3d(page: Page, focus: string) {
  await expect
    .poll(
      async () => {
        const i = await info(page)
        return `${i.renderer}:${i.focus}`
      },
      { timeout: 30_000 },
    )
    .toBe(`webgl2:${focus}`)
  return info(page)
}

/** Wait until nothing has needed a frame for `ms`. */
async function idleFor(page: Page, ms: number) {
  await expect
    .poll(() => page.evaluate(() => window.__machine3d?.idleMs() ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(ms)
}

const l3 = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })

/** Wait until the report, the scene's materials and the camera all show `preset` on `model`. */
async function settled(page: Page, preset: StagePresetId, model: 'I' | 'M4' | 'M3' = 'I') {
  const { focus } = STAGE_PRESETS[preset]
  await reported3d(page, focus)
  const expected = dimmedParts(focus, model)
  await expect
    .poll(async () => {
      const parts = await m3d(page, 'parts')
      const drawn = expected.filter((p) => parts.present.includes(p))
      return [...parts.dimmed].sort().join() === [...drawn].sort().join() && parts.present.length > 10
    })
    .toBe(true)
  await idleFor(page, 300)
  await expect.poll(() => m3d(page, 'camera').then((c) => c.settleFrames !== null)).toBe(true)
}

const overlap = (a: ClientRect, b: ClientRect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const inside = (c: ClientRect, p: { x: number; y: number }) =>
  p.x >= c.x - 0.5 && p.x <= c.x + c.w + 0.5 && p.y >= c.y - 0.5 && p.y <= c.y + c.h + 0.5
const boxInside = (c: ClientRect, b: ClientRect) => inside(c, b) && inside(c, { x: b.x + b.w, y: b.y + b.h })

/** The points a preset's shot must keep on screen. */
function framedKinds(preset: StagePresetId): { kind: PointKind; only?: string }[] {
  const d = STAGE_PRESETS[preset]
  switch (d.shot) {
    case 'overview':
    case 'front':
    case 'toy':
      return [
        { kind: 'key' },
        { kind: 'lamp' },
        { kind: 'window' },
        ...(d.plugboard ? [{ kind: 'socket' as const }] : []),
      ]
    case 'plugboard':
      return [{ kind: 'socket' }]
    case 'lampboard':
      return [{ kind: 'lamp' }]
    case 'rotors':
      return d.focus === 'pawls' ? [{ kind: 'window' }, { kind: 'pawl' }] : [{ kind: 'window' }]
    case 'rotor-layers':
      return [{ kind: 'window', only: 'right' }]
    case 'reflector':
      return [{ kind: 'reflector' }]
  }
}

test.describe('machine3d', { tag: '@3d' }, () => {
  test('renders WebGL 2 through SwiftShader and reports the GPU', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/lab/stage?preset=overview', { stage: '3d' })
    const i = await reported3d(page, 'overview')
    test.info().annotations.push({ type: 'gpu', description: i.gpu ?? 'none' })
    console.log(`__stage.info().gpu: ${i.gpu}`)
    expect(i.renderer).toBe('webgl2')
    expect(i.gpu).toMatch(/SwiftShader/i)
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', 'webgl2')
    await expect(page.getByTestId('machine3d')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('[data-testid="machine3d"] canvas')).toHaveCount(1)
  })

  test('every preset reports focus and dimmedParts, dims exactly those parts, within 120 draw calls', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    for (const model of ['I', 'M4'] as const) {
      for (const id of STAGE_PRESET_IDS) {
        await gotoApp(page, `/lab/stage?preset=${id}&model=${model}`, { stage: '3d', motion: 'reduce' })
        const { focus } = STAGE_PRESETS[id]
        const i = await reported3d(page, focus)
        const expected = dimmedParts(focus, model)
        expect(i.directive, `${id} on ${model}`).toEqual(STAGE_PRESETS[id])
        expect(i.dimmed, `${id} on ${model}`).toEqual(expected)
        // The live scene (its React tree commits on its own schedule): the materials of exactly
        // those parts are dimmed.
        await expect
          .poll(
            async () => {
              const parts = await m3d(page, 'parts')
              const drawn = expected.filter((p) => parts.present.includes(p))
              return [...parts.dimmed].sort().join() === [...drawn].sort().join() && parts.present.length > 10
            },
            { message: `${id} on ${model}: dimmed materials` },
          )
          .toBe(true)
        await idleFor(page, 200)
        const s = await stats(page)
        expect(s!.calls, `${id} on ${model}: draw calls`).toBeLessThanOrEqual(120)
        expect(s!.calls).toBeGreaterThan(10)
        // Positions are letters: no number beside a window letter; numbers only in the exploded view.
        for (const r of await m3d(page, 'rings')) {
          expect(r.windowNumber, `${id} on ${model}: a number beside the ${r.slot} window letter`).toBe(false)
          if (!STAGE_PRESETS[id].ringLayer)
            expect(r.digits, `${id} on ${model}: digits on the ${r.slot} ring`).toEqual([])
        }
      }
    }
  })

  test('the windows follow __enigma through 30 presses from ADU, double step included', async ({ page }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/lab/stage?preset=rotors', { stage: '3d' })
    await reported3d(page, 'rotor-stack')
    expect((await info(page)).windows).toBe('ADU')
    let doubleSteps = 0
    const step = (2 * Math.PI) / 26
    for (let i = 0; i < 30; i++) {
      const letter = 'ENIGMAREVEALSTHEDOUBLESTEPNOWX'[i]!
      await page.evaluate((l) => window.__enigma!.pressKey(l), letter)
      const state = await page.evaluate(() => window.__enigma!.getState())
      if (state.lastStepping?.doubleStep) doubleSteps++
      await expect.poll(async () => (await info(page)).windows, { timeout: 10_000 }).toBe(state.positions)
      // The rings in the scene show the same letters, at the matching angles.
      await expect
        .poll(async () => {
          const rotors = await m3d(page, 'rotors')
          const letters = rotors.map((r) => String.fromCharCode(65 + r.window)).join('')
          const turned = rotors.every((r) => Math.abs(r.ringAngle - r.window * step) < 1e-6)
          return turned ? letters : `${letters} (turning)`
        })
        .toBe(state.positions)
    }
    expect(doubleSteps).toBeGreaterThanOrEqual(1)
    // Let the last press finish: the lamp matches __enigma.
    const lamp = await page.evaluate(() => window.__enigma!.getState().lamp)
    await expect.poll(async () => (await info(page)).litLamp, { timeout: 10_000 }).toBe(lamp)
  })

  test('renders on demand only; geometries and textures stay put over 100 presses', async ({ page }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'reduce' })
    await reported3d(page, 'wire')
    await idleFor(page, 1500)
    const f0 = await m3d(page, 'frames')
    await idleFor(page, 2000)
    expect(await m3d(page, 'frames'), 'no frame while idle').toBe(f0)
    expect((await stats(page))!.framesWhileIdle).toBe(0)

    const press = async (l: string) => {
      const before = await m3d(page, 'frames')
      await page.evaluate((k) => window.__enigma!.pressKey(k), l)
      await expect.poll(() => m3d(page, 'frames')).toBeGreaterThan(before)
    }
    await press('A')
    await idleFor(page, 300)
    const base = (await stats(page))!
    expect(base.calls).toBeLessThanOrEqual(120)
    for (let i = 0; i < 100; i++) await press(String.fromCharCode(65 + ((i * 7) % 26)))
    await idleFor(page, 1500)
    const after = (await stats(page))!
    expect(after.geometries, 'geometries after 100 presses').toBe(base.geometries)
    expect(after.textures, 'textures after 100 presses').toBe(base.textures)
    expect(after.calls).toBeLessThanOrEqual(120)
    expect(after.framesWhileIdle).toBe(0)
  })

  test('a lost WebGL context falls back to the 2D view without a console error', async ({ page, allowContextLoss }) => {
    test.setTimeout(60_000)
    allowContextLoss()
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d' })
    await reported3d(page, 'wire')
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="machine3d"] canvas')!
      canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
    })
    // 'svg' once 04's Stage2D lands; 'placeholder' while Stage2D is the 02 stub.
    await expect.poll(async () => (await info(page)).renderer).toMatch(/^(svg|placeholder)$/)
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', /^(svg|placeholder)$/)
    await expect(page.locator('[data-testid="machine3d"]')).toHaveCount(0)
    expect(await page.evaluate(() => window.__contextLost)).toBeGreaterThanOrEqual(1)
    const i = await info(page)
    expect(i.focus).toBe('wire')
    expect(i.dimmed).toEqual(dimmedParts('wire', 'I'))
  })

  test('reduced motion cuts to a new shot; full motion flies there', async ({ page }) => {
    test.setTimeout(90_000)
    const arrived = (shot: string) => m3d(page, 'camera').then((c) => c.shot === shot && c.settleFrames !== null)
    for (const motion of ['reduce', 'full'] as const) {
      await gotoApp(page, '/lab/stage?preset=overview', { stage: '3d', motion })
      await reported3d(page, 'overview')
      await expect.poll(() => arrived('overview'), { timeout: 30_000 }).toBe(true)
      await page.getByTestId('preset-rotors').click()
      await reported3d(page, 'rotor-stack')
      await expect.poll(() => arrived('rotors'), { timeout: 30_000 }).toBe(true)
      const cam = await m3d(page, 'camera')
      expect(cam.shot).toBe('rotors')
      const canvas = await m3d(page, 'canvas')
      const shot = frameShot('rotors', l3, { aspect: canvas.w / canvas.h, focus: 'rotor-stack', labels: true })
      cam.position.forEach((v, k) => expect(v).toBeCloseTo([shot.position.x, shot.position.y, shot.position.z][k]!, 2))
      cam.target.forEach((v, k) => expect(v).toBeCloseTo([shot.target.x, shot.target.y, shot.target.z][k]!, 2))
      if (motion === 'reduce') expect(cam.settleFrames, 'a cut: the next frame is there').toBeLessThanOrEqual(1)
      else expect(cam.settleFrames, 'a flight takes several frames').toBeGreaterThan(3)
    }
  })

  test('a click on a 3D key presses it through the store, unless the keyboard is locked', async ({ page }) => {
    test.setTimeout(60_000)
    for (const locks of ['', '&locks=keyboard']) {
      await gotoApp(page, `/lab/stage?preset=type-a-word${locks}`, { stage: '3d', motion: 'reduce' })
      await reported3d(page, 'overview')
      await expect
        .poll(() => m3d(page, 'camera').then((c) => c.shot === 'front' && c.settleFrames !== null), { timeout: 30_000 })
        .toBe(true)
      const point = await m3d(page, 'keyPoint', 'Q')
      expect(point).not.toBeNull()
      await page.mouse.click(point!.x, point!.y)
      const expected = locks ? '' : 'Q'
      await expect.poll(() => page.evaluate(() => window.__enigma!.getState().input)).toBe(expected)
      if (!locks) {
        const lamp = await page.evaluate(() => window.__enigma!.getState().lamp)
        await expect.poll(async () => (await info(page)).litLamp).toBe(lamp)
      }
    }
  })

  test('rotor-layers shows the ring setting where the core index points: rings AAA and EEE differ clearly', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/lab/stage?preset=rotor-layers', { stage: '3d', motion: 'reduce' })
    await settled(page, 'rotor-layers')
    const right = async () => (await m3d(page, 'rings')).find((r) => r.slot === 'right')!
    const texts = async () => (await m3d(page, 'labels')).labels.map((l) => l.text)
    expect(await right()).toMatchObject({ ringSetting: '01', leader: true, windowNumber: false })
    expect(await texts()).toContain('ring 01')
    const index0 = (await m3d(page, 'screenPoints', 'core-index')).right!
    const core0 = (await m3d(page, 'rotors'))[2]!.coreAngle
    await page.evaluate(() => window.__enigma!.setConfig({ rings: 'EEE' }))
    await expect.poll(async () => (await right()).ringSetting).toBe('05')
    await idleFor(page, 300)
    expect((await info(page)).windows).toBe('ADU')
    expect(await texts()).toContain('ring 05')
    const index1 = (await m3d(page, 'screenPoints', 'core-index')).right!
    const moved = Math.hypot(index1.x - index0.x, index1.y - index0.y)
    test.info().annotations.push({ type: 'core index moved', description: `${moved.toFixed(0)} px` })
    expect(moved, 'the core index moves visibly between rings 01 and 05').toBeGreaterThan(40)
    expect((await m3d(page, 'rotors'))[2]!.coreAngle).toBeCloseTo(core0 - (4 * 2 * Math.PI) / 26, 6)
  })

  test('pawls: pawl and notch labels stay clear of each other and of the pawl–notch contacts at ADV, AEW and BFX', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await gotoApp(page, '/lab/stage?preset=pawls', { stage: '3d', motion: 'reduce' })
      await page.evaluate(() => window.__enigma!.reset())
      await expect.poll(async () => (await info(page)).windows).toBe('ADU')
      await settled(page, 'pawls')
      for (const windows of ['ADV', 'AEW', 'BFX']) {
        await page.evaluate(() => window.__enigma!.pressKey('A'))
        await expect.poll(async () => (await info(page)).windows).toBe(windows)
        await idleFor(page, 300)
        const where = `${windows} at ${viewport.width} px`
        const canvas = await m3d(page, 'canvas')
        const { labels, keepOut } = await m3d(page, 'labels')
        const mechanism = labels.filter((l) => /^(pawl|notch)-/.test(l.key))
        expect(mechanism.map((l) => l.key).sort(), where).toEqual([
          'notch-left',
          'notch-middle',
          'notch-right',
          'pawl-left',
          'pawl-middle',
          'pawl-right',
        ])
        expect(keepOut, where).toHaveLength(6)
        mechanism.forEach((a, i) => {
          expect(boxInside(canvas, a), `${where}: ${a.key} inside the canvas`).toBe(true)
          mechanism.slice(i + 1).forEach((b) => expect(overlap(a, b), `${where}: ${a.key} on ${b.key}`).toBe(false))
          keepOut.forEach((k) => expect(overlap(a, k), `${where}: ${a.key} on a pawl–notch contact`).toBe(false))
        })
      }
    }
  })
})

test.describe('machine3d on a phone (390 × 844)', { tag: '@3d' }, () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('every preset keeps its parts and labels inside the canvas, on the I, the M4 and the 8-letter toy', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const cases: { preset: StagePresetId; q: string; model: 'I' | 'M4' }[] = [
      ...(['I', 'M4'] as const).flatMap((model) =>
        STAGE_PRESET_IDS.map((preset) => ({ preset, q: `&model=${model}`, model })),
      ),
      { preset: 'toy', q: '&toy=8', model: 'I' },
    ]
    for (const { preset, q, model } of cases) {
      await gotoApp(page, `/lab/stage?preset=${preset}${q}`, { stage: '3d', motion: 'reduce' })
      await settled(page, preset, model)
      const where = `${preset}${q}`
      const canvas = await m3d(page, 'canvas')
      for (const { kind, only } of framedKinds(preset)) {
        const points = await m3d(page, 'screenPoints', kind)
        const names = Object.keys(points).filter((k) => !only || k === only)
        expect(names.length, `${where}: ${kind} points`).toBeGreaterThan(0)
        for (const name of names) {
          expect(inside(canvas, points[name]!), `${where}: ${kind} ${name} at ${JSON.stringify(points[name])}`).toBe(
            true,
          )
        }
      }
      for (const label of (await m3d(page, 'labels')).labels) {
        expect(boxInside(canvas, label), `${where}: label ${label.text} inside the canvas`).toBe(true)
      }
    }
  })
})
