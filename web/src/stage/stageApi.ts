/**
 * window.__stage (PLAN §2.7, §3.9): the latest StageReport of the mounted view, the resolved
 * directive and the playback clock. Installed in every build (production included) by main.tsx.
 */

import type { StageInfo, StageTestApi } from '../contracts/hooks'
import type { StageReport, StageStats } from '../contracts/stage'
import { usePlaybackStore } from '../state/playbackStore'
import { useStageStore } from '../state/stageStore'

/** What info() reports before any view has reported. */
const NO_REPORT: StageReport = {
  renderer: 'placeholder',
  focus: 'overview',
  dimmed: [],
  highlighted: [],
  litLamp: null,
  windows: '',
  hop: -1,
  pathPoints: 0,
  ghost: false,
}

let latest: StageReport | null = null
let statsProvider: (() => StageStats | null) | null = null

/** StageHost forwards every view report here; null when the stage unmounts. */
export function reportStage(report: StageReport | null): void {
  latest = report
}

/** The latest report, or null when no stage is mounted. */
export function latestStageReport(): StageReport | null {
  return latest
}

/** The 3D view registers its renderer stats; returns an unregister function. */
export function registerStageStats(provider: () => StageStats | null): () => void {
  statsProvider = provider
  return () => {
    if (statsProvider === provider) statsProvider = null
  }
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const stageApi: StageTestApi = {
  info(): StageInfo {
    const { seq, t } = usePlaybackStore.getState()
    return copy({ ...(latest ?? NO_REPORT), directive: useStageStore.getState().directive, seq, t })
  },
  stats: () => (statsProvider ? copy(statsProvider()) : null),
  playback() {
    const { t, hops, seq, playing, gated } = usePlaybackStore.getState()
    return { t, hops, seq, playing, gated }
  },
}

export function installStageApi(target: Window = window): void {
  target.__stage = stageApi
}
