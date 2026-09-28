/**
 * Scoring rules (PLAN §3.5, rules 1–7). PURE: no React, no DOM, no Math.random. The lesson runtime,
 * the guess bot and the CC learner all score through these functions, so the UI can never drift
 * from the truth tables in __tests__/rules.test.ts.
 *
 * Attempts are 1-based: a fresh item is on attempt 1 (hint L0). Every answer or reveal appends one
 * outcome, increments `attempt` and moves to a fresh instance, whose seed reduceItem stores (redraw 0);
 * the runtime then settles the redraw with drawInstance (it needs the ItemLogic for `same`).
 */

import type { ItemKey } from '../contracts/core'
import type {
  GateLogic,
  GateRecord,
  HintLevel,
  ItemAction,
  ItemLogic,
  ItemRecord,
  Outcome,
  OutcomeResult,
  PassRule,
  RuleConfig,
} from '../contracts/lesson'
import { createRng, seedFor } from '../lib/rng'

/** minLatencyMs 2000, burstMs 5000. */
export const DEFAULT_RULES: RuleConfig = Object.freeze({ minLatencyMs: 2000, burstMs: 5000 })

/** ItemRecord.outcomes keeps at most this many (the oldest are dropped). */
export const OUTCOME_CAP = 20

/** drawInstance and drawWorked try redraws 0…MAX_REDRAW. */
export const MAX_REDRAW = 20

export function instanceSeed(salt: string, key: ItemKey, attempt: number, redraw: number): number {
  return seedFor(salt, key, 'inst', attempt, redraw)
}

export function workedSeed(salt: string, key: ItemKey, attempt: number, k: number): number {
  return seedFor(salt, key, 'worked', attempt, k)
}

export function fallbackSeed(salt: string, key: ItemKey, attempt: number): number {
  return seedFor(salt, key, 'fallback', attempt)
}

/** A fresh item on attempt 1 with its first instance's seed. */
export function newItemRecord(salt: string, key: ItemKey, now: number): ItemRecord {
  return {
    attempt: 1,
    seed: instanceSeed(salt, key, 1, 0),
    redraw: 0,
    shownAt: now,
    outcomes: [],
    wrong: 0,
    fallbackNext: false,
    passed: false,
  }
}

/** Rule 1: at least 2 of the last 3 outcomes are correct ('revealed' counts as wrong). */
export function windowPassed(outcomes: readonly Outcome[]): boolean {
  return outcomes.slice(-3).filter((o) => o.result === 'correct').length >= 2
}

/** Rule 4: normal gates min(3, wrong); puzzle gates min(3, max(0, wrong − 1)). */
export function hintLevel(rec: ItemRecord, puzzle: boolean): HintLevel {
  const level = puzzle ? Math.max(0, rec.wrong - 1) : rec.wrong
  return Math.min(3, level) as HintLevel
}

/**
 * Rule 5. `fast`: the last two outcomes are both answers given in under minLatencyMs (a reveal is not an
 * answer, so reading a revealed solution never counts as fast). `ladder`: the last three outcomes are
 * wrong answers, each under burstMs, that ran up to L3. `reveals`: two or more reveals among the last six.
 */
export function isGaming(rec: ItemRecord, cfg: RuleConfig = DEFAULT_RULES): false | 'fast' | 'ladder' | 'reveals' {
  const o = rec.outcomes
  const last2 = o.slice(-2)
  if (last2.length === 2 && last2.every((x) => x.result !== 'revealed' && x.ms < cfg.minLatencyMs)) return 'fast'
  const last3 = o.slice(-3)
  if (last3.length === 3 && rec.wrong >= 3 && last3.every((x) => x.result === 'wrong' && x.ms < cfg.burstMs)) {
    return 'ladder'
  }
  if (o.slice(-6).filter((x) => x.result === 'revealed').length >= 2) return 'reveals'
  return false
}

/**
 * Rules 1–5: score one answer or reveal. The outcome is recorded against the instance on show (its seed,
 * whether it was a fallback, the hint level it was shown at), then the item moves to attempt + 1 with a
 * fresh seed: the fallback seed when a gaming signal fired, else instanceSeed(…, redraw 0).
 * `ctx.puzzle` (optional) records the puzzle ladder's hint level in the outcome.
 */
export function reduceItem(
  rec: ItemRecord,
  a: ItemAction,
  rule: PassRule,
  ctx: { readonly salt: string; readonly key: ItemKey; readonly puzzle?: boolean },
  cfg: RuleConfig = DEFAULT_RULES,
): ItemRecord {
  const result: OutcomeResult = a.type === 'reveal' ? 'revealed' : a.correct ? 'correct' : 'wrong'
  const outcome: Outcome = {
    result,
    ms: Math.max(0, a.now - rec.shownAt),
    seed: rec.seed,
    fallback: rec.fallbackNext,
    hintLevel: hintLevel(rec, !!ctx.puzzle),
    at: a.now,
  }
  const outcomes = [...rec.outcomes, outcome].slice(-OUTCOME_CAP)
  const attempt = rec.attempt + 1
  const passed = rec.passed || (rule.kind === 'window' ? windowPassed(outcomes) : result === 'correct')
  const next: ItemRecord = {
    attempt,
    seed: instanceSeed(ctx.salt, ctx.key, attempt, 0),
    redraw: 0,
    shownAt: a.now,
    outcomes,
    wrong: result === 'wrong' ? rec.wrong + 1 : 0,
    fallbackNext: false,
    passed,
  }
  if (isGaming(next, cfg) === false) return next
  return { ...next, fallbackNext: true, seed: fallbackSeed(ctx.salt, ctx.key, attempt) }
}

/** Rule 3 / G3: the first instance that matches none of `previous` (redraw 0…20; the 20th is kept regardless). */
export function drawInstance(
  l: ItemLogic,
  salt: string,
  key: ItemKey,
  attempt: number,
  previous: readonly unknown[],
): { instance: unknown; seed: number; redraw: number } {
  for (let redraw = 0; ; redraw++) {
    const seed = instanceSeed(salt, key, attempt, redraw)
    const instance = l.generate(createRng(seed), { key, attempt, purpose: 'instance', previous })
    if (redraw >= MAX_REDRAW || !previous.some((p) => l.same(p, instance))) return { instance, seed, redraw }
  }
}

/** Rule 4 L2: a worked-example instance that equals neither the current instance nor the next one. */
export function drawWorked(
  l: ItemLogic,
  salt: string,
  key: ItemKey,
  attempt: number,
  current: unknown,
  next: unknown,
): { instance: unknown; seed: number } {
  for (let k = 0; ; k++) {
    const seed = workedSeed(salt, key, attempt, k)
    const instance = l.generate(createRng(seed), { key, attempt, purpose: 'worked', previous: [current, next] })
    if (k >= MAX_REDRAW || (!l.same(instance, current) && !l.same(instance, next))) return { instance, seed }
  }
}

/** Rule 7: every item has passed. */
export function gatePassed(g: GateRecord, logic: GateLogic): boolean {
  return logic.items.every((it) => g.items[it.id]?.passed === true)
}
