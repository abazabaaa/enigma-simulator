// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEYBOARD_ROWS, createMachine, pressKey, positionsToString, type MachineConfigInput } from '../../engine'
import { useMachineStore } from '../../state/machineStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { Announcer } from '../Announcer'
import { Keyboard, isTextEntry } from '../Keyboard'
import { Lampboard } from '../Lampboard'
import { MachinePanel } from '../MachinePanel'
import { PermTable } from '../PermTable'
import { PlaybackBar, hopStops, nextStop } from '../PlaybackBar'
import { PlugboardEditor, parsePairs } from '../PlugboardEditor'
import { RotorControls } from '../RotorControls'
import { TracePanel } from '../TracePanel'
import { RING_TYPING_MS } from '../RotorControls'
import { rewindTape, tapeStart, typeText } from '../tape'
import { PaperTape } from '../PaperTape'
import {
  allByTestId,
  byTestId,
  cleanup,
  click,
  keyDown,
  mount,
  resetStores,
  run,
  selectValue,
  submit,
  typeInto,
} from './dom'

const ADU: MachineConfigInput = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU' }
const store = () => useMachineStore.getState()

beforeEach(() => resetStores())
afterEach(() => cleanup())

describe('Keyboard', () => {
  it('has 26 key buttons in the QWERTZ rows that press the store', () => {
    mount(<Keyboard />)
    const keys = allByTestId(/^key-[A-Z]$/)
    expect(keys.map((k) => k.textContent).join('')).toBe(KEYBOARD_ROWS.flat().join(''))
    expect(keys.every((k) => k.tagName === 'BUTTON')).toBe(true)
    click(byTestId('key-A'))
    expect(store().input).toBe('A')
  })

  it('is aria-disabled and inert while locks.keyboard is set, and ignores clicks and physical keys', () => {
    mount(<Keyboard />)
    run(() => store().setLocks({ keyboard: true }))
    for (const k of allByTestId(/^key-[A-Z]$/)) expect(k.getAttribute('aria-disabled')).toBe('true')
    expect(byTestId('keyboard').hasAttribute('inert')).toBe(true)
    click(byTestId('key-A'))
    keyDown(document.body, 'b')
    expect(store().input).toBe('')

    run(() => store().setLocks({}))
    expect(byTestId('key-A').hasAttribute('aria-disabled')).toBe(false)
    expect(byTestId('keyboard').hasAttribute('inert')).toBe(false)
    click(byTestId('key-A'))
    expect(store().input).toBe('A')
  })

  it('types physical letters A–Z, but not in text fields, with modifiers or on repeat', () => {
    mount(<Keyboard />)
    const text = document.createElement('input')
    document.body.appendChild(text)
    keyDown(document.body, 'h')
    keyDown(document.body, 'I')
    keyDown(text, 'x')
    keyDown(document.body, 'y', { ctrlKey: true })
    keyDown(document.body, 'z', { repeat: true })
    keyDown(document.body, '1')
    keyDown(document.body, 'Enter')
    expect(store().input).toBe('HI')
    text.remove()
  })

  it('presses once per physical key even with two keyboards mounted', () => {
    mount(
      <>
        <Keyboard />
        <Keyboard />
      </>,
    )
    keyDown(document.body, 'q')
    expect(store().input).toBe('Q')
  })
})

describe('Lampboard', () => {
  it('lights the lamp of the last press, and covers it under lampsHidden', () => {
    mount(<Lampboard />)
    run(() => store().pressKey('A'))
    const lamp = store().output
    expect(byTestId(`lamp-${lamp}`).dataset.lit).toBe('true')
    expect(allByTestId(/^lamp-/).filter((l) => l.dataset.lit === 'true')).toHaveLength(1)
    run(() => store().setLocks({ lampsHidden: true }))
    expect(allByTestId(/^lamp-/).filter((l) => l.dataset.lit === 'true')).toHaveLength(0)
    expect(byTestId('lampboard').dataset.hidden).toBe('true')
  })

  it('waits for the playback clock: unlit during the animation, lit at its end', () => {
    mount(<Lampboard />)
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('A'))
    expect(allByTestId(/^lamp-/).filter((l) => l.dataset.lit === 'true')).toHaveLength(0)
    run(() => usePlaybackStore.getState().finish())
    expect(byTestId(`lamp-${store().output}`).dataset.lit).toBe('true')
  })
})

