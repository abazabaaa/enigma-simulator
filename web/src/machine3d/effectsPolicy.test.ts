import { describe, expect, it } from 'vitest'
import { shouldLoadEffects, type EffectsInputs } from './effectsPolicy'

const GPU: EffectsInputs = { reduced: false, software: false, force: null, declined: false, dropped: false }

describe('shouldLoadEffects: the effects chunk is fetched only when Bloom can mount', () => {
  it('loads on a GPU renderer with full motion', () => {
    expect(shouldLoadEffects(GPU)).toBe(true)
  })

  it('never under reduced motion, even when forced', () => {
    expect(shouldLoadEffects({ ...GPU, reduced: true })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, reduced: true, force: true })).toBe(false)
  })

  it('not on a software rasterizer, unless forced', () => {
    expect(shouldLoadEffects({ ...GPU, software: true })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, software: true, force: true })).toBe(true)
  })

  it('not before the renderer is known, after a PerformanceMonitor decline, or once the budget dropped Bloom', () => {
    expect(shouldLoadEffects({ ...GPU, software: null })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, software: null, force: true })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, declined: true })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, dropped: true })).toBe(false)
    expect(shouldLoadEffects({ ...GPU, dropped: true, force: true })).toBe(true)
  })

  it('force false keeps it off', () => {
    expect(shouldLoadEffects({ ...GPU, force: false })).toBe(false)
  })
})
