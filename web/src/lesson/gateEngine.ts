/**
 * The gate engine: PURE functions over (GateLogic, GateRecord) that the gate UI, window.__course, the
 * guess bot and the CC learner share, so every path scores through the same code (PLAN §3.5).
 *
 * Instances are never stored: an item's current instance is regenerated from its persisted seed.
 *  - A normal instance: generate(createRng(seed), { key, attempt, purpose 'instance', previous }), where
 *    `previous` is the canonical list of the last ≤ 3 non-fallback instances, each regenerated from its
 *    outcome's seed with previous = []. Generators must not depend on ctx.previous (repeat avoidance is
 *    drawInstance's job, through same()).
 *  - A fallback instance (fallbackNext): the gate's fallback logic at fallbackSeed(…, attempt).
 * Outcome j of n was answered on attempt (rec.attempt − (n − j)).
 */

import type { GateKey, ItemKey } from '../contracts/core'
import type {
  CheckResult,
  GateLogic,
  GateRecord,
  ItemLogic,
  ItemRecord,
  ItemRuntimeView,
  RuleConfig,
} from '../contracts/lesson'
import type { LessonEvent } from '../contracts/progress'
import { createRng } from '../lib/rng'
import { DEFAULT_RULES, drawInstance, drawWorked, gatePassed, hintLevel, isGaming, newItemRecord, reduceItem } from './rules'

export interface GateCtx {
  readonly key: GateKey
  readonly logic: GateLogic
  readonly salt: string
  readonly cfg?: RuleConfig
}

export const EMPTY_GATE: GateRecord = Object.freeze({ items: Object.freeze({}), passed: false })

export function itemKeyOf(gate: GateKey, itemId: string): ItemKey {
  return `${gate}/${itemId}` as ItemKey
}

/** The first item that has not passed (items are shown one at a time, in order), or null. */
export function currentItem(logic: GateLogic, rec: GateRecord | undefined): ItemLogic | null {
  return logic.items.find((it) => rec?.items[it.id]?.passed !== true) ?? null
}

// ---------------------------------------------------------------------------
// Instances (memoised: prompts, widgets and __course.gate() ask for the same instance many times)
// ---------------------------------------------------------------------------

const cache = new Map<string, unknown>()
const CACHE_MAX = 400

function instanceAt(
  l: ItemLogic,
  key: ItemKey,
  seed: number,
  attempt: number,
  purpose: 'instance' | 'worked' | 'fallback',
  previous: readonly unknown[],
  previousTag: string,
): unknown {
  const k = `${l.id}|${key}|${seed}|${attempt}|${purpose}|${previousTag}`
  if (cache.has(k)) return cache.get(k)
  const instance = l.generate(createRng(seed), { key, attempt, purpose, previous })
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(k, instance)
  return instance
}

function previousRefs(rec: ItemRecord): { seed: number; attempt: number }[] {
  const n = rec.outcomes.length
  const refs: { seed: number; attempt: number }[] = []
  rec.outcomes.forEach((o, j) => {
    if (!o.fallback) refs.push({ seed: o.seed, attempt: rec.attempt - (n - j) })
  })
  return refs.slice(-3)
}

/** The canonical previous instances of an item's current attempt (the last ≤ 3 non-fallback ones). */
export function previousInstances(l: ItemLogic, key: ItemKey, rec: ItemRecord): unknown[] {
  return previousRefs(rec).map((p) => instanceAt(l, key, p.seed, p.attempt, 'instance', [], ''))
}

export interface Shown {
  /** The logic that generated and checks the instance: the gate's fallback when `fallback`. */
  readonly logic: ItemLogic
  readonly instance: unknown
  readonly fallback: boolean
}

/** The instance an item record currently shows. */
export function shownInstance(ctx: GateCtx, item: ItemLogic, rec: ItemRecord): Shown {
  const key = itemKeyOf(ctx.key, item.id)
  if (rec.fallbackNext) {
    const l = ctx.logic.fallback
    return { logic: l, fallback: true, instance: instanceAt(l, key, rec.seed, rec.attempt, 'fallback', [], '') }
  }
  const refs = previousRefs(rec)
  const previous = previousInstances(item, key, rec)
  const tag = refs.map((p) => `${p.attempt}:${p.seed}`).join(',')
  return { logic: item, fallback: false, instance: instanceAt(item, key, rec.seed, rec.attempt, 'instance', previous, tag) }
}

