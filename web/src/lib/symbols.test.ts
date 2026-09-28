import { describe, expect, it } from 'vitest'
import { ALL_PARTS } from '../contracts/stage'
import { createMachine, pressKey, type TraceStage } from '../engine'
import { SWATCHES, SYMBOL_COLORS, SYM_FOR_PART, applySymbolTokens, symForStage, symbolColor } from './symbols'

const ALL_STAGES: readonly TraceStage[] = [
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
]

describe('symForStage', () => {
  it('covers all 13 stages', () => {
    expect(ALL_STAGES.map(symForStage).join('')).toBe('SHNMLGUGLMNHS')
  })

  it('covers every stage the engine emits on the M4', () => {
    const rotors = ['Beta', 'II', 'IV', 'I'] as const
    const m4 = createMachine({ model: 'M4', reflector: 'B-thin', rotors, rings: 'AAAA', positions: 'AAAA' })
    const stages = pressKey(m4, 'A').trace.map((t) => t.stage)
    expect(stages).toEqual(ALL_STAGES)
  })
})

describe('SYM_FOR_PART', () => {
  it('colours every slot part by its slot and the fixed parts by their letter', () => {
    for (const part of ALL_PARTS('M4')) {
      const sym = SYM_FOR_PART[part]
      if (['battery', 'keyboard', 'lampboard', 'lid'].includes(part)) expect(sym).toBeUndefined()
      else expect(sym).toBeDefined()
    }
    expect(SYM_FOR_PART.plugboard).toBe('S')
    expect(SYM_FOR_PART.etw).toBe('H')
    expect(SYM_FOR_PART.reflector).toBe('U')
    expect(SYM_FOR_PART['core-right']).toBe('N')
    expect(SYM_FOR_PART['pawl-middle']).toBe('M')
    expect(SYM_FOR_PART['ring-left']).toBe('L')
    expect(SYM_FOR_PART['rotor-greek']).toBe('G')
  })
})

describe('symbol colours', () => {
  it('has a distinct light and dark colour per swatch', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const colours = SWATCHES.map((s) => symbolColor(s, scheme))
      expect(new Set(colours).size).toBe(SWATCHES.length)
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(symbolColor('N', 'dark')).toBe(SYMBOL_COLORS.N.dark)
  })

  it('writes --sym-* tokens', () => {
    const props = new Map<string, string>()
    const root = { style: { setProperty: (k: string, v: string) => props.set(k, v) } } as unknown as HTMLElement
    applySymbolTokens(root)
    expect(props.get('--sym-N')).toBe(`light-dark(${SYMBOL_COLORS.N.light}, ${SYMBOL_COLORS.N.dark})`)
    expect(props.get('--sym-dim-dark')).toBe(SYMBOL_COLORS.dim.dark)
    expect(props.size).toBe(SWATCHES.length * 3)
  })
})
