/**
 * Progress persistence (PLAN §2.2 item 8, §3.8): a zustand store persisted as plain JSON (a ProgressV1) in
 * localStorage['enigma.progress.v1'] with version 1.
 *  - A value that does not parse, or has another version or shape, is copied to 'enigma.progress.corrupt';
 *    progress starts fresh and `notice.corrupt` is raised (ProgressNotices shows it).
 *  - When storage throws, lib/storage keeps the value in memory and `notice.storageFailed` raises a banner.
 *  - The salt comes from ?seed=<salt> or is random.
 * Instance seeds live in the gate records, so a reload never rerolls an instance.
 */

import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import type { AnyChapterId, BetKey, GateKey } from '../contracts/core'
import type { GateRecord, ItemRecord, OutcomeResult } from '../contracts/lesson'
import { PROGRESS_CORRUPT_KEY, PROGRESS_KEY, type BetRecord, type ProgressV1 } from '../contracts/progress'
import { getFlags } from '../lib/flags'
import { storage as defaultStorage, type SafeStorage } from '../lib/storage'
import { MAX_REDRAW, OUTCOME_CAP } from './rules'

export type ChapterProgress = NonNullable<ProgressV1['chapters'][AnyChapterId]>

export interface ProgressNotice {
  /** The previous value could not be read and was moved to PROGRESS_CORRUPT_KEY. */
  readonly corrupt: boolean
  /** Storage refused a write: progress lives in memory for this session. */
  readonly storageFailed: boolean
}

export interface ProgressStore extends ProgressV1 {
  readonly notice: ProgressNotice
  setGate(key: GateKey, rec: GateRecord): void
  patchChapter(id: AnyChapterId, patch: Partial<ChapterProgress>): void
  addTask(id: AnyChapterId, task: string): void
  setBet(key: BetKey, rec: BetRecord): void
  noteRecall(itemId: string, result: OutcomeResult, now: number): void
  visit(now: number): void
  setSalt(salt: string): void
  setPrefs(prefs: Partial<ProgressV1['prefs']>): void
  /** Fresh progress with a new salt (or the ?seed salt). */
  reset(now: number): void
  dismissNotice(): void
}

export const DEFAULT_PREFS: ProgressV1['prefs'] = { speed: 1, motion: 'system', stage: 'auto', labels: true }

/** A random salt (not an assessment seed: gates derive every seed from it through seedFor). */
export function randomSalt(): string {
  const bytes = new Uint8Array(6)
  try {
    globalThis.crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Date.now() >> (i * 3)) & 0xff
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function freshProgress(now: number, salt: string): ProgressV1 {
  return {
    version: 1,
    salt,
    createdAt: now,
    lastVisit: now,
    chapters: {},
    gates: {},
    bets: {},
    recall: {},
    prefs: DEFAULT_PREFS,
  }
}

// ---------------------------------------------------------------------------
// Validation: anything that is not a well-formed ProgressV1 is quarantined
// ---------------------------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/** A non-negative number (a time, a duration). */
const isTime = (x: unknown): x is number => isNum(x) && x >= 0
/** An integer in [lo, hi]. */
const isInt = (x: unknown, lo: number, hi = Number.MAX_SAFE_INTEGER): x is number =>
  isNum(x) && Number.isInteger(x) && x >= lo && x <= hi
const isSeed = (x: unknown) => isInt(x, 0, 0xffffffff)
const RESULTS: readonly OutcomeResult[] = ['correct', 'wrong', 'revealed']

/** A well-formed ItemRecord with every value in range (anything else is quarantined, never clamped). */
function validItem(x: unknown): x is ItemRecord {
  if (!isObj(x)) return false
  if (
    !isInt(x.attempt, 1) ||
    !isSeed(x.seed) ||
    !isInt(x.redraw, 0, MAX_REDRAW) ||
    !isTime(x.shownAt) ||
    !isInt(x.wrong, 0)
  ) {
    return false
  }
  if (typeof x.fallbackNext !== 'boolean' || typeof x.passed !== 'boolean' || !Array.isArray(x.outcomes)) return false
  if (x.outcomes.length > OUTCOME_CAP) return false
  return x.outcomes.every(
    (o) =>
      isObj(o) &&
      RESULTS.includes(o.result as OutcomeResult) &&
      isTime(o.ms) &&
      isSeed(o.seed) &&
      typeof o.fallback === 'boolean' &&
      [0, 1, 2, 3].includes(o.hintLevel as number) &&
      isTime(o.at),
  )
}

/** The ProgressV1 in `raw`, or null when it is not one (bad JSON, another version, a broken record). */
export function parseProgress(raw: string): ProgressV1 | null {
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    !isObj(v) ||
    v.version !== 1 ||
    typeof v.salt !== 'string' ||
    v.salt === '' ||
    !isTime(v.createdAt) ||
    !isTime(v.lastVisit)
  ) {
    return null
  }
  if (!isObj(v.chapters) || !isObj(v.gates) || !isObj(v.bets) || !isObj(v.recall) || !isObj(v.prefs)) return null
  for (const c of Object.values(v.chapters)) {
    if (!isObj(c) || !isInt(c.reached, 0) || typeof c.completed !== 'boolean') return null
    if (!Array.isArray(c.tasks) || !c.tasks.every((t) => typeof t === 'string')) return null
  }
  for (const g of Object.values(v.gates)) {
    if (!isObj(g) || typeof g.passed !== 'boolean' || !isObj(g.items) || !Object.values(g.items).every(validItem))
      return null
  }
  for (const b of Object.values(v.bets)) {
    if (
      !isObj(b) ||
      typeof b.value !== 'string' ||
      !isTime(b.at) ||
      ![true, false, null].includes(b.correct as boolean | null)
    ) {
      return null
    }
  }
  for (const r of Object.values(v.recall)) {
    if (!isObj(r) || !isTime(r.lastSeen) || !isInt(r.correct, 0) || !isInt(r.wrong, 0)) return null
  }
  return { ...(v as unknown as ProgressV1), prefs: { ...DEFAULT_PREFS, ...(v.prefs as object) } }
}

