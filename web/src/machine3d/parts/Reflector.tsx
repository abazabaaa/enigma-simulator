/**
 * The reflector (Umkehrwalze, U) left of the left rotor (PLAN §2.6, brief 11). Its contact face
 * (towards the rotors) carries n contacts at contactPoint(layout, 'reflector', 'in', j, 0); its
 * outer face shows the wiring as a chord diagram: n/2 wire pairs (13 on the machine, 3 or 4 on a
 * toy), each an arc between its two contacts (signal/route.ts reflectorArc). The pair the signal
 * uses lights up, in the signal's glow, once the signal reaches the reflector; the signal tube runs
 * through the disc and along that very arc. On the M4 the reflector is the thin one (B-thin,
 * C-thin), which shares its space with the Greek rotor (layout.ts reflectorWidth).
 * Draw calls: the disc, the face with every arc, contact and stud (vertex colours), the lit arc.
 */

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Mesh } from 'three'
import type { ReflectorName } from '../../engine'
import { usePartMaterial } from '../focus'
import { discX } from '../geometry'
import { useGeometry } from '../hooks'
import { AXIS_Y, AXIS_Z, REFLECTOR, contactPoint, reflectorWidth, reflectorX, type Layout } from '../layout'
import { markChange } from '../monitor'
import { PALETTE, swatch } from '../palette'
import { glowMaterial } from '../signal/materials'
import { mergeColored, showRange, tubeAlong } from '../signal/mesh'
import { reflectorArc, wirePairs } from '../signal/route'
import { usePrimed } from '../signal/usePrimed'
import { hopShown, useSignal } from '../signal/useSignal'

export interface ReflectorProps {
  readonly layout: Layout
  /** The reflector's wiring: a fixed-point-free involution on layout.n (contact j ↔ wiring[j]). */
  readonly wiring: readonly number[]
  /** 'B', 'C', 'B-thin' … on the machine; null on a toy. */
  readonly name: ReflectorName | null
}

const ARC_RADIUS = 0.075
const LIT_RADIUS = 0.11
const ARC_SEGMENTS = 28

/** The arcs of every pair, as tubes (the lit copy is a little thicker). */
function arcTubes(layout: Layout, pairs: readonly (readonly [number, number])[], radius: number) {
  return pairs.map(([a, b]) => tubeAlong(reflectorArc(layout, a, b), radius, ARC_SEGMENTS, 6))
}

/** The outer face plate, the arcs, their end studs and the contacts on the contact face. */
function faceGeometry(layout: Layout, pairs: readonly (readonly [number, number])[]) {
  const w = reflectorWidth(layout)
  const x = reflectorX(layout)
  const outer = x - w / 2
  const inner = x + w / 2
  const u = swatch('U')
  const plate = discX(REFLECTOR.r - 0.3, outer - 0.05, outer + 0.02, 48).translate(0, AXIS_Y, AXIS_Z)
  const parts: { geometry: BufferGeometry; color: string }[] = [{ geometry: plate, color: PALETTE.core }]
  for (const g of arcTubes(layout, pairs, ARC_RADIUS)) parts.push({ geometry: g, color: u })
  for (const [a, b] of pairs) {
    for (const end of [a, b]) {
      const arc = reflectorArc(layout, a, b, 1)
      const p = end === a ? arc[0]! : arc[1]!
      parts.push({ geometry: new SphereGeometry(0.15, 10, 8).translate(p.x, p.y, p.z), color: PALETTE.brass })
    }
  }
  for (let j = 0; j < layout.n; j++) {
    const p = contactPoint(layout, 'reflector', 'in', j, 0)
    parts.push({ geometry: discX(0.2, inner - 0.1, p.x, 12).translate(0, p.y, p.z), color: u })
  }
  return mergeColored(parts)
}

export function Reflector({ layout, wiring }: ReflectorProps): JSX.Element {
  const w = reflectorWidth(layout)
  const thin = layout.slots.includes('greek')
  const wiringKey = wiring.join()
  const pairs = useMemo(() => wirePairs(wiring), [wiringKey])
  const disc = useGeometry(() => discX(REFLECTOR.r, -w / 2, w / 2, 48), [w])
  const face = useMemo(() => faceGeometry(layout, pairs), [layout, pairs])
  const lit = useMemo(
    () => mergeColored(arcTubes(layout, pairs, LIT_RADIUS).map((geometry) => ({ geometry, color: null }))),
    [layout, pairs],
  )
  useLayoutEffect(() => () => face.geometry.dispose(), [face])
  useLayoutEffect(() => () => lit.geometry.dispose(), [lit])

  const body = usePartMaterial(
    'reflector',
    () => new MeshStandardMaterial({ color: swatch('U'), roughness: 0.5, metalness: 0.3 }),
  )
  const faceMaterial = usePartMaterial(
    'reflector',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }),
  )
  const glow = usePartMaterial('reflector', glowMaterial)

  // The pair the signal uses, once the signal has reached the reflector.
  const signal = useSignal('discrete')
  const hopIndex = signal.press.hops.findIndex((h) => h.kind === 'reflector')
  const hop = hopShown(signal, hopIndex) ? signal.press.hops[hopIndex]! : null
  const litPair = hop
    ? ([Math.min(hop.inputIndex, hop.outputIndex), Math.max(hop.inputIndex, hop.outputIndex)] as const)
    : null
  const litIndex = litPair ? pairs.findIndex(([a, b]) => a === litPair[0] && b === litPair[1]) : -1
  const invalidate = useThree((s) => s.invalidate)
  const shows = litIndex >= 0
  const primed = usePrimed<Mesh>(shows)
  useLayoutEffect(() => {
    showRange(lit, shows ? litIndex : null)
    markChange()
    invalidate()
  }, [lit, litIndex, shows, invalidate])

  return (
    <group name="reflector-group">
      <mesh
        name="reflector"
        geometry={disc}
        material={body}
        position={[reflectorX(layout), AXIS_Y, AXIS_Z]}
        userData={{ part: 'reflector', width: w, thin }}
      />
      <mesh
        name="reflector-arcs"
        geometry={face.geometry}
        material={faceMaterial}
        userData={{ part: 'reflector', pairs }}
      />
      <mesh
        ref={primed.ref}
        name="reflector-lit"
        geometry={lit.geometry}
        material={glow}
        visible={primed.visible}
        onAfterRender={primed.onAfterRender}
        userData={{ part: 'reflector', lit: shows ? litPair : null }}
      />
    </group>
  )
}
