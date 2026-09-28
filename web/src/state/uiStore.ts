/**
 * UI preferences (PLAN §2.2): renderer (auto | 3d | 2d), motion (system | reduce | full) and labels.
 * 05 persists them through ProgressV1.prefs and applies them with setPrefs (which also forwards the
 * playback speed). URL flags (?stage, ?motion) override the preferences for the session.
 */

import { create } from 'zustand'
import type { ProgressV1 } from '../contracts/progress'
import { getFlags } from '../lib/flags'
import { resolveReducedMotion, subscribeSystemReducedMotion, systemPrefersReducedMotion } from '../lib/reducedMotion'

export type Prefs = ProgressV1['prefs']

export interface UiStore {
  readonly stage: Prefs['stage']
  readonly motion: Prefs['motion']
  readonly labels: boolean
  /** The system's prefers-reduced-motion. */
  readonly systemReducedMotion: boolean
  /** Resolved: ?motion flag, else the preference, else the system. */
  readonly reducedMotion: boolean
  readonly setPrefs: (p: Partial<Prefs>) => void
}

type SpeedSink = (speed: Prefs['speed']) => void
let speedSink: SpeedSink | null = null

/** playbackStore registers itself here so setPrefs can forward the speed without an import cycle. */
export function registerSpeedSink(sink: SpeedSink): void {
  speedSink = sink
}

const resolve = (motion: Prefs['motion'], system: boolean) => resolveReducedMotion(motion, getFlags().motion, system)

export const useUiStore = create<UiStore>()((set, get) => {
  const system = systemPrefersReducedMotion()
  subscribeSystemReducedMotion((reduced) =>
    set({ systemReducedMotion: reduced, reducedMotion: resolve(get().motion, reduced) }),
  )
  return {
    stage: 'auto',
    motion: 'system',
    labels: true,
    systemReducedMotion: system,
    reducedMotion: resolve('system', system),
    setPrefs: ({ speed, ...p }) => {
      if (speed !== undefined) speedSink?.(speed)
      const motion = p.motion ?? get().motion
      set({ ...p, reducedMotion: resolve(motion, get().systemReducedMotion) })
    },
  }
})

export function isReducedMotion(): boolean {
  return useUiStore.getState().reducedMotion
}

export function useReducedMotion(): boolean {
  return useUiStore((s) => s.reducedMotion)
}

/** The renderer the user or the URL asks for: the ?stage flag beats the preference. */
export function requestedStage(pref: Prefs['stage'] = useUiStore.getState().stage): Prefs['stage'] {
  return getFlags().stage ?? pref
}
