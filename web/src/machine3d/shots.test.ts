import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { CameraShot, Focus } from '../contracts/stage'
import {
  AXIS_Y,
  AXIS_Z,
  ROTOR,
  WINDOW_ANGLE,
  keyPosition,
  lampPosition,
  makeLayout,
  reflectorX,
  slotX,
  socketPosition,
  type Layout,
  type Vec3,
} from './layout'
import { pawlTip } from './parts/Pawls'
import { CAMERA_FOV, dialUp, frameShot } from './shots'

const LAYOUTS: readonly [string, Layout][] = [
  ['I', makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })],
  ['M4', makeLayout({ n: 26, slots: ['greek', 'left', 'middle', 'right'], toy: false })],
  ['toy 8', makeLayout({ n: 8, slots: ['left', 'middle', 'right'], toy: true })],
]
/** A phone in portrait (390 px wide), a square, the desktop canvas and a very wide one. */
const ASPECTS = [358 / 560, 1, 992 / 560, 2.4]

const range = (n: number) => Array.from({ length: n }, (_, k) => k)
const windows = (l: Layout): Vec3[] =>
  l.slots.map((_, i) => ({
    x: slotX(l, i) + ROTOR.letterX,
    y: AXIS_Y + ROTOR.bandR * Math.cos(WINDOW_ANGLE),
    z: AXIS_Z + ROTOR.bandR * Math.sin(WINDOW_ANGLE),
  }))

/** What each shot must keep in view. */
function framed(shot: CameraShot, focus: Focus, l: Layout): Vec3[] {
  const letters = range(l.n)
  const deck = [...letters.map((k) => keyPosition(l, k)), ...letters.map((k) => lampPosition(l, k))]
  switch (shot) {
    case 'overview':
    case 'toy':
      return [...deck, ...letters.map((k) => socketPosition(l, k)), ...windows(l)]
    case 'front':
      return [...deck, ...letters.map((k) => socketPosition(l, k)), ...windows(l)]
    case 'plugboard':
      return letters.map((k) => socketPosition(l, k))
    case 'lampboard':
      return letters.map((k) => lampPosition(l, k))
    case 'rotors':
      return focus === 'pawls'
        ? [...windows(l), ...l.slots.map((_, i) => pawlTip(l, i, true)), ...l.slots.map((_, i) => pawlTip(l, i, false))]
        : windows(l)
    case 'rotor-layers':
      return [windows(l)[l.slots.length - 1]!]
    case 'reflector':
      return [{ x: reflectorX(l), y: AXIS_Y, z: AXIS_Z }]
  }
}

const SHOTS: readonly [CameraShot, Focus][] = [
  ['overview', 'overview'],
  ['front', 'overview'],
  ['toy', 'wire'],
  ['plugboard', 'plugboard'],
  ['lampboard', 'lampboard'],
  ['rotors', 'rotor-stack'],
  ['rotors', 'pawls'],
  ['rotor-layers', 'ring-right'],
  ['reflector', 'reflector'],
]

describe('frameShot', () => {
  it.each(SHOTS)('%s (%s): what the shot frames is inside the view at every aspect ratio', (shot, focus) => {
    for (const [name, l] of LAYOUTS) {
      for (const aspect of ASPECTS) {
        for (const labels of [false, true]) {
          const s = frameShot(shot, l, { aspect, focus, labels, ringLayer: shot === 'rotor-layers' })
          const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 1, 600)
          camera.position.set(s.position.x, s.position.y, s.position.z)
          camera.lookAt(s.target.x, s.target.y, s.target.z)
          camera.updateMatrixWorld()
          for (const p of framed(shot, focus, l)) {
            const ndc = new Vector3(p.x, p.y, p.z).project(camera)
            const where = `${name} at aspect ${aspect.toFixed(2)}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`
            expect(Math.abs(ndc.x), where).toBeLessThanOrEqual(0.95)
            expect(Math.abs(ndc.y), where).toBeLessThanOrEqual(0.95)
            expect(ndc.z, where).toBeLessThan(1)
          }
        }
      }
    }
  })

  it('moves back on a narrow canvas and keeps the viewing direction', () => {
    const l = LAYOUTS[0]![1]
    const wide = frameShot('overview', l, { aspect: 992 / 560 })
    const narrow = frameShot('overview', l, { aspect: 358 / 560 })
    const dist = (s: typeof wide) =>
      Math.hypot(s.position.x - s.target.x, s.position.y - s.target.y, s.position.z - s.target.z)
    expect(dist(narrow)).toBeGreaterThan(dist(wide) * 1.5)
    expect(narrow.target).toEqual(wide.target)
    const dir = (s: typeof wide) => {
      const d = dist(s)
      return [(s.position.x - s.target.x) / d, (s.position.y - s.target.y) / d, (s.position.z - s.target.z) / d]
    }
    dir(narrow).forEach((c, k) => expect(c).toBeCloseTo(dir(wide)[k]!, 12))
  })

  it('rotor-layers: the window letter is not seen edge-on and the dial numbers stand upright', () => {
    const l = LAYOUTS[0]![1]
    for (const aspect of ASPECTS) {
      const s = frameShot('rotor-layers', l, { aspect, focus: 'ring-right', labels: true, ringLayer: true })
      const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 1, 600)
      camera.position.set(s.position.x, s.position.y, s.position.z)
      camera.lookAt(s.target.x, s.target.y, s.target.z)
      camera.updateMatrixWorld()
      const px = (a: Vector3, b: Vector3) => {
        const p = a.clone().project(camera)
        const q = b.clone().project(camera)
        return Math.hypot((p.x - q.x) * aspect, p.y - q.y)
      }
      const r = ROTOR.bandR * 1.3
      const c = new Vector3(
        slotX(l, 2) + ROTOR.letterX,
        AXIS_Y + r * Math.cos(WINDOW_ANGLE),
        AXIS_Z + r * Math.sin(WINDOW_ANGLE),
      )
      const across = new Vector3(0.5, 0, 0)
      const up = new Vector3(0, Math.sin(WINDOW_ANGLE), -Math.cos(WINDOW_ANGLE)).multiplyScalar(0.5)
      const ratio = px(c.clone().sub(across), c.clone().add(across)) / px(c.clone().sub(up), c.clone().add(up))
      expect(ratio, `window letter width/height at aspect ${aspect.toFixed(2)}`).toBeGreaterThan(0.65)
      // the dial's up is (nearly) the camera's up: numbers keep their height
      const u = dialUp()
      const dial = new Vector3(slotX(l, 2) + ROTOR.bandX1, AXIS_Y, AXIS_Z + 5.7)
      const along = new Vector3(0, u.y, u.z).multiplyScalar(0.5)
      const d0 = px(dial.clone().sub(along), dial.clone().add(along))
      const camUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(0.5)
      expect(d0 / px(dial.clone().sub(camUp), dial.clone().add(camUp)), 'dial numbers unforeshortened').toBeGreaterThan(
        0.9,
      )
    }
  })

  it('frames the pawls from above the stack: the pawl–notch contact faces the camera', () => {
    const l = LAYOUTS[0]![1]
    const s = frameShot('rotors', l, { aspect: 1.7, focus: 'pawls', labels: true })
    for (let i = 0; i < 3; i++) {
      const tip = pawlTip(l, i, false)
      // the outward normal at the contact points towards the camera
      const n = { y: tip.y - AXIS_Y, z: tip.z - AXIS_Z }
      const toCamera = { y: s.position.y - tip.y, z: s.position.z - tip.z }
      expect(n.y * toCamera.y + n.z * toCamera.z).toBeGreaterThan(0)
    }
  })
})
