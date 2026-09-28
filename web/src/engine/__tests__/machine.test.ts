import { describe, expect, it } from 'vitest'
import { LETTERS, indexToLetter, mod } from '../alphabet'
import {
  DEFAULT_CONFIG,
  EnigmaConfigError,
  createMachine,
  encipher,
  encodeLetter,
  isAtTurnover,
  machinePermutation,
  positionsToString,
  pressKey,
  rotorPermutation,
  step,
  validateConfig,
  withPositions,
  type MachineConfigInput,
  type MachineState,
  type RotorTraceStep,
} from '../machine'
import { conjugate, equals, fromWiring, shift } from '../permutation'
import { REFLECTORS, ROTORS } from '../wiring'

const at = (positions: string, overrides: Partial<MachineConfigInput> = {}): MachineState =>
  createMachine({ ...DEFAULT_CONFIG, positions, ...overrides })

function stepsFrom(state: MachineState, n: number): string[] {
  const out: string[] = []
  let s = state
  for (let i = 0; i < n; i++) {
    s = step(s).state
    out.push(positionsToString(s))
  }
  return out
}

describe('wiring tables', () => {
  it('every rotor is a permutation and every reflector a fixed-point-free involution', () => {
    for (const r of Object.values(ROTORS)) expect(fromWiring(r.wiring)).toHaveLength(26)
    for (const r of Object.values(REFLECTORS)) {
      const p = fromWiring(r.wiring)
      p.forEach((x, i) => {
        expect(x).not.toBe(i)
        expect(p[x]).toBe(i)
      })
    }
  })

  it('notch letters on the ring are the turnover letters + 8', () => {
    for (const r of Object.values(ROTORS)) {
      expect(r.notches.length).toBe(r.turnovers.length)
      r.turnovers.split('').forEach((t, i) => {
        expect(indexToLetter(LETTERS.indexOf(t as never) + 8)).toBe(r.notches[i])
      })
    }
  })

  it('only rotors VI, VII, VIII have two notches and only Beta/Gamma have none', () => {
    const counts = Object.fromEntries(Object.values(ROTORS).map((r) => [r.name, r.turnovers.length]))
    expect(counts).toEqual({ I: 1, II: 1, III: 1, IV: 1, V: 1, VI: 2, VII: 2, VIII: 2, Beta: 0, Gamma: 0 })
  })
})

