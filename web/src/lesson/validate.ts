/**
 * The content validator (PLAN §3.13 V1–V13). Each check returns human-readable problems; validate.test.ts
 * runs them over every registered chapter, the fixture chapter and the recall pool.
 * Placeholder chapters (02's "Being written" stubs, which export PLACEHOLDER) skip the rules about a finished
 * chapter's shape (V2 endings, V3 act clocks, V7 fading, V11 recall).
 */

import type { AnyChapterId, ChapterId } from '../contracts/core'
import type { ChapterDef, ChapterMeta, ItemLogic, ItemUiMap, MechanismTag, Rollback, SceneDef } from '../contracts/lesson'
import { resolveStage } from '../contracts/stage'
import { validateConfig } from '../engine'
import { createRng, seedFor } from '../lib/rng'

export interface ChapterUnderTest {
  readonly id: AnyChapterId
  readonly def: ChapterDef
  readonly meta?: ChapterMeta
  readonly placeholder: boolean
}

const FEEDBACK_KINDS: readonly Rollback['kind'][] = ['cycles', 'perm', 'crib', 'menu', 'wires']
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** The rollback kinds an item produces for wrong answers (mutated solutions over a few seeds). */
export function rollbackKinds(l: ItemLogic, seeds = 30): Set<Rollback['kind']> {
  const kinds = new Set<Rollback['kind']>()
  for (let s = 0; s < seeds; s++) {
    const i = l.generate(createRng(seedFor('rollbacks', l.id, s)), {
      key: `lab-fixture/validate/${l.id}`,
      attempt: (s % 4) + 1,
      purpose: 'instance',
      previous: [],
    })
    const r = createRng(seedFor('rollback-answer', l.id, s))
    for (const a of [l.mutate(i, l.solve(i), r), l.sampleAnswer(i, r)]) {
      const res = l.check(i, a)
      if (!res.correct) kinds.add(res.rollback.kind)
    }
  }
  return kinds
}

/** V1 for a set of items against their ITEM_UI. */
export function itemUiProblems(where: string, items: readonly ItemLogic[], ui: ItemUiMap): string[] {
  const out: string[] = []
  for (const l of items) {
    const entry = ui[l.id]
    if (!entry) {
      out.push(`${where}: item ${l.id} has no ITEM_UI entry`)
      continue
    }
    if (l.kind === 'custom' && !entry.Answer) out.push(`${where}: custom item ${l.id} has no Answer`)
    const needs = [...rollbackKinds(l)].filter((k) => FEEDBACK_KINDS.includes(k))
    if (needs.length && !entry.Feedback) out.push(`${where}: item ${l.id} rolls back as ${needs.join('/')} but has no Feedback`)
  }
  return out
}

/** V9, V10, V12 (items) for one item over its lint seeds. */
export function itemProblems(where: string, l: ItemLogic, role: 'item' | 'fallback'): string[] {
  const out: string[] = []
  if ((l.transfer || l.constantAnswer) && l.rule.kind !== 'once') out.push(`${where}: ${l.id} is transfer/constantAnswer but not once (V9)`)
  if (role === 'fallback') {
    if (!l.inPage) out.push(`${where}: fallback ${l.id} is not inPage (V10)`)
    if (!['set-machine', 'ghost-pick', 'custom'].includes(l.kind)) out.push(`${where}: fallback ${l.id} is a ${l.kind} item (V10)`)
  }
  const n = l.lintSeeds ?? 300
  for (let s = 0; s < n; s++) {
    const i = l.generate(createRng(seedFor('lint', l.id, s)), { key: `lab-fixture/validate/${l.id}`, attempt: (s % 4) + 1, purpose: 'instance', previous: [] })
    const setup = l.setup?.(i)
    if (setup?.machine) {
      const problems = validateConfig(setup.machine)
      if (problems.length) {
        out.push(`${where}: ${l.id} seed ${s}: setup.machine is invalid: ${problems.join('; ')} (V12)`)
        break
      }
    }
    if (l.kind === 'set-machine') {
      const unlocked = (i as { unlocked?: readonly string[] }).unlocked ?? []
      const locked = unlocked.filter((k) => (setup?.locks as Record<string, boolean> | undefined)?.[k])
      if (locked.length) {
        out.push(`${where}: ${l.id} seed ${s}: unlocked ${locked.join(', ')} is locked by its setup (V12)`)
        break
      }
    }
  }
  return out
}

function stageFocus(scene: SceneDef): string | null {
  return scene.stage === null ? null : resolveStage(scene.stage).focus
}

