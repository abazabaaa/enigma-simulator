/**
 * STUB (02 → 04). 04 replaces this file with the SVG "flattened circuit" (PLAN §2.6, brief 04).
 * The stub draws nothing and reports renderer 'placeholder' (so StageHost shows StagePlaceholder),
 * with the same focus, dimming, lamp, windows and hop a real view would report.
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { hopAt, isLit } from '../contracts/machine'
import { dimmedParts, type StageViewProps } from '../contracts/stage'
import { positionsToString } from '../engine'
import { toyWindows } from '../lib/toy'
import { useMachine } from '../state/activeMachine'
import { usePlaybackStore } from '../state/playbackStore'
import { useStageStore } from '../state/stageStore'
import { useToyStore } from '../state/toyStore'

export default function Stage2D({ directive, onReport }: StageViewProps): null {
  const { machine, last, lampsHidden } = useMachine(
    useShallow((s) => ({ machine: s.machine, last: s.last, lampsHidden: !!s.locks.lampsHidden })),
  )
  const toy = useToyStore(useShallow((s) => ({ spec: s.spec, last: s.last })))
  const { t, hops } = usePlaybackStore(useShallow((s) => ({ t: s.t, hops: s.hops })))
  const { highlight, ghost } = useStageStore(useShallow((s) => ({ highlight: s.highlight, ghost: s.ghost })))

  useEffect(() => {
    const isToy = directive.source === 'toy'
    const lamp = isToy ? (toy.last?.lamp ?? null) : (last?.output ?? null)
    const stepping = isToy ? toy.last?.stepping : last?.stepping
    const windows =
      stepping && t < 1 ? positionsToString(stepping.before) : isToy ? toyWindows(toy.spec) : positionsToString(machine)
    onReport({
      renderer: 'placeholder',
      focus: directive.focus,
      dimmed: dimmedParts(directive.focus, machine.config.model),
      highlighted: highlight.map((h) => h.part),
      litLamp: !lampsHidden && isLit(t, hops) ? lamp : null,
      windows,
      hop: hopAt(t, hops),
      pathPoints: 0,
      ghost: ghost !== null,
    })
  })

  return null
}
