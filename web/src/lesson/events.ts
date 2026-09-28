/** The lesson event log behind window.__course.events() (PLAN §3.8). In memory, per page load. */

import type { LessonEvent } from '../contracts/progress'

const MAX = 5000
const log: LessonEvent[] = []
const listeners = new Set<(e: LessonEvent) => void>()

export function emit(...events: readonly LessonEvent[]): void {
  for (const e of events) {
    log.push(e)
    if (log.length > MAX) log.shift()
    for (const l of listeners) l(e)
  }
}

export function events(): readonly LessonEvent[] {
  return log
}

export function onEvent(fn: (e: LessonEvent) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