/** Every check of one chapter. `introducedBefore` holds the tags introduced by earlier chapters (V6). */
export function chapterProblems(c: ChapterUnderTest, introducedBefore: ReadonlySet<MechanismTag>): string[] {
  const out: string[] = []
  const { def, id } = c
  const at = (s: SceneDef) => `${id}/${s.id}`
  if (def.id !== id) out.push(`${id}: def.id is ${def.id}`)

  // V1 identity.
  const ids = def.scenes.map((s) => s.id)
  if (new Set(ids).size !== ids.length) out.push(`${id}: duplicate scene ids`)
  const betIds = def.scenes.flatMap((s) => (s.bets ?? []).map((b) => b.id))
  if (new Set(betIds).size !== betIds.length) out.push(`${id}: duplicate bet ids`)
  if (def.scenes.length === 0) out.push(`${id}: no scenes`)
  for (const s of def.scenes) {
    const tasks = (s.tasks ?? []).map((t) => t.id)
    if (new Set(tasks).size !== tasks.length) out.push(`${at(s)}: duplicate task ids`)
    if (s.kind === 'gate' && (!s.gate || !def.gates[s.gate])) out.push(`${at(s)}: gate '${s.gate}' does not resolve`)
    if (s.kind !== 'gate' && s.gate) out.push(`${at(s)}: gate on a ${s.kind} scene`)
    if (s.kind === 'recall' && !s.recall) out.push(`${at(s)}: recall scene without recall`)
    if ((s.kind === 'story' || s.kind === 'recall') && s.View) out.push(`${at(s)}: ${s.kind} scenes have no View`)
  }
  for (const [gid, b] of Object.entries(def.gates)) {
    out.push(...itemUiProblems(`${id}/${gid}`, [...b.logic.items, b.logic.fallback], b.ui))
    const itemIds = b.logic.items.map((i) => i.id)
    if (new Set(itemIds).size !== itemIds.length) out.push(`${id}/${gid}: duplicate item ids`)
    // V8 pairing.
    if (b.logic.items.some((i) => i.kind === 'code') && !b.logic.items.some((i) => i.kind !== 'code' && i.inPage)) {
      out.push(`${id}/${gid}: a code item needs an inPage item in the same gate (V8)`)
    }
    for (const it of b.logic.items) out.push(...itemProblems(`${id}/${gid}`, it, 'item'))
    out.push(...itemProblems(`${id}/${gid}`, b.logic.fallback, 'fallback'))
  }

  // V3 story.
  const facts = new Map(def.facts.map((f) => [f.id, f]))
  const referenced = new Set<string>()
  def.scenes.forEach((s, k) => {
    if (s.story && s.kind !== 'story') out.push(`${at(s)}: story on a ${s.kind} scene (V3)`)
    if (s.kind === 'story') {
      if (!s.story) {
        out.push(`${at(s)}: story scene without a story (V3)`)
        return
      }
      if (k > 0 && def.scenes[k - 1]!.kind === 'story') out.push(`${at(s)}: two story scenes in a row (V3)`)
      if (words(s.story.text) > 120) out.push(`${at(s)}: story has ${words(s.story.text)} words (V3)`)
      const people = s.story.people.map((p) => facts.get(p))
      if (people.length === 0 || people.some((p) => p?.kind !== 'person')) out.push(`${at(s)}: people must be person facts (V3)`)
      if (facts.get(s.story.date)?.kind !== 'date') out.push(`${at(s)}: date must be a date fact (V3)`)
      if (s.story.clock && facts.get(s.story.clock.date)?.kind !== 'date') out.push(`${at(s)}: clock date must be a date fact (V3)`)
      for (const f of s.story.facts ?? []) if (!facts.has(f)) out.push(`${at(s)}: fact ${f} does not resolve (V3)`)
      for (const f of [...s.story.people, s.story.date, ...(s.story.facts ?? []), ...(s.story.clock ? [s.story.clock.date] : [])]) {
        referenced.add(f)
      }
      if (s.stage !== null) out.push(`${at(s)}: story scenes have no stage`)
    }
  })
  if (!c.placeholder && (['prologue', 'ii5-indicators', 'iii9-cribs', 'iv-capstone'] as string[]).includes(id)) {
    const first = def.scenes.find((s) => s.kind === 'story')
    if (!first?.story?.clock) out.push(`${id}: the first story scene needs an act clock (V3)`)
  }

  // V4 facts.
  const factIds = def.facts.map((f) => f.id)
  if (new Set(factIds).size !== factIds.length) out.push(`${id}: duplicate fact ids (V4)`)
  for (const f of def.facts) {
    if (!/^https:\/\/\S+$/.test(f.source)) out.push(`${id}: fact ${f.id} needs an https source (V4)`)
    if (!referenced.has(f.id)) out.push(`${id}: fact ${f.id} is never referenced (V4)`)
  }

  // V5 one component per scene (Acts I and II).
  if (c.meta && (c.meta.act === 'I' || c.meta.act === 'II')) {
    for (const s of def.scenes) {
      if ((s.kind === 'explore' || s.kind === 'gate') && s.stage !== null && stageFocus(s) === 'overview') {
        out.push(`${at(s)}: focus 'overview' in Acts I–II (V5)`)
      }
    }
  }

  // V6 bets.
  const introduced = new Set(introducedBefore)
  for (const s of def.scenes) {
    const bets = new Set((s.bets ?? []).map((b) => b.id))
    const reveals = s.reveals ?? []
    if ((s.bets ?? []).length > 3) out.push(`${at(s)}: more than 3 bets (G10)`)
    if (s.introduces?.length && reveals.length === 0) out.push(`${at(s)}: introduces without a reveal (V6)`)
    for (const r of reveals) if (!bets.has(r.bet)) out.push(`${at(s)}: reveal ${r.bet} has no bet (V6)`)
    for (const b of bets) if (!reveals.some((r) => r.bet === b)) out.push(`${at(s)}: bet ${b} is never revealed (V6)`)
    for (const b of s.bets ?? []) {
      if (b.kind === 'choice' && !(b.options?.length ?? 0)) out.push(`${at(s)}: choice bet ${b.id} has no options`)
    }
    if (s.freePress) {
      if (!s.shows?.length) out.push(`${at(s)}: freePress needs shows (V6)`)
      for (const t of s.shows ?? []) if (!introduced.has(t)) out.push(`${at(s)}: shows '${t}' before it is introduced (V6)`)
    }
    const animates = s.stage !== null && resolveStage(s.stage).trace === 'animate'
    if (s.panels?.keyboard && animates && !s.introduces?.length && !s.freePress) {
      out.push(`${at(s)}: keyboard with an animated trace needs introduces or freePress (V6)`)
    }
    for (const t of s.introduces ?? []) introduced.add(t)
  }

  if (!c.placeholder) {
    const firstGate = def.scenes.findIndex((s) => s.kind === 'gate')
    // V2 endings.
    if (id !== 'prologue' && def.scenes.at(-1)?.kind !== 'gate') out.push(`${id}: must end with a gate scene (V2)`)
    // V7 fading.
    const order = c.meta?.order ?? 0
    const workedBefore = def.scenes.slice(0, firstGate === -1 ? undefined : firstGate).some((s) => s.worked)
    if (order <= 5 && firstGate !== -1 && !workedBefore) out.push(`${id}: needs a worked scene before its first gate (V7)`)
    if (order >= 6 && def.scenes.some((s) => s.worked)) out.push(`${id}: no worked scenes from II.6 on (V7)`)
    // V11 recall.
    if ((['ii5-indicators', 'iii9-cribs', 'iv-capstone'] as string[]).includes(id) && def.scenes[0]?.kind !== 'recall') {
      out.push(`${id}: must start with a recall scene (V11)`)
    }
  }

  // V12 scene setups.
  for (const s of def.scenes) {
    if (s.setup?.machine) {
      const problems = validateConfig(s.setup.machine)
      if (problems.length) out.push(`${at(s)}: setup.machine is invalid: ${problems.join('; ')} (V12)`)
    }
  }
  return out
}