const PERSISTED: readonly (keyof ProgressV1)[] = [
  'version',
  'salt',
  'createdAt',
  'lastVisit',
  'chapters',
  'gates',
  'bets',
  'recall',
  'prefs',
]

export function toProgress(s: ProgressV1): ProgressV1 {
  return Object.fromEntries(PERSISTED.map((k) => [k, s[k]])) as unknown as ProgressV1
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export interface ProgressStoreOptions {
  readonly storage?: SafeStorage
  /** Salt for fresh progress (default: ?seed, else random). */
  readonly seed?: string | null
  readonly now?: () => number
}

export function createProgressStore(o: ProgressStoreOptions = {}) {
  const store = o.storage ?? defaultStorage
  const clock = o.now ?? Date.now
  const saltFor = () => o.seed ?? randomSalt()
  let corrupt = false
  let failed = !store.persistent

  const adapter: PersistStorage<ProgressV1> = {
    getItem(name) {
      const raw = store.get(name)
      if (raw === null) return null
      const parsed = parseProgress(raw)
      if (parsed) return { state: parsed, version: 1 }
      store.set(PROGRESS_CORRUPT_KEY, raw)
      store.remove(name)
      corrupt = true
      return null
    },
    setItem(name, value) {
      if (!store.set(name, JSON.stringify(value.state)) && !failed) {
        failed = true
        queueMicrotask(() => hook.setState((s) => ({ notice: { ...s.notice, storageFailed: true } })))
      }
    },
    removeItem(name) {
      store.remove(name)
    },
  }

  const hook = create<ProgressStore>()(
    persist(
      (set) => ({
        ...freshProgress(clock(), saltFor()),
        notice: { corrupt: false, storageFailed: false },
        setGate: (key, rec) => set((s) => (s.gates[key] === rec ? s : { gates: { ...s.gates, [key]: rec } })),
        patchChapter: (id, patch) =>
          set((s) => {
            const prev: ChapterProgress = s.chapters[id] ?? { reached: 0, completed: false, tasks: [] }
            return { chapters: { ...s.chapters, [id]: { ...prev, ...patch } } }
          }),
        addTask: (id, task) =>
          set((s) => {
            const prev: ChapterProgress = s.chapters[id] ?? { reached: 0, completed: false, tasks: [] }
            // Returning the same state object is a true no-op (no listener runs).
            if (prev.tasks.includes(task)) return s
            return { chapters: { ...s.chapters, [id]: { ...prev, tasks: [...prev.tasks, task] } } }
          }),
        setBet: (key, rec) => set((s) => ({ bets: { ...s.bets, [key]: rec } })),
        noteRecall: (itemId, result, now) =>
          set((s) => {
            const prev = s.recall[itemId] ?? { lastSeen: 0, correct: 0, wrong: 0 }
            const next = {
              lastSeen: now,
              correct: prev.correct + (result === 'correct' ? 1 : 0),
              wrong: prev.wrong + (result === 'correct' ? 0 : 1),
            }
            return { recall: { ...s.recall, [itemId]: next } }
          }),
        visit: (now) => set((s) => (s.lastVisit === now ? s : { lastVisit: now })),
        setSalt: (salt) => set({ salt }),
        setPrefs: (prefs) => set((s) => ({ prefs: { ...s.prefs, ...prefs } })),
        reset: (now) => set({ ...freshProgress(now, saltFor()) }),
        dismissNotice: () => set((s) => ({ notice: { ...s.notice, corrupt: false } })),
      }),
      {
        name: PROGRESS_KEY,
        version: 1,
        storage: adapter,
        partialize: (s) => toProgress(s),
        merge: (persisted, current) => ({ ...current, ...(persisted as ProgressV1) }),
      },
    ),
  )
  if (corrupt || failed) hook.setState((s) => ({ notice: { ...s.notice, corrupt, storageFailed: failed } }))
  if (o.seed && hook.getState().salt !== o.seed) hook.getState().setSalt(o.seed)
  return hook
}

export type ProgressHook = ReturnType<typeof createProgressStore>

/** The app's progress (created when the lesson runtime first loads). */
export const useProgress: ProgressHook = createProgressStore({ seed: getFlags().seed })

export function progressSnapshot(): ProgressV1 {
  return JSON.parse(JSON.stringify(toProgress(useProgress.getState()))) as ProgressV1
}
