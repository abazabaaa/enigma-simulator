/**
 * The 3D view's inputs, read from the stores (PLAN §2.5): the machine store (provider-aware), the toy
 * store, the playback clock and the stage store. index.tsx reads them outside the Canvas and passes
 * the result in, so the report and the scene come from the same snapshot. The playback clock counts
 * only while it plays this view's source; otherwise the source's own last press is shown finished.
 */

import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { ToySpec } from '../contracts/machine'
import { dimmedParts, type Ghost, type Highlight, type StageDirective, type StageReport } from '../contracts/stage'
import type { ModelName } from '../engine'
import { useMachineApi } from '../state/activeMachine'
import { usePlaybackStore } from '../state/playbackStore'
import { useStageStore } from '../state/stageStore'
import { useToyStore } from '../state/toyStore'
import { useSignalReport } from './signalReport'
import { machineView, playbackFor, toyView, type SceneView } from './view'

export interface StageViewState {
  readonly view: SceneView
  readonly model: ModelName
  readonly t: number
  readonly highlight: readonly Highlight[]
  readonly ghost: Ghost | null
  readonly keyboardLocked: boolean
  readonly toySpec: ToySpec
  readonly pathPoints: number
}

export function useStageView(source: StageDirective['source']): StageViewState {
  const api = useMachineApi()
  const m = useStore(
    api,
    useShallow((s) => ({
      machine: s.machine,
      last: s.last,
      lampsHidden: !!s.locks.lampsHidden,
      keyboardLocked: !!s.locks.keyboard,
    })),
  )
  const toy = useToyStore(useShallow((s) => ({ spec: s.spec, last: s.last })))
  const played = usePlaybackStore(useShallow((s) => ({ t: s.t, hops: s.hops, source: s.source })))
  const { highlight, ghost } = useStageStore(useShallow((s) => ({ highlight: s.highlight, ghost: s.ghost })))
  const pathPoints = useSignalReport((s) => s.pathPoints)
  const ownHops = source === 'toy' ? (toy.last?.hops.length ?? 0) : (m.last?.trace.length ?? 0)
  const pb = playbackFor(source, played, ownHops)
  const view =
    source === 'toy'
      ? toyView({ spec: toy.spec, last: toy.last, lampsHidden: m.lampsHidden }, pb)
      : machineView({ machine: m.machine, last: m.last, lampsHidden: m.lampsHidden }, pb)
  return {
    view,
    model: m.machine.config.model,
    t: pb.t,
    highlight,
    ghost,
    keyboardLocked: m.keyboardLocked,
    toySpec: toy.spec,
    pathPoints,
  }
}

/** The StageReport of what the 3D view shows (PLAN §3.3). */
export function buildReport(s: StageViewState, directive: StageDirective, gpu: string): StageReport {
  return {
    renderer: 'webgl2',
    gpu,
    focus: directive.focus,
    dimmed: dimmedParts(directive.focus, s.model),
    highlighted: s.highlight.map((h) => h.part),
    litLamp: s.view.litLamp === null ? null : s.view.letters[s.view.litLamp]!,
    windows: s.view.windows,
    hop: s.view.hop,
    pathPoints: s.pathPoints,
    ghost: s.ghost !== null,
  }
}
