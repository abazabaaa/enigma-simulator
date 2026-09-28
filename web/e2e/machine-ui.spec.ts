import AxeBuilder from '@axe-core/playwright'
import { createMachine, encipher, normalizeConfig, positionsToString, pressKey, type MachineConfigInput } from '../src/engine'
import { encodeConfig } from '../src/machine-ui/urlCodec'
import { expect, test } from './fixtures'
import { gotoApp } from './helpers/app'
import { enigma, openSandbox, pageOverflow, readings, setConfig, tabTo } from './helpers/machine'

const ADV: MachineConfigInput = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADV', plugboard: [] }

test.describe('machine UI', { tag: '@area:machine-ui' }, () => {
  test('keyboard only: Tab to key-A and press Enter; the lamp and __enigma agree', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await tabTo(page, 'key-A')
    await page.keyboard.press('Enter')
    const expected = pressKey(createMachine({ ...ADV, positions: 'AAA' }), 'A')
    await expect.poll(() => enigma(page).then((s) => s.lamp)).toBe(expected.output)
    await expect(page.getByTestId(`lamp-${expected.output}`)).toHaveAttribute('data-lit', 'true')
    const r = await readings(page)
    expect(r.litLamps).toEqual([expected.output])
    expect(r.announcer).toBe(`Rotors stepped to A A B; A lit ${expected.output}.`)
    // Space works too, and the focus stays on the key.
    await page.keyboard.press('Space')
    await expect.poll(() => enigma(page).then((s) => s.input)).toBe('AA')
    await expect(page.getByTestId('key-A')).toBeFocused()
  })

  test('physical typing HELLO equals the __enigma output', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await page.keyboard.type('hello')
    const expected = encipher(createMachine({ ...ADV, positions: 'AAA' }), 'HELLO').output
    await expect.poll(() => enigma(page).then((s) => [s.input, s.output])).toEqual(['HELLO', expected])
    expect(expected).toBe('ILBDA')
    await expect(page.getByTestId('tape-input')).toHaveText('HELLO')
    await expect(page.getByTestId('tape-output')).toHaveText(expected)
    // Typing into a text field is not a key press.
    await page.getByTestId('plug-input').fill('xy')
    await page.getByTestId('plug-input').press('z')
    expect((await enigma(page)).input).toBe('HELLO')
  })

  test('after touching a slider or a select, physical typing still presses keys', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await page.getByTestId('key-Q').click()
    await page.getByTestId('playback-scrub').focus()
    await page.keyboard.type('abc')
    await expect.poll(() => enigma(page).then((s) => s.input)).toBe('QABC')
    const speed = page.getByTestId('playback-speed')
    await speed.focus()
    await page.keyboard.type('id') // 'i' would jump the select to "Instant" by type-ahead
    await expect.poll(() => enigma(page).then((s) => s.input)).toBe('QABCID')
    await expect(speed).toHaveValue('1')
    await expect(page.getByTestId('tape-input')).toHaveText('QABCI D')
  })

  test('the announcer reads "Rotors stepped to A E W; Q lit E." exactly', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await setConfig(page, ADV)
    const expected = pressKey(createMachine(ADV), 'Q')
    expect(positionsToString(expected.state)).toBe('AEW')
    await page.getByTestId('key-Q').click()
    const announcer = page.getByTestId('announcer')
    await expect(announcer).toHaveText(`Rotors stepped to A E W; Q lit ${expected.output}.`)
    await expect(announcer).toHaveAttribute('role', 'status')
    await expect(announcer).toHaveAttribute('aria-live', 'polite')

    // Lamps hidden: the lamp is left out.
    await gotoApp(page, '/lab/stage?preset=wire&locks=lampsHidden', { stage })
    await setConfig(page, ADV)
    await page.getByTestId('key-Q').click()
    await expect(announcer).toHaveText('Rotors stepped to A E W; Q pressed.')
    await expect(page.locator('[data-testid^="lamp-"][data-lit="true"]')).toHaveCount(0)
    await expect(page.getByTestId('trace-row-10')).toHaveAttribute('data-output', '?')
  })

  test('switching to the M4 gives 13 trace rows', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await expect(page.locator('[data-testid^="trace-row-"]')).toHaveCount(11)
    await page.getByTestId('model-select').selectOption('M4')
    await expect(page.locator('[data-testid^="trace-row-"]')).toHaveCount(13)
    await expect(page.getByTestId('rotor-pos-greek')).toHaveAttribute('aria-valuetext', 'A')
    await expect(page.getByTestId('reflector-select')).toHaveValue('B-thin')
    await page.getByTestId('key-A').click()
    const s = await enigma(page)
    expect(s.config.model).toBe('M4')
    expect(s.lastTrace).toHaveLength(13)
    const stages = await page.locator('[data-testid^="trace-row-"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.stage))
    expect(stages).toEqual(s.lastTrace!.map((t) => t.stage))
    await expect(page.getByTestId('trace-row-12')).toHaveAttribute('data-output', s.lamp!)
    await expect(page.getByTestId('trace-row-12')).toHaveAttribute('data-lit', 'true')
  })

  test("the ring spinbutton shows '05', never a letter", async ({ page, stage }) => {
    await openSandbox(page, { stage })
    const ring = page.getByTestId('ring-right')
    await expect(ring).toHaveText('01')
    await ring.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp')
    await expect(ring).toHaveText('05')
    await expect(ring).toHaveAttribute('aria-valuetext', '05')
    await expect(ring).toHaveAttribute('role', 'spinbutton')
    const s = await enigma(page)
    expect(s.config.rings).toEqual(['A', 'A', 'E'])
    expect(s.positions).toBe('AAA') // the window letter is unchanged
    await expect(page.getByTestId('rotor-pos-right')).toHaveAttribute('aria-valuetext', 'A')
    for (const slot of ['left', 'middle', 'right']) await expect(page.getByTestId(`ring-${slot}`)).toHaveText(/^\d\d$/)
  })

  test('locks from #/lab/stage?locks=keyboard,positions disable the controls', async ({ page, stage }) => {
    await gotoApp(page, '/lab/stage?preset=pawls&locks=keyboard,positions', { stage })
    const keyA = page.getByTestId('key-A')
    await expect(keyA).toHaveAttribute('aria-disabled', 'true')
    await expect(keyA).toBeDisabled()
    await expect(page.getByTestId('keyboard')).toHaveAttribute('inert', '')
    for (const slot of ['left', 'middle', 'right']) {
      await expect(page.getByTestId(`rotor-pos-${slot}`)).toHaveAttribute('aria-disabled', 'true')
    }
    const before = await enigma(page)
    await page.getByTestId('rotor-pos-right').focus()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('b')
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.type('abc')
    const after = await enigma(page)
    expect(after.positions).toBe(before.positions)
    expect(after.input).toBe('')
    await expect(page.evaluate(() => window.__enigma!.pressKey('A'))).rejects.toThrow(/keyboard/)
    // Unlocked controls stay usable.
    await expect(page.getByTestId('rotor-select-right')).toBeEnabled()
  })

  test('the share URL restores the exact configuration on reload', async ({ page, context, stage }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openSandbox(page, { stage })
    await page.getByTestId('model-select').selectOption('M3')
    await page.getByTestId('rotor-select-middle').selectOption('VII')
    await page.getByTestId('reflector-select').selectOption('C')
    await page.getByTestId('ring-left').focus()
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown') // 01 → 20
    await page.getByTestId('rotor-pos-middle').focus()
    await page.keyboard.press('q')
    await page.getByTestId('plug-input').fill('AV bs')
    await page.getByTestId('plug-add').click()
    await expect(page.getByTestId('plug-pair-1')).toHaveAttribute('data-pair', 'BS')
    const set = await enigma(page)
    expect(set.config).toMatchObject({ model: 'M3', reflector: 'C', rings: ['T', 'A', 'A'], plugboard: ['AV', 'BS'] })
    expect(set.config.rotors[1]).toBe('VII')
    expect(set.positions).toBe('AQA')

    await page.getByTestId('share-link').click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(await page.getByTestId('share-url').inputValue())
    const k = new URLSearchParams(new URL(copied).hash.split('?')[1]).get('k')!
    expect(k).toBe(encodeConfig({ ...set.config, positions: ['A', 'Q', 'A'] }))

    // Typing does not change the link: it encodes where the tape began.
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.type('abc')
    await expect(page.getByTestId('share-url')).toHaveValue(copied)

    await page.goto('about:blank')
    await openSandbox(page, { stage, k })
    const loaded = await enigma(page)
    expect(loaded.config).toEqual(normalizeConfig({ ...set.config, positions: 'AQA' }))
    expect(loaded.positions).toBe('AQA')
    await expect(page.getByTestId('ring-left')).toHaveText('20')
    await expect(page.getByTestId('sandbox-notice')).toHaveCount(0)

    // An invalid k loads the default machine and says so.
    await openSandbox(page, { stage, k: 'I.B.I-I-III.01-01-01.AAA.' })
    await expect(page.getByTestId('sandbox-notice')).toContainText('not valid')
    expect((await enigma(page)).config).toMatchObject({ model: 'I', rotors: ['I', 'II', 'III'], positions: ['A', 'A', 'A'] })
  })

  test('tape round trip: the ciphertext typed back from the start gives the plaintext', async ({ page, context, stage }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openSandbox(page, { stage })
    await page.getByTestId('rotor-pos-left').focus()
    await page.keyboard.press('k') // start at KAA
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.type('attackatdawn')
    const typed = await enigma(page)
    expect(typed.input).toBe('ATTACKATDAWN')
    await expect(page.getByTestId('tape-input')).toHaveText('ATTAC KATDA WN')

    await page.getByTestId('tape-copy').click()
    await expect(page.getByTestId('tape-status')).toContainText('Copied')
    const cipher = await page.evaluate(() => navigator.clipboard.readText())
    expect(cipher.replace(/ /g, '')).toBe(typed.output)

    await page.getByTestId('tape-rewind').click()
    await expect.poll(() => enigma(page).then((s) => [s.input, s.positions])).toEqual(['', 'KAA'])

    await page.getByTestId('tape-paste').click()
    await expect.poll(() => enigma(page).then((s) => s.output)).toBe('ATTACKATDAWN')
    expect((await enigma(page)).input).toBe(typed.output)
    await expect(page.getByTestId('tape-output')).toHaveText('ATTAC KATDA WN')
  })

  test('axe finds no serious or critical issues (and no heading-order skip) on #/machine', async ({ page, stage }) => {
    await openSandbox(page, { stage })
    await page.getByTestId('plug-input').fill('AV')
    await page.getByTestId('plug-add').click()
    await page.getByTestId('key-Q').click()
    await page.getByTestId('plug-input').fill('AA')
    await page.getByTestId('plug-add').click() // an error in the alert region
    const results = await new AxeBuilder({ page }).analyze()
    const bad = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical' || v.id === 'heading-order')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5) }))
    expect(bad).toEqual([])
  })

  test('at 390×844 the page never scrolls sideways', async ({ page, stage }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSandbox(page, { stage })
    await page.getByTestId('key-Q').click()
    let o = await pageOverflow(page)
    expect(o.scrollWidth).toBeLessThanOrEqual(o.innerWidth)
    await page.getByTestId('model-select').selectOption('M4')
    await page.getByTestId('plug-input').fill('AB CD EF GH IJ KL MN OP QR ST UV WX YZ')
    await page.getByTestId('plug-add').click()
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.type('thequickbrownfoxjumpsoverthelazydog')
    o = await pageOverflow(page)
    expect(o.scrollWidth).toBeLessThanOrEqual(o.innerWidth)
    await gotoApp(page, '/lab/stage?preset=wire&model=M4', { stage })
    o = await pageOverflow(page)
    expect(o.scrollWidth).toBeLessThanOrEqual(o.innerWidth)

    // A long invalid k is shortened and wraps inside the notice.
    await openSandbox(page, { stage, k: 'X'.repeat(3000) })
    await expect(page.getByTestId('sandbox-notice')).toContainText('…')
    o = await pageOverflow(page)
    expect(o.scrollWidth).toBeLessThanOrEqual(o.innerWidth)

    // The sideways-scrolling stage stays accessible at this width.
    await openSandbox(page, { stage })
    await page.getByTestId('key-Q').click()
    const results = await new AxeBuilder({ page }).analyze()
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
    expect(bad).toEqual([])
  })
})
