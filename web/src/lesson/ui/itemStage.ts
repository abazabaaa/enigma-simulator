/** What the current gate item asks of its scene: a stage override (ItemSetup.stage) and hiding the scene's machine panel. */

import { create } from 'zustand'
import type { StageRef } from '../../contracts/stage'

export interface ItemStageStore {
  /** undefined: use the scene's stage; null: no stage; a ref: that stage. */
  readonly stage: StageRef | null | undefined
  /** The item renders its own machine controls (set-machine): the scene hides its panel. */
  readonly ownsMachine: boolean
  set(patch: Partial<Pick<ItemStageStore, 'stage' | 'ownsMachine'>>): void
}

export const useItemStage = create<ItemStageStore>()((set) => ({
  stage: undefined,
  ownsMachine: false,
  set: (patch) => set(patch),
}))