/** V2 act endings: the last required chapter of each act ends on a gate with a compute item. */
export function actEndingProblems(chapters: readonly ChapterUnderTest[]): string[] {
  const out: string[] = []
  const byId = new Map(chapters.map((c) => [c.id, c]))
  const ii8 = byId.get('ii8-sheets')
  const ii8HasGate = !!ii8 && !ii8.placeholder && ii8.def.scenes.at(-1)?.kind === 'gate'
  const enders: ChapterId[] = ['i4-permutations', ii8HasGate ? 'ii8-sheets' : 'ii7-catalogue', 'iii12-checking', 'iv-capstone']
  for (const id of enders) {
    const c = byId.get(id)
    if (!c || c.placeholder) continue
    const last = c.def.scenes.at(-1)
    const gate = last?.kind === 'gate' && last.gate ? c.def.gates[last.gate] : undefined
    if (!gate || !gate.logic.items.some((i) => i.compute)) out.push(`${id}: the act must end on a gate with a compute item (V2)`)
  }
  return out
}

/** V13 registry. */
export function registryProblems(metas: readonly ChapterMeta[]): string[] {
  const out: string[] = []
  if (metas.length !== 14) out.push(`registry has ${metas.length} chapters, not 14 (V13)`)
  const orders = metas.map((m) => m.order)
  if (new Set(orders).size !== orders.length) out.push('registry orders are not unique (V13)')
  const ids = metas.map((m) => m.id)
  if (new Set(ids).size !== ids.length) out.push('registry ids are not unique (V13)')
  for (const m of metas) if (m.optional && m.id !== 'ii8-sheets') out.push(`${m.id}: only II.8 may be optional (V13)`)
  return out
}