describe('stepping', () => {
  it('the RIGHTMOST rotor is the fast rotor', () => {
    expect(stepsFrom(at('AAA'), 3)).toEqual(['AAB', 'AAC', 'AAD'])
  })

  it('steps BEFORE encoding: the first letter is enciphered at AAB, not AAA', () => {
    const first = pressKey(at('AAA'), 'A')
    expect(positionsToString(first.state)).toBe('AAB')
    expect(first.output).toBe(encodeLetter(at('AAB'), 'A').output)
    expect(first.output).toBe('B') // AAAAA -> B DZGO
    expect(pressKey(at('ADU'), 'A').state.positions).toEqual(at('ADV').positions) // not AEV
  })

  it('double-steps the middle rotor: ADU -> ADV -> AEW -> BFX -> BFY, flagging only the anomaly', () => {
    let s = at('ADU')
    const seen: { window: string; doubleStep: boolean; stepped: object }[] = []
    for (let i = 0; i < 4; i++) {
      const r = step(s)
      s = r.state
      seen.push({ window: positionsToString(s), doubleStep: r.doubleStep, stepped: r.stepped })
    }
    expect(seen).toEqual([
      { window: 'ADV', doubleStep: false, stepped: { left: false, middle: false, right: true } },
      { window: 'AEW', doubleStep: false, stepped: { left: false, middle: true, right: true } },
      { window: 'BFX', doubleStep: true, stepped: { left: true, middle: true, right: true } },
      { window: 'BFY', doubleStep: false, stepped: { left: false, middle: false, right: true } },
    ])
  })

  it('has period 26 x 25 x 26 = 16,900 with rotors I II III (checked in vectors) and never skips', () => {
    // Every step changes the right rotor by exactly one.
    let s = at('AAA')
    for (let i = 0; i < 1000; i++) {
      const next = step(s).state
      expect(next.positions[2]).toBe(mod(s.positions[2]! + 1))
      s = next
    }
  })

  it('the notch travels with the alphabet ring: turnover depends on the window letter, not the ring', () => {
    for (const rings of ['AAA', 'AAB', 'ZZZ', 'MQX']) {
      expect(stepsFrom(at('AAU', { rings }), 2)).toEqual(['AAV', 'ABW'])
    }
    expect(isAtTurnover('III', 'V')).toBe(true)
    expect(isAtTurnover('III', 'W')).toBe(false)
    expect(isAtTurnover('I', 16)).toBe(true) // Q
  })

  it('ring settings shift the wiring relative to the alphabet ring', () => {
    // Rotor I at A: ring A gives A->E, ring B gives A->K (Wikipedia).
    expect(indexToLetter(rotorPermutation('I', 'A', 'A')[0]!)).toBe('E')
    expect(indexToLetter(rotorPermutation('I', 'B', 'A')[0]!)).toBe('K')
    // Advancing ring and position together leaves the substitution unchanged.
    for (const rotor of Object.keys(ROTORS) as (keyof typeof ROTORS)[]) {
      for (let k = 0; k < 26; k++) {
        expect(equals(rotorPermutation(rotor, k, (k + 5) % 26), rotorPermutation(rotor, 0, 5))).toBe(true)
      }
    }
    // Rejewski's formula: at offset o the rotor acts as P^o W P^-o (left-to-right composition).
    const w = fromWiring(ROTORS.II.wiring)
    for (let o = 0; o < 26; o++) {
      expect(equals(rotorPermutation('II', 0, o), conjugate(w, shift(-o)))).toBe(true)
    }
  })

  it('double-notched rotors (VI-VIII) carry at both Z->A and M->N', () => {
    const m3 = (positions: string, rotors: MachineConfigInput['rotors']) =>
      createMachine({ model: 'M3', reflector: 'B', rotors, rings: 'AAA', positions })
    expect(stepsFrom(m3('AAY', ['I', 'II', 'VIII']), 3)).toEqual(['AAZ', 'ABA', 'ABB'])
    expect(stepsFrom(m3('AAL', ['I', 'II', 'VI']), 3)).toEqual(['AAM', 'ABN', 'ABO'])
    // In the middle slot, both notches trigger the double step.
    expect(stepsFrom(m3('ALU', ['I', 'VII', 'III']), 3)).toEqual(['ALV', 'AMW', 'BNX'])
    expect(stepsFrom(m3('AYU', ['I', 'VII', 'III']), 3)).toEqual(['AYV', 'AZW', 'BAX'])
  })

  it("the M4's Greek rotor never steps", () => {
    let s = createMachine({ model: 'M4', reflector: 'B-thin', rotors: ['Beta', 'I', 'II', 'III'], rings: 'AAAA', positions: 'QZZZ' })
    for (let i = 0; i < 17576; i++) {
      s = step(s).state
      expect(s.positions[0]).toBe(16)
    }
  })
})

