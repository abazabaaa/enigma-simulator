/**
 * The ghost path (PLAN §2.6): after a wrong answer the lesson puts the learner's path in the stage
 * store (Ghost: its hops and divergeAt, the first hop that goes wrong). The 3D view draws it as a
 * red tube against the reference path in gold, with a marker where they part — as the 2D view does.
 * PURE.
 */

import type { ToySpec } from '../../contracts/machine'
import type { Ghost, PathHop } from '../../contracts/stage'
import { encodeLetter, type MachineState } from '../../engine'
import { toyPress } from '../../lib/toy'

/**
 * The path the ghost's key takes at the current positions, without stepping: the reference.
 * The same rule as stage2d's referenceHops, so the two views show the same reference.
 */
export function referenceHops(
  ghost: Ghost | null,
  o: { toy: boolean; machine: MachineState; spec: ToySpec },
): readonly PathHop[] | null {
  const key = ghost?.hops[0]?.input
  if (!key) return null
  try {
    return o.toy ? toyPress({ ...o.spec, stepping: false }, key).hops : encodeLetter(o.machine, key).trace
  } catch {
    return null
  }
}

/**
 * The ghost's hops, placed by their letters only. A ghost copies the reference's hops and changes
 * their letters (lesson/kinds/helpers ghostFromOutputs), so the core contacts it carries belong to
 * the reference; without them layout.ts places a rotor hop at (letter + offset), where the ghost's
 * letters really run.
 */
export function ghostHops(ghost: Ghost): PathHop[] {
  return ghost.hops.map((h) => ({
    kind: h.kind,
    stage: h.stage,
    input: h.input,
    output: h.output,
    inputIndex: h.inputIndex,
    outputIndex: h.outputIndex,
    slotIndex: h.slotIndex,
    offset: h.offset,
  }))
}

/** The anchor (pathPoints index) of the divergence marker: the entry of hop divergeAt, or null. */
export function divergeAnchor(ghost: Ghost): number | null {
  const k = ghost.divergeAt
  return Number.isInteger(k) && k >= 0 && k < ghost.hops.length ? 1 + 2 * k : null
}
