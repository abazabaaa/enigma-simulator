/**
 * window.__course (PLAN §2.7, §3.9): the state hook e2e drives. gate() returns instance parameters, never
 * answers; e2e computes answers in Node from the pure gates.ts. answer() is the same path as the UI Submit.
 * completeTasks, unlockAll, resetProgress and configure throw unless the page was opened with ?e2e=1.
 */

import type { CourseTestApi } from '../contracts/hooks'
import { isE2E } from '../lib/flags'
import { setNow } from './clock'
import { updateConfig, rules } from './config'
import { events } from './events'
import { progressSnapshot, useProgress } from './progress'
import { NOWHERE, activeGate, activePlayer, lastCheck } from './runtime'
import { now } from './clock'

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T))

function e2eOnly<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  return (...a: A) => {
    if (!isE2E()) throw new Error('e2e only')
    return fn(...a)
  }
}

export const courseApi: CourseTestApi = {
  version: 1,
  where: () => clone(activePlayer()?.where() ?? NOWHERE),
  gate() {
    const g = activeGate()
    if (!g) return null
    const v = g.view()
    return clone({ key: v.key, passed: v.passed, current: v.current, items: v.items })
  },
  answer(itemId, answer) {
    const g = activeGate()
    if (!g) throw new Error('There is no gate on this page')
    return clone(g.answer(itemId, clone(answer)))
  },
  continue() {
    activeGate()?.continue()
  },
  bet(betId, value) {
    const p = activePlayer()
    if (!p) throw new Error('There is no scene on this page')
    p.bet(betId, value)
  },
  next: () => activePlayer()?.next() ?? false,
  lastCheck: () => clone(lastCheck()),
  events: () => clone([...events()]),
  progress: () => progressSnapshot(),
  completeTasks: e2eOnly(() => activePlayer()?.completeTasks()),
  unlockAll: e2eOnly(() => updateConfig({ unlockAll: true })),
  resetProgress: e2eOnly(() => useProgress.getState().reset(now())),
  configure: e2eOnly((o) => {
    const r = rules()
    updateConfig({
      rules: { minLatencyMs: o.minLatencyMs ?? r.minLatencyMs, burstMs: o.burstMs ?? r.burstMs },
      ...(o.playback ? { playback: o.playback } : {}),
    })
    if (o.now !== undefined) setNow(o.now)
    if (o.salt !== undefined) useProgress.getState().setSalt(o.salt)
  }),
}

export function installCourseApi(target: Window | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (target) target.__course = courseApi
}
