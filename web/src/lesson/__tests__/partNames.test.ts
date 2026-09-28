import { describe, expect, it } from 'vitest'
import { ALL_PARTS } from '../../contracts/stage'
import { partLabel, partList, partName } from '../partNames'

describe('part names (review round 2)', () => {
  it('every part of every model has a learner-facing name, never a raw id', () => {
    const parts = new Set([...ALL_PARTS('I'), ...ALL_PARTS('M3'), ...ALL_PARTS('M4')])
    for (const p of parts) {
      // Plain words (battery, lid, reflector) are their own names; nothing hyphenated reaches the learner.
      expect(partName(p), p).toMatch(/^[A-Za-z' ]+$/)
      if (p.includes('-')) expect(partName(p), p).not.toBe(p)
    }
    expect(parts.size).toBe(25)
  })

  it('reads well in hints and on buttons', () => {
    expect(partName('notch-right')).toBe("right rotor's notch")
    expect(partName('pawl-middle')).toBe('middle pawl')
    expect(partName('ring-right')).toBe("right rotor's alphabet ring")
    expect(partName('core-greek')).toBe("Greek rotor's wiring core")
    expect(partName('etw')).toBe('entry wheel')
    expect(partLabel('rotor-left')).toBe('Left rotor')
    expect(partList(['notch-right', 'pawl-middle', 'notch-middle'])).toBe(
      "right rotor's notch, middle pawl and middle rotor's notch",
    )
  })
})
