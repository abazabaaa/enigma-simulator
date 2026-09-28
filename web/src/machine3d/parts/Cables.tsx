/**
 * STUB (06 → 11). Plug cables: one tube per plugged pair between the two sockets, which the signal
 * visibly crosses twice. Socket k is at socketPosition(layout, k); its holes at
 * contactPoint(layout, 'plugboard', 'in' | 'out', k, 0) (layout.ts). Rendered by the scene only
 * while the directive shows the plugboard; dim with usePartMaterial('plugboard', …).
 */

import type { Layout } from '../layout'

export interface CablesProps {
  readonly layout: Layout
  /** The plugboard as an involution on layout.n; plugs[i] ≠ i means i is cabled to plugs[i]. */
  readonly plugs: readonly number[]
}

export function Cables(_props: CablesProps): null {
  return null
}
