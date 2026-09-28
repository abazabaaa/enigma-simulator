import type { Page } from '@playwright/test'
import { hopAt } from '../src/contracts/machine'
import { LETTERS, createMachine, normalizeConfig, pressKey, type Letter, type MachineConfigInput } from '../src/engine'
import { SYMBOL_COLORS, symForStage } from '../src/lib/symbols'
import { createRng, int, randomConfig } from '../src/lib/rng'
import { randomToy, toyPress } from '../src/lib/toy'
import type { Machine3DDebugApi } from '../src/machine3d/debugApi'
import { makeLayout, reflectorX, slotX } from '../src/machine3d/layout'
import type { SignalDebugApi } from '../src/machine3d/signal/debugApi'
import { encodeConfig } from '../src/machine-ui/urlCodec'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { expectInSync, openSandbox, readings, setConfig, setSpeed } from './helpers/machine'

// The 3D signal (PR 11): the glowing path drawn up to the playback time, the ghost against the
// reference, the reflector's arcs, the plug cables, the toys' wiring, Bloom and the M4. State only,
// never pixels: window.__stage (contract), __enigma, and with ?e2e=1 window.__machine3d and
// window.__machine3dSignal (src/machine3d/signal/debugApi.ts).

type Sig = SignalDebugApi
type M3d = Machine3DDebugApi

const info = (page: Page) => page.evaluate(() => window.__stage!.info())
const stats = (page: Page) => page.evaluate(() => window.__stage!.stats())
const enigma = (page: Page) => page.evaluate(() => window.__enigma!.getState())

function sig<K extends keyof Sig>(page: Page, method: K): Promise<ReturnType<Sig[K]>> {
  return page.evaluate((m) => (window.__machine3dSignal![m] as () => unknown)(), method) as Promise<ReturnType<Sig[K]>>
}
function m3d<K extends keyof M3d>(page: Page, method: K): Promise<ReturnType<M3d[K]>> {
  return page.evaluate((m) => (window.__machine3d![m] as () => unknown)(), method) as Promise<ReturnType<M3d[K]>>
}

/** e2e switch: mount Bloom whatever the renderer says (true), keep it off (false), or neither (null). */
const forceBloom = (page: Page, on: boolean | null) => page.evaluate((v) => window.__machine3dSignal!.forceBloom(v), on)

/** Wait until the 3D view reports and its signal hook is installed. */
async function ready3d(page: Page) {
  await expect
    .poll(
      async () => page.evaluate(() => `${window.__stage?.info().renderer}:${typeof window.__machine3dSignal?.live}`),
      { timeout: 30_000 },
    )
    .toBe('webgl2:function')
}