/** Settle a record's redraw: a normal instance that repeats one of the last 3 is redrawn (G3). */
export function settle(ctx: GateCtx, item: ItemLogic, rec: ItemRecord): ItemRecord {
  if (rec.fallbackNext) return rec
  const key = itemKeyOf(ctx.key, item.id)
  const d = drawInstance(item, ctx.salt, key, rec.attempt, previousInstances(item, key, rec))
  return d.seed === rec.seed && d.redraw === rec.redraw ? rec : { ...rec, seed: d.seed, redraw: d.redraw }
}

/** The worked example for hint L2: an instance different from the current one and from the next one. */
export function workedFor(ctx: GateCtx, item: ItemLogic, rec: ItemRecord): { instance: unknown; seed: number; solution: unknown; logic: ItemLogic } {
  const key = itemKeyOf(ctx.key, item.id)
  const shown = shownInstance(ctx, item, rec)
  let next: unknown = shown.instance
  if (!shown.fallback) {
    const previous = [...previousInstances(item, key, rec), shown.instance].slice(-3)
    next = drawInstance(item, ctx.salt, key, rec.attempt + 1, previous).instance
  }
  const w = drawWorked(shown.logic, ctx.salt, key, rec.attempt, shown.instance, next)
  return { ...w, solution: shown.logic.solve(w.instance), logic: shown.logic }
}

// ---------------------------------------------------------------------------
// Records and views
// ---------------------------------------------------------------------------

/** The gate record with a record for its current item (created on first show). Unchanged when present. */
export function ensureCurrent(ctx: GateCtx, rec: GateRecord | undefined, now: number): GateRecord {
  const gate = rec ?? EMPTY_GATE
  const item = currentItem(ctx.logic, gate)
  if (!item || gate.items[item.id]) return gate
  const fresh = settle(ctx, item, newItemRecord(ctx.salt, itemKeyOf(ctx.key, item.id), now))
  return { ...gate, items: { ...gate.items, [item.id]: fresh } }
}

const NOT_STARTED = { attempt: 0, seed: 0, hintLevel: 0, fallback: false, passed: false, window: [], instance: null } as const

export function itemView(ctx: GateCtx, item: ItemLogic, rec: ItemRecord | undefined, withInstance: boolean): ItemRuntimeView {
  const key = itemKeyOf(ctx.key, item.id)
  if (!rec) return { key, itemId: item.id, kind: item.kind, rule: item.rule, ...NOT_STARTED }
  const shown = withInstance ? shownInstance(ctx, item, rec) : null
  return {
    key,
    itemId: item.id,
    kind: rec.fallbackNext ? ctx.logic.fallback.kind : item.kind,
    rule: item.rule,
    attempt: rec.attempt,
    seed: rec.seed,
    hintLevel: hintLevel(rec, !!ctx.logic.puzzle),
    fallback: rec.fallbackNext,
    passed: rec.passed,
    window: rec.outcomes.slice(-3).map((o) => o.result),
    instance: shown ? shown.instance : null,
  }
}

export interface GateView {
  readonly key: GateKey
  readonly passed: boolean
  readonly current: ItemRuntimeView | null
  readonly items: readonly ItemRuntimeView[]
}

export function gateView(ctx: GateCtx, rec: GateRecord | undefined): GateView {
  const gate = rec ?? EMPTY_GATE
  const cur = currentItem(ctx.logic, gate)
  return {
    key: ctx.key,
    passed: gate.passed,
    current: cur ? itemView(ctx, cur, gate.items[cur.id], true) : null,
    items: ctx.logic.items.map((it) => itemView(ctx, it, gate.items[it.id], false)),
  }
}

// ---------------------------------------------------------------------------
// Scoring actions
// ---------------------------------------------------------------------------

export interface ActionResult {
  readonly gate: GateRecord
  readonly events: readonly LessonEvent[]
  /** The instance that was answered or revealed, with its logic. */
  readonly shown: Shown
  readonly itemPassed: boolean
  readonly gatePassed: boolean
}

