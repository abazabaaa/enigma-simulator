import { describe, expect, it } from 'vitest'
import { MODEL_NAMES, normalizeConfig, validateConfig } from '../../engine'
import { createRng, randomConfig } from '../../lib/rng'
import { decodeConfig, encodeConfig } from '../urlCodec'

describe('encodeConfig / decodeConfig', () => {
  it('encodes the PLAN §3.10 example', () => {
    const c = normalizeConfig({
      model: 'I',
      reflector: 'B',
      rotors: ['I', 'II', 'III'],
      rings: 'AAA',
      positions: 'ADU',
      plugboard: 'AV BS',
    })
    expect(encodeConfig(c)).toBe('I.B.I-II-III.01-01-01.ADU.AV-BS')
    expect(decodeConfig('I.B.I-II-III.01-01-01.ADU.AV-BS')).toEqual(c)
  })

  it('writes rings as 01–26 and gives the M4 four rotors and four rings', () => {
    const m4 = normalizeConfig({
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'II', 'IV', 'I'],
      rings: 'AAAV',
      positions: 'VJNA',
      plugboard: 'AT BL',
    })
    expect(encodeConfig(m4)).toBe('M4.B-thin.Beta-II-IV-I.01-01-01-22.VJNA.AT-BL')
    expect(decodeConfig(encodeConfig(m4))).toEqual(m4)
    const noPlugs = normalizeConfig({ model: 'M3', reflector: 'C', rotors: ['VI', 'VII', 'VIII'], rings: 'ZMA', positions: 'QQQ' })
    expect(encodeConfig(noPlugs)).toBe('M3.C.VI-VII-VIII.26-13-01.QQQ.')
    expect(decodeConfig('M3.C.VI-VII-VIII.26-13-01.QQQ.')).toEqual(noPlugs)
  })

  it('round-trips 1,000 random configurations of every model', () => {
    for (const model of MODEL_NAMES) {
      const r = createRng(0x04 + model.length)
      for (let i = 0; i < 1000; i++) {
        const c = randomConfig(r, { model, plugs: [0, 13] })
        const s = encodeConfig(c)
        const back = decodeConfig(s)
        expect(back, s).toEqual(normalizeConfig(c))
        expect(encodeConfig(back!)).toBe(s)
        expect(validateConfig(back!)).toEqual([])
      }
    }
  })

  it.each([
    ['', 'empty'],
    ['I.B.I-II-III.01-01-01.ADU', 'five fields'],
    ['I.B.I-II-III.01-01-01.ADU.AV-BS.', 'seven fields'],
    ['X.B.I-II-III.01-01-01.ADU.', 'unknown model'],
    ['I.B-thin.I-II-III.01-01-01.ADU.', 'thin reflector on the Enigma I'],
    ['I.B.I-II-VI.01-01-01.ADU.', 'rotor VI on the Enigma I'],
    ['I.B.I-I-III.01-01-01.ADU.', 'a rotor twice'],
    ['I.B.I-II.01-01.AD.', 'two rotors'],
    ['M4.B-thin.II-IV-I.01-01-01.JNA.', 'an M4 without a Greek rotor'],
    ['M4.B-thin.Beta-II-IV-I.01-01-01.VJNA.', 'three rings for four rotors'],
    ['I.B.I-II-III.00-01-01.ADU.', 'ring 00'],
    ['I.B.I-II-III.27-01-01.ADU.', 'ring 27'],
    ['I.B.I-II-III.1-1-1.ADU.', 'one-digit rings'],
    ['I.B.I-II-III.A-A-A.ADU.', 'rings as letters'],
    ['I.B.I-II-III.01-01-01.AD1.', 'a digit window'],
    ['I.B.I-II-III.01-01-01.ADU.AA', 'a letter plugged to itself'],
    ['I.B.I-II-III.01-01-01.ADU.AV-VB', 'a letter plugged twice'],
    ['I.B.I-II-III.01-01-01.ADU.AVB', 'an odd plug'],
    ['I.B.I-II-III.01-01-01.ADU.AB-CD-EF-GH-IJ-KL-MN-OP-QR-ST-UV-WX-YZ-AC', '14 cables'],
    ['I.B.i-ii-iii.01-01-01.ADU.', 'lowercase rotor names'],
  ])('rejects %j (%s)', (s) => {
    expect(decodeConfig(s)).toBeNull()
  })

  it('accepts lowercase windows and plugs and normalises them', () => {
    expect(encodeConfig(decodeConfig('I.B.I-II-III.01-01-01.adu.av-bs')!)).toBe('I.B.I-II-III.01-01-01.ADU.AV-BS')
  })
})
