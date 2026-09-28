/**
 * Test helper: a bot driven through the real gate engine (the same path as the UI, the guess bot and the CC learner).
 * `answer` answers the item under test; every other item gets its solution, so the rate measured is that item's.
 * Attempts are 10 s apart (no gaming fallback), at most 6 per item, and the ladder's L3 is revealed as a learner would.
 */

import type { GateKey } from '../../../contracts/core'
import type { GateLogic, GateRecord, ItemLogic } from '../../../contracts/lesson'
import { EMPTY_GATE, currentItem, ensureCurrent, revealCurrent, shownInstance, submitAnswer, type GateCtx } from '../../../lesson/gateEngine'
import { hintLevel } from '../../../lesson/rules'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export type BotAnswer = (item: ItemLogic, instance: unknown) => unknown

/** Whether the item `target` passes for this bot (other items are answered correctly). */
export function itemPasses(key: GateKey, logic: GateLogic, target: string, answer: BotAnswer, salt: string): boolean {
  const ctx: GateCtx = { key, logic, salt }
  let rec: GateRecord = EMPTY_GATE
  let now = 1
  for (;;) {
    rec = ensureCurrent(ctx, rec, now)
    const item = currentItem(logic, rec)
    if (!item) return true
    const it = rec.items[item.id]!
    if (item.id !== target && it.passed) continue
    if (it.attempt > 6) return false
    now += 10_000
    if (hintLevel(it, !!logic.puzzle) === 3) {
      rec = revealCurrent(ctx, rec, item.id, now).gate
      continue
    }
    const shown = shownInstance(ctx, item, it)
    const a = item.id === target ? answer(shown.logic, clone(shown.instance)) : shown.logic.solve(clone(shown.instance))
    rec = submitAnswer(ctx, rec, item.id, clone(a), now).gate
    if (item.id === target && rec.items[target]?.passed) return true
  }
}

/** The pass rate of `target` for this bot over `runs` salts. */
export function passRate(key: GateKey, logic: GateLogic, target: string, answer: BotAnswer, runs = 300): number {
  let passes = 0
  for (let run = 0; run < runs; run++) if (itemPasses(key, logic, target, answer, `bot:${target}:${run}`)) passes++
  return passes / runs
}

/** The most common solution of an item over `seeds` instances (as JSON), and its share. */
export function modalAnswer(l: ItemLogic, gen: (s: number) => unknown, seeds = 300): { answer: unknown; share: number } {
  const counts = new Map<string, number>()
  for (let s = 0; s < seeds; s++) {
    const key = JSON.stringify(l.solve(gen(s)))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [key, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!
  return { answer: JSON.parse(key), share: n / seeds }
}
