/**
 * The reflector (Umkehrwalze, U) left of the left rotor (PLAN §2.6, brief 11). Its contact face
 * (towards the rotors) meets the left rotor at contactPoint(layout, 'reflector', 'in', j, 0); its
 * outer face shows the wiring as a chord diagram: n/2 wire pairs (13 on the machine, 3 or 4 on a
 * toy), each an arc between its two contacts (signal/route.ts reflectorArc). The pair the signal
 * uses is lit: the glowing signal tube runs through the disc and along that very arc, and the mesh
 * records the pair (userData.lit) once the signal has reached the reflector. On the M4 the
 * reflector is the thin one (B-thin, C-thin), which shares its space with the Greek rotor
 * (layout.ts reflectorWidth). One draw call: disc, face plate, arcs and their studs, in vertex
 * colours. The mesh named 'reflector' sits at the reflector's centre (the core's labels, framing and
 * screen points read its position), its geometry relative to it.
 */

import { memo, useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshStandardMaterial, SphereGeometry, type BufferGeometry } from 'three'
import type { ReflectorName } from '../../engine'
import { usePartMaterial } from '../focus'
import { discX } from '../geometry'
import { AXIS_Y, AXIS_Z, REFLECTOR, reflectorWidth, reflectorX, type Layout } from '../layout'
import { PALETTE, swatch } from '../palette'
import { mergeColored, tubeAlong } from '../signal/mesh'
import { reflectorArc, wirePairs } from '../signal/route'
import { hopShown, useSignal } from '../signal/useSignal'

export interface ReflectorProps {
  readonly layout: Layout
  /** The reflector's wiring: a fixed-point-free involution on layout.n (contact j ↔ wiring[j]). */
  readonly wiring: readonly number[]
  /** 'B', 'C', 'B-thin' … on the machine; null on a toy. */
  readonly name: ReflectorName | null
}

const ARC_RADIUS = 0.075
export const ARC_SEGMENTS = 20
export const ARC_SIDES = 5

/** The reflector's centre (on the rotor axis). */
const centre = (layout: Layout): [number, number, number] => [reflectorX(layout), AXIS_Y, AXIS_Z]

/** The disc, the dark plate on its outer face, the arcs and the studs at their ends, about the centre. */
function reflectorGeometry(layout: Layout, pairs: readonly (readonly [number, number])[]) {
  const w = reflectorWidth(layout)
  const x = reflectorX(layout)
  const outer = x - w / 2
  const u = swatch('U')
  const parts: { geometry: BufferGeometry; color: string }[] = [
    { geometry: discX(REFLECTOR.r, x - w / 2, x + w / 2, 48).translate(0, AXIS_Y, AXIS_Z), color: u },
    {
      geometry: discX(REFLECTOR.r - 0.3, outer - 0.05, outer + 0.02, 32).translate(0, AXIS_Y, AXIS_Z),
      color: PALETTE.core,
    },
  ]
  for (const [a, b] of pairs) {
    const arc = reflectorArc(layout, a, b)
    parts.push({ geometry: tubeAlong(arc, ARC_RADIUS, ARC_SEGMENTS, ARC_SIDES), color: u })
    for (const p of [arc[0]!, arc[arc.length - 1]!]) {
      parts.push({ geometry: new SphereGeometry(0.15, 6, 4).translate(p.x, p.y, p.z), color: PALETTE.brass })
    }
  }
  const merged = mergeColored(parts)
  const [cx, cy, cz] = centre(layout)
  merged.geometry.translate(-cx, -cy, -cz)
  return merged
}

export const Reflector = memo(function Reflector({ layout, wiring }: ReflectorProps): JSX.Element {
  const w = reflectorWidth(layout)
  const thin = layout.slots.includes('greek')
  const wiringKey = wiring.join()
  const pairs = useMemo(() => wirePairs(wiring), [wiringKey])
  const merged = useMemo(() => reflectorGeometry(layout, pairs), [layout, pairs])
  useLayoutEffect(() => () => merged.geometry.dispose(), [merged])
  const material = usePartMaterial(
    'reflector',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }),
  )

  // The pair the signal uses, once the signal has reached the reflector.
  const signal = useSignal()
  const r = signal.hops.findIndex((h) => h.kind === 'reflector')
  const hop = hopShown(signal, r) ? signal.hops[r]! : null
  const lit = hop ? [Math.min(hop.inputIndex, hop.outputIndex), Math.max(hop.inputIndex, hop.outputIndex)] : null

  return (
    <mesh
      name="reflector"
      geometry={merged.geometry}
      material={material}
      position={centre(layout)}
      userData={{ part: 'reflector', width: w, thin, pairs, lit }}
    />
  )
})
