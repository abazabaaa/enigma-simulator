/**
 * data.ts re-derived: every POLISH_CARDS row is a card of the UKW-A catalogue (6 orders of I, II, III; rings 01) with 2
 * to 5 settings, lists them in catalogue order, holds its day, and never has the day first or the day's double-step
 * twin first; no characteristic is drawn for more than 4 of the 720 days.
 */

import { describe, expect, it } from 'vitest'
import { buildCatalogue, characteristicAt, sixPermutations } from '../../../crypto'
import { normalizeConfig } from '../../../engine'
import { CARD_ROWS, type CardSetting } from '../gates'

const firstPress = (s: CardSetting) =>
  JSON.stringify(
    sixPermutations(normalizeConfig({ model: 'I', reflector: 'A', rotors: [...s.rotors], rings: 'AAA', positions: s.positions, plugboard: [] })),
  )

describe('POLISH_CARDS', () => {
  it('720 rows, each its setting’s whole catalogue card, the setting never first nor its twin', { timeout: 120_000 }, () => {
    const catalogue = buildCatalogue({ reflector: 'A' })
    expect(CARD_ROWS).toHaveLength(720)
    const perKey = new Map<string, number>()
    for (const row of CARD_ROWS) {
      const key = characteristicAt(row.setting.rotors, 'A', row.setting.positions)
      perKey.set(key, (perKey.get(key) ?? 0) + 1)
      const card = catalogue.get(key)!
      expect(row.card.map((s) => `${s.rotors.join('-')} ${s.positions}`)).toEqual(card.map((s) => `${s.rotors.join('-')} ${s.positions}`))
      expect(card.length).toBeGreaterThanOrEqual(2)
      expect(card.length).toBeLessThanOrEqual(5)
      const at = row.card.findIndex((s) => s.rotors.join('-') === row.setting.rotors.join('-') && s.positions === row.setting.positions)
      expect(at).toBeGreaterThan(0)
      expect(firstPress(row.card[0]!)).not.toBe(firstPress(row.setting))
    }
    expect(Math.max(...perKey.values())).toBeLessThanOrEqual(4)
  })
})
