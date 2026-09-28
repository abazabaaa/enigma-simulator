import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'
import { resolveReducedMotion } from './reducedMotion'

describe('parseFlags', () => {
  it('reads the flags before the hash', () => {
    expect(parseFlags('?e2e=1&stage=2d&motion=reduce&seed=abc')).toEqual({
      e2e: true,
      stage: '2d',
      motion: 'reduce',
      seed: 'abc',
    })
    expect(parseFlags('')).toEqual({ e2e: null, stage: null, motion: null, seed: null })
    expect(parseFlags('?e2e=0&stage=4d&motion=fast&seed=')).toEqual({ e2e: false, stage: null, motion: null, seed: null })
    expect(parseFlags('?stage=3d&motion=full').stage).toBe('3d')
  })
})

describe('resolveReducedMotion', () => {
  it('prefers the flag, then the preference, then the system', () => {
    expect(resolveReducedMotion('system', null, true)).toBe(true)
    expect(resolveReducedMotion('system', null, false)).toBe(false)
    expect(resolveReducedMotion('reduce', null, false)).toBe(true)
    expect(resolveReducedMotion('full', null, true)).toBe(false)
    expect(resolveReducedMotion('reduce', 'full', true)).toBe(false)
    expect(resolveReducedMotion('full', 'reduce', false)).toBe(true)
  })
})
