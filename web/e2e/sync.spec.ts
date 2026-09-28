import { LETTERS, createMachine, positionsToString, pressKey, type MachineConfig, type MachineState } from '../src/engine'
import { createRng, int, randomConfig } from '../src/lib/rng'
import { expect, test } from './fixtures'
import { expectInSync, openSandbox, readings, setConfig, setSpeed } from './helpers/machine'

/**
 * PLAN §2.5 sync check (04 runs it in 2D; 11 runs it again in 3D): at speed 'instant', 50 random
 * presses on each of 3 random configurations (Enigma I, M3, M4). After every press the lamp from
 * __enigma, the plugboard-out trace row, __stage.info().litLamp, the announcer and the windows
 * (spinbuttons, __stage.info().windows, __enigma positions) agree, and match the engine in Node.
 * Presses rotate between the DOM keys, physical keys and __enigma.pressKey: the one write path.
 */

const CONFIGS: readonly MachineConfig[] = (() => {
  const r = createRng(0x2_5)
  return [randomConfig(r, { model: 'I' }), randomConfig(r, { model: 'M3' }), randomConfig(r, { model: 'M4' })]
})()

const WAYS = ['click', 'keyboard', 'api'] as const

test.describe('sync', { tag: '@sync' }, () => {
  test('five readings agree over 50 random presses on 3 random configurations', async ({ page, stage }) => {
    // 150 presses, each read back in full: ~10 s on a quiet box, more on a loaded one (§7.1 budget 90 s).
    test.setTimeout(90_000)
    await openSandbox(page, { stage })
    await setSpeed(page, 'instant')
    await page.getByRole('heading', { level: 1 }).click() // focus off the speed select
    const r = createRng(0x5_c)

    for (const [c, config] of CONFIGS.entries()) {
      await setConfig(page, config)
      let machine: MachineState = createMachine(config)
      for (let i = 0; i < 50; i++) {
        const letter = LETTERS[int(r, 26)]!
        const way = WAYS[(i + c) % WAYS.length]!
        if (way === 'click') await page.getByTestId(`key-${letter}`).click()
        else if (way === 'keyboard') await page.keyboard.press(letter.toLowerCase())
        else await page.evaluate((l) => window.__enigma!.pressKey(l), letter)

        const expected = pressKey(machine, letter)
        machine = expected.state
        const context = `${config.model} ${c} press ${i} (${way} ${letter})`
        await expect(async () => {
          const got = await readings(page)
          expectInSync(got, context)
          expect(got.lamp, context).toBe(expected.output)
          expect(got.positions, context).toBe(positionsToString(expected.state))
          expect(got.traceRows, context).toBe(config.model === 'M4' ? 13 : 11)
        }).toPass({ timeout: 5_000 })
      }
    }
  })
})
