import { describe, expect, it } from 'vitest'
import { HOP_MS, STEP_MS, hopAt, isLit } from './machine'

describe('hopAt / isLit (PLAN §3.2 truth table, 11 hops)', () => {
  const hops = 11
  it.each([
    [0, -1, false],
    [0.5, -1, false],
    [1, 0, false],
    [1.99, 0, false],
    [2, 1, false],
    [11.9, 10, false],
    [12, 10, true],
  ])('t = %s → hop %s, lit %s', (t, hop, lit) => {
    expect(hopAt(t, hops)).toBe(hop)
    expect(isLit(t, hops)).toBe(lit)
  })

  it('never reports a hop beyond the last one', () => {
    expect(hopAt(40, 13)).toBe(12)
    expect(hopAt(1, 0)).toBe(-1)
    expect(isLit(1, 0)).toBe(true)
  })

  it('has the speed-1 durations of the plan', () => {
    expect([STEP_MS, HOP_MS]).toEqual([400, 150])
  })
})
