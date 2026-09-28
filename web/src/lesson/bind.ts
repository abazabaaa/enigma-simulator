/**
 * bindGates (PLAN §3.4): pairs each gate's pure logic with the chapter's ITEM_UI. Throws when an item or a
 * fallback has no UI entry, or when a custom item has no Answer (validate V1 checks the Feedback rules).
 */

import type { ChapterGates, GateBinding, ItemUiMap } from '../contracts/lesson'

export function bindGates(g: ChapterGates, ui: ItemUiMap): Readonly<Record<string, GateBinding>> {
  const out: Record<string, GateBinding> = {}
  for (const [gateId, logic] of Object.entries(g)) {
    for (const item of [...logic.items, logic.fallback]) {
      const entry = ui[item.id]
      if (!entry) throw new Error(`bindGates: gate '${gateId}' item '${item.id}' has no ITEM_UI entry`)
      if (item.kind === 'custom' && !entry.Answer) {
        throw new Error(`bindGates: custom item '${item.id}' (gate '${gateId}') needs an Answer component`)
      }
    }
    out[gateId] = Object.freeze({ logic, ui })
  }
  return Object.freeze(out)
}
