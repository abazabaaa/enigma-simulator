/**
 * V1–V13 (PLAN §3.13) over every registered chapter (placeholders included), the fixture chapter and the
 * recall pool.
 */

import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../content/registry'
import type { ChapterDef, ChapterGates, MechanismTag } from '../contracts/lesson'
import fixture from './fixture'
import { GATES as FIXTURE_GATES } from './fixture/gates'
import { RECALL_UI } from './recall/items'
import { RECALL_FALLBACK, RECALL_LOGIC, allRecallGates } from './recall/pool'
import {
  actEndingProblems,
  chapterProblems,
  itemProblems,
  itemUiProblems,
  registryProblems,
  type ChapterUnderTest,
} from './validate'

async function loadChapters(): Promise<ChapterUnderTest[]> {
  const out: ChapterUnderTest[] = []
  for (const meta of [...CHAPTERS].sort((a, b) => a.order - b.order)) {
    const mod = (await meta.load()) as { default: ChapterDef; PLACEHOLDER?: boolean }
    out.push({ id: meta.id, def: mod.default, meta, placeholder: mod.PLACEHOLDER === true })
  }
  return out
}

describe('V13 registry', () => {
  it('has 14 chapters with unique orders; only II.8 is optional', () => {
    expect(registryProblems(CHAPTERS)).toEqual([])
  })
})

describe('registered chapters (V1–V12)', async () => {
  const chapters = await loadChapters()
  const introduced = new Set<MechanismTag>()
  const cases = chapters.map((c) => {
    const before = new Set(introduced)
    for (const s of c.def.scenes) for (const t of s.introduces ?? []) introduced.add(t)
    return [c.id, c, before] as const
  })

  it.each(cases)('%s', (_id, c, before) => {
    expect(chapterProblems(c, before)).toEqual([])
  })

  it('V2 every act ends on a gate with a compute item', () => {
    expect(actEndingProblems(chapters)).toEqual([])
  })
})

describe('the fixture chapter', () => {
  it('passes V1–V12', () => {
    expect(chapterProblems({ id: 'lab-fixture', def: fixture, placeholder: false }, new Set())).toEqual([])
  })

  it('exercises every scene kind, every reveal trigger and every item kind', () => {
    const kinds = new Set(fixture.scenes.map((s) => s.kind))
    expect([...kinds].sort()).toEqual(['explore', 'gate', 'recall', 'story'])
    const triggers = new Set(fixture.scenes.flatMap((s) => (s.reveals ?? []).map((r) => r.trigger)))
    expect([...triggers].sort()).toEqual(['play', 'press', 'run', 'step', 'toggle'])
    const items = Object.values(FIXTURE_GATES).flatMap((g) => g.items.map((i) => i.kind))
    expect(new Set(items)).toEqual(
      new Set(['letter', 'letters', 'numbers', 'choice', 'order', 'chain', 'set-machine', 'ghost-pick', 'code', 'custom']),
    )
    expect(Object.values(FIXTURE_GATES).some((g) => g.puzzle)).toBe(true)
  })

  it('the validator catches broken content (self-test)', () => {
    const broken: ChapterDef = {
      ...fixture,
      scenes: [
        { ...fixture.scenes[0]!, story: { ...fixture.scenes[0]!.story!, text: 'word '.repeat(121), people: ['patent'] } },
        { ...fixture.scenes[0]!, id: 'story-2' },
        { ...fixture.scenes[1]!, reveals: [], freePress: true },
        { ...fixture.scenes[4]!, gate: 'nope' },
      ],
      facts: [...fixture.facts, { id: 'orphan', kind: 'number', text: 'x', source: 'https://example.com' }],
    }
    const problems = chapterProblems({ id: 'lab-fixture', def: broken, placeholder: false }, new Set())
    for (const rule of ['V3', 'V4', 'V6']) expect(problems.join('\n')).toContain(rule)
    expect(problems.join('\n')).toMatch(/120|words/)
    expect(problems.join('\n')).toContain("gate 'nope' does not resolve")
    expect(problems.join('\n')).toContain('two story scenes in a row')
  })
})

describe('the recall pool', () => {
  const gates: ChapterGates = allRecallGates()
  it('every item and the fallback have a UI, with Feedback where the rollback needs one (V1)', () => {
    expect(itemUiProblems('recall', [...Object.values(RECALL_LOGIC), RECALL_FALLBACK], RECALL_UI)).toEqual([])
  })
  it.each(Object.entries(gates))('%s: V9, V10, V12', (_name, g) => {
    const problems = [...g.items.flatMap((i) => itemProblems('recall', i, 'item')), ...itemProblems('recall', g.fallback, 'fallback')]
    expect(problems).toEqual([])
  })
  it('every recall item is once', () => {
    for (const l of Object.values(RECALL_LOGIC)) expect(l.rule).toEqual({ kind: 'once' })
  })
})
