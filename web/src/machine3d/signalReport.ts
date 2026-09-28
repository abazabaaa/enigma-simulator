/**
 * The signal layer's side of the stage report. PR 11's SignalLayer writes how many path points it
 * currently draws; index.tsx reports that as StageReport.pathPoints (0 until PR 11 lands).
 */

import { create } from 'zustand'

export interface SignalReport {
  /** Points of the drawn signal path: 2 + 2·(hops drawn), 0 when nothing is drawn. */
  readonly pathPoints: number
  readonly setPathPoints: (n: number) => void
}

export const useSignalReport = create<SignalReport>()((set) => ({
  pathPoints: 0,
  setPathPoints: (pathPoints) => set({ pathPoints }),
}))
