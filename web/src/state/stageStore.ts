/**
 * What the stage shows (PLAN §2.2): the resolved directive of the current scene or item (set by
 * StageHost), hint/rollback highlights and the rollback ghost path. The 2D and 3D views read it.
 */

import { create } from 'zustand'
import type { StageStore } from '../contracts/stage'

export type { StageStore } from '../contracts/stage'

export const useStageStore = create<StageStore>()((set) => ({
  directive: null,
  highlight: [],
  ghost: null,
  setDirective: (directive) => set({ directive }),
  setHighlight: (highlight) => set({ highlight }),
  setGhost: (ghost) => set({ ghost }),
}))
