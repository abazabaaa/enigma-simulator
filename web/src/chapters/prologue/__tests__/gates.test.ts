/**
 * The Prologue: the bets' truths, the key-space figure (every number from lib/keyspace) and the paper tape's round
 * trip. The shared lints (validate, purity) cover the chapter too.
 */

import { describe, expect, it } from 'vitest'
import { LETTERS, createMachine, encipher, pressKey, validateConfig } from '../../../engine'
import { formatSci, keyspace, plugboardCount } from '../../../lib/keyspace'
import chapter from '../index'
import { FACTS } from '../facts'
import {
  BRUTE_TRUTH,
  GATES,
  OWN_LETTER_TRUTH,
  RING_SETTINGS,
  START,
  formatYears,
  keyspaceLines,
  ownLetterTruth,
  roundtripDone,
  yearsToTry,
} from '../gates'

describe('the machine and the bets', () => {
  it('types on Enigma I, I II III, rings 01 01 01, windows AAA, no cables', () => {
    expect(validateConfig(START)).toEqual([])
    expect(START).toMatchObject({
      rotors: ['I', 'II', 'III'],
      rings: ['A', 'A', 'A'],
      positions: ['A', 'A', 'A'],
      plugboard: [],
    })
  })

  it('own-letter: whichever key is pressed first, another letter lights', () => {
    for (const k of LETTERS) expect(pressKey(createMachine(START), k).output).not.toBe(k)
    expect(OWN_LETTER_TRUTH).toBe('other')
    expect(ownLetterTruth()).toBe('other')
  })

  it('every bet’s truth is one of its options, and every reveal has its bet', () => {
    const truths: Record<string, string> = { 'own-letter': OWN_LETTER_TRUTH, brute: BRUTE_TRUTH }
    for (const s of chapter.scenes) {
      for (const b of s.bets ?? []) expect(b.options?.map((o) => o.id)).toContain(truths[b.id])
      for (const r of s.reveals ?? []) expect(s.bets?.some((b) => b.id === r.bet)).toBe(true)
    }
  })

  it('has no gate (the hook) and ends on an explore scene', () => {
    expect(GATES).toEqual({})
    expect(chapter.scenes.map((s) => s.kind)).toEqual(['story', 'explore', 'explore'])
  })
})

describe('the key-space figure', () => {
  it('60 × 17,576 × 150,738,274,937,250 ≈ 1.59 × 10²⁰; × 676 ≈ 1.07 × 10²³ (lib/keyspace)', () => {
    const lines = Object.fromEntries(keyspaceLines().map((l) => [l.id, l]))
    expect(lines.orders!.value).toBe(60n)
    expect(lines.positions!.value).toBe(17576n)
    expect(lines.plugboard!.value).toBe(plugboardCount(10))
    expect(lines.plugboard!.shown).toBe('150,738,274,937,250')
    expect(lines.total!.value).toBe(keyspace())
    expect(lines.total!.factors).toEqual(['60', '17,576', '150,738,274,937,250'])
    expect(lines.total!.shown).toBe('158,962,555,217,826,360,000 ≈ 1.59 × 10²⁰')
    expect(lines.rings!.value).toBe(keyspace({ rings: true }))
    expect(lines.rings!.shown).toBe('≈ 1.07 × 10²³')
    expect(RING_SETTINGS).toBe(676n)
    expect(keyspaceLines().map((l) => l.id)).toEqual(['orders', 'positions', 'plugboard', 'total', 'rings'])
  })

  it('the years a search takes, computed', () => {
    expect(yearsToTry(keyspace(), 10n ** 9n)).toBe(5037n)
    expect(formatYears(5037n)).toBe('5,037 years')
    expect(formatYears(yearsToTry(keyspace({ rings: true }), 10n ** 9n))).toBe(
      formatSci(yearsToTry(keyspace({ rings: true }), 10n ** 9n)) + ' years',
    )
    expect(formatYears(0n)).toBe('less than a year')
    expect(() => yearsToTry(1n, 0n)).toThrow(RangeError)
  })

  it('the keyspace fact is computed, not typed', () => {
    expect(FACTS.find((f) => f.id === 'keyspace')!.text).toContain(formatSci(keyspace()))
    expect(FACTS.every((f) => f.source.startsWith('https://'))).toBe(true)
  })
})

describe('the round trip', () => {
  it('typing the ciphertext from the same start gives the word back, and that is what the rule sees', () => {
    const word = 'HELLO'
    const cipher = encipher(createMachine(START), word).output
    expect(encipher(createMachine(START), cipher).output).toBe(word)
    expect(roundtripDone([{ input: word, output: cipher }], { input: cipher, output: word })).toBe(true)
  })

  it('needs an earlier tape, the whole word, and at least three letters', () => {
    expect(roundtripDone([], { input: 'ABC', output: 'XYZ' })).toBe(false)
    expect(roundtripDone([{ input: 'HELLO', output: 'MFNCZ' }], { input: 'MFNC', output: 'HELL' })).toBe(false)
    expect(roundtripDone([{ input: 'HI', output: 'XY' }], { input: 'XY', output: 'HI' })).toBe(false)
    expect(roundtripDone([{ input: 'HELLO', output: 'MFNCZ' }], { input: 'MFNCZ', output: 'HELLP' })).toBe(false)
    expect(
      roundtripDone(
        [
          { input: 'A', output: 'B' },
          { input: 'HELLO', output: 'MFNCZ' },
        ],
        { input: 'MFNCZ', output: 'HELLO' },
      ),
    ).toBe(true)
  })
})