/** Wait until nothing has needed a frame for `ms`. */
async function idleFor(page: Page, ms: number) {
  await expect
    .poll(() => page.evaluate(() => window.__machine3d?.idleMs() ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(ms)
}

/** Press through __enigma and wait until its playback has finished. */
async function press(page: Page, letter: string) {
  await page.evaluate((l) => window.__enigma!.pressKey(l), letter)
  await expect.poll(() => page.evaluate(() => window.__stage!.playback().playing), { timeout: 15_000 }).toBe(false)
}

/** Scrub the playback clock through the DOM slider (it writes only t). */
async function scrub(page: Page, t: number) {
  await page.getByTestId('playback-scrub').fill(String(t))
  await expect.poll(() => page.evaluate(() => window.__stage!.playback().t)).toBeCloseTo(t, 6)
}

/**
 * Sets a playback control (speed select or scrub range) the way its change handler sees a user's
 * input, without scrolling it into view. A page scroll moves the canvas, and R3F renders a frame for
 * any change of its size state (top/left included) that the core's frame monitor (machine3d/monitor.ts)
 * does not mark as a change, so it would count as an idle frame; the stats test must not scroll.
 */
async function setControl(page: Page, testId: 'playback-speed' | 'playback-scrub', value: string) {
  await page.evaluate(
    ([id, v]) => {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`)!
      const select = el instanceof HTMLSelectElement
      const proto = select ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
      el.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }))
    },
    [testId, value] as const,
  )
}

const same = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-9)

const l3 = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })

test.describe('machine3d signal', { tag: ['@3d', '@area:machine3d-signal'] }, () => {
  test('the head advances with hop order 0…10 as the playback is scrubbed', async ({ page }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'full' })
    await ready3d(page)
    await press(page, 'A')
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)

    await scrub(page, 0.5) // the stepping phase: nothing drawn
    await expect.poll(async () => (await info(page)).pathPoints).toBe(2)
    expect((await info(page)).hop).toBe(-1)
    expect((await sig(page, 'live')).segments).toBe(0)
    expect((await sig(page, 'live')).head).toBeNull()

    const xs: number[] = []
    let prev = -1
    const trace = (await enigma(page)).lastTrace!
    const changes = trace.filter((h) => h.input !== h.output).length
    let changed = 0
    for (let k = 0; k < 11; k++) {
      await scrub(page, 1.5 + k)
      await expect.poll(async () => (await info(page)).hop, { message: `hop ${k}` }).toBe(k)
      await expect.poll(async () => (await sig(page, 'live')).drawn).toBe(k + 1)
      const i = await info(page)
      const live = await sig(page, 'live')
      expect(i.pathPoints, `hop ${k}`).toBe(2 + 2 * (k + 1))
      expect(live.pathPoints).toBe(i.pathPoints)
      expect(live.fraction, `hop ${k}`).toBeGreaterThan(live.anchorsU[2 * k]!)
      expect(live.fraction, `hop ${k}`).toBeLessThan(live.anchorsU[2 * k + 2]!)
      expect(live.fraction).toBeGreaterThan(prev)
      prev = live.fraction
      expect(live.head, `hop ${k}: the head shows`).not.toBeNull()
      expect(i.litLamp).toBeNull()
      xs.push(live.head![0])
      // the tag: the part (⁻¹ on the way back), its letters, and the count of letter changes
      const h = trace[k]!
      if (h.input !== h.output) changed++
      const back = h.stage === 'plugboard-out' || h.stage === 'etw-out' || h.stage.endsWith('-bwd')
      expect(live.tag, `hop ${k}: the tag`).toMatchObject({
        sym: symForStage(h.stage),
        inverse: back,
        input: h.input,
        output: h.output,
        changes,
        detail: h.input !== h.output ? `change ${changed} of ${changes}` : 'no change',
        color: SYMBOL_COLORS[symForStage(h.stage)].dark,
      })
    }
    // forward through the right, middle and left rotors the head moves left; back, it moves right
    expect(xs[3]!).toBeLessThan(xs[2]!)
    expect(xs[4]!).toBeLessThan(xs[3]!)
    expect(xs[7]!).toBeGreaterThan(xs[6]!)
    expect(xs[8]!).toBeGreaterThan(xs[7]!)
    // hop 5 is the reflector: left of the left rotor
    expect(xs[5]!).toBeLessThan(slotX(l3, 0) - 1)
    expect(xs[5]!).toBeLessThan(reflectorX(l3) + 1)

    await scrub(page, 12)
    const lamp = (await enigma(page)).lamp
    await expect.poll(async () => (await info(page)).litLamp).toBe(lamp)
    const live = await sig(page, 'live')
    expect(live.pathPoints).toBe(24)
    expect(live.segments).toBe(live.totalSegments)
    expect(live.head).toBeNull()
    expect(live.tag).toBeNull()
    expect(live.glow).toBe(true)
    expect(live.color).toBe(SYMBOL_COLORS.signal.dark)
  })

  test('3D sync: the 3D view, the trace panel and __enigma agree at sampled playback times', async ({ page }) => {
    test.setTimeout(120_000)
    await openSandbox(page, { stage: '3d', motion: 'full' })
    await ready3d(page)
    await setSpeed(page, 'instant')
    await page.getByRole('heading', { level: 1 }).click()
    const r = createRng(0x11)
    const configs = [
      randomConfig(r, { model: 'I' }),
      randomConfig(r, { model: 'M3' }),
      randomConfig(r, { model: 'M4' }),
    ]
    let presses = 0
    for (const config of configs) {
      await setConfig(page, config)
      for (let i = 0; i < 17; i++) {
        const letter = LETTERS[int(r, 26)]!
        await page.evaluate((l) => window.__enigma!.pressKey(l), letter)
        presses++
        const s = await enigma(page)
        const H = s.lastTrace!.length
        // The five end-of-press readings (PLAN §2.5) agree in 3D.
        await expect(async () => expectInSync(await readings(page), `${config.model} press ${i}`)).toPass({
          timeout: 5_000,
        })
        // Then one sampled playback time per press, rotating through the phases.
        const phase = presses % 5
        const t = [0.4, 1.3, 1 + Math.floor(H / 2) + 0.6, H + 0.5, 1 + H][phase]!
        await scrub(page, t)
        const hop = hopAt(t, H)
        const windows = t < 1 ? s.lastStepping!.before : s.positions
        await expect(async () => {
          const got = await page.evaluate(() => {
            const i = window.__stage!.info()
            const rows = [...document.querySelectorAll<HTMLElement>('[data-testid^="trace-row-"]')]
            return {
              hop: i.hop,
              windows: i.windows,
              litLamp: i.litLamp,
              pathPoints: i.pathPoints,
              rowsLit: rows.filter((e) => e.dataset.lit === 'true').length,
              stepLive: document.querySelector<HTMLElement>('[data-testid="trace-step"]')?.dataset.live,
              spin: [...document.querySelectorAll('[data-testid^="rotor-pos-"]')]
                .map((e) => e.getAttribute('aria-valuetext'))
                .join(''),
              rings: window
                .__machine3d!.rotors()
                .map((x) => String.fromCharCode(65 + x.window))
                .join(''),
              drawn: window.__machine3dSignal!.live().drawn,
              head: window.__machine3dSignal!.live().head !== null,
            }
          })
          expect(got, `${config.model} press ${i} at t = ${t}`).toEqual({
            hop,
            windows,
            litLamp: t >= 1 + H ? s.lamp : null,
            pathPoints: t < 1 ? 2 : 2 + 2 * (hop + 1),
            rowsLit: hop + 1,
            stepLive: t < 1 ? 'true' : 'false',
            spin: windows,
            rings: windows,
            drawn: t < 1 ? 0 : hop + 1,
            head: t >= 1 && t < 1 + H,
          })
        }).toPass({ timeout: 5_000 })
      }
    }
    expect(presses).toBe(51)
  })

  test('the ghost is red and dashed against the gold reference, and parts from it at divergeAt', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/lab/stage?preset=wire&ghost=demo', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    await expect.poll(async () => (await info(page)).ghost).toBe(true)
    await expect.poll(async () => (await sig(page, 'ghost')) !== null).toBe(true)
    const g = (await sig(page, 'ghost'))!
    expect(g.divergeAt).toBe(4)
    expect(g.ghostColor).toBe(SYMBOL_COLORS.ghost.dark)
    expect(g.referenceColor).toBe(SYMBOL_COLORS.reference.dark)
    expect(g.ghostColor).not.toBe(SYMBOL_COLORS.signal.dark)
    expect(g.dashed).toBe(true)
    expect(g.ghostAnchors).toHaveLength(24)
    expect(g.referenceAnchors).toHaveLength(24)
    // the same path up to the entry of hop divergeAt, where the marker sits; apart after it
    const at = 1 + 2 * g.divergeAt
    for (let i = 0; i <= at; i++) expect(same(g.ghostAnchors[i]!, g.referenceAnchors[i]!), `point ${i}`).toBe(true)
    expect(g.ghostAnchors.slice(at + 1).some((p, i) => !same(p, g.referenceAnchors[at + 1 + i]!))).toBe(true)
    expect(same(g.ghostAnchors[at + 1]!, g.referenceAnchors[at + 1]!), 'apart from the exit of hop divergeAt').toBe(false)
    expect(g.marker).toEqual(g.ghostAnchors[at])
    // no ghost, no ghost path
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'reduce' })
    await expect.poll(async () => (await info(page)).ghost).toBe(false)
    await expect.poll(() => sig(page, 'ghost')).toBeNull()
  })

  test('the reflector has 13 arcs and lights the pair the path uses; thin on the M4 (13 hops)', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/lab/stage?preset=reflector', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    const before = await sig(page, 'reflector')
    expect(before.arcs).toBe(13)
    expect(before.lit).toBeNull()
    expect(before.thin).toBe(false)
    await press(page, 'A')
    const trace = (await enigma(page)).lastTrace!
    const hop = trace.find((h) => h.kind === 'reflector')!
    const pair = [hop.input, hop.output].sort().join('')
    await expect.poll(async () => (await sig(page, 'reflector')).lit).toBe(pair)
    expect(before.pairs).toContain(pair)

    // M4 through the sandbox's share link: the Greek rotor, the thin reflector, 13 hops
    const m4: MachineConfigInput = {
      model: 'M4',
      reflector: 'C-thin',
      rotors: ['Gamma', 'VI', 'II', 'VIII'],
      rings: 'AEHZ',
      positions: 'QMRX',
      plugboard: 'AT BL DF QZ',
    }
    await openSandbox(page, { stage: '3d', k: encodeConfig(normalizeConfig(m4)), motion: 'reduce' })
    await ready3d(page)
    expect((await enigma(page)).config.model).toBe('M4')
    await press(page, 'E')
    await expect.poll(async () => (await info(page)).pathPoints).toBe(28)
    const i = await info(page)
    expect(i.hop).toBe(12)
    expect(i.litLamp).toBe((await enigma(page)).lamp)
    const live = await sig(page, 'live')
    expect(live.hops).toBe(13)
    expect(live.anchors).toHaveLength(28)
    expect(live.segments).toBe(live.totalSegments)
    const reflector = await sig(page, 'reflector')
    expect(reflector.thin).toBe(true)
    expect(reflector.width).toBe(0.6)
    expect(reflector.arcs).toBe(13)
    expect((await m3d(page, 'rotors')).map((r) => r.slot)).toEqual(['greek', 'left', 'middle', 'right'])
  })

  test('one cable per plug pair; the path crosses the plugboard twice and lights both cables', async ({ page }) => {
    test.setTimeout(60_000)
    const plugs = 'AV BS CG DL FU HZ IN KM OW RX'
    await gotoApp(page, '/lab/stage?preset=plugboard', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    await expect.poll(async () => (await sig(page, 'cables'))?.pairs).toEqual(['AV', 'BS', 'CG'])
    await setConfig(page, { plugboard: plugs })
    await expect.poll(async () => (await sig(page, 'cables'))?.pairs.length).toBe(10)
    expect((await sig(page, 'cables'))!.pairs.sort()).toEqual(plugs.split(' ').sort())
    // a key whose current crosses a cable on the way in and another on the way out
    const config = (await enigma(page)).config
    const m = createMachine(config)
    const key = LETTERS.find((l) => {
      const t = pressKey(m, l).trace
      return t[0]!.input !== t[0]!.output && t[t.length - 1]!.input !== t[t.length - 1]!.output
    }) as Letter
    const trace = pressKey(m, key).trace
    const expected = [trace[0]!, trace[trace.length - 1]!].map((h) => [h.input, h.output].sort().join(''))
    await press(page, key)
    await expect.poll(async () => (await sig(page, 'cables'))!.lit.sort()).toEqual([...new Set(expected)].sort())
    expect((await info(page)).pathPoints).toBe(24)
  })

  test('the toys (n = 6 and 8) render with their own wiring, and their paths have 2 + 2·hops points', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    for (const n of [6, 8] as const) {
      await gotoApp(page, `/lab/stage?preset=toy&toy=${n}`, { stage: '3d', motion: 'reduce' })
      await ready3d(page)
      await expect.poll(() => sig(page, 'toy')).toEqual({ n, wires: n, contacts: n, terminals: n })
      expect((await sig(page, 'reflector')).arcs).toBe(n / 2)
      const spec = randomToy(createRng(1), n, n === 6 ? 2 : 3)
      const expected = toyPress(spec, 'C')
      await page.getByTestId('toy-key-C').click()
      await expect.poll(async () => (await info(page)).pathPoints).toBe(2 + 2 * expected.hops.length)
      expect((await info(page)).litLamp).toBe(expected.lamp)
      const live = await sig(page, 'live')
      expect(live.hops).toBe(expected.hops.length)
      expect(live.anchors).toHaveLength(2 + 2 * expected.hops.length)
      expect(live.segments).toBe(live.totalSegments)
    }
    // the machine has no toy wiring
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    await expect.poll(() => sig(page, 'toy')).toBeNull()
  })

  test('reduced motion draws the whole path at once, without Bloom', async ({ page }) => {
    test.setTimeout(60_000)
    const chunks: string[] = []
    page.on('response', (res) => {
      if (/\/assets\/effects-[\w-]+\.js$/.test(res.url())) chunks.push(res.url())
    })
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    const first = await page.evaluate(() => {
      window.__enigma!.pressKey('W')
      return { pb: window.__stage!.playback() }
    })
    expect(first.pb.playing).toBe(false)
    expect(first.pb.t).toBe(1 + first.pb.hops)
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)
    const live = await sig(page, 'live')
    expect(live.segments).toBe(live.totalSegments)
    expect(live.head).toBeNull()
    // no Bloom under reduced motion, even when forced — and the effects chunk is never fetched (PR 17)
    await forceBloom(page, true)
    await page.evaluate(() => window.__enigma!.pressKey('V'))
    await idleFor(page, 500)
    expect((await sig(page, 'effects')).bloom).toBe(false)
    expect(chunks).toEqual([])
  })

  test('with the path, the head, the ghost and Bloom: ≤ 120 draw calls, no idle frames, steady memory', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const chunks: string[] = []
    page.on('response', (res) => {
      if (/\/assets\/effects-[\w-]+\.js$/.test(res.url())) chunks.push(res.url())
    })
    // The 2D view never loads the effects chunk (it is not in the entry).
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '2d' })
    await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', 'svg')
    expect(chunks).toEqual([])

    await page.goto('about:blank')
    await gotoApp(page, '/lab/stage?preset=wire&ghost=demo', { stage: '3d', motion: 'full' })
    await ready3d(page)
    // The effects chunk loads with the 3D view only where Bloom can mount (PR 17): a software rasterizer
    // (SwiftShader here and in CI) gets no Bloom by default and does not fetch the chunk; a GPU gets it at once.
    await expect
      .poll(
        async () => {
          const fx = await sig(page, 'effects')
          return fx.software || fx.bloom
        },
        { timeout: 30_000 },
      )
      .toBe(true)
    const policy = await sig(page, 'effects')
    expect(policy.bloom).toBe(!policy.software)
    expect(chunks).toHaveLength(policy.software ? 0 : 1)

    // The path drawn to hop 5 with its head, and the ghost: instant playback (no continuous
    // animation), then the scrubber, both set without scrolling the page (see setControl).
    await setControl(page, 'playback-speed', 'instant')
    await expect.poll(() => page.evaluate(() => window.__stage!.playback().playing)).toBe(false)
    await press(page, 'A')
    await setControl(page, 'playback-scrub', '6.5')
    await expect.poll(() => page.evaluate(() => window.__stage!.playback().t)).toBe(6.5)
    await expect.poll(async () => (await sig(page, 'live')).head).not.toBeNull()
    await idleFor(page, 1500)
    const s = (await stats(page))!
    expect(s.calls, 'draw calls with the signal, its head and the ghost').toBeLessThanOrEqual(120)
    expect(s.framesWhileIdle).toBe(0)
    const f0 = await m3d(page, 'frames')
    await idleFor(page, 2500)
    expect(await m3d(page, 'frames'), 'no frame while idle').toBe(f0)

    // 40 more presses: geometries and textures stay put, and still no idle frame
    await setControl(page, 'playback-scrub', '12')
    await idleFor(page, 1200)
    const base = (await stats(page))!
    for (let i = 0; i < 40; i++) {
      await page.evaluate((l) => window.__enigma!.pressKey(l), String.fromCharCode(65 + ((i * 11) % 26)))
    }
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)
    await idleFor(page, 1500)
    const after = (await stats(page))!
    expect(after.geometries, 'geometries after 40 presses').toBe(base.geometries)
    expect(after.textures, 'textures after 40 presses').toBe(base.textures)
    expect(after.calls).toBeLessThanOrEqual(120)
    expect(after.framesWhileIdle).toBe(0)

    // With Bloom on (forced on a software rasterizer): still ≤ 120 draw calls and no frame while
    // idle. (Its frames can take over a second here, which the core's monitor would count as idle
    // frames although each was asked for, so this checks the frame count over an idle spell.)
    await forceBloom(page, true)
    await expect.poll(async () => (await sig(page, 'effects')).bloom, { timeout: 30_000 }).toBe(true)
    expect(chunks, 'forcing Bloom fetches the effects chunk once').toHaveLength(1)
    expect(await sig(page, 'effects')).toEqual({
      bloom: true,
      luminanceThreshold: 1,
      mipmapBlur: true,
      dropped: false,
      software: policy.software,
    })
    await setControl(page, 'playback-scrub', '6.5')
    await expect.poll(async () => (await sig(page, 'live')).head).not.toBeNull()
    await idleFor(page, 1500)
    expect((await stats(page))!.calls, 'draw calls with Bloom').toBeLessThanOrEqual(120)
    const f1 = await m3d(page, 'frames')
    await idleFor(page, 2500)
    expect(await m3d(page, 'frames'), 'no frame while idle, with Bloom').toBe(f1)
    const withBloom = (await stats(page))!
    for (let i = 0; i < 10; i++) {
      await page.evaluate((l) => window.__enigma!.pressKey(l), String.fromCharCode(66 + ((i * 7) % 25)))
    }
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)
    await idleFor(page, 1500)
    expect((await sig(page, 'effects')).bloom, 'Bloom is still on').toBe(true)
    expect((await stats(page))!.geometries, 'geometries after 10 presses with Bloom').toBe(withBloom.geometries)
    expect((await stats(page))!.textures, 'textures after 10 presses with Bloom').toBe(withBloom.textures)
  })

  test('a lost WebGL context with the path and Bloom on still falls back to 2D', async ({ page, allowContextLoss }) => {
    test.setTimeout(60_000)
    allowContextLoss()
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'full' })
    await ready3d(page)
    await forceBloom(page, true)
    await expect.poll(async () => (await sig(page, 'effects')).bloom, { timeout: 30_000 }).toBe(true)
    await press(page, 'A')
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="machine3d"] canvas')!
      canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
    })
    await expect.poll(async () => (await info(page)).renderer).toBe('svg')
    await expect(page.locator('[data-testid="machine3d"]')).toHaveCount(0)
    // the 2D view shows the same press by the same rule
    await expect.poll(async () => (await info(page)).pathPoints).toBe(24)
    expect(await page.evaluate(() => window.__machine3dSignal)).toBeUndefined()
  })
})

test.describe('machine3d signal: review round 1', { tag: ['@3d', '@area:machine3d-signal'] }, () => {
  test('one part in focus: no see-through path; plugboard hidden: the crossed cable is drawn faintly', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    for (const [preset, xray] of [
      ['wire', true],
      ['reflector', false],
      ['plugboard', false],
    ] as const) {
      await gotoApp(page, `/lab/stage?preset=${preset}`, { stage: '3d', motion: 'reduce' })
      await ready3d(page)
      await press(page, 'A')
      await expect.poll(async () => (await sig(page, 'live')).segments > 0, { message: preset }).toBe(true)
      expect((await sig(page, 'live')).xray, preset).toBe(xray)
    }
    // wire-noplug: the demo plugs stay set; A runs along the AV cable, which is drawn faintly
    await gotoApp(page, '/lab/stage?preset=wire-noplug', { stage: '3d', motion: 'reduce' })
    await ready3d(page)
    expect(await sig(page, 'cables')).toBeNull()
    await expect.poll(async () => (await sig(page, 'faintCables'))?.pairs).toEqual(['AV', 'BS', 'CG'])
    await press(page, 'A')
    await expect.poll(async () => (await sig(page, 'faintCables'))?.shown).toContain('AV')
  })
})

test.describe('machine3d signal on a phone (390 × 844)', { tag: ['@3d', '@area:machine3d-signal'] }, () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the head stays at least 12 px across and carries its tag while the path is drawn', async ({ page }) => {
    test.setTimeout(90_000)
    await gotoApp(page, '/lab/stage?preset=wire', { stage: '3d', motion: 'full' })
    await ready3d(page)
    await setControl(page, 'playback-speed', 'instant')
    await press(page, 'Q')
    const trace = (await enigma(page)).lastTrace!
    const canvas = await m3d(page, 'canvas')
    for (const k of [2, 5, 8]) {
      await setControl(page, 'playback-scrub', String(1.5 + k))
      await expect.poll(async () => (await info(page)).hop).toBe(k)
      await expect.poll(async () => (await sig(page, 'live')).headPx, { message: `hop ${k}` }).toBeGreaterThan(0)
      const live = await sig(page, 'live')
      expect(live.headPx, `hop ${k}: head diameter`).toBeGreaterThanOrEqual(12)
      expect(live.tag, `hop ${k}: tag`).toMatchObject({ input: trace[k]!.input, output: trace[k]!.output })
      expect(live.tag!.px, `hop ${k}: tag height`).toBeGreaterThanOrEqual(30)
      expect(canvas.w).toBeLessThanOrEqual(390)
    }
  })
})