describe('RotorControls', () => {
  it("shows the ring as a number: ArrowUp ×4 from 01 gives '05', never the letter 'E'", () => {
    mount(<RotorControls rings rotorSelect />)
    const ring = byTestId('ring-right')
    expect(ring.getAttribute('role')).toBe('spinbutton')
    expect(ring.textContent).toBe('01')
    for (let i = 0; i < 4; i++) keyDown(ring, 'ArrowUp')
    expect(ring.textContent).toBe('05')
    expect(ring.getAttribute('aria-valuetext')).toBe('05')
    expect(ring.getAttribute('aria-valuenow')).toBe('5')
    expect(ring.textContent).not.toBe('E')
    expect(store().machine.config.rings).toEqual(['A', 'A', 'E'])
    // The window letter is untouched by the ring.
    expect(byTestId('rotor-pos-right').getAttribute('aria-valuetext')).toBe('A')
    // Two typed digits set a ring; Home/End go to 01/26.
    keyDown(ring, '1')
    keyDown(ring, '2')
    expect(ring.textContent).toBe('12')
    keyDown(ring, 'End')
    expect(ring.getAttribute('aria-valuetext')).toBe('26')
    keyDown(ring, 'ArrowUp')
    expect(ring.getAttribute('aria-valuetext')).toBe('01')
  })

  it('turns the windows with the arrows and typed letters, and locks them', () => {
    run(() => store().setConfig(ADU))
    mount(<RotorControls />)
    const right = byTestId('rotor-pos-right')
    expect(right.getAttribute('aria-valuetext')).toBe('U')
    keyDown(right, 'ArrowUp')
    expect(positionsToString(store().machine)).toBe('ADV')
    keyDown(right, 'ArrowDown')
    keyDown(right, 'ArrowDown')
    expect(right.getAttribute('aria-valuetext')).toBe('T')
    const typed = keyDown(byTestId('rotor-pos-left'), 'q')
    expect(typed.defaultPrevented).toBe(true)
    expect(positionsToString(store().machine)).toBe('QDT')
    expect(store().input).toBe('') // typing on a spinbutton is not a key press

    run(() => store().setLocks({ positions: true }))
    expect(right.getAttribute('aria-disabled')).toBe('true')
    keyDown(right, 'ArrowUp')
    expect(positionsToString(store().machine)).toBe('QDT')
  })

  it('shows stepping.before while t < 1 and the new windows after', () => {
    run(() => store().setConfig(ADU))
    mount(<RotorControls />)
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('Q'))
    const shown = () => ['left', 'middle', 'right'].map((s) => byTestId(`rotor-pos-${s}`).getAttribute('aria-valuetext')).join('')
    expect(shown()).toBe('ADU')
    run(() => usePlaybackStore.getState().scrub(1))
    expect(shown()).toBe('ADV')
  })

  it('filters rotor and reflector choices by model and swaps a rotor already in use', () => {
    mount(<RotorControls rotorSelect />)
    const opts = (id: string) => [...byTestId(id).querySelectorAll('option')].map((o) => o.value)
    expect(opts('rotor-select-left')).toEqual(['I', 'II', 'III', 'IV', 'V'])
    expect(opts('reflector-select')).toEqual(['A', 'B', 'C'])
    selectValue(byTestId('rotor-select-left') as HTMLSelectElement, 'III')
    expect(store().machine.config.rotors).toEqual(['III', 'II', 'I'])
    run(() => store().setModel('M4'))
    expect(opts('rotor-select-greek')).toEqual(['Beta', 'Gamma'])
    expect(opts('rotor-select-left')).toContain('VIII')
    expect(opts('reflector-select')).toEqual(['B-thin', 'C-thin'])
    selectValue(byTestId('reflector-select') as HTMLSelectElement, 'C-thin')
    expect(store().machine.config.reflector).toBe('C-thin')
    run(() => store().setLocks({ rotors: true, reflector: true }))
    expect((byTestId('rotor-select-left') as HTMLSelectElement).disabled).toBe(true)
    expect((byTestId('reflector-select') as HTMLSelectElement).disabled).toBe(true)
  })
})

