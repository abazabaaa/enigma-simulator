import { describe, expect, it } from 'vitest'
import type { LockKey, MachineStore } from '../contracts/machine'
import { EnigmaConfigError, encodeLetter, positionsToString, validateConfig, type MachineConfigInput } from '../engine'
import { MachineLockedError, createMachineStore, useMachineStore } from './machineStore'

const DEFAULT: MachineConfigInput = {
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
}
const windows = (s: MachineStore) => positionsToString(s.machine)

describe('pressKey', () => {
  it('enciphers AAAAA → BDZGO through the store and counts presses', () => {
    const store = createMachineStore({ config: DEFAULT })
    const lamps = [...'AAAAA'].map((l) => store.getState().pressKey(l).output).join('')
    expect(lamps).toBe('BDZGO')
    const s = store.getState()
    expect(s).toMatchObject({ input: 'AAAAA', output: 'BDZGO', seq: 5 })
    expect(windows(s)).toBe('AAF')
    expect(s.last?.output).toBe('O')
  })

  it('accepts lower case and rejects non-letters without stepping', () => {
    const store = createMachineStore({ config: DEFAULT })
    store.getState().pressKey('a')
    expect(store.getState().input).toBe('A')
    expect(() => store.getState().pressKey('1')).toThrow(RangeError)
    expect(store.getState()).toMatchObject({ seq: 1, input: 'A' })
    expect(windows(store.getState())).toBe('AAB')
  })

  it('throws MachineLockedError with the keyboard locked, naming the lock', () => {
    const store = createMachineStore({ config: DEFAULT, locks: { keyboard: true } })
    let error: unknown
    try {
      store.getState().pressKey('A')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(MachineLockedError)
    expect((error as MachineLockedError).lock).toBe('keyboard')
    expect((error as Error).message).toMatch(/keyboard/)
    expect(store.getState()).toMatchObject({ seq: 0, input: '', last: null })
  })

  it('hold encodes like encodeLetter and leaves the windows unchanged', () => {
    const store = createMachineStore({ config: { ...DEFAULT, positions: 'ADU' }, locks: { hold: true } })
    const before = store.getState().machine
    const expected = encodeLetter(before, 'K')
    const result = store.getState().pressKey('K')
    expect(result.output).toBe(expected.output)
    expect(result.trace).toEqual(expected.trace)
    expect(result.state).toBe(before)
    expect(result.stepping).toEqual({
      stepped: { left: false, middle: false, right: false },
      doubleStep: false,
      before: before.positions,
      after: before.positions,
    })
    store.getState().pressKey('K')
    expect(windows(store.getState())).toBe('ADU')
    expect(store.getState()).toMatchObject({ seq: 2, output: expected.output + expected.output })
  })
})

describe('setters and locks', () => {
  const calls: [LockKey, (s: MachineStore) => void][] = [
    ['positions', (s) => s.setPositions('ABC')],
    ['rings', (s) => s.setRing(0, 'B')],
    ['rotors', (s) => s.setRotor(0, 'IV')],
    ['reflector', (s) => s.setReflector('C')],
    ['model', (s) => s.setModel('M3')],
    ['plugboard', (s) => s.setPlugs(['AB'])],
    ['plugboard', (s) => s.togglePlug('A', 'B')],
  ]

  it.each(calls)('the %s setter throws MachineLockedError when locked, and works when unlocked', (lock, call) => {
    const locked = createMachineStore({ config: DEFAULT, locks: { [lock]: true } })
    const before = locked.getState().machine
    expect(() => call(locked.getState())).toThrow(MachineLockedError)
    expect(locked.getState().machine).toBe(before)

    const open = createMachineStore({ config: DEFAULT })
    call(open.getState())
    expect(open.getState().machine).not.toBe(before)
  })

  it('setConfig and setLocks are the setup path and ignore locks', () => {
    const all = { model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true, keyboard: true }
    const store = createMachineStore({ config: DEFAULT, locks: all })
    store.getState().setConfig({ ...DEFAULT, rotors: ['V', 'IV', 'III'], positions: 'QEV' })
    expect(windows(store.getState())).toBe('QEV')
    store.getState().setLocks({ hold: true })
    expect(store.getState().locks).toEqual({ hold: true })
  })

  it('setConfig clears the tape and last but keeps seq', () => {
    const store = createMachineStore({ config: DEFAULT })
    store.getState().pressKey('A')
    store.getState().setConfig(DEFAULT)
    expect(store.getState()).toMatchObject({ input: '', output: '', last: null, seq: 1 })
  })

  it('config setters keep the current windows and the tape and clear last', () => {
    const store = createMachineStore({ config: DEFAULT })
    store.getState().pressKey('A')
    store.getState().setRing(2, 'E')
    const s = store.getState()
    expect(windows(s)).toBe('AAB')
    expect(s.machine.config.rings).toEqual(['A', 'A', 'E'])
    expect(s).toMatchObject({ input: 'A', last: null })
    store.getState().setPositions('adu')
    expect(windows(store.getState())).toBe('ADU')
    expect(store.getState().machine.config.positions).toEqual(['A', 'A', 'A'])
  })

  it('setRotor validates for the model and swaps a rotor already in use', () => {
    const store = createMachineStore({ config: DEFAULT })
    expect(() => store.getState().setRotor(0, 'VI')).toThrow(EnigmaConfigError)
    expect(() => store.getState().setRotor(3, 'IV')).toThrow(EnigmaConfigError)
    store.getState().setRotor(0, 'III')
    expect(store.getState().machine.config.rotors).toEqual(['III', 'II', 'I'])
    store.getState().setRotor(1, 'V')
    expect(store.getState().machine.config.rotors).toEqual(['III', 'V', 'I'])
  })

  it('setReflector and setPlugs validate', () => {
    const store = createMachineStore({ config: DEFAULT })
    expect(() => store.getState().setReflector('B-thin')).toThrow(EnigmaConfigError)
    store.getState().setReflector('C')
    expect(store.getState().machine.config.reflector).toBe('C')
    expect(() => store.getState().setPlugs(['AB', 'BC'])).toThrow(EnigmaConfigError)
    store.getState().setPlugs(['av', 'bs'])
    expect(store.getState().machine.config.plugboard).toEqual(['AV', 'BS'])
  })

  it('togglePlug adds a pair, or removes the pair containing a', () => {
    const store = createMachineStore({ config: DEFAULT })
    store.getState().togglePlug('A', 'V')
    store.getState().togglePlug('B', 'S')
    expect(store.getState().machine.config.plugboard).toEqual(['AV', 'BS'])
    store.getState().togglePlug('V', 'Q')
    expect(store.getState().machine.config.plugboard).toEqual(['BS'])
    expect(() => store.getState().togglePlug('C', 'B')).toThrow(EnigmaConfigError)
  })
})

describe('setModel', () => {
  it('gives valid configurations with the documented defaults', () => {
    const store = createMachineStore({
      config: { ...DEFAULT, rotors: ['II', 'IV', 'V'], rings: 'BUL', positions: 'BLA', plugboard: 'AV BS' },
    })
    store.getState().pressKey('E')
    store.getState().setModel('M4')
    let c = store.getState().machine.config
    expect(c).toMatchObject({ model: 'M4', reflector: 'B-thin', rotors: ['Beta', 'II', 'IV', 'V'], plugboard: ['AV', 'BS'] })
    expect(c.rings).toEqual(['A', 'B', 'U', 'L'])
    expect(c.positions).toEqual(['A', 'B', 'L', 'A'])
    expect(windows(store.getState())).toBe('ABLB')
    expect(validateConfig(c)).toEqual([])

    store.getState().setRotor(3, 'VIII')
    store.getState().setModel('M3')
    c = store.getState().machine.config
    expect(c).toMatchObject({ model: 'M3', reflector: 'B', rotors: ['II', 'IV', 'VIII'] })
    expect(windows(store.getState())).toBe('BLB')
    expect(validateConfig(c)).toEqual([])

    store.getState().setModel('I')
    c = store.getState().machine.config
    expect(c).toMatchObject({ model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'] })
    expect(validateConfig(c)).toEqual([])

    store.getState().setModel('I')
    expect(store.getState().machine.config).toBe(c)
  })

  it('keeps I–V rotors when switching back to the Enigma I', () => {
    const store = createMachineStore({ config: { ...DEFAULT, model: 'M3', rotors: ['V', 'I', 'III'] } })
    store.getState().setModel('I')
    expect(store.getState().machine.config.rotors).toEqual(['V', 'I', 'III'])
  })
})

describe('snapshot and instances', () => {
  it('snapshot has the current windows', () => {
    const store = createMachineStore({ config: { ...DEFAULT, positions: 'ADU' } })
    ;[...'AAA'].forEach((l) => store.getState().pressKey(l))
    const snap = store.getState().snapshot()
    expect(snap.positions).toEqual(['B', 'F', 'X'])
    expect(snap.rotors).toEqual(['I', 'II', 'III'])
    expect(validateConfig(snap)).toEqual([])
  })

  it('isolates two store instances', () => {
    const a = createMachineStore({ config: DEFAULT })
    const b = createMachineStore({ config: DEFAULT, locks: { keyboard: true } })
    a.getState().pressKey('A')
    a.getState().setLocks({ positions: true })
    expect(b.getState()).toMatchObject({ seq: 0, input: '', locks: { keyboard: true } })
    expect(windows(b.getState())).toBe('AAA')
    expect(a.getState().locks).toEqual({ positions: true })
  })

  it('the default store starts on the default key', () => {
    expect(useMachineStore.getState().machine.config).toMatchObject({ model: 'I', rotors: ['I', 'II', 'III'] })
  })

  it('reset returns to the start positions and clears the tape', () => {
    const store = createMachineStore({ config: DEFAULT })
    store.getState().pressKey('A')
    store.getState().reset()
    expect(store.getState()).toMatchObject({ input: '', output: '', last: null, seq: 1 })
    expect(windows(store.getState())).toBe('AAA')
  })
})
