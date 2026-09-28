/**
 * The stepping pawls (pawl-X), on a shaft behind the rotors. Pawl X sits in the gap right of rotor X,
 * over X's ratchet and the notch ring of its right-hand neighbour: it drops (engaged) when that
 * ring's notch is under it, i.e. when the neighbour is at its turnover (isAtTurnover), and then
 * carries rotor X on the next key press. The rightmost pawl has no ring under it and is always down.
 * The middle rotor's notch under the left pawl is the double step. The Greek rotor has no pawl.
 */

import { memo, useMemo, type JSX } from 'react'
import { MeshStandardMaterial } from 'three'
import { usePartMaterial } from '../focus'
import { box, discX, merge } from '../geometry'
import { useGeometry } from '../hooks'
import { AXIS_Y, AXIS_Z, PAWL_ANGLE, ROTOR, ROTOR_PITCH, slotX, type Layout, type Vec3 } from '../layout'
import { PALETTE, slotColor } from '../palette'
import type { RotorView } from '../view'

const PIVOT_R = 7.4
const PIVOT_ANGLE = PAWL_ANGLE - 0.14
/** Tip radius resting on the notch ring, and dropped into the notch. */
const TIP_UP_R = ROTOR.notchR + 1.0
const TIP_DOWN_R = ROTOR.notchR + 0.3
/** Pawl x relative to its rotor's centre: in the gap towards the right-hand neighbour. */
export const PAWL_DX = 1.72

/** Pivot of the pawls, relative to the rotor axis (y, z). */
export const PAWL_PIVOT = { y: PIVOT_R * Math.cos(PIVOT_ANGLE), z: PIVOT_R * Math.sin(PIVOT_ANGLE) }

function aim(r: number): { angle: number; length: number } {
  const dy = r * Math.cos(PAWL_ANGLE) - PAWL_PIVOT.y
  const dz = r * Math.sin(PAWL_ANGLE) - PAWL_PIVOT.z
  // rotation.x = θ turns local −y into (−cos θ, −sin θ) in (y, z)
  return { angle: Math.atan2(-dz, -dy), length: Math.hypot(dy, dz) }
}

const UP = aim(TIP_UP_R)
const DOWN = aim(TIP_DOWN_R)

/** rotation.x of a pawl, engaged or not. */
export const pawlAngle = (engaged: boolean): number => (engaged ? DOWN.angle : UP.angle)

/** The tip of a pawl in its own frame (pivot at the origin, before its rotation). */
export const PAWL_TIP_LOCAL: Vec3 = { x: ROTOR_PITCH + ROTOR.notchX0 - PAWL_DX + 0.15, y: -UP.length, z: 0 }

/** World position of pawl i's tip, where it meets the notch ring: the pawl–notch contact. */
export function pawlTip(l: Layout, i: number, engaged: boolean): Vec3 {
  const a = pawlAngle(engaged)
  const { x, y } = PAWL_TIP_LOCAL
  return {
    x: slotX(l, i) + PAWL_DX + x,
    y: AXIS_Y + PAWL_PIVOT.y + y * Math.cos(a),
    z: AXIS_Z + PAWL_PIVOT.z + y * Math.sin(a),
  }
}

/** World position of pawl i's pivot (for labels and highlights). */
export function pawlAnchor(l: Layout, i: number): Vec3 {
  return { x: slotX(l, i) + PAWL_DX, y: AXIS_Y + PAWL_PIVOT.y, z: AXIS_Z + PAWL_PIVOT.z }
}

function bladeGeometry() {
  const L = UP.length
  return merge([
    box(-0.22, 0.22, -L + 0.1, 0.35, -0.14, 0.14),
    // the tip: over this rotor's ratchet (−x) and the neighbour's notch ring (+x)
    box(ROTOR.ratchetX0 - PAWL_DX, ROTOR_PITCH + ROTOR.notchX1 - PAWL_DX, -L - 0.12, -L + 0.28, -0.15, 0.15),
  ])
}

function Pawl({ layout, index, rotor }: { layout: Layout; index: number; rotor: RotorView }): JSX.Element {
  const { slot } = rotor
  const blade = useGeometry(bladeGeometry, [])
  const material = usePartMaterial(
    `pawl-${slot}`,
    () => new MeshStandardMaterial({ color: slotColor(slot), roughness: 0.35, metalness: 0.55 }),
    [slot],
  )
  return (
    <group position={[slotX(layout, index) + PAWL_DX, PAWL_PIVOT.y, PAWL_PIVOT.z]}>
      <mesh
        name={`pawl-${slot}`}
        geometry={blade}
        material={material}
        rotation-x={pawlAngle(rotor.engaged)}
        userData={{ part: `pawl-${slot}`, engaged: rotor.engaged }}
      />
    </group>
  )
}

export const Pawls = memo(function Pawls({
  layout,
  rotors,
}: {
  layout: Layout
  rotors: readonly RotorView[]
}): JSX.Element {
  const withPawl = useMemo(() => rotors.map((r, i) => ({ r, i })).filter(({ r }) => r.pawl), [rotors])
  const first = withPawl[0]?.i ?? 0
  const last = withPawl[withPawl.length - 1]?.i ?? 0
  const shaft = useGeometry(
    () => discX(0.28, slotX(layout, first) + PAWL_DX - 0.8, slotX(layout, last) + PAWL_DX + 0.8, 16),
    [layout, first, last],
  )
  const shaftMaterial = usePartMaterial(
    'scenery',
    () => new MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.4, metalness: 0.7 }),
  )
  return (
    <group name="pawls" position={[0, AXIS_Y, AXIS_Z]}>
      {withPawl.length ? (
        <mesh name="pawl-shaft" geometry={shaft} material={shaftMaterial} position={[0, PAWL_PIVOT.y, PAWL_PIVOT.z]} />
      ) : null}
      {withPawl.map(({ r, i }) => (
        <Pawl key={r.slot} layout={layout} index={i} rotor={r} />
      ))}
    </group>
  )
})
