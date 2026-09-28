/**
 * The press on show and how much of its path is drawn, for every 3D part that shows the signal
 * (the tube, the lit reflector pair, the lit plug cables). It reads the SAME press view as the DOM
 * and the 2D stage (machine-ui/hooks usePressView: the last press against the playback clock, only
 * while the clock plays that very press), so the 3D path, the trace panel and the 2D path cannot
 * drift apart (PLAN §2.5).
 */

import { useRef } from 'react'
import { usePressView, type ClockMode, type PressView } from '../../machine-ui/hooks'
import { useMachineApi } from '../../state/activeMachine'
import { useStage3D } from '../context'
import type { Layout } from '../layout'
import { hopsDrawn, type TraceClock } from './timing'

export interface SignalState {
  readonly press: PressView
  readonly clock: TraceClock
  /** Hops drawn now (a partly drawn live hop counts). */
  readonly drawn: number
  /** The scene's layout, stable while n, the slots and the toy flag stay the same. */
  readonly layout: Layout
}

/** A layout object that keeps its identity while its content is unchanged. */
export function useStableLayout(layout: Layout): Layout {
  const key = `${layout.n}|${layout.slots.join()}|${layout.toy}`
  const ref = useRef({ key, layout })
  if (ref.current.key !== key) ref.current = { key, layout }
  return ref.current.layout
}

/**
 * The signal's state. 'continuous' re-renders on every clock tick (the growing tube and its head);
 * 'discrete' only when a hop starts (parts that light up hop by hop).
 */
export function useSignal(mode: ClockMode): SignalState {
  const { view, directive } = useStage3D()
  const api = useMachineApi()
  const press = usePressView(directive.source, api, mode)
  const clock: TraceClock = {
    trace: directive.trace,
    hasPress: press.hasPress,
    conceal: press.lampsHidden,
    t: press.t,
    hops: press.hops.length,
  }
  return { press, clock, drawn: hopsDrawn(clock), layout: useStableLayout(view.layout) }
}

/**
 * Whether hop `index` of the press is drawn (live or done); false for a missing hop. A part lights
 * up (the reflector pair, a plug cable) when the signal reaches it, and stays lit while shown.
 */
export function hopShown(s: SignalState, index: number): boolean {
  return index >= 0 && index < s.press.hops.length && s.drawn > index
}
