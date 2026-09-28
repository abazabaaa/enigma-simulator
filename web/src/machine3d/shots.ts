/**
 * Named camera shots (PLAN §3.3 CameraShot). PURE, so e2e specs can import it in Node and compare
 * the live camera against the shot.
 */

import type { CameraShot } from '../contracts/stage'
import { AXIS_Y, AXIS_Z, DECK, reflectorX, slotX, type Layout, type Vec3 } from './layout'

export interface Shot {
  readonly position: Vec3
  readonly target: Vec3
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export function shotFor(shot: CameraShot, l: Layout): Shot {
  const right = slotX(l, l.slots.length - 1)
  switch (shot) {
    case 'overview':
      return { position: v(0, 52, 54), target: v(0, -2.5, -0.5) }
    case 'front':
      return { position: v(0, 38, 60), target: v(0, -2.5, 2.5) }
    case 'rotors':
      return { position: v(18, 34, 17), target: v(0, 2, AXIS_Z) }
    case 'rotor-layers':
      return { position: v(right + 21, 14, 9), target: v(right - 1, AXIS_Y, AXIS_Z) }
    case 'reflector':
      return { position: v(-34, 20, 8), target: v(reflectorX(l) + 2, AXIS_Y, AXIS_Z) }
    case 'plugboard':
      return { position: v(0, 4, 58), target: v(0, -6.4, DECK.panelZ) }
    case 'lampboard':
      return { position: v(0, 42, 30), target: v(0, 0, 0.3) }
    case 'toy':
      return { position: v(0, 44, 46), target: v(0, -2, -2) }
  }
}
