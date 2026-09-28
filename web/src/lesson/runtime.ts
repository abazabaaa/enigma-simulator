/**
 * The active page's handles, for window.__course: the chapter player (where, next, bets, tasks) and a stack
 * of mounted gates (a return check's gate sits on top of the scene's gate while it is open).
 */

import type { AnyChapterId } from '../contracts/core'
import type { CheckResult, SceneKind } from '../contracts/lesson'
import type { GateView } from './gateEngine'

export interface Where {
  readonly chapter: AnyChapterId | null
  readonly scene: string | null
  readonly index: number
  readonly kind: SceneKind | null
  readonly canNext: boolean
  readonly locked: boolean
}

export const NOWHERE: Where = { chapter: null, scene: null, index: -1, kind: null, canNext: false, locked: false }

export interface PlayerApi {
  where(): Where
  next(): boolean
  bet(betId: string, value: string): void
  completeTasks(): void
}

export interface ActiveGate {
  view(): GateView
  answer(itemId: string, answer: unknown): CheckResult
  continue(): void
}

let player: PlayerApi | null = null
const gates: ActiveGate[] = []
let last: { itemId: string; result: CheckResult } | null = null

export function registerPlayer(p: PlayerApi): () => void {
  player = p
  return () => {
    if (player === p) player = null
  }
}

export function activePlayer(): PlayerApi | null {
  return player
}

export function registerGate(g: ActiveGate): () => void {
  gates.push(g)
  return () => {
    const k = gates.lastIndexOf(g)
    if (k !== -1) gates.splice(k, 1)
  }
}

export function activeGate(): ActiveGate | null {
  return gates.at(-1) ?? null
}

export function setLastCheck(c: { itemId: string; result: CheckResult }): void {
  last = c
}

export function lastCheck(): { itemId: string; result: CheckResult } | null {
  return last
}