describe('signal path and trace', () => {
  it('records the 11 stages of a 3-rotor machine in order (hand-checked AAA, key A -> lamp B)', () => {
    const { output, trace } = pressKey(at('AAA'), 'A')
    expect(output).toBe('B')
    expect(trace.map((t) => `${t.stage}:${t.input}${t.output}`)).toEqual([
      'plugboard-in:AA',
      'etw-in:AA',
      'rotor-right-fwd:AC',
      'rotor-middle-fwd:CD',
      'rotor-left-fwd:DF',
      'reflector:FS',
      'rotor-left-bwd:SS',
      'rotor-middle-bwd:SE',
      'rotor-right-bwd:EB',
      'etw-out:BB',
      'plugboard-out:BB',
    ])
    const right = trace[2] as RotorTraceStep
    expect(right).toMatchObject({ rotor: 'III', slot: 'right', slotIndex: 2, window: 'B', position: 1, ring: 0, offset: 1 })
    expect(right).toMatchObject({ entryContact: 1, exitContact: 3 }) // core B -> D (III: BDFH…)
  })

  it('records 13 stages on the M4, with the Greek rotor next to the reflector', () => {
    const s = createMachine({
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'II', 'IV', 'I'],
      rings: 'AAAV',
      positions: 'VJNA',
      plugboard: 'AT BL DF GJ HM NW OP QY RZ VX',
    })
    const { trace } = encodeLetter(s, 'N')
    expect(trace.map((t) => t.stage)).toEqual([
      'plugboard-in',
      'etw-in',
      'rotor-right-fwd',
      'rotor-middle-fwd',
      'rotor-left-fwd',
      'rotor-greek-fwd',
      'reflector',
      'rotor-greek-bwd',
      'rotor-left-bwd',
      'rotor-middle-bwd',
      'rotor-right-bwd',
      'etw-out',
      'plugboard-out',
    ])
    expect(trace[0]).toMatchObject({ kind: 'plugboard', input: 'N', output: 'W', plugged: true })
  })

  it('is a consistent chain whose rotor contacts match the wiring tables', () => {
    const s = createMachine({
      model: 'M3',
      reflector: 'C',
      rotors: ['III', 'VI', 'VIII'],
      rings: 'AHM',
      positions: 'UZV',
      plugboard: 'AN EZ HK IJ LR MQ OT PV SW UX',
    })
    for (const letter of LETTERS) {
      const { output, trace } = encodeLetter(s, letter)
      expect(trace[0]!.input).toBe(letter)
      expect(trace.at(-1)!.output).toBe(output)
      for (let i = 1; i < trace.length; i++) expect(trace[i]!.input).toBe(trace[i - 1]!.output)
      for (const t of trace) {
        expect(t.input).toBe(indexToLetter(t.inputIndex))
        expect(t.output).toBe(indexToLetter(t.outputIndex))
        if (t.kind !== 'rotor') continue
        const wiring = ROTORS[t.rotor].wiring
        expect(t.window).toBe('UZV'[t.slotIndex])
        expect(t.offset).toBe(mod(t.position - t.ring))
        expect(t.entryContact).toBe(mod(t.inputIndex + t.offset))
        expect(t.outputIndex).toBe(mod(t.exitContact - t.offset))
        if (t.direction === 'fwd') expect(wiring[t.entryContact]).toBe(indexToLetter(t.exitContact))
        else expect(wiring[t.exitContact]).toBe(indexToLetter(t.entryContact))
      }
      expect(output).toBe(indexToLetter(machinePermutation(s)[LETTERS.indexOf(letter)]!))
    }
  })
})

describe('encipher', () => {
  it('drops non-letters by default and can keep them without stepping', () => {
    const s = at('AAA')
    expect(encipher(s, 'aaaaa').output).toBe('BDZGO')
    expect(encipher(s, 'AA AA-A!').output).toBe('BDZGO')
    expect(encipher(s, 'AAAAA AAAAA', { keepNonLetters: true }).output).toBe(
      `BDZGO ${encipher(s, 'AAAAAAAAAA').output.slice(5)}`,
    )
    expect(positionsToString(encipher(s, 'A1 2A').state)).toBe('AAC')
  })

  it('is an involution from the same start state', () => {
    const s = at('QEV', { rings: 'CKT', plugboard: 'AV BS CG DL FU HZ IN KM OW RX' })
    const text = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG'
    expect(encipher(s, encipher(s, text).output).output).toBe(text)
  })
})

describe('immutability', () => {
  it('never mutates states or configs', () => {
    const s = at('ADU')
    const before = JSON.stringify(s)
    const r = pressKey(s, 'X')
    encipher(s, 'HELLO')
    expect(JSON.stringify(s)).toBe(before)
    expect(r.state).not.toBe(s)
    expect(r.state.config).toBe(s.config)
    expect(Object.isFrozen(s) && Object.isFrozen(s.positions) && Object.isFrozen(s.config)).toBe(true)
    expect(r.stepping.before).toEqual([0, 3, 20])
    expect(r.stepping.after).toEqual([0, 3, 21])
  })

  it('withPositions turns rotors by hand', () => {
    const s = withPositions(at('AAA'), 'ADU')
    expect(positionsToString(s)).toBe('ADU')
    expect(positionsToString(withPositions(s, [1, 'C', 27]))).toBe('BCB')
    expect(() => withPositions(s, 'AB')).toThrow(EnigmaConfigError)
  })

  it('pressKey rejects non-letters without stepping', () => {
    expect(() => pressKey(at('AAA'), '1')).toThrow(RangeError)
    expect(() => pressKey(at('AAA'), 'AB')).toThrow(RangeError)
    expect(pressKey(at('AAA'), 'a').output).toBe('B')
  })
})

