/**
 * The case (scenery), the battery and the inner lid over the rotors. Lid states (StageDirective.lid):
 * 'closed' covers the rotors and shows one window per rotor, 'open' swings it up on its back hinge,
 * 'cutaway' removes it.
 */

import { memo, type JSX } from 'react'
import { ExtrudeGeometry, Matrix4, MeshStandardMaterial, Path, Shape, Vector3 } from 'three'
import type { StageDirective } from '../../contracts/stage'
import { usePartMaterial } from '../focus'
import { box, discX, merge } from '../geometry'
import { useGeometry } from '../hooks'
import {
  AXIS_Y,
  AXIS_Z,
  CASE,
  ROTOR,
  WINDOW_ANGLE,
  etwX,
  reflectorX,
  slotX,
  type Layout,
} from '../layout'
import { PALETTE } from '../palette'

const W = 0.6 // wood thickness

function woodBody() {
  const { x0, x1, zBack, zFront, yBottom } = CASE
  return merge([
    box(x0 - W, x0, yBottom, 1.2, zBack - W, zFront),
    box(x1, x1 + W, yBottom, 1.2, zBack - W, zFront),
    box(x0 - W, x1 + W, yBottom, 1.2, zBack - W, zBack),
    box(x0 - W, x1 + W, yBottom - W, yBottom, zBack - W, zFront),
  ])
}

function metalBody(l: Layout) {
  const { x0, x1, zBack, zFront, yBottom, deckZ0, wellFloorY } = CASE
  return merge([
    box(x0, x1, -0.4, 0, deckZ0, zFront - 0.4),
    box(x0, x1, yBottom, 0, zFront - 0.4, zFront),
    box(x0, x1, wellFloorY - 0.3, wellFloorY, zBack, deckZ0),
    box(x0, x1, wellFloorY, 0, deckZ0 - 0.3, deckZ0),
    // the rotor spindle
    discX(0.35, reflectorX(l) - 1, etwX(l) + 1.2, 16).translate(0, AXIS_Y, AXIS_Z),
  ])
}

/** The lid, in hinge-relative coordinates (hinge on the back top edge). */
function lidGeometry(l: Layout) {
  const half = 15.6
  const t = 0.3
  const { zBack, lidTopY } = CASE
  // Sloped window plate, tangent to a cylinder of radius R around the rotor axis at the window angle.
  const R = ROTOR.wheelR + 0.4
  const c = Math.cos(WINDOW_ANGLE)
  const s = Math.sin(WINDOW_ANGLE)
  const py = AXIS_Y + R * c
  const pz = AXIS_Z + R * s
  const vTop = (lidTopY - t - py) / s
  const vBottom = (1.6 - py) / s
  const plate = new Shape()
  plate.moveTo(-half, vBottom)
  plate.lineTo(half, vBottom)
  plate.lineTo(half, vTop)
  plate.lineTo(-half, vTop)
  plate.closePath()
  l.slots.forEach((_, i) => {
    const x = slotX(l, i) + ROTOR.letterX
    const hole = new Path()
    hole.moveTo(x - 0.7, -0.75)
    hole.lineTo(x - 0.7, 0.75)
    hole.lineTo(x + 0.7, 0.75)
    hole.lineTo(x + 0.7, -0.75)
    hole.closePath()
    plate.holes.push(hole)
  })
  const slope = new ExtrudeGeometry(plate, { depth: t, bevelEnabled: false })
  const basis = new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, s, -c), new Vector3(0, c, s))
  slope.applyMatrix4(basis)
  slope.translate(0, py, pz)
  const topZ = pz - vTop * c
  const frontZ = pz - vBottom * c
  const side = () => {
    const shape = new Shape()
    shape.moveTo(zBack, 0)
    shape.lineTo(zBack, lidTopY)
    shape.lineTo(topZ, lidTopY)
    shape.lineTo(frontZ, 1.6)
    shape.lineTo(frontZ, 0)
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: t, bevelEnabled: false })
    g.rotateY(-Math.PI / 2)
    return g
  }
  const g = merge([
    box(-half, half, lidTopY - t, lidTopY, zBack, topZ),
    slope,
    box(-half, half, 0, 1.6, frontZ - t, frontZ),
    side().translate(half + t, 0, 0),
    side().translate(-half, 0, 0),
  ])
  g.translate(0, -lidTopY, -zBack)
  return g
}

function Lid({ layout, open }: { layout: Layout; open: boolean }): JSX.Element {
  const key = layout.slots.join()
  const geometry = useGeometry(() => lidGeometry(layout), [key])
  const material = usePartMaterial(
    'lid',
    () => new MeshStandardMaterial({ color: PALETTE.metalDark, roughness: 0.55, metalness: 0.35 }),
  )
  return (
    <group position={[0, CASE.lidTopY, CASE.zBack]} rotation-x={open ? -1.9 : 0}>
      <mesh name="lid" geometry={geometry} material={material} userData={{ part: 'lid' }} />
    </group>
  )
}

function Battery(): JSX.Element {
  const geometry = useGeometry(
    () =>
      merge([
        box(-15.6, -11.8, CASE.wellFloorY, -1.2, -15.4, -9.6),
        box(-14.6, -13.8, -1.2, -0.8, -14.2, -13.4),
        box(-14.6, -13.8, -1.2, -0.8, -11.6, -10.8),
      ]),
    [],
  )
  const material = usePartMaterial(
    'battery',
    () => new MeshStandardMaterial({ color: '#5c3a26', roughness: 0.7, metalness: 0.1 }),
  )
  return <mesh name="battery" geometry={geometry} material={material} userData={{ part: 'battery' }} />
}

export const Case = memo(function Case({ layout, lid }: { layout: Layout; lid: StageDirective['lid'] }): JSX.Element {
  const key = layout.slots.join()
  const wood = useGeometry(woodBody, [])
  const metal = useGeometry(() => metalBody(layout), [key])
  const woodMaterial = usePartMaterial('scenery', () => new MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 }))
  const metalMaterial = usePartMaterial(
    'scenery',
    () => new MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.85, metalness: 0.2 }),
  )
  return (
    <group name="case">
      <mesh name="case-wood" geometry={wood} material={woodMaterial} userData={{ part: 'scenery' }} />
      <mesh name="case-metal" geometry={metal} material={metalMaterial} userData={{ part: 'scenery' }} />
      <Battery />
      {lid === 'cutaway' ? null : <Lid layout={layout} open={lid === 'open'} />}
    </group>
  )
})