export interface SubmitResult extends ActionResult {
  readonly result: CheckResult
}

function currentRecord(ctx: GateCtx, rec: GateRecord, itemId: string): { item: ItemLogic; item_rec: ItemRecord } {
  const item = currentItem(ctx.logic, rec)
  if (!item || item.id !== itemId) {
    throw new Error(`'${itemId}' is not the current item of ${ctx.key} (current: ${item?.id ?? 'none'})`)
  }
  const item_rec = rec.items[itemId]
  if (!item_rec) throw new Error(`'${itemId}' has not been shown yet`)
  return { item, item_rec }
}

function finish(
  ctx: GateCtx,
  gate: GateRecord,
  item: ItemLogic,
  before: ItemRecord,
  after: ItemRecord,
  events: LessonEvent[],
  shown: Shown,
): ActionResult {
  const key = itemKeyOf(ctx.key, item.id)
  if (!before.passed && after.passed) events.push({ type: 'item.passed', item: key })
  if (after.fallbackNext) {
    const reason = isGaming(after, ctx.cfg ?? DEFAULT_RULES)
    if (reason) events.push({ type: 'gaming', item: key, reason })
  }
  const items = { ...gate.items, [item.id]: after }
  const nowPassed = gate.passed || gatePassed({ items, passed: false }, ctx.logic)
  if (nowPassed && !gate.passed) events.push({ type: 'gate.passed', gate: ctx.key })
  return {
    gate: { items, passed: nowPassed },
    events,
    shown,
    itemPassed: after.passed,
    gatePassed: nowPassed,
  }
}

/** Score an answer to the current item (rules 1–6). Throws if `itemId` is not the current item. */
export function submitAnswer(ctx: GateCtx, rec: GateRecord, itemId: string, answer: unknown, now: number): SubmitResult {
  const { item, item_rec } = currentRecord(ctx, rec, itemId)
  const shown = shownInstance(ctx, item, item_rec)
  let result: CheckResult
  try {
    result = shown.logic.check(shown.instance, answer)
  } catch {
    result = { correct: false, feedback: 'That answer could not be read.', rollback: { kind: 'none' } }
  }
  const key = itemKeyOf(ctx.key, item.id)
  const reduced = reduceItem(
    item_rec,
    { type: 'answer', correct: result.correct, now },
    item.rule,
    { salt: ctx.salt, key, puzzle: !!ctx.logic.puzzle },
    ctx.cfg ?? DEFAULT_RULES,
  )
  const after = settle(ctx, item, reduced)
  const events: LessonEvent[] = [
    {
      type: 'item.submit',
      item: key,
      attempt: item_rec.attempt,
      correct: result.correct,
      ms: Math.max(0, now - item_rec.shownAt),
      rollback: result.rollback.kind,
    },
  ]
  return { ...finish(ctx, rec, item, item_rec, after, events, shown), result }
}

/** Hint L3's "Got it: next instance": records 'revealed' and draws a fresh instance. */
export function revealCurrent(ctx: GateCtx, rec: GateRecord, itemId: string, now: number): ActionResult {
  const { item, item_rec } = currentRecord(ctx, rec, itemId)
  const shown = shownInstance(ctx, item, item_rec)
  const key = itemKeyOf(ctx.key, item.id)
  const reduced = reduceItem(
    item_rec,
    { type: 'reveal', now },
    item.rule,
    { salt: ctx.salt, key, puzzle: !!ctx.logic.puzzle },
    ctx.cfg ?? DEFAULT_RULES,
  )
  const after = settle(ctx, item, reduced)
  const events: LessonEvent[] = [{ type: 'item.reveal', item: key, attempt: item_rec.attempt }]
  return finish(ctx, rec, item, item_rec, after, events, shown)
}

/** Restart the current item's timer (the learner has just been shown its instance). */
export function markShown(rec: GateRecord, itemId: string, now: number): GateRecord {
  const it = rec.items[itemId]
  if (!it || it.shownAt === now) return rec
  return { ...rec, items: { ...rec.items, [itemId]: { ...it, shownAt: now } } }
}
