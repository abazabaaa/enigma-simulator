/**
 * Contracts v1 · window test hooks (PLAN §3.9). `window.__stage` is installed by stage/stageApi.ts
 * (02) in every build; `window.__course` by 05. `window.__enigma` stays declared in debug/windowApi.ts.
 */

import type { AnyChapterId, GateKey } from './core'
import type { CheckResult, ItemRuntimeView, SceneKind } from './lesson'
import type { LessonEvent, ProgressV1 } from './progress'
import type { StageDirective, StageReport, StageStats } from './stage'

/** The latest StageReport, the resolved directive and the playback clock. */
export type StageInfo = StageReport & {
  readonly directive: StageDirective | null
  readonly seq: number
  readonly t: number
}

export interface StageTestApi {
  info(): StageInfo
  /** null unless the 3D view registered a stats provider (stage/stageApi.ts registerStageStats). */
  stats(): StageStats | null
  playback(): { t: number; hops: number; seq: number; playing: boolean; gated: boolean }
}

export interface CourseTestApi {
  readonly version: 1
  where(): {
    chapter: AnyChapterId | null
    scene: string | null
    index: number
    kind: SceneKind | null
    canNext: boolean
    locked: boolean
  }
  /** Instance parameters only: never answers. */
  gate(): { key: GateKey; passed: boolean; current: ItemRuntimeView | null; items: readonly ItemRuntimeView[] } | null
  /** The same path as the UI Submit; scored; throws if not the current item. */
  answer(itemId: string, answer: unknown): CheckResult
  continue(): void
  bet(betId: string, value: string): void
  next(): boolean
  lastCheck(): { itemId: string; result: CheckResult } | null
  events(): readonly LessonEvent[]
  progress(): ProgressV1
  // e2e-only: throw Error('e2e only') unless the page URL had ?e2e=1
  completeTasks(): void
  unlockAll(): void
  resetProgress(): void
  configure(o: { minLatencyMs?: number; burstMs?: number; playback?: 'instant' | 'normal'; now?: number; salt?: string }): void
}

declare global {
  interface Window {
    __stage?: StageTestApi
    __course?: CourseTestApi
  }
}
