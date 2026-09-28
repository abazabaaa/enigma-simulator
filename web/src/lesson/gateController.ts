/**
 * One mounted gate: the UI phase (answering, or the feedback of the last answer), the last wrong answer per
 * item (hint L1 highlights), and the actions shared by the gate UI and window.__course. Scoring goes
 * through gateEngine against the persisted progress, synchronously.
 */

import type { GateKey, ItemKey } from '../contracts/core'
import type { CheckResult, GateLogic, GateRecord } from '../contracts/lesson'
import type { Highlight } from '../contracts/stage'
import { now } from './clock'
import { rules } from './config'
import { emit } from './events'
import {
  currentItem,
  ensureCurrent,
  gateView,
  hintHighlights,
  itemKeyOf,
  markShown,
  revealCurrent,
  shownInstance,
  submitAnswer,
  workedFor,
  wrongAnswerOf,
  type GateCtx,
  type GateView,
  type Shown,
  type WrongAnswer,
} from './gateEngine'
import { useProgress } from './progress'
import { hintLevel } from './rules'
import { setLastCheck } from './runtime'

export interface LastAnswer {
  readonly itemId: string
  readonly itemKey: ItemKey
  readonly attempt: number
  readonly answer: unknown
  readonly result: CheckResult
  readonly shown: Shown
  readonly passed: boolean
}

export interface ControllerState {
  readonly phase: 'answer' | 'feedback'
  readonly last: LastAnswer | null
  /** Per item, the last wrong answer with the instance it answered (hint L1 highlights come from it). */
  readonly lastWrong: Readonly<Record<string, WrongAnswer>>
}

export interface Worked {
  readonly seed: number
  readonly instance: unknown
  readonly solution: unknown
}

export interface GateController {
  readonly key: GateKey
  readonly logic: GateLogic
  getState(): ControllerState
  subscribe(listener: () => void): () => void
  ctx(): GateCtx
  /** The record with the current item created (persists it when it was missing). */
  ensure(): GateRecord
  view(): GateView
  submit(itemId: string, answer: unknown): CheckResult
  continue(): void
  /** The worked example for the current item's attempt (hint L2), memoised. */
  worked(): Worked | null
  /** Emit item.show once per shown instance. */
  announce(): void
  /**
   * The stage highlights of the hint ladder for the current item while answering at L1+: from the instance the
   * last wrong answer belonged to (hintHighlights), not the fresh instance now shown. [] otherwise.
   */
  hints(): readonly Highlight[]
}

export function createGateController(o: { key: GateKey; logic: GateLogic; recall?: boolean }): GateController {
  let state: ControllerState = { phase: 'answer', last: null, lastWrong: {} }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<ControllerState>) => {
    state = { ...state, ...patch }
    for (const l of listeners) l()
  }
  const progress = () => useProgress.getState()
  const ctx = (): GateCtx => ({ key: o.key, logic: o.logic, salt: progress().salt, cfg: rules() })
  const ensure = (): GateRecord => {
    const rec = progress().gates[o.key]
    const next = ensureCurrent(ctx(), rec, now())
    if (next !== rec) progress().setGate(o.key, next)
    return next
  }
  const workedCache = new Map<string, Worked>()
  let announced = ''

  const controller: GateController = {
    key: o.key,
    logic: o.logic,
    getState: () => state,
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    ctx,
    ensure,
    view: () => gateView(ctx(), ensure()),

    submit(itemId, answer) {
      if (state.phase === 'feedback')
        throw new Error('The feedback of the last answer is showing: call continue() first')
      const rec = ensure()
      const cur = currentItem(o.logic, rec)
      const it = cur ? rec.items[cur.id] : undefined
      if (cur?.id === itemId && it && hintLevel(it, !!o.logic.puzzle) === 3) {
        throw new Error('At hint level 3 the only action is continue() ("Got it: next instance")')
      }
      const t = now()
      const res = submitAnswer(ctx(), rec, itemId, answer, t)
      progress().setGate(o.key, res.gate)
      if (o.recall) progress().noteRecall(itemId, res.result.correct ? 'correct' : 'wrong', t)
      emit(...res.events)
      const { [itemId]: _drop, ...others } = state.lastWrong
      set({
        phase: 'feedback',
        last: {
          itemId,
          itemKey: itemKeyOf(o.key, itemId),
          attempt: it?.attempt ?? 0,
          answer,
          result: res.result,
          shown: res.shown,
          passed: res.itemPassed,
        },
        lastWrong: res.result.correct ? others : { ...others, [itemId]: wrongAnswerOf(res, answer)! },
      })
      setLastCheck({ itemId, result: res.result })
      return res.result
    },

    continue() {
      if (state.phase === 'feedback') {
        const rec = progress().gates[o.key]
        const cur = rec ? currentItem(o.logic, rec) : null
        if (rec && cur && rec.items[cur.id]) progress().setGate(o.key, markShown(rec, cur.id, now()))
        set({ phase: 'answer' })
        return
      }
      const rec = ensure()
      const cur = currentItem(o.logic, rec)
      const it = cur ? rec.items[cur.id] : undefined
      if (!cur || !it || hintLevel(it, !!o.logic.puzzle) !== 3) return
      const t = now()
      const res = revealCurrent(ctx(), rec, cur.id, t)
      progress().setGate(o.key, ensureCurrent(ctx(), res.gate, t))
      if (o.recall) progress().noteRecall(cur.id, 'revealed', t)
      emit(...res.events)
      const { [cur.id]: _drop, ...others } = state.lastWrong
      set({ lastWrong: others })
    },

    worked() {
      const rec = progress().gates[o.key]
      const cur = rec ? currentItem(o.logic, rec) : null
      const it = cur && rec ? rec.items[cur.id] : undefined
      if (!cur || !it) return null
      const k = `${cur.id}|${it.attempt}|${it.seed}|${it.fallbackNext}|${progress().salt}`
      let w = workedCache.get(k)
      if (!w) {
        const d = workedFor(ctx(), cur, it)
        w = { seed: d.seed, instance: d.instance, solution: d.solution }
        workedCache.set(k, w)
      }
      return w
    },

    announce() {
      if (state.phase !== 'answer') return
      const rec = progress().gates[o.key]
      const cur = rec ? currentItem(o.logic, rec) : null
      const it = cur && rec ? rec.items[cur.id] : undefined
      if (!cur || !it) return
      const tag = `${cur.id}|${it.attempt}|${it.seed}`
      if (tag === announced) return
      announced = tag
      const level = hintLevel(it, !!o.logic.puzzle)
      shownInstance(ctx(), cur, it)
      emit({
        type: 'item.show',
        item: itemKeyOf(o.key, cur.id),
        attempt: it.attempt,
        seed: it.seed,
        hintLevel: level,
        fallback: it.fallbackNext,
        ...(level === 2 ? { workedSeed: controller.worked()!.seed } : {}),
      })
    },

    hints() {
      if (state.phase !== 'answer') return []
      const rec = progress().gates[o.key]
      const cur = rec ? currentItem(o.logic, rec) : null
      const it = cur && rec ? rec.items[cur.id] : undefined
      if (!cur || !it || hintLevel(it, !!o.logic.puzzle) < 1) return []
      return hintHighlights(shownInstance(ctx(), cur, it), state.lastWrong[cur.id] ?? null)
    },
  }
  return controller
}
