/**
 * The tag at the signal's head (PLAN §2.6 teaching aid, "count the transformations"): which part the
 * current is in, what it does to the letter there, and how many of the path's letter changes have
 * happened so far. PURE, unit-tested.
 *  - The part is its symbol (S, H, N, M, L, G, U) in the slot's colour; on the way back through a
 *    rotor, the entry wheel or the plugboard it carries ⁻¹ (the inverse wiring), as in the trace panel.
 *  - A hop changes the letter when its input and output differ. The entry wheel (wired A→A) and an
 *    unplugged socket change nothing; the reflector always does.
 */

import type { PathHop } from '../../contracts/stage'
import { symForStage, type Sym } from '../../lib/symbols'

export interface HeadTag {
  readonly sym: Sym
  /** The way back: the inverse of the part's wiring. */
  readonly inverse: boolean
  readonly input: string
  readonly output: string
  /** 1-based index of this hop among the path's letter changes, or null when it changes nothing. */
  readonly change: number | null
  /** Letter changes on the whole path. */
  readonly changes: number
  /** First line: 'N  E → W' ('N⁻¹  E → W' on the way back). */
  readonly title: string
  /** Second line: 'change 4 of 7', or 'no change'. */
  readonly detail: string
}

const changes = (h: PathHop): boolean => h.inputIndex !== h.outputIndex
const isReturn = (h: PathHop): boolean =>
  h.stage === 'plugboard-out' || h.stage === 'etw-out' || h.stage.endsWith('-bwd')

/** The tag for hop k of a path, or null when there is no such hop. */
export function headTag(hops: readonly PathHop[], k: number): HeadTag | null {
  const h = hops[k]
  if (!h) return null
  const total = hops.filter(changes).length
  const change = changes(h) ? hops.slice(0, k + 1).filter(changes).length : null
  const sym = symForStage(h.stage)
  const inverse = isReturn(h)
  return {
    sym,
    inverse,
    input: h.input,
    output: h.output,
    change,
    changes: total,
    title: `${sym}${inverse ? '⁻¹' : ''}  ${h.input} → ${h.output}`,
    detail: change === null ? 'no change' : `change ${change} of ${total}`,
  }
}
