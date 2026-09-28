/**
 * STUB (06 → 11). The reflector (Umkehrwalze, U) left of the left rotor. PR 11 draws its n/2 wire
 * pairs as arcs on the contact face; this stub is a plain disc with the final props.
 * Contact j of the face is at contactPoint(layout, 'reflector', 'in', j, 0) (layout.ts).
 */

import type { JSX } from 'react'
import { MeshStandardMaterial } from 'three'
import type { ReflectorName } from '../../engine'
import { usePartMaterial } from '../focus'
import { discX } from '../geometry'
import { useGeometry } from '../hooks'
import { AXIS_Y, AXIS_Z, REFLECTOR, reflectorWidth, reflectorX, type Layout } from '../layout'
import { swatch } from '../palette'

export interface ReflectorProps {
  readonly layout: Layout
  /** The reflector's wiring: a fixed-point-free involution on layout.n (contact j ↔ wiring[j]). */
  readonly wiring: readonly number[]
  /** 'B', 'C', 'B-thin' … on the machine; null on a toy. */
  readonly name: ReflectorName | null
}

export function Reflector({ layout }: ReflectorProps): JSX.Element {
  const w = reflectorWidth(layout)
  const disc = useGeometry(() => discX(REFLECTOR.r, -w / 2, w / 2, 48), [w])
  const material = usePartMaterial(
    'reflector',
    () => new MeshStandardMaterial({ color: swatch('U'), roughness: 0.5, metalness: 0.3 }),
  )
  return (
    <mesh
      name="reflector"
      geometry={disc}
      material={material}
      position={[reflectorX(layout), AXIS_Y, AXIS_Z]}
      userData={{ part: 'reflector' }}
    />
  )
}
