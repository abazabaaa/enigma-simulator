/**
 * The lesson clock: Date.now() plus an offset that e2e can move with __course.configure({ now }). The offset
 * lives in sessionStorage, so a reload in the same tab keeps it (e.g. mid return-check test).
 */

import { create } from 'zustand'
import { sessionStore } from '../lib/storage'

const KEY = 'enigma.course.clock'

function readOffset(): number {
  const n = Number(sessionStore.get(KEY) ?? 0)
  return Number.isFinite(n) ? n : 0
}

export const useClock = create<{ offset: number }>()(() => ({ offset: readOffset() }))

export function now(): number {
  return Date.now() + useClock.getState().offset
}

/** Move the clock so that now() reads `target` (a timestamp in ms). */
export function setNow(target: number): void {
  const offset = target - Date.now()
  sessionStore.set(KEY, String(offset))
  useClock.setState({ offset })
}

export function resetClock(): void {
  sessionStore.remove(KEY)
  useClock.setState({ offset: 0 })
}
