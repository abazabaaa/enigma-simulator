/**
 * Named camera shots (PLAN §3.3 CameraShot), fitted to the canvas. PURE, so e2e specs can import it
 * in Node and compare the live camera against the shot.
 *
 * A shot is a viewing direction and the box of what it must show (the focused part, and its labels
 * when labels are on). frameShot() looks at the box's centre from that direction, from the smallest
 * distance at which every corner of the box fits the view at the canvas's aspect ratio: on a wide
 * screen the height decides, on a phone the width does, and nothing framed is ever cut.
 * The 'rotors' shot looks down more steeply when the focus is the pawls, so that the pawl–notch
 * contact behind the top of the rings is in view. 'rotor-layers' looks at the ring's side face, where
 * the exploded view's dial of ring numbers is.
 */

import type { CameraShot, Focus } from '../contracts/stage'
import { AXIS_Y, AXIS_Z, CASE, DECK, ROTOR, etwX, reflectorX, slotX, type Layout, type Vec3 } from './layout'

export interface Shot {
  readonly position: Vec3
  readonly target: Vec3
}

export interface FrameOptions {
  /** Canvas width / height. */
  readonly aspect: number
  /** Vertical field of view in degrees (CAMERA_FOV). */
  readonly fov?: number
  readonly focus?: Focus
  /** Labels are drawn (StageDirective.labels !== 'off'). */
  readonly labels?: boolean
  /** Exploded ring layers (StageDirective.ringLayer). */
  readonly ringLayer?: boolean
}

export const CAMERA_FOV = 35
/** Share of the view the framed box may use (the rest is margin). */
const FILL = 0.9

interface Box {
  readonly min: Vec3
  readonly max: Vec3
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: v(x0, y0, z0),
  max: v(x1, y1, z1),
})

/** Height reached by the rotor labels (they climb from right to left, labels.tsx). */
export const rotorLabelTop = (l: Layout): number => AXIS_Y + 7.4 + 1.6 * (l.slots.length - 1) + 0.8

/** The whole case, and the labels above the rotors when they are drawn. */
function machineBox(l: Layout, labels: boolean): Box {
  const w = 0.6
  const top = labels ? Math.max(CASE.lidTopY + 0.3, rotorLabelTop(l)) : CASE.lidTopY + 0.3
  return box(CASE.x0 - w, CASE.x1 + w, CASE.yBottom - w, top, CASE.zBack - w, CASE.zFront + 0.2)
}

function spec(shot: CameraShot, l: Layout, o: FrameOptions): { dir: Vec3; box: Box } {
  const labels = !!o.labels
  const first = slotX(l, 0)
  const last = slotX(l, l.slots.length - 1)
  const stackTop = labels ? rotorLabelTop(l) : AXIS_Y + ROTOR.wheelR + 0.4
  const labelWing = labels ? 4 : 0
  switch (shot) {
    case 'overview':
      return { dir: v(0, 1, 1), box: machineBox(l, labels) }
    case 'toy':
      return { dir: v(0, 1, 1.04), box: machineBox(l, labels) }
    case 'front':
      return {
        dir: v(0, 40.5, 57.5),
        box: box(CASE.x0 - 0.6, CASE.x1 + 0.6, CASE.yBottom, CASE.lidTopY + 0.3, -9, CASE.zFront + 0.2),
      }
    case 'rotors':
      if (o.focus === 'pawls') {
        return {
          dir: v(0.2, 0.94, 0.3),
          box: box(first - 2.2, last + 3.2, AXIS_Y - 2, AXIS_Y + 9.2, AXIS_Z - 8.6, AXIS_Z + 5.8),
        }
      }
      return {
        dir: v(18, 32, 27.6),
        box: box(
          reflectorX(l) - 1 - labelWing,
          etwX(l) + 1 + labelWing,
          AXIS_Y - ROTOR.wheelR,
          stackTop,
          AXIS_Z - 7.6,
          AXIS_Z + ROTOR.wheelR,
        ),
      }
    case 'rotor-layers': {
      const r = ROTOR.bandR * (o.ringLayer ? 1.3 : 1) + (labels ? 2.6 : 0.6)
      return { dir: v(26, 10, 14), box: box(last - 2, last + 2, AXIS_Y - r, AXIS_Y + r, AXIS_Z - r, AXIS_Z + r) }
    }
    case 'reflector': {
      const x = reflectorX(l)
      return {
        dir: v(-29.4, 18.8, 18.6),
        box: box(x - 1.5 - labelWing, x + 3, AXIS_Y - 5, AXIS_Y + (labels ? 7.4 : 5), AXIS_Z - 5, AXIS_Z + 5),
      }
    }
    case 'plugboard':
      return { dir: v(0, 10.4, 42.4), box: box(-16, 16, -12, -1.2, DECK.panelZ, DECK.panelZ + 0.4) }
    case 'lampboard':
      return { dir: v(0, 42, 29.7), box: box(-14.2, 14.2, 0, 0.5, -3.6, 4.6) }
  }
}

const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z)
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a.x, a.y, a.z)
  return v(a.x / n, a.y / n, a.z / n)
}

/** The shot fitted to a canvas of the given aspect ratio. */
export function frameShot(shot: CameraShot, l: Layout, o: FrameOptions): Shot {
  const { dir, box: b } = spec(shot, l, o)
  const d = unit(dir)
  const target = v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
  const forward = v(-d.x, -d.y, -d.z)
  const right = unit(cross(forward, v(0, 1, 0)))
  const up = cross(right, forward)
  const tanV = Math.tan((((o.fov ?? CAMERA_FOV) * Math.PI) / 180) * 0.5) * FILL
  const tanH = tanV * o.aspect
  let distance = 0
  for (const x of [b.min.x, b.max.x]) {
    for (const y of [b.min.y, b.max.y]) {
      for (const z of [b.min.z, b.max.z]) {
        const p = sub(v(x, y, z), target)
        const depth = dot(p, forward)
        distance = Math.max(distance, Math.abs(dot(p, right)) / tanH - depth, Math.abs(dot(p, up)) / tanV - depth)
      }
    }
  }
  return { target, position: v(target.x + d.x * distance, target.y + d.y * distance, target.z + d.z * distance) }
}
