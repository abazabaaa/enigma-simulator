/**
 * Pure course-flow rules over ProgressV1 (PLAN §2.3, §4.1 G1, §4.2): when a scene may advance, which chapters
 * are locked, and when the return-visit check is due.
 */

import type { AnyChapterId, BetKey, ChapterId, GateKey } from '../contracts/core'
import type { ChapterMeta, SceneDef } from '../contracts/lesson'
import type { ProgressV1 } from '../contracts/progress'
import type { RecallAct } from './recall/pool'

export const RETURN_CHECK_MS = 6 * 60 * 60 * 1000

export const taskKey = (scene: string, task: string) => `${scene}/${task}`
export const betKey = (chapter: AnyChapterId, bet: string) => `${chapter}/${bet}` as BetKey
export const gateKey = (chapter: AnyChapterId, gate: string) => `${chapter}/${gate}` as GateKey
export const RECALL_GATE = 'recall'

/** G1: story always; explore when every task is done and every reveal's bet is committed; gate/recall when passed. */
export function canAdvanceScene(chapter: AnyChapterId, scene: SceneDef, p: ProgressV1): boolean {
  switch (scene.kind) {
    case 'story':
      return true
    case 'explore': {
      const done = p.chapters[chapter]?.tasks ?? []
      const tasks = (scene.tasks ?? []).every((t) => done.includes(taskKey(scene.id, t.id)))
      const bets = (scene.reveals ?? []).every((r) => p.bets[betKey(chapter, r.bet)] !== undefined)
      return tasks && bets
    }
    case 'gate':
      return scene.gate !== undefined && p.gates[gateKey(chapter, scene.gate)]?.passed === true
    case 'recall':
      return p.gates[gateKey(chapter, RECALL_GATE)]?.passed === true
  }
}

/** The previous REQUIRED chapter by order (II.8 is optional and never blocks III.9), or null for the first. */
export function previousRequired(chapters: readonly ChapterMeta[], id: ChapterId): ChapterMeta | null {
  const me = chapters.find((c) => c.id === id)
  if (!me) return null
  const before = chapters.filter((c) => c.order < me.order && !c.optional).sort((a, b) => b.order - a.order)
  return before[0] ?? null
}

/** A chapter is locked until the previous required chapter is complete (from progress alone). */
export function isLocked(chapters: readonly ChapterMeta[], id: ChapterId, p: ProgressV1): boolean {
  const prev = previousRequired(chapters, id)
  return prev !== null && p.chapters[prev.id]?.completed !== true
}

/** The next chapter by order (optional ones included), or null. */
export function nextChapter(chapters: readonly ChapterMeta[], id: AnyChapterId): ChapterMeta | null {
  const me = chapters.find((c) => c.id === id)
  if (!me) return null
  return [...chapters].sort((a, b) => a.order - b.order).find((c) => c.order > me.order) ?? null
}

const ACT_OF: Readonly<Record<string, RecallAct | undefined>> = { I: 'I', II: 'II', III: 'III' }

/** Acts with recall items in which the learner has completed a chapter. */
export function eligibleActs(chapters: readonly ChapterMeta[], p: ProgressV1): RecallAct[] {
  const acts = new Set<RecallAct>()
  for (const c of chapters) {
    const act = ACT_OF[c.act]
    if (act && p.chapters[c.id]?.completed) acts.add(act)
  }
  return (['I', 'II', 'III'] as const).filter((a) => acts.has(a))
}

/** §4.2: at least 6 h since the last visit, and at least one chapter complete. */
export function returnCheckDue(p: ProgressV1, now: number): boolean {
  const anyComplete = Object.values(p.chapters).some((c) => c?.completed)
  return anyComplete && now - p.lastVisit >= RETURN_CHECK_MS
}
