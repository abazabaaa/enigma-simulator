/**
 * The 6- and 8-letter toys' own wiring (PLAN §2.6, brief 11), drawn in addition to the n-parametric
 * parts (rotors, pawls, keys, lamps, sockets, reflector) when the source is 'toy'. A toy has no entry
 * wheel: its n wires run from the plugboard sockets straight to a fixed contact plate against the
 * right rotor. With only 6 or 8 of them, every wire is shown — the whole circuit can be followed —
 * and the glowing signal runs along one of them (signal/route.ts harnessPath). While the directive
 * hides the plugboard, a strip of n terminals stands where the sockets would be, so the path from
 * a key, through the terminals and back to the rotors, has something to run to.
 * Draw calls: one (plate, contacts, wires and terminals, in vertex colours).
 */

import { memo, useLayoutEffect, useMemo, type JSX } from 'react'
import { CylinderGeometry, MeshStandardMaterial, type BufferGeometry } from 'three'
import type { ToySpec } from '../../contracts/machine'
import { useStage3D } from '../context'
import { usePartMaterial } from '../focus'
import { box, discX, shellX } from '../geometry'
import { AXIS_Y, AXIS_Z, DECK, ROTOR, contactPoint, slotX, socketPosition, type Layout } from '../layout'
import { PALETTE } from '../palette'
import { mergeColored, tubeAlong } from '../signal/mesh'
import { harnessPath } from '../signal/route'

export interface ToyGeometryProps {
  readonly layout: Layout
  readonly spec: ToySpec
}

const WIRE_COLOR = '#b87333'
const WIRE_RADIUS = 0.06

/** The plate's x range: just right of the right rotor's pins. */
function plateX(layout: Layout): [number, number] {
  const x0 = slotX(layout, layout.slots.length - 1) + ROTOR.inFaceX + 0.1
  return [x0, x0 + 0.16]
}

/** Where the sockets would be: a strip with the n terminals (both holes of each). */
function terminals(layout: Layout, n: number): { geometry: BufferGeometry; color: string }[] {
  const ends = [socketPosition(layout, 0), socketPosition(layout, n - 1)]
  const y = ends[0]!.y
  const out: { geometry: BufferGeometry; color: string }[] = [
    {
      geometry: box(ends[0]!.x - 1.6, ends[1]!.x + 1.6, y - 1.3, y + 1.3, DECK.panelZ, DECK.panelZ + 0.06),
      color: PALETTE.metalDark,
    },
  ]
  for (let k = 0; k < n; k++) {
    for (const face of ['in', 'out'] as const) {
      const p = contactPoint(layout, 'plugboard', face, k, 0)
      const g = new CylinderGeometry(0.3, 0.3, 0.24, 14).rotateX(Math.PI / 2).translate(p.x, p.y, DECK.panelZ + 0.12)
      out.push({ geometry: g, color: PALETTE.brass })
    }
  }
  return out
}

function toyGeometry(layout: Layout, n: number, withTerminals: boolean) {
  const right = layout.slots[layout.slots.length - 1]!
  const [x0, x1] = plateX(layout)
  const parts: { geometry: BufferGeometry; color: string }[] = [
    {
      geometry: shellX(ROTOR.contactR - 0.75, ROTOR.contactR + 0.75, x0, x1, 48).translate(0, AXIS_Y, AXIS_Z),
      color: PALETTE.core,
    },
  ]
  for (let k = 0; k < n; k++) {
    const face = contactPoint(layout, right, 'in', k, 0)
    parts.push({ geometry: discX(0.24, x0 - 0.05, x1 + 0.05, 8).translate(0, face.y, face.z), color: PALETTE.brass })
    const hole = contactPoint(layout, 'plugboard', 'out', k, 0)
    parts.push({
      geometry: tubeAlong([hole, ...harnessPath(hole, face), face], WIRE_RADIUS, 64, 4),
      color: WIRE_COLOR,
    })
  }
  if (withTerminals) parts.push(...terminals(layout, n))
  return mergeColored(parts)
}

export const ToyGeometry = memo(function ToyGeometry({ layout, spec }: ToyGeometryProps): JSX.Element {
  const n = Math.min(spec.n, layout.n)
  const withTerminals = !useStage3D().directive.plugboard
  const merged = useMemo(() => toyGeometry(layout, n, withTerminals), [layout, n, withTerminals])
  useLayoutEffect(() => () => merged.geometry.dispose(), [merged])
  const material = usePartMaterial(
    'plugboard',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }),
  )
  return (
    <group name="toy-geometry" userData={{ n, wires: n, contacts: n, terminals: withTerminals ? n : 0 }}>
      <mesh name="toy-wiring" geometry={merged.geometry} material={material} userData={{ part: 'plugboard' }} />
    </group>
  )
})
