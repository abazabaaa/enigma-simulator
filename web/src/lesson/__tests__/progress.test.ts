import { describe, expect, it } from 'vitest'
import { PROGRESS_CORRUPT_KEY, PROGRESS_KEY } from '../../contracts/progress'
import type { SafeStorage } from '../../lib/storage'
import { createProgressStore, freshProgress, parseProgress } from '../progress'

function memory(
  init: Record<string, string> = {},
  o: { failWrites?: boolean } = {},
): SafeStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  let ok = true
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set(k, v) {
      data.set(k, v)
      if (o.failWrites) ok = false
      return !o.failWrites
    },
    remove: (k) => void data.delete(k),
    get persistent() {
      return ok
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

/** Values out of range are quarantined, never clamped (review m7). */
function outOfRange(): [string, string][] {
  const item = {
    attempt: 2,
    seed: 7,
    redraw: 0,
    shownAt: 5,
    outcomes: [],
    wrong: 0,
    fallbackNext: false,
    passed: false,
  }
  const outcome = { result: 'wrong', ms: 10, seed: 7, fallback: false, hintLevel: 0, at: 5 }
  const withItem = (patch: object) =>
    JSON.stringify({
      ...freshProgress(1, 's'),
      gates: { 'lab-fixture/main': { passed: false, items: { a: { ...item, ...patch } } } },
    })
  return [
    ['wrong < 0', withItem({ wrong: -5 })],
    ['a fractional attempt', withItem({ attempt: 1.5 })],
    ['attempt 0', withItem({ attempt: 0 })],
    ['a seed beyond 32 bits', withItem({ seed: 2 ** 33 })],
    ['redraw > 20', withItem({ redraw: 21 })],
    ['a negative outcome time', withItem({ outcomes: [{ ...outcome, ms: -1 }] })],
    ['hint level 4', withItem({ outcomes: [{ ...outcome, hintLevel: 4 }] })],
    ['more than 20 outcomes', withItem({ outcomes: Array.from({ length: 21 }, () => outcome) })],
    [
      'reached < 0',
      JSON.stringify({
        ...freshProgress(1, 's'),
        chapters: { prologue: { reached: -4, completed: false, tasks: [] } },
      }),
    ],
    ['a negative lastVisit', JSON.stringify({ ...freshProgress(1, 's'), lastVisit: -1 })],
    [
      'a bet with a bad verdict',
      JSON.stringify({ ...freshProgress(1, 's'), bets: { 'lab-fixture/x': { value: 'A', correct: 'yes', at: 1 } } }),
    ],
  ]
}

describe('progress persistence', () => {
  it('starts fresh with the given salt and writes plain ProgressV1 JSON', () => {
    const s = memory()
    const store = createProgressStore({ storage: s, seed: 'abc', now: () => 1000 })
    expect(store.getState()).toMatchObject({ version: 1, salt: 'abc', createdAt: 1000, lastVisit: 1000 })
    store.getState().patchChapter('i1-anatomy', { reached: 2 })
    const saved = JSON.parse(s.data.get(PROGRESS_KEY)!)
    expect(saved).toMatchObject({
      version: 1,
      salt: 'abc',
      chapters: { 'i1-anatomy': { reached: 2, completed: false, tasks: [] } },
    })
    expect(saved).not.toHaveProperty('notice')
    expect(parseProgress(s.data.get(PROGRESS_KEY)!)).not.toBeNull()
  })

  it('restores saved progress exactly (seeds included) on the next load', () => {
    const s = memory()
    const a = createProgressStore({ storage: s, seed: 'abc' })
    const rec = {
      attempt: 3,
      seed: 12345,
      redraw: 2,
      shownAt: 7,
      outcomes: [],
      wrong: 0,
      fallbackNext: false,
      passed: false,
    }
    a.getState().setGate('lab-fixture/main', { items: { 'toy-lamp': rec }, passed: false })
    const b = createProgressStore({ storage: s })
    expect(b.getState().gates['lab-fixture/main']!.items['toy-lamp']).toEqual(rec)
    expect(b.getState().salt).toBe('abc')
    expect(b.getState().notice).toEqual({ corrupt: false, storageFailed: false })
  })

  it.each([
    ['not JSON', '{nope'],
    ['another version', JSON.stringify({ ...freshProgress(1, 's'), version: 2 })],
    [
      'a broken gate record',
      JSON.stringify({ ...freshProgress(1, 's'), gates: { 'x/y': { passed: false, items: { a: { attempt: 'x' } } } } }),
    ],
    ['zustand-wrapped state', JSON.stringify({ state: freshProgress(1, 's'), version: 1 })],
    ...outOfRange(),
  ])('quarantines %s and starts fresh with a notice', (_label, raw) => {
    const s = memory({ [PROGRESS_KEY]: raw })
    const store = createProgressStore({ storage: s, seed: 'fresh' })
    expect(s.data.get(PROGRESS_CORRUPT_KEY)).toBe(raw)
    expect(store.getState()).toMatchObject({ salt: 'fresh', gates: {}, chapters: {} })
    expect(store.getState().notice.corrupt).toBe(true)
    store.getState().dismissNotice()
    expect(store.getState().notice.corrupt).toBe(false)
  })

  it('keeps progress in memory with a banner when storage refuses writes', async () => {
    const s = memory({}, { failWrites: true })
    const store = createProgressStore({ storage: s, seed: 'm' })
    store.getState().addTask('prologue', 'type-a-word/type5')
    await flush()
    expect(store.getState().chapters.prologue?.tasks).toEqual(['type-a-word/type5'])
    expect(store.getState().notice.storageFailed).toBe(true)
  })

  it('raises the banner at once when storage is unavailable', () => {
    const s = {
      ...memory(),
      get persistent() {
        return false
      },
    }
    expect(createProgressStore({ storage: s }).getState().notice.storageFailed).toBe(true)
  })

  it('?seed overrides the salt of existing progress', () => {
    const s = memory()
    createProgressStore({ storage: s, seed: 'one' }).getState().visit(5)
    expect(createProgressStore({ storage: s, seed: 'two' }).getState().salt).toBe('two')
  })

  it('records recall statistics and resets to fresh progress', () => {
    const store = createProgressStore({ storage: memory(), seed: 'r' })
    store.getState().noteRecall('r-windows', 'correct', 10)
    store.getState().noteRecall('r-windows', 'revealed', 20)
    expect(store.getState().recall['r-windows']).toEqual({ lastSeen: 20, correct: 1, wrong: 1 })
    store.getState().reset(99)
    expect(store.getState()).toMatchObject({ recall: {}, createdAt: 99, lastVisit: 99, salt: 'r' })
  })
})
