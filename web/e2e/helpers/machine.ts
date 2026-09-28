/**
 * Helpers for the machine UI specs (PR 04): state through window.__enigma and window.__stage and
 * the DOM's data attributes, never pixels.
 */

import type { Page } from '@playwright/test'
import type { StageInfo } from '../../src/contracts/hooks'
import type { Speed } from '../../src/contracts/machine'
import type { EnigmaSnapshot } from '../../src/debug/windowApi'
import type { MachineConfigInput } from '../../src/engine'
import { expect } from '../fixtures'
import { gotoApp } from './app'

export const enigma = (page: Page): Promise<EnigmaSnapshot> => page.evaluate(() => window.__enigma!.getState())

export const stageInfo = (page: Page): Promise<StageInfo> => page.evaluate(() => window.__stage!.info())

export const playback = (page: Page) => page.evaluate(() => window.__stage!.playback())

/** The setup path (ignores locks): merge into the current config and reset. */
export const setConfig = (page: Page, config: Partial<MachineConfigInput>): Promise<EnigmaSnapshot> =>
  page.evaluate((c) => window.__enigma!.setConfig(c), config)

/** Open #/machine (optionally with k=) and wait for the machine and the 2D stage. */
export async function openSandbox(page: Page, o: { stage?: '2d' | '3d'; k?: string; motion?: 'reduce' | 'full' } = {}): Promise<void> {
  await gotoApp(page, o.k === undefined ? '/machine' : `/machine?k=${o.k}`, { stage: o.stage, motion: o.motion })
  await expect(page.getByTestId('key-A')).toBeVisible()
  await expect(page.getByTestId('stage')).toHaveAttribute('data-renderer', /svg|webgl2/)
}

export async function setSpeed(page: Page, speed: Speed): Promise<void> {
  await page.getByTestId('playback-speed').selectOption(String(speed))
  await expect(page.getByTestId('playback-speed')).toHaveValue(String(speed))
}

/** Everything that shows the last press, read in one go (PLAN §2.5 sync readings). */
export interface Readings {
  /** 1. __enigma.getState().lamp */
  readonly lamp: string | null
  /** 2. data-output of the last trace row (plugboard-out). */
  readonly traceOut: string | null
  readonly traceStage: string | null
  readonly traceRows: number
  /** 3. __stage.info().litLamp */
  readonly stageLamp: string | null
  /** 4. The lamp letter in the announcer. */
  readonly announcerLamp: string | null
  readonly announcer: string
  /** 5. The windows: spinbuttons joined, __stage.info().windows and __enigma positions. */
  readonly spin: string
  readonly stageWindows: string
  readonly positions: string
  /** The DOM lamps that are lit. */
  readonly litLamps: readonly string[]
  readonly t: number
  readonly hops: number
}

export function readings(page: Page): Promise<Readings> {
  return page.evaluate(() => {
    const s = window.__enigma!.getState()
    const info = window.__stage!.info()
    const pb = window.__stage!.playback()
    const rows = [...document.querySelectorAll<HTMLElement>('[data-testid^="trace-row-"]')]
    const last = rows[rows.length - 1]
    const announcer = document.querySelector('[data-testid="announcer"]')?.textContent ?? ''
    const spin = [...document.querySelectorAll('[data-testid^="rotor-pos-"]')].map((e) => e.getAttribute('aria-valuetext')).join('')
    const litLamps = [...document.querySelectorAll<HTMLElement>('[data-testid^="lamp-"][data-lit="true"]')].map((e) =>
      e.dataset.testid!.slice('lamp-'.length),
    )
    return {
      lamp: s.lamp,
      traceOut: last?.dataset.output ?? null,
      traceStage: last?.dataset.stage ?? null,
      traceRows: rows.length,
      stageLamp: info.litLamp,
      announcerLamp: /^[A-Z] lights ([A-Z])\./.exec(announcer)?.[1] ?? null,
      announcer,
      spin,
      stageWindows: info.windows,
      positions: s.positions,
      litLamps,
      t: pb.t,
      hops: pb.hops,
    }
  })
}

/** The five readings of the sync spec agree (and the press has finished playing). */
export function expectInSync(r: Readings, context = ''): void {
  expect(r.lamp, `${context} __enigma lamp`).toMatch(/^[A-Z]$/)
  expect(r.t, `${context} t at the end`).toBe(1 + r.hops)
  expect(
    {
      trace: r.traceOut,
      traceStage: r.traceStage,
      stage: r.stageLamp,
      announcer: r.announcerLamp,
      domLamps: r.litLamps,
      spin: r.spin,
      stageWindows: r.stageWindows,
    },
    context,
  ).toEqual({
    trace: r.lamp,
    traceStage: 'plugboard-out',
    stage: r.lamp,
    announcer: r.lamp,
    domLamps: [r.lamp],
    spin: r.positions,
    stageWindows: r.positions,
  })
}

/** Press Tab until the element with this test id has focus (at most `limit` presses). */
export async function tabTo(page: Page, testId: string, limit = 120): Promise<number> {
  for (let i = 1; i <= limit; i++) {
    await page.keyboard.press('Tab')
    const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? null)
    if (id === testId) return i
  }
  throw new Error(`Tab never reached ${testId}`)
}

/** The page has no horizontal scroll. */
export const pageOverflow = (page: Page) =>
  page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
