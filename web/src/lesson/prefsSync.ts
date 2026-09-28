/**
 * Keeps the UI preferences and ProgressV1.prefs in step (PLAN §2.2 item 6): the stored prefs are applied to
 * the UI store once, then renderer, motion, labels and speed changes are persisted.
 */

import { usePlaybackStore } from '../state/playbackStore'
import { useUiStore } from '../state/uiStore'
import { applyPlayback } from './config'
import { useProgress } from './progress'

let installed = false

export function installPrefsSync(): void {
  if (installed) return
  installed = true
  const { prefs } = useProgress.getState()
  useUiStore.getState().setPrefs(prefs)
  applyPlayback()
  useUiStore.subscribe((s, prev) => {
    if (s.stage !== prev.stage || s.motion !== prev.motion || s.labels !== prev.labels) {
      useProgress.getState().setPrefs({ stage: s.stage, motion: s.motion, labels: s.labels })
    }
  })
  usePlaybackStore.subscribe((s, prev) => {
    if (s.speed !== prev.speed && s.speed !== 'instant') useProgress.getState().setPrefs({ speed: s.speed })
  })
}
