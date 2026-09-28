/**
 * What the §3.13 lints run over: every chapter's gates.ts (placeholders have none), the fixture chapter and
 * the recall pool (its act-recall gates and every return-check pair the rotation can produce).
 */

import type { ChapterGates, GateLogic, ItemLogic } from '../../contracts/lesson'
import { GATES as FIXTURE_GATES } from '../fixture/gates'
import { RECALL_FALLBACK, RECALL_LOGIC, allRecallGates, recallGateOf, returnCheckPairs } from '../recall/pool'

const chapterModules = import.meta.glob<{ GATES: ChapterGates }>('../../chapters/*/gates.ts', { eager: true })

export interface GateSource {
  /** e.g. 'i2-stepping/stepping', 'lab-fixture/main', 'recall/iii9-cribs:0', 'return/r-windows+r-lengths'. */
  readonly name: string
  readonly logic: GateLogic
  /** The GateKey the runtime uses for this gate. */
  readonly key: `${string}/${string}`
}

export function chapterGates(): { chapter: string; gates: ChapterGates }[] {
  return Object.entries(chapterModules).map(([path, mod]) => ({ chapter: path.split('/').at(-2)!, gates: mod.GATES }))
}

export function gateSources(): GateSource[] {
  const out: GateSource[] = []
  for (const { chapter, gates } of chapterGates()) {
    for (const [id, logic] of Object.entries(gates)) out.push({ name: `${chapter}/${id}`, logic, key: `${chapter}/${id}` })
  }
  for (const [id, logic] of Object.entries(FIXTURE_GATES)) out.push({ name: `lab-fixture/${id}`, logic, key: `lab-fixture/${id}` })
  for (const [id, logic] of Object.entries(allRecallGates())) {
    out.push({ name: `recall/${id}`, logic, key: `${id.split(':')[0]}/recall` })
  }
  for (const [a, b] of returnCheckPairs()) {
    out.push({ name: `return/${a}+${b}`, logic: recallGateOf([a, b]), key: 'lab-fixture/return-0' })
  }
  return out
}

/** Every distinct item logic (items and fallbacks) across chapters, the fixture and the recall pool. */
export function allItemLogics(): { owner: string; logic: ItemLogic }[] {
  const seen = new Map<ItemLogic, string>()
  for (const { chapter, gates } of chapterGates()) {
    for (const g of Object.values(gates)) for (const l of [...g.items, g.fallback]) if (!seen.has(l)) seen.set(l, chapter)
  }
  for (const g of Object.values(FIXTURE_GATES)) for (const l of [...g.items, g.fallback]) if (!seen.has(l)) seen.set(l, 'lab-fixture')
  for (const l of [...Object.values(RECALL_LOGIC), RECALL_FALLBACK]) if (!seen.has(l)) seen.set(l, 'recall')
  return [...seen].map(([logic, owner]) => ({ owner, logic }))
}
