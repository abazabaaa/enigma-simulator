import { describe, expect, it } from 'vitest'
import type { ModelName } from '../engine'
import { ALL_PARTS, STAGE_PRESETS, STAGE_PRESET_IDS, dimmedParts, resolveStage, type Focus, type PartId } from './stage'

const MODELS: readonly ModelName[] = ['I', 'M3', 'M4']

describe('STAGE_PRESETS', () => {
  it('has the 12 presets of the PLAN §3.3 table', () => {
    expect(STAGE_PRESET_IDS).toEqual([
      'overview',
      'type-a-word',
      'toy',
      'wire',
      'wire-noplug',
      'rotors',
      'rotor-layers',
      'pawls',
      'reflector',
      'plugboard',
      'symbols',
      'checking',
    ])
    // Spot-check rows verbatim.
    expect(STAGE_PRESETS.toy).toEqual({
      source: 'toy',
      shot: 'toy',
      focus: 'wire',
      lid: 'open',
      trace: 'animate',
      labels: 'names',
      ringLayer: false,
      plugboard: false,
      interactive: true,
    })
    expect(STAGE_PRESETS['rotor-layers']).toMatchObject({ focus: 'ring-right', ringLayer: true, interactive: false, trace: 'off' })
    expect(STAGE_PRESETS.symbols).toMatchObject({ labels: 'symbols', focus: 'wire', plugboard: true })
    expect(STAGE_PRESETS['type-a-word']).toMatchObject({ shot: 'front', focus: 'overview', trace: 'off', lid: 'closed' })
    expect(Object.isFrozen(STAGE_PRESETS.overview)).toBe(true)
  })
})

describe('resolveStage', () => {
  it('returns a preset, or merges overrides into it', () => {
    expect(resolveStage('pawls')).toBe(STAGE_PRESETS.pawls)
    const d = resolveStage({ preset: 'wire', with: { source: 'toy', plugboard: false } })
    expect(d).toEqual({ ...STAGE_PRESETS.wire, source: 'toy', plugboard: false })
    expect(STAGE_PRESETS.wire.source).toBe('machine') // the preset itself is untouched
  })

  it('rejects an unknown preset', () => {
    expect(() => resolveStage('nope' as never)).toThrow(/Unknown stage preset/)
  })
})

describe('ALL_PARTS', () => {
  it('lists 3 rotor slots (I, M3) or 4 (M4); the Greek slot has no notch or pawl', () => {
    expect(ALL_PARTS('I')).toHaveLength(7 + 3 * 5)
    expect(ALL_PARTS('M3')).toEqual(ALL_PARTS('I'))
    expect(ALL_PARTS('M4')).toHaveLength(7 + 3 * 5 + 3)
    expect(ALL_PARTS('M4')).toEqual(expect.arrayContaining(['rotor-greek', 'ring-greek', 'core-greek']))
    expect(ALL_PARTS('M4')).not.toContain('pawl-greek')
    expect(ALL_PARTS('M4')).not.toContain('notch-greek')
    expect(new Set(ALL_PARTS('M4')).size).toBe(ALL_PARTS('M4').length)
  })
})

describe('dimmedParts', () => {
  const expected = (focus: Focus, model: ModelName): PartId[] => {
    const all = ALL_PARTS(model)
    const slotParts = (p: string) => /^(rotor|ring|core|notch|pawl)-/.test(p)
    switch (focus) {
      case 'overview':
        return []
      case 'wire':
        return all.filter((p) => p === 'battery' || p === 'lid' || /^(notch|pawl)-/.test(p))
      case 'rotor-stack':
        return all.filter((p) => !slotParts(p))
      case 'pawls':
        return all.filter((p) => !/^(pawl|notch|ring)-/.test(p))
      default:
        return all.filter((p) => p !== focus)
    }
  }

  for (const model of MODELS) {
    for (const id of STAGE_PRESET_IDS) {
      it(`matches the rule for preset ${id} on the ${model}`, () => {
        const { focus } = STAGE_PRESETS[id]
        expect(dimmedParts(focus, model)).toEqual(expected(focus, model))
      })
    }
  }

  it('keeps a rotor with its ring, core, notch and pawl', () => {
    const dimmed = dimmedParts('rotor-middle', 'I')
    for (const p of ['rotor-middle', 'ring-middle', 'core-middle', 'notch-middle', 'pawl-middle'] as const) {
      expect(dimmed).not.toContain(p)
    }
    expect(dimmed).toContain('rotor-left')
    expect(dimmed).toContain('ring-right')
    expect(dimmed).toHaveLength(ALL_PARTS('I').length - 5)
  })

  it('handles the Greek rotor on the M4 and single parts', () => {
    expect(dimmedParts('rotor-greek', 'M4')).toHaveLength(ALL_PARTS('M4').length - 3)
    expect(dimmedParts('reflector', 'M4')).toEqual(ALL_PARTS('M4').filter((p) => p !== 'reflector'))
    expect(dimmedParts('ring-right', 'M3')).toEqual(ALL_PARTS('M3').filter((p) => p !== 'ring-right'))
    expect(dimmedParts('wire', 'M4')).toEqual([
      'battery',
      'notch-left',
      'pawl-left',
      'notch-middle',
      'pawl-middle',
      'notch-right',
      'pawl-right',
      'lid',
    ])
  })

  it('is in ALL_PARTS order and dims nothing for overview', () => {
    for (const model of MODELS) {
      expect(dimmedParts('overview', model)).toEqual([])
      const all = ALL_PARTS(model)
      const d = dimmedParts('pawls', model)
      expect(d).toEqual(all.filter((p) => d.includes(p)))
    }
  })
})