describe('configuration rules', () => {
  const base: MachineConfigInput = DEFAULT_CONFIG
  const problems = (overrides: Partial<Record<keyof MachineConfigInput, unknown>>) =>
    validateConfig({ ...base, ...overrides } as MachineConfigInput)

  it('accepts the historical configurations and normalises input', () => {
    expect(validateConfig(base)).toEqual([])
    const s = createMachine({ ...base, rings: 'bul', positions: ['b', 'l', 'a'], plugboard: 'av bs, cg' })
    expect(s.config.rings).toEqual(['B', 'U', 'L'])
    expect(s.config.positions).toEqual(['B', 'L', 'A'])
    expect(s.config.plugboard).toEqual(['AV', 'BS', 'CG'])
    expect(createMachine({ ...base, plugboard: undefined }).config.plugboard).toEqual([])
  })

  it('allows at most 13 plugboard cables and no letter twice', () => {
    const thirteen = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ'
    expect(problems({ plugboard: thirteen })).toEqual([])
    expect(problems({ plugboard: thirteen + ' AZ' }).join()).toMatch(/At most 13/)
    expect(problems({ plugboard: 'AB BC' }).join()).toMatch(/B is plugged more than once/)
    expect(problems({ plugboard: 'AA' }).join()).toMatch(/itself/)
    expect(problems({ plugboard: 'A1' }).join()).toMatch(/two letters/)
    expect(problems({ plugboard: 'ABC' }).join()).toMatch(/two letters/)
  })

  it('enforces rotors and reflectors per model', () => {
    expect(problems({ rotors: ['I', 'II', 'VI'] }).join()).toMatch(/Rotor VI cannot go/)
    expect(problems({ rotors: ['I', 'I', 'II'] }).join()).toMatch(/only once/)
    expect(problems({ rotors: ['I', 'II'] }).join()).toMatch(/takes 3 rotors/)
    expect(problems({ rotors: ['I', 'II', 'IX'] }).join()).toMatch(/Unknown rotor/)
    expect(problems({ reflector: 'B-thin' }).join()).toMatch(/does not fit/)
    expect(problems({ model: 'M3', reflector: 'A' }).join()).toMatch(/does not fit/)
    expect(problems({ model: 'M5' }).join()).toMatch(/Unknown model/)
    const m4 = { model: 'M4', reflector: 'B-thin', rings: 'AAAA', positions: 'AAAA' }
    expect(problems({ ...m4, rotors: ['Beta', 'I', 'II', 'III'] })).toEqual([])
    expect(problems({ ...m4, rotors: ['I', 'Beta', 'II', 'III'] }).join()).toMatch(/Greek rotor/)
    expect(problems({ ...m4, rotors: ['Beta', 'Gamma', 'II', 'III'] }).join()).toMatch(/Rotor Gamma cannot go/)
    expect(problems({ ...m4, reflector: 'B', rotors: ['Beta', 'I', 'II', 'III'] }).join()).toMatch(/does not fit/)
  })

  it('checks rings and positions', () => {
    expect(problems({ rings: 'AA' }).join()).toMatch(/rings needs one letter per rotor/)
    expect(problems({ positions: 'A1A' }).join()).toMatch(/positions must be letters/)
  })

  it('createMachine throws EnigmaConfigError listing every problem', () => {
    try {
      createMachine({ ...base, rotors: ['I', 'I', 'VI'], plugboard: 'AB AC' })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(EnigmaConfigError)
      expect((e as EnigmaConfigError).problems.length).toBeGreaterThanOrEqual(3)
    }
  })
})
