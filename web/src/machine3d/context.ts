/**
 * What every 3D component may read (06 core and 11's signal layer, cables, reflector and toy
 * geometry): the view model, the directive and reduced motion, plus the live playback clock.
 * Provided by Scene.tsx inside the Canvas.
 */

import { createContext, useContext } from 'react'
import type { StageDirective } from '../contracts/stage'
import type { ModelName } from '../engine'
import type { SceneView } from './view'

export interface Stage3D {
  readonly view: SceneView
  readonly directive: StageDirective
  readonly reducedMotion: boolean
  /** The machine's model (dimming uses it even when the source is a toy). */
  readonly model: ModelName
  /** Playback time t ∈ [0, 1 + hops] (PLAN §2.2). */
  readonly t: number
}

export const Stage3DContext = createContext<Stage3D | null>(null)

export function useStage3D(): Stage3D {
  const s = useContext(Stage3DContext)
  if (!s) throw new Error('useStage3D() outside the 3D machine')
  return s
}