describe('PlugboardEditor', () => {
  it('parses pairs and rejects doubles, self-pairs, odd input and too many cables', () => {
    expect(parsePairs('av', [], 13)).toEqual({ pairs: ['AV'] })
    expect(parsePairs('AB cd,EF', [], 13)).toEqual({ pairs: ['AB', 'CD', 'EF'] })
    expect(parsePairs('', [], 13)).toHaveProperty('error')
    expect(parsePairs('ABC', [], 13)).toMatchObject({ error: expect.stringMatching(/pairs/) })
    expect(parsePairs('AA', [], 13)).toMatchObject({ error: expect.stringMatching(/different/) })
    expect(parsePairs('AB', ['CA'], 13)).toMatchObject({ error: expect.stringMatching(/A is already plugged/) })
    expect(parsePairs('AB BC', [], 13)).toMatchObject({ error: expect.stringMatching(/B is already plugged/) })
    expect(parsePairs('CD', ['AB'], 1)).toMatchObject({ error: expect.stringMatching(/At most 1 cable/) })
  })

  it('adds and removes cables, and reports problems in role=alert', () => {
    const { container } = mount(<PlugboardEditor maxPairs={2} />)
    const input = byTestId('plug-input') as HTMLInputElement
    const form = container.querySelector('form')!
    typeInto(input, 'av')
    submit(form)
    expect(store().machine.config.plugboard).toEqual(['AV'])
    expect(byTestId('plug-pair-0').dataset.pair).toBe('AV')
    expect(input.value).toBe('')

    typeInto(input, 'VB')
    submit(form)
    const alert = byTestId('plug-error')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toMatch(/V is already plugged/)
    expect(store().machine.config.plugboard).toEqual(['AV'])

    typeInto(input, 'BS CG')
    submit(form)
    expect(alert.textContent).toMatch(/At most 2 cables/)

    typeInto(input, 'bs')
    submit(form)
    expect(store().machine.config.plugboard).toEqual(['AV', 'BS'])
    expect(alert.textContent).toBe('')

    click(byTestId('plug-remove-0'))
    expect(store().machine.config.plugboard).toEqual(['BS'])

    run(() => store().setLocks({ plugboard: true }))
    expect(input.disabled).toBe(true)
    expect((byTestId('plug-add') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('TracePanel', () => {
  const stages3 = [
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

  it('has 11 rows with the trace in data attributes after a press, and flags the double step', () => {
    run(() => store().setConfig({ ...ADU, plugboard: 'AV BS CG' }))
    mount(<TracePanel showOffsets />)
    run(() => store().pressKey('Q')) // ADU → ADV
    run(() => store().pressKey('Q')) // ADV → AEW
    run(() => store().pressKey('Q')) // AEW → BFX: the double step
    const rows = allByTestId(/^trace-row-\d+$/)
    const trace = store().last!.trace
    expect(rows).toHaveLength(11)
    expect(rows.map((r) => r.dataset.stage)).toEqual(stages3)
    rows.forEach((r, i) => {
      expect(r.dataset.input).toBe(trace[i]!.input)
      expect(r.dataset.output).toBe(trace[i]!.output)
      expect(r.dataset.lit).toBe('true')
      expect(r.querySelector('[data-sym]')).not.toBeNull()
    })
    expect(rows[10]!.dataset.output).toBe(store().output.at(-1))
    const step = byTestId('trace-step')
    expect(step.dataset.before).toBe('AEW')
    expect(step.dataset.after).toBe('BFX')
    expect(step.dataset.doubleStep).toBe('true')
    expect(step.textContent).toMatch(/double step/)
  })

  it('has 13 rows on the M4', () => {
    mount(<TracePanel />)
    run(() => store().setModel('M4'))
    expect(allByTestId(/^trace-row-\d+$/)).toHaveLength(13)
    run(() => store().pressKey('A'))
    const rows = allByTestId(/^trace-row-\d+$/)
    expect(rows).toHaveLength(13)
    expect(rows.map((r) => r.dataset.stage)).toEqual(store().last!.trace.map((t) => t.stage))
    expect(rows[5]!.dataset.stage).toBe('rotor-greek-fwd')
  })

  it('lights row k when hopAt(t) ≥ k and masks outputs under lampsHidden', () => {
    mount(<TracePanel />)
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('A'))
    const lit = () => allByTestId(/^trace-row-\d+$/).map((r) => r.dataset.lit === 'true')
    expect(lit().some(Boolean)).toBe(false)
    expect(byTestId('trace-step').dataset.live).toBe('true')
    run(() => usePlaybackStore.getState().scrub(4.5)) // hopAt = 3
    expect(lit()).toEqual([true, true, true, true, false, false, false, false, false, false, false])
    expect(byTestId('trace-row-3').dataset.live).toBe('true')
    run(() => usePlaybackStore.getState().finish())
    run(() => store().setLocks({ lampsHidden: true }))
    const rows = allByTestId(/^trace-row-\d+$/)
    expect(rows[0]!.dataset.input).toBe('A')
    expect(rows.every((r) => r.dataset.output === '?')).toBe(true)
    expect(rows.slice(1).every((r) => r.dataset.input === '?')).toBe(true)
  })
})

describe('Announcer', () => {
  it('reads "Rotors stepped to A E W; Q lit E." (stepping first) once the lamp is lit', () => {
    run(() => store().setConfig({ ...ADU, positions: 'ADV' }))
    mount(<Announcer />)
    const status = byTestId('announcer')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')
    const expected = pressKey(createMachine({ ...ADU, positions: 'ADV' }), 'Q')
    run(() => store().pressKey('Q'))
    expect(positionsToString(expected.state)).toBe('AEW')
    expect(status.textContent).toBe(`Rotors stepped to A E W; Q lit ${expected.output}.`)
  })

  it('is silent while the press animates, and omits the lamp under lampsHidden', () => {
    run(() => store().setConfig({ ...ADU, positions: 'ADV' }))
    mount(<Announcer />)
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('Q'))
    expect(byTestId('announcer').textContent).toBe('')
    run(() => usePlaybackStore.getState().finish())
    expect(byTestId('announcer').textContent).toMatch(/^Rotors stepped to A E W; Q lit [A-Z]\.$/)
    run(() => store().setLocks({ lampsHidden: true }))
    expect(byTestId('announcer').textContent).toBe('Rotors stepped to A E W; Q pressed.')
  })
})

describe('PlaybackBar', () => {
  it('scrubs t, replays and sets the speed', () => {
    mount(<PlaybackBar />)
    const play = byTestId('playback-play') as HTMLButtonElement
    expect(play.disabled).toBe(true)
    run(() => store().pressKey('A'))
    expect(play.disabled).toBe(false)
    const scrub = byTestId('playback-scrub') as HTMLInputElement
    expect(scrub.max).toBe('12')
    expect(scrub.getAttribute('aria-valuetext')).toBe('Lamp lit')
    selectValue(byTestId('playback-speed') as HTMLSelectElement, '0.25')
    expect(usePlaybackStore.getState().speed).toBe(0.25)
    click(play) // replay from the start
    expect(usePlaybackStore.getState()).toMatchObject({ t: 0, playing: true })
    expect(play.textContent).toBe('Pause')
    click(play)
    expect(usePlaybackStore.getState().playing).toBe(false)
    run(() => usePlaybackStore.getState().scrub(3.2))
    expect(scrub.getAttribute('aria-valuetext')).toBe('Hop 3 of 11')
    run(() => usePlaybackStore.getState().setGated(true))
    expect(play.disabled).toBe(true)
    expect(scrub.disabled).toBe(true)
  })
})

describe('PaperTape helpers', () => {
  it('types text key by key and reads the ciphertext back from where the tape began', () => {
    run(() => store().setPositions('ADU'))
    expect(tapeStart(useMachineStore)).toBe('ADU')
    run(() => typeText(useMachineStore, 'Hello, world!'))
    expect(store().input).toBe('HELLOWORLD')
    expect(tapeStart(useMachineStore)).toBe('ADU')
    const cipher = store().output
    run(() => rewindTape(useMachineStore))
    expect(store().input).toBe('')
    expect(positionsToString(store().machine)).toBe('ADU')
    run(() => typeText(useMachineStore, cipher))
    expect(store().output).toBe('HELLOWORLD')
  })

  it('renders the tape in 5-letter groups', () => {
    mount(<MachinePanel show={{ tape: true }} />)
    run(() => typeText(useMachineStore, 'HELLOWORLDX'))
    expect(byTestId('tape-input').textContent).toBe('HELLO WORLD X')
    expect(byTestId('tape-output').textContent!.replace(/ /g, '')).toBe(store().output)
  })
})

describe('MachinePanel', () => {
  it('composes the panels named in show, with an announcer for keys or lamps', () => {
    const { container } = mount(<MachinePanel show={{ keyboard: true, lamps: true, rotors: true, trace: true, playback: true }} />)
    for (const id of ['keyboard', 'lampboard', 'rotor-controls', 'trace-panel', 'playback-bar', 'announcer']) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull()
    }
    for (const id of ['plugboard-editor', 'model-select', 'paper-tape', 'ring-right']) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).toBeNull()
    }
  })
})

describe('PermTable', () => {
  it('shows images, highlights cells and edits them from the keyboard', () => {
    const onEdit = vi.fn()
    mount(<PermTable perm={[1, 0, null, 5, 4, 3]} highlight={[2]} editable onEdit={onEdit} testId="ad" label="AD" />)
    expect(byTestId('ad-cell-0').dataset.value).toBe('B')
    expect(byTestId('ad-cell-2').dataset.value).toBe('')
    expect(byTestId('ad-cell-2').className).toMatch(/outline/)
    const cell = byTestId('ad-cell-2').querySelector('input')!
    keyDown(cell, 'c')
    expect(onEdit).toHaveBeenLastCalledWith(2, 2)
    keyDown(cell, 'Backspace')
    expect(onEdit).toHaveBeenLastCalledWith(2, null)
    keyDown(cell, 'z') // outside A…F
    expect(onEdit).toHaveBeenCalledTimes(2)
  })

  it('renders read-only cells without inputs', () => {
    mount(<PermTable perm={[1, 0]} testId="p" />)
    expect(byTestId('p').querySelector('input')).toBeNull()
    expect(byTestId('p-cell-1').dataset.value).toBe('A')
  })
})

/** Let deferred (microtask) store work finish and React re-render. */
const settle = () => act(async () => {})

describe('review round 2 regressions', () => {
  it('F2: the tape prints the last letter only once its lamp lights, and offsets wait for their row', () => {
    mount(
      <>
        <PaperTape />
        <TracePanel showOffsets />
      </>,
    )
    run(() => usePlaybackStore.getState().setSpeed(0.25))
    run(() => store().pressKey('A'))
    const out = () => byTestId('tape-output').textContent
    const copy = byTestId('tape-copy') as HTMLButtonElement
    expect(out()).toBe('')
    expect(copy.disabled).toBe(true)
    run(() => usePlaybackStore.getState().scrub(5)) // hop 3 live, lamp unlit
    expect(out()).toBe('')
    const offsets = (i: number) => byTestId(`trace-row-${i}`).textContent!.includes('offset')
    expect(offsets(2)).toBe(true) // rotor-right-fwd, lit
    expect(offsets(7)).toBe(false) // rotor-middle-bwd, not yet lit
    run(() => usePlaybackStore.getState().finish())
    expect(out()).toBe(store().output)
    expect(copy.disabled).toBe(false)
    expect(offsets(7)).toBe(true)
    run(() => usePlaybackStore.getState().scrub(3)) // scrubbing back takes the letter off again
    expect(out()).toBe('')
  })

  it('F3: a hand change with letters on the shown tape starts a new tape at the new setting', async () => {
    mount(<MachinePanel show={{ rotors: true, rings: true, model: true, plugboard: true, tape: true }} />)
    run(() => typeText(useMachineStore, 'HELLO'))
    keyDown(byTestId('rotor-pos-right'), 'ArrowUp')
    await settle()
    expect(store().input).toBe('')
    expect(store().machine.config.positions.join('')).toBe(positionsToString(store().machine))
    const start = positionsToString(store().machine)
    run(() => typeText(useMachineStore, 'WORLD'))
    expect(tapeStart(useMachineStore)).toBe(start)
    const cipher = store().output
    run(() => rewindTape(useMachineStore))
    run(() => typeText(useMachineStore, cipher))
    expect(store().output).toBe('WORLD')

    // Rings, cables and the model do the same.
    for (const change of [
      () => keyDown(byTestId('ring-middle'), 'ArrowUp'),
      () => run(() => store().togglePlug('D', 'E')),
      () => run(() => store().setModel('M3')),
    ]) {
      run(() => typeText(useMachineStore, 'ABC'))
      change()
      await settle()
      expect(store().input).toBe('')
    }
  })

  it('F3: without a tape on screen, hand changes keep the letters', async () => {
    mount(<RotorControls />)
    run(() => typeText(useMachineStore, 'HELLO'))
    keyDown(byTestId('rotor-pos-right'), 'ArrowUp')
    await settle()
    expect(store().input).toBe('HELLO')
  })

  it('F4: a window step during the stepping phase starts from the current window, not the shown one', () => {
    run(() => store().setConfig({ ...ADU, positions: 'BGF' }))
    mount(<RotorControls rings />)
    run(() => usePlaybackStore.getState().setSpeed(0.25))
    run(() => store().pressKey('E')) // BGF → BGG, still showing BGF
    expect(byTestId('rotor-pos-right').getAttribute('aria-valuetext')).toBe('F')
    keyDown(byTestId('rotor-pos-right'), 'ArrowUp')
    expect(positionsToString(store().machine)).toBe('BGH')
    expect(byTestId('rotor-pos-right').getAttribute('aria-valuetext')).toBe('H')
  })

  it('F6: a repeated identical sentence (rotors held) is a new node, so it is spoken again', () => {
    run(() => store().setLocks({ hold: true }))
    mount(<Announcer />)
    run(() => store().pressKey('Q'))
    const first = byTestId('announcer').firstElementChild!
    const text = first.textContent
    expect(text).toMatch(/^Rotors held at A A A; Q lit [A-Z]\.$/) // no rotor moved: held, not stepped
    run(() => store().pressKey('Q'))
    const second = byTestId('announcer').firstElementChild!
    expect(second.textContent).toBe(text)
    expect(second).not.toBe(first)
    expect(first.isConnected).toBe(false)
  })

  it('F9: the plugboard and the tape headings are h2 (no h1 → h3 jump)', () => {
    const { container } = mount(<MachinePanel show={{ plugboard: true, tape: true }} />)
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      expect.stringContaining('Plugboard'),
      'Paper tape',
    ])
    expect(container.querySelector('h3')).toBeNull()
  })

  it('F10: typed ring digits form one number only within a second of each other', () => {
    let now = 10_000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    mount(<RotorControls rings />)
    const ring = byTestId('ring-right')
    const type = (d: string, after: number) => {
      now += after
      keyDown(ring, d)
    }
    type('0', 0)
    type('5', 100)
    expect(ring.textContent).toBe('05')
    type('1', RING_TYPING_MS + 1)
    expect(ring.textContent).toBe('01')
    type('3', 200)
    expect(ring.textContent).toBe('13')
    type('3', RING_TYPING_MS + 1)
    expect(ring.textContent).toBe('03')
    clock.mockRestore()
  })
})

