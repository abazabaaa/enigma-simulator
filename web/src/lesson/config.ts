/**
 * Session configuration set by __course.configure (e2e only): the gaming thresholds, the playback mode and
 * the unlock-all override. Kept in sessionStorage so a reload in the same tab keeps it.
 */

import { create } from 'zustand'
import type { RuleConfig } from '../contracts/lesson'
import { sessionStore } from '../lib/storage'
import { usePlaybackStore } from '../state/playbackStore'
import { DEFAULT_RULES } from './rules'

const KEY = 'enigma.course.config'

export interface CourseConfig {
  readonly rules: RuleConfig
  readonly playback: 'instant' | 'normal' | null
  /** e2e: every chapter is reachable (the course map still shows the real lock states). */
  readonly unlockAll: boolean
}

function read(): CourseConfig {
  try {
    const raw = JSON.parse(sessionStore.get(KEY) ?? 'null') as Partial<CourseConfig> | null
    if (raw && typeof raw === 'object') {
      return {
        rules: { ...DEFAULT_RULES, ...(raw.rules ?? {}) },
        playback: raw.playback === 'instant' || raw.playback === 'normal' ? raw.playback : null,
        unlockAll: raw.unlockAll === true,
      }
    }
  } catch {
    // fall through to the defaults
  }
  return { rules: DEFAULT_RULES, playback: null, unlockAll: false }
}

export const useCourseConfig = create<CourseConfig>()(() => read())

export function updateConfig(patch: Partial<CourseConfig>): void {
  useCourseConfig.setState(patch)
  const { rules, playback, unlockAll } = useCourseConfig.getState()
  sessionStore.set(KEY, JSON.stringify({ rules, playback, unlockAll }))
  applyPlayback()
}

/** Apply the configured playback mode to the playback store (called at load and on configure). */
export function applyPlayback(): void {
  const { playback } = useCourseConfig.getState()
  if (playback === 'instant') usePlaybackStore.getState().setSpeed('instant')
  else if (playback === 'normal' && usePlaybackStore.getState().speed === 'instant') usePlaybackStore.getState().setSpeed(1)
}

export function rules(): RuleConfig {
  return useCourseConfig.getState().rules
}
