/**
 * The press on show and how much of its path is drawn, for every 3D part that shows the signal
 * (the tube, the lit reflector pair, the lit plug cables). It reads the 3D view's own snapshot —
 * useStage3D(): view.hops and t, which view.ts playbackFor takes from the playback clock by the
 * source rule (the clock counts only while it plays this view's source; otherwise the source's own
 * last press shows finished) — the very snapshot the StageReport comes from, so the reported
 * pathPoints always match the reported hop. The DOM and the 2D view read the same stores by the
 * same rules (PLAN §2.5), so the three cannot drift apart.
 */

import { useRef } from 'react'
import type { PathHop } from '../../contracts/stage'
import { useMachine } from '../../state/activeMachine'
import { useStage3D } from '../context'
import type { Layout } from '../layout'
import { hopsDrawn, type TraceClock } from './timing'

export interface SignalState {
  /** Hops of the press on show (empty before the first press). */
  readonly hops: readonly PathHop[]
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

/** The signal's state at the scene's playback time. */
export function useSignal(): SignalState {
  const { view, directive, t } = useStage3D()
  // lampsHidden conceals the path (it would give the lamp away), as in the 2D view.
  const conceal = useMachine((s) => !!s.locks.lampsHidden)
  const clock: TraceClock = {
    trace: directive.trace,
    hasPress: view.hops.length > 0,
    conceal,
    t,
    hops: view.hops.length,
  }
  return { hops: view.hops, clock, drawn: hopsDrawn(clock), layout: useStableLayout(view.layout) }
}

/**
 * Whether hop `index` of the press is drawn (live or done); false for a missing hop. A part lights
 * up (the reflector pair, a plug cable) when the signal reaches it, and stays lit while shown.
 */
export function hopShown(s: SignalState, index: number): boolean {
  return index >= 0 && index < s.hops.length && s.drawn > index
}

/**
 * The plug cables the drawn path runs along: on the way in (hop 0, the key's socket → its partner)
 * and on the way out (the last hop, a partner → the lamp's socket), once the signal gets there. An
 * unplugged letter crosses no cable; the same cable twice when key and lamp are partners.
 */
export function crossedCables(s: SignalState): [number, number][] {
  const out: [number, number][] = []
  for (const index of [0, s.hops.length - 1]) {
    if (!hopShown(s, index)) continue
    const h = s.hops[index]!
    if (h.kind !== 'plugboard' || h.inputIndex === h.outputIndex) continue
    const pair: [number, number] = [Math.min(h.inputIndex, h.outputIndex), Math.max(h.inputIndex, h.outputIndex)]
    if (!out.some(([a, b]) => a === pair[0] && b === pair[1])) out.push(pair)
  }
  return out
}
