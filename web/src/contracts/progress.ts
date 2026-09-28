/**
 * Contracts v1 · progress and the lesson event log (PLAN §3.8). 05 implements persistence
 * (zustand persist → localStorage[PROGRESS_KEY]) and emits the events.
 */

import type { AnyChapterId, BetKey, GateKey, ItemKey } from './core'
import type { GateRecord, HintLevel, RevealSpec, Rollback } from './lesson'
import type { Speed } from './machine'

export const PROGRESS_KEY = 'enigma.progress.v1',
  PROGRESS_CORRUPT_KEY = 'enigma.progress.corrupt'

export interface BetRecord {
  readonly value: string
  readonly correct: boolean | null
  readonly at: number
}

export interface ProgressV1 {
  readonly version: 1
  readonly salt: string
  readonly createdAt: number
  readonly lastVisit: number
  readonly chapters: Partial<
    Record<AnyChapterId, { readonly reached: number; readonly completed: boolean; readonly tasks: readonly string[] }>
  >
  readonly gates: Readonly<Record<GateKey, GateRecord>>
  /** Shown as "bets made / bets right"; never scored. */
  readonly bets: Readonly<Record<BetKey, BetRecord>>
  readonly recall: Readonly<Record<string, { readonly lastSeen: number; readonly correct: number; readonly wrong: number }>>
  readonly prefs: {
    readonly speed: Speed
    readonly motion: 'system' | 'reduce' | 'full'
    readonly stage: 'auto' | '3d' | '2d'
    readonly labels: boolean
  }
}

/** The event log behind window.__course.events(). */
export type LessonEvent =
  | { readonly type: 'scene.enter' | 'scene.complete'; readonly chapter: AnyChapterId; readonly scene: string }
  | { readonly type: 'bet.commit'; readonly bet: BetKey; readonly value: string }
  | { readonly type: 'bet.resolve'; readonly bet: BetKey; readonly correct: boolean }
  | { readonly type: 'reveal'; readonly bet: BetKey; readonly trigger: RevealSpec['trigger'] }
  | {
      readonly type: 'item.show'
      readonly item: ItemKey
      readonly attempt: number
      readonly seed: number
      readonly hintLevel: HintLevel
      readonly fallback: boolean
      readonly workedSeed?: number
    }
  | {
      readonly type: 'item.submit'
      readonly item: ItemKey
      readonly attempt: number
      readonly correct: boolean
      readonly ms: number
      readonly rollback: Rollback['kind']
    }
  | { readonly type: 'item.reveal'; readonly item: ItemKey; readonly attempt: number }
  | { readonly type: 'item.passed'; readonly item: ItemKey }
  | { readonly type: 'gate.passed'; readonly gate: GateKey }
  | { readonly type: 'chapter.complete'; readonly chapter: AnyChapterId }
  | { readonly type: 'gaming'; readonly item: ItemKey; readonly reason: 'fast' | 'ladder' | 'reveals' }
  | { readonly type: 'return-check'; readonly items: readonly ItemKey[] }
