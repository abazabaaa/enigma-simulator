/**
 * STUB (06 → 11). Extra geometry for the 6- and 8-letter toy machines (PLAN §2.6). The scene already
 * draws a toy with the n-parametric parts (rotors, pawls, keys, lamps, sockets, reflector; there is
 * no entry wheel); this component is rendered in addition when the source is 'toy'.
 */

import type { ToySpec } from '../../contracts/machine'
import type { Layout } from '../layout'

export interface ToyGeometryProps {
  readonly layout: Layout
  readonly spec: ToySpec
}

export function ToyGeometry(_props: ToyGeometryProps): null {
  return null
}
