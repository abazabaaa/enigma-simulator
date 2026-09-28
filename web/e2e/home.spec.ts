/**
 * The guided home page #/ (PLAN §2.3, brief 09, @area:home): the whole machine with one thing to do (type a word),
 * typing lights lamps on the stage, the lid slider, the paper tape's round trip (clear and rewind, retype the
 * ciphertext), Begin to the Prologue, resume where the learner left off, the sandbox link and the course map.
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { configure, walkChapter, where } from './helpers/course'
import { START } from '../src/chapters/prologue/gates'
import { createMachine, encipher, pressKey } from '../src/engine'
import { MACHINE_3D_READY } from '../src/machine3d/ready'

const tape = async (page: Page, id: 'tape-input' | 'tape-output') => ((await page.getByTestId(id).textContent()) ?? '').replace(/\s/g, '')

async function typeKeys(page: Page, word: string): Promise<void> {
  for (const ch of word) await page.getByTestId(`key-${ch}`).click()
  await expect.poll(() => page.evaluate(() => window.__enigma!.getState().input)).toMatch(new RegExp(`${word}$`))
}

test.describe('home', { tag: '@area:home' }, () => {
  test('the guided entry: one hint, the whole machine; typing lights lamps on the stage; Begin opens the prologue', async ({
    page,
    stage,
  }) => {
    await gotoApp(page, '/', { stage })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Enigma')
    await expect(page.getByTestId('home-hint')).toHaveText('Type a word.')
    // The stage is the type-a-word preset: the front of the whole machine, nothing dimmed, keys live.
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.shot)).toBe('front')
    const info = await page.evaluate(() => window.__stage!.info())
    expect(info).toMatchObject({ focus: 'overview', dimmed: [], litLamp: null })
    expect(info.directive).toMatchObject({ interactive: true, trace: 'off', lid: 'closed' })
    // No bet, no lock: the first thing a visitor can do is type.
    expect(await page.evaluate(() => window.__stage!.playback().gated)).toBe(false)
    await expect(page.getByTestId('key-H')).toBeEnabled()
    await page.getByTestId('key-H').click()
    const lamp = pressKey(createMachine(START), 'H').output
    await expect.poll(() => page.evaluate(() => window.__stage!.info().litLamp)).toBe(lamp)
    await expect(page.getByTestId(`lamp-${lamp}`)).toHaveAttribute('data-lit', 'true')
    await expect(page.getByTestId('announcer')).toContainText(`H lights ${lamp}`)
    // The physical keyboard types too.
    await page.keyboard.press('i')
    await expect.poll(() => tape(page, 'tape-input')).toBe('HI')
    expect(await page.evaluate(() => window.__enigma!.getState().positions)).toBe('AAC')
    // The lid slider opens the case.
    await page.getByTestId('lid-slider').fill('1')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.lid)).toBe('open')
    // The way on: the course map, the sandbox, and (for a new learner) no resume.
    await expect(page.getByTestId('course-map')).toBeVisible()
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('home-sandbox')).toHaveAttribute('href', '#/machine')
    await expect(page.getByTestId('home-resume')).toHaveCount(0)
    await page.getByTestId('home-begin').click()
    await expect.poll(async () => (await where(page)).chapter).toBe('prologue')
    expect(await where(page)).toMatchObject({ scene: 'scherbius', index: 0 })
  })

  test('the round trip: type a word, clear and rewind the tape, type the ciphertext, and the word comes back', async ({ page, stage }) => {
    await gotoApp(page, '/', { stage })
    const note = page.getByTestId('home-roundtrip')
    await expect(note).toHaveAttribute('data-done', 'false')
    await typeKeys(page, 'ENIGMA')
    const cipher = encipher(createMachine(START), 'ENIGMA').output
    await expect.poll(() => tape(page, 'tape-output')).toBe(cipher)
    await expect(note).toContainText('Clear and rewind')
    await page.getByTestId('tape-rewind').click()
    await expect.poll(() => tape(page, 'tape-input')).toBe('')
    expect(await page.evaluate(() => window.__enigma!.getState().positions)).toBe('AAA')
    await expect(note).toContainText(cipher.match(/.{1,5}/g)!.join(' '))
    await typeKeys(page, cipher)
    await expect.poll(() => tape(page, 'tape-output')).toBe('ENIGMA')
    await expect(note).toHaveAttribute('data-done', 'true')
    await expect(note).toContainText('ENIGM A')
  })

  test('resume where you left off: after the prologue, Resume opens I.1 at the scene reached', async ({ page, stage }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/', { stage })
    await page.getByTestId('home-begin').click()
    await expect.poll(async () => (await where(page)).chapter).toBe('prologue')
    await configure(page, { minLatencyMs: 0, burstMs: 0, playback: 'instant' })
    await walkChapter(page)
    await page.getByTestId('chapter-next-link').click()
    await expect.poll(async () => (await where(page)).scene).toBe('knox')
    await page.getByTestId('scene-next').click()
    await expect.poll(async () => (await where(page)).scene).toBe('toy-wire')
    await gotoApp(page, '/', { stage })
    const resume = page.getByTestId('home-resume')
    await expect(resume).toHaveAttribute('data-chapter', 'i1-anatomy')
    await expect(resume).toContainText('scene 2')
    await expect(page.getByTestId('chapter-link-prologue')).toHaveAttribute('data-completed', 'true')
    await resume.click()
    await expect.poll(async () => (await where(page)).chapter).toBe('i1-anatomy')
    expect((await where(page)).scene).toBe('toy-wire')
  })
})

test.describe('home in 3D', { tag: ['@3d', '@area:home'] }, () => {
  test('the home stage is the 3D machine when WebGL 2 works, and typing lights a lamp', async ({ page }) => {
    test.skip(!MACHINE_3D_READY, 'the 3D machine is not ready')
    test.setTimeout(60_000)
    await gotoApp(page, '/', { stage: '3d' })
    await expect.poll(() => page.evaluate(() => window.__stage!.info().renderer), { timeout: 30_000 }).toBe('webgl2')
    expect(await page.evaluate(() => window.__stage!.info().dimmed)).toEqual([])
    await page.getByTestId('key-Q').click()
    const lamp = pressKey(createMachine(START), 'Q').output
    await expect.poll(() => page.evaluate(() => window.__stage!.info().litLamp), { timeout: 10_000 }).toBe(lamp)
    await page.getByTestId('lid-slider').fill('2')
    await expect.poll(() => page.evaluate(() => window.__stage!.info().directive?.lid)).toBe('cutaway')
  })
})