describe('review round 4', () => {
  it('hop stops: stepping, the middle of each hop (hopAt = k), then the lit lamp', () => {
    expect(hopStops(0)).toEqual([])
    expect(hopStops(3)).toEqual([0.5, 1.5, 2.5, 3.5, 4])
    expect(nextStop(4, 3, -1)).toBe(3.5)
    expect(nextStop(0.5, 3, -1)).toBeNull()
    expect(nextStop(0, 3, 1)).toBe(0.5)
    expect(nextStop(2.7, 3, 1)).toBe(3.5)
    expect(nextStop(4, 3, 1)).toBeNull()
  })

  it("◀ hop / hop ▶ and '[' / ']' pause and step the clock through every hop", () => {
    mount(<PlaybackBar />)
    const prev = byTestId('playback-prev-hop') as HTMLButtonElement
    const next = byTestId('playback-next-hop') as HTMLButtonElement
    expect([prev.disabled, next.disabled]).toEqual([true, true]) // no press yet
    expect(prev.getAttribute('aria-keyshortcuts')).toBe('[')
    expect(next.getAttribute('aria-keyshortcuts')).toBe(']')
    run(() => store().pressKey('A')) // instant: t = 12
    const t = () => usePlaybackStore.getState().t
    expect(next.disabled).toBe(true)
    const seen: number[] = []
    for (let i = 0; i < 12; i++) {
      click(prev)
      seen.push(t())
    }
    expect(seen).toEqual([11.5, 10.5, 9.5, 8.5, 7.5, 6.5, 5.5, 4.5, 3.5, 2.5, 1.5, 0.5])
    expect(prev.disabled).toBe(true)
    keyDown(document.body, ']')
    expect(t()).toBe(1.5)
    keyDown(document.body, '[')
    expect(t()).toBe(0.5)
    // A text field keeps its brackets.
    const text = document.createElement('input')
    document.body.appendChild(text)
    keyDown(text, ']')
    expect(t()).toBe(0.5)
    text.remove()
    // Stepping pauses a running animation.
    run(() => usePlaybackStore.getState().setSpeed(0.25))
    click(byTestId('playback-play')) // resumes from 0.5
    expect(usePlaybackStore.getState().playing).toBe(true)
    click(next)
    expect(usePlaybackStore.getState()).toMatchObject({ playing: false, t: 1.5 })
    // Gated like Play: disabled, and the keys do nothing.
    run(() => usePlaybackStore.getState().setGated(true))
    expect([prev.disabled, next.disabled]).toEqual([true, true])
    keyDown(document.body, ']')
    expect(usePlaybackStore.getState().t).toBe(0)
  })

  it('a focused slider, checkbox, radio, button or select does not swallow typing; text fields do', () => {
    const make = (tag: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement(tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      document.body.appendChild(el)
      return el
    }
    const notText = [
      make('input', { type: 'range' }),
      make('input', { type: 'checkbox' }),
      make('input', { type: 'radio' }),
      make('input', { type: 'button' }),
      make('select'),
      make('button'),
    ]
    const text = [
      make('input'),
      make('input', { type: 'search' }),
      make('input', { type: 'number' }),
      make('textarea'),
      make('div', { contenteditable: 'true' }),
      make('div', { role: 'spinbutton' }),
    ]
    for (const el of notText) expect(isTextEntry(el), el.outerHTML).toBe(false)
    for (const el of text) expect(isTextEntry(el), el.outerHTML).toBe(true)

    mount(<Keyboard />)
    keyDown(notText[0]!, 'a') // the range slider
    const onSelect = keyDown(notText[4]!, 'b') // the select: the press also cancels its type-ahead
    expect(onSelect.defaultPrevented).toBe(true)
    keyDown(text[0]!, 'c')
    expect(store().input).toBe('AB')
    for (const el of [...notText, ...text]) el.remove()
  })
})
