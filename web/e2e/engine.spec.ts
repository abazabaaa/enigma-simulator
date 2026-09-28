import { expect, test, type Page } from '@playwright/test'
import type { MachineConfigInput } from '../src/engine'
import type { EnigmaSnapshot } from '../src/debug/windowApi'

const DEFAULT: MachineConfigInput = {
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
}

const THREE_ROTOR_STAGES = [
  'plugboard-in',
  'etw-in',
  'rotor-right-fwd',
  'rotor-middle-fwd',
  'rotor-left-fwd',
  'reflector',
  'rotor-left-bwd',
  'rotor-middle-bwd',
  'rotor-right-bwd',
  'etw-out',
  'plugboard-out',
]

const setConfig = (page: Page, config: Partial<MachineConfigInput>): Promise<EnigmaSnapshot> =>
  page.evaluate((cfg) => window.__enigma!.setConfig(cfg), config)

const getState = (page: Page): Promise<EnigmaSnapshot> => page.evaluate(() => window.__enigma!.getState())

test.beforeEach(async ({ page }) => {
  await page.goto('./#/engine')
  await page.waitForFunction(() => window.__enigma?.version === 1)
  await expect(page.getByRole('heading', { name: 'Engine dev page' })).toBeVisible()
})

test('window.__enigma enciphers AAAAA -> BDZGO and reports the state', async ({ page }) => {
  const initial = await setConfig(page, DEFAULT)
  expect(initial).toMatchObject({ positions: 'AAA', input: '', output: '', lamp: null, lastTrace: null })

  const lamps = await page.evaluate(() => ['A', 'A', 'A', 'A', 'A'].map((l) => window.__enigma!.pressKey(l)).join(''))
  expect(lamps).toBe('BDZGO')

  const state = await getState(page)
  expect(state).toMatchObject({ positions: 'AAF', input: 'AAAAA', output: 'BDZGO', lamp: 'O' })
  expect(state.lastTrace!.map((t) => t.stage)).toEqual(THREE_ROTOR_STAGES)
  expect(state.lastStepping).toMatchObject({ before: 'AAE', after: 'AAF', doubleStep: false })

  // The page renders the same store.
  await expect(page.getByTestId('output-tape')).toHaveText('BDZGO')
  await expect(page.getByTestId('positions')).toHaveText('AAF')
  await expect(page.getByTestId('lamp')).toHaveText('O')
})

test('window positions after each key press show the double step ADU -> ADV -> AEW -> BFX -> BFY', async ({ page }) => {
  await setConfig(page, { ...DEFAULT, positions: 'ADU' })
  const seen = await page.evaluate(() =>
    ['A', 'A', 'A', 'A'].map((l) => {
      window.__enigma!.pressKey(l)
      const s = window.__enigma!.getState()
      return `${s.positions}:${s.lastStepping!.doubleStep}`
    }),
  )
  expect(seen).toEqual(['ADV:false', 'AEW:false', 'BFX:true', 'BFY:false'])

  const reset = await page.evaluate(() => window.__enigma!.reset())
  expect(reset).toMatchObject({ positions: 'ADU', input: '', output: '' })
  await expect(page.getByTestId('positions')).toHaveText('ADU')
})

test('typing on the real keyboard lights the lamps', async ({ page }) => {
  await setConfig(page, DEFAULT)
  await page.keyboard.type('aaaaa')

  await expect(page.getByTestId('input-tape')).toHaveText('AAAAA')
  await expect(page.getByTestId('output-tape')).toHaveText('BDZGO')
  await expect(page.getByTestId('lamp')).toHaveText('O')
  await expect(page.getByTestId('lamp-O')).toHaveAttribute('data-lit', 'true')
  await expect(page.getByTestId('lamp-G')).toHaveAttribute('data-lit', 'false')
  await expect(page.getByTestId('positions')).toHaveText('AAF')
  await expect(page.getByTestId('trace')).toContainText('rotor-right-fwd')
  expect((await getState(page)).output).toBe('BDZGO')

  // Non-letters are ignored, like the real 26-key keyboard.
  await page.keyboard.type('1 -')
  expect((await getState(page)).input).toBe('AAAAA')
})

test('deciphers the Barbarossa message typed on the keyboard', async ({ page }) => {
  await setConfig(page, {
    model: 'I',
    reflector: 'B',
    rotors: ['II', 'IV', 'V'],
    rings: 'BUL',
    positions: 'BLA',
    plugboard: 'AV BS CG DL FU HZ IN KM OW RX',
  })
  await expect(page.getByTestId('config-plugboard')).toHaveText('AV BS CG DL FU HZ IN KM OW RX')
  await page.keyboard.type('EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZ')
  await expect(page.getByTestId('output-tape')).toHaveText('AUFKLXABTEILUNGXVONXKURTINOWAX')
})

test('drives the M4 and rejects invalid configurations', async ({ page }) => {
  await setConfig(page, {
    model: 'M4',
    reflector: 'B-thin',
    rotors: ['Beta', 'II', 'IV', 'I'],
    rings: 'AAAV',
    positions: 'VJNA',
    plugboard: 'AT BL DF GJ HM NW OP QY RZ VX',
  })
  const lamps = await page.evaluate(() => [...'NCZWVUSXPNYM'].map((l) => window.__enigma!.pressKey(l)).join(''))
  expect(lamps).toBe('VONVONJLOOKS')
  expect((await getState(page)).lastTrace).toHaveLength(13)

  const error = await page.evaluate(() => {
    try {
      window.__enigma!.setConfig({ model: 'I', rotors: ['I', 'I', 'VI'], rings: 'AAA', positions: 'AAA', reflector: 'B' })
      return null
    } catch (e) {
      return (e as Error).message
    }
  })
  expect(error).toMatch(/only once/)
  expect(error).toMatch(/Rotor VI cannot go/)
  expect((await getState(page)).config.model).toBe('M4') // unchanged
})

test('headless Chromium provides WebGL 2 (guards the future 3D chapters)', async ({ page }) => {
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    return gl ? String(gl.getParameter(gl.VERSION)) : null
  })
  expect(renderer).toContain('WebGL 2')
})

test('home page renders', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Enigma')
})
