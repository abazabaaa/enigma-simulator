import { describe, expect, it } from 'vitest'
import { CATALOGUE_SETTINGS, formatSci, keyspace, pairedPartitions, plugboardCount } from './keyspace'

describe('keyspace (F-KS)', () => {
  it('counts plugboard settings exactly', () => {
    expect(plugboardCount(0)).toBe(1n)
    expect(plugboardCount(1)).toBe(325n)
    expect(plugboardCount(10)).toBe(150738274937250n)
    expect(plugboardCount(13)).toBe(7905853580625n)
    expect(() => plugboardCount(14)).toThrow(RangeError)
  })

  it('multiplies orders, positions and plugs', () => {
    expect(keyspace()).toBe(158962555217826360000n)
    expect(keyspace()).toBe(60n * 17576n * 150738274937250n)
    expect(keyspace({ rings: true })).toBe(158962555217826360000n * 676n)
    expect(keyspace({ orders: 6n, pairs: 0 })).toBe(6n * 17576n)
  })

  it('has 101 cycle types for AD and 105,456 catalogue settings', () => {
    expect(pairedPartitions()).toBe(101)
    expect(CATALOGUE_SETTINGS).toBe(6 * 17576)
    expect(BigInt(pairedPartitions()) ** 3n).toBe(1030301n)
  })

  it('formats in scientific notation', () => {
    expect(formatSci(keyspace())).toBe('1.59 × 10²⁰')
    expect(formatSci(keyspace({ rings: true }))).toBe('1.07 × 10²³')
    expect(formatSci(plugboardCount(10))).toBe('1.51 × 10¹⁴')
    expect(formatSci(105456n, 4)).toBe('1.055 × 10⁵')
    expect(formatSci(999_999n)).toBe('1.00 × 10⁶')
    expect(formatSci(7n, 1)).toBe('7 × 10⁰')
    expect(formatSci(0n)).toBe('0')
    expect(formatSci(-1500n, 2)).toBe('−1.5 × 10³')
  })
})
