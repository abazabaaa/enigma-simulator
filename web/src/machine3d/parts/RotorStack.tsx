/**
 * The rotors (3, or 4 on the M4; 1–3 on a toy). Each rotor has two separately turning layers
 * (PLAN §2.6):
 *  - AlphabetRing (ring-X), angle = window: the letter band with n letters and the notch plate(s)
 *    (notch-X) at the turnover letters. Positions are letters: the numbers 01–26 appear only in the
 *    exploded view (StageDirective.ringLayer), as a dial on the ring's side face, and never at the
 *    window letter;
 *  - WiringCore (core-X), angle = offset = window − ring: the core with its n contacts on each face
 *    in the slot's symbol colour and a white index (spoke and pointer) at contact A, plus the
 *    thumbwheel and ratchet (rotor-X), which are fixed to the core.
 * A ring setting turns the core under the ring: the window letter stays, the core and its index turn.
 * In the exploded view the ring is lifted off the core and, for a ring in focus, an amber leader
 * runs from the core index to the dial number it faces — the ring setting — which is picked out.
 */

import { memo, useEffect, useMemo, type JSX } from 'react'
import {
  BufferGeometry,
  ExtrudeGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
} from 'three'
import type { Letter } from '../../engine'
import { useFocus, usePartMaterial } from '../focus'
import { box, discX, gearX, merge, shellX } from '../geometry'
import { GlyphMesh, type GlyphItem } from '../glyphs'
import { useGeometry } from '../hooks'
import {
  AXIS_Y,
  AXIS_Z,
  PAWL_ANGLE,
  ROTOR,
  WINDOW_ANGLE,
  contactAngle,
  coreAngle,
  ringAngle,
  slotX,
  stepAngle,
  type Layout,
} from '../layout'
import { PALETTE, slotColor } from '../palette'
import { dialUp } from '../shots'
import { StaticInstances } from '../StaticInstances'
import type { RotorView } from '../view'

/** How far the ring is lifted off the core in the exploded view. */
export const EXPLODE_SCALE = 1.3

/** The ring-setting annotation: the leader from the core index and the picked-out ring number. */
export const RING_SETTING_COLOR = '#fbbf24'

const ringNumber = (i: number): string => String(i + 1).padStart(2, '0')

/**
 * The exploded view's dial: a flange on the ring's right face carrying the numbers 01–26, wide
 * enough for digits that stay legible on a phone.
 */
export const DIAL = {
  r0: 4.55,
  r1: ROTOR.bandR * EXPLODE_SCALE,
  x: ROTOR.bandX1,
  depth: 0.08,
  /** Digit cells near the outer edge, as large as 26 of them around allow. */
  digit: 1.3,
  settingDigit: 1.4,
} as const
/** Radius of the dial's digits. */
export const DIAL_R = 5.72

const X_AXIS = new Vector3(1, 0, 0)

/** Orientation of a glyph quad lying on the band at angle a: facing out, its top towards a − Δ. */
function bandQuaternion(a: number): Quaternion {
  return new Quaternion().setFromAxisAngle(X_AXIS, a - Math.PI / 2)
}

/** The notch plate: a U-shaped bracket; the pawl tip drops between its posts at the turnover. */
function notchPlate(r: number, angle: number) {
  const r0 = r - 0.05
  const r1 = r + 0.55
  const s = new Shape()
  s.moveTo(-0.45, r0)
  s.lineTo(0.45, r0)
  s.lineTo(0.45, r1)
  s.lineTo(0.19, r1)
  s.lineTo(0.19, r0 + 0.2)
  s.lineTo(-0.19, r0 + 0.2)
  s.lineTo(-0.19, r1)
  s.lineTo(-0.45, r1)
  s.closePath()
  const depth = ROTOR.notchX1 - ROTOR.notchX0 + 0.1
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false })
  // shape x → z, shape y → y (radial), extrusion → −x; then turn +y to the notch angle.
  g.rotateY(-Math.PI / 2)
  g.translate(ROTOR.notchX1 + 0.05, 0, 0)
  g.rotateX(angle)
  return g
}

/** The fixed window frame around the letter at the window. */
function windowFrame(r: number) {
  const h = 0.62
  const w = 0.55
  const t = 0.07
  const g = merge([
    box(-w, w, h - t, h, -0.03, 0.03),
    box(-w, w, -h, -h + t, -0.03, 0.03),
    box(-w, -w + t, -h, h, -0.03, 0.03),
    box(w - t, w, -h, h, -0.03, 0.03),
  ])
  g.applyQuaternion(bandQuaternion(WINDOW_ANGLE))
  g.translate(ROTOR.letterX, r * Math.cos(WINDOW_ANGLE), r * Math.sin(WINDOW_ANGLE))
  return g
}

interface RotorProps {
  readonly layout: Layout
  readonly index: number
  readonly rotor: RotorView
  readonly letters: readonly Letter[]
  /** The numbers 01–26 are on the band (exploded view, machine only). */
  readonly numbers: boolean
  readonly explode: boolean
}

/**
 * Orientation of a dial number on the ring's right side face (facing +x) of a ring turned by `turn`:
 * upright for the 'rotor-layers' camera, whatever its place around the dial (dialUp()).
 */
function dialQuaternion(turn: number): Quaternion {
  const u = dialUp()
  // the dial's up, in the ring's own frame (which is turned by `turn` about x)
  const c = Math.cos(-turn)
  const s = Math.sin(-turn)
  const up = new Vector3(0, u.y * c - u.z * s, u.y * s + u.z * c)
  const side = new Vector3(0, up.z, -up.y)
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, up, X_AXIS))
}

/**
 * The glyphs on a ring: every letter on the band. With `numbers` (exploded view) the ring numbers
 * 01–26 form a dial on the ring's right side face, which the core's index points into; the number at
 * the window letter is left out (positions are letters). With `annotate` the ring-setting number is
 * picked out (and kept even if it is at the window).
 */
export function ringGlyphItems(
  layout: Layout,
  letters: readonly Letter[],
  rotor: Pick<RotorView, 'window' | 'ring' | 'ringTurn'>,
  o: { numbers: boolean; annotate: boolean; explode: boolean },
): GlyphItem[] {
  const upright = o.numbers ? dialQuaternion(ringAngle(layout, rotor.ringTurn)) : null
  const k = o.explode ? EXPLODE_SCALE : 1
  const r = ROTOR.bandR * k + 0.02
  const arc = (2 * Math.PI * ROTOR.bandR) / layout.n
  const size = Math.min(0.8, arc * 0.66)
  const out: GlyphItem[] = []
  letters.forEach((letter, i) => {
    const a = contactAngle(layout, i)
    out.push({
      glyph: letter,
      position: [ROTOR.letterX, r * Math.cos(a), r * Math.sin(a)],
      quaternion: bandQuaternion(a),
      size,
      color: PALETTE.glyphDark,
    })
    const setting = o.annotate && i === rotor.ring
    if (!o.numbers || (i === rotor.window && !setting)) return
    out.push({
      glyph: ringNumber(i),
      position: [DIAL.x + DIAL.depth + 0.02, DIAL_R * Math.cos(a), DIAL_R * Math.sin(a)],
      quaternion: upright!,
      size: setting ? DIAL.settingDigit : DIAL.digit,
      color: setting ? '#b45309' : PALETTE.ringNumber,
    })
  })
  return out
}

function AlphabetRing({
  layout,
  rotor,
  letters,
  numbers,
  explode,
  annotate,
}: Omit<RotorProps, 'index'> & { annotate: boolean }): JSX.Element {
  const { slot } = rotor
  const k = explode ? EXPLODE_SCALE : 1
  const turnoverKey = rotor.turnovers.join()
  const band = useGeometry(
    () =>
      merge([
        shellX(ROTOR.innerR * k, ROTOR.bandR * k, ROTOR.bandX0, ROTOR.bandX1),
        shellX(ROTOR.innerR * k, ROTOR.notchR * k, ROTOR.notchX0, ROTOR.notchX1),
        ...(numbers ? [shellX(DIAL.r0, DIAL.r1, DIAL.x, DIAL.x + DIAL.depth)] : []),
      ]),
    [k, numbers],
  )
  const notches = useGeometry(
    () =>
      rotor.turnovers.length
        ? merge(rotor.turnovers.map((t) => notchPlate(ROTOR.notchR * k, PAWL_ANGLE - t * stepAngle(layout))))
        : new BufferGeometry(),
    [k, turnoverKey, layout.n],
  )
  const bandMaterial = usePartMaterial(
    `ring-${slot}`,
    () => new MeshStandardMaterial({ color: PALETTE.ringBand, roughness: 0.55, metalness: 0.05 }),
  )
  const notchMaterial = usePartMaterial(
    `notch-${slot}`,
    () => new MeshStandardMaterial({ color: slotColor(slot), roughness: 0.4, metalness: 0.4 }),
    [slot],
  )
  const glyphs = useMemo(
    () => ringGlyphItems(layout, letters, rotor, { numbers, annotate, explode }),
    [layout, letters, rotor.window, rotor.ring, numbers && rotor.ringTurn, numbers, annotate, explode],
  )
  const digits = glyphs.filter((g) => /\d/.test(g.glyph)).map((g) => g.glyph)
  return (
    <>
      <mesh name={`ring-band-${slot}`} geometry={band} material={bandMaterial} userData={{ part: `ring-${slot}` }} />
      {rotor.turnovers.length ? (
        <mesh name={`notch-${slot}`} geometry={notches} material={notchMaterial} userData={{ part: `notch-${slot}` }} />
      ) : null}
      <GlyphMesh
        name={`ring-glyphs-${slot}`}
        items={glyphs}
        part={`ring-${slot}`}
        userData={{
          numbers: digits,
          windowNumber: digits.includes(ringNumber(rotor.window)) && !(annotate && rotor.window === rotor.ring),
          ringSetting: annotate ? ringNumber(rotor.ring) : null,
        }}
      />
    </>
  )
}

/** The core's index at contact A: a spoke on the right face and a pointer on the rim. */
function coreIndex(angle: number) {
  const spoke = box(ROTOR.coreX1, ROTOR.coreX1 + 0.08, 0.7, ROTOR.coreR - 0.1, -0.2, 0.2)
  const s = new Shape()
  s.moveTo(-0.42, ROTOR.coreR - 0.12)
  s.lineTo(0.42, ROTOR.coreR - 0.12)
  s.lineTo(0, ROTOR.coreR + 0.24)
  s.closePath()
  const pointer = new ExtrudeGeometry(s, { depth: ROTOR.coreX1 - ROTOR.coreX0 - 0.3, bevelEnabled: false })
  pointer.rotateY(-Math.PI / 2)
  pointer.translate(ROTOR.coreX1 + 0.02, 0, 0)
  const g = merge([spoke, pointer])
  g.rotateX(angle)
  return g
}

/** The exploded view's leader: from the core index out to the ring number it faces on the dial. */
function leader(angle: number) {
  const g = box(DIAL.x - 0.02, DIAL.x + DIAL.depth + 0.06, ROTOR.coreR + 0.2, DIAL.r0 + 0.1, -0.09, 0.09)
  g.rotateX(angle)
  return g
}

function WiringCore({ layout, rotor, annotate }: { layout: Layout; rotor: RotorView; annotate: boolean }): JSX.Element {
  const { slot } = rotor
  const a0 = contactAngle(layout, 0)
  const body = useGeometry(() => discX(ROTOR.coreR, ROTOR.coreX0, ROTOR.coreX1, 48), [])
  const index = useGeometry(() => coreIndex(a0), [a0])
  const line = useGeometry(() => leader(a0), [a0])
  const wheel = useGeometry(
    () =>
      merge([
        gearX(40, ROTOR.innerR, ROTOR.wheelR - 0.22, ROTOR.wheelR, ROTOR.wheelX0, ROTOR.wheelX1),
        gearX(layout.n, 3.2, ROTOR.ratchetR - 0.35, ROTOR.ratchetR, ROTOR.ratchetX0, ROTOR.ratchetX1),
      ]),
    [layout.n],
  )
  const pin = useGeometry(() => discX(0.19, -0.1, 0.1, 10), [])
  const coreMaterial = usePartMaterial(
    `core-${slot}`,
    () => new MeshStandardMaterial({ color: PALETTE.core, roughness: 0.65, metalness: 0.25 }),
  )
  const contactMaterial = usePartMaterial(
    `core-${slot}`,
    () => new MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }),
  )
  const indexMaterial = usePartMaterial(
    `core-${slot}`,
    () => new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.4 }),
  )
  const wheelMaterial = usePartMaterial(
    `rotor-${slot}`,
    () => new MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.4, metalness: 0.7 }),
  )
  // An annotation, not a part: it keeps full strength while the core is dimmed.
  const leaderMaterial = useMemo(
    () => new MeshBasicMaterial({ color: RING_SETTING_COLOR, toneMapped: false, depthTest: false }),
    [],
  )
  useEffect(() => () => leaderMaterial.dispose(), [leaderMaterial])
  const { matrices, colors } = useMemo(() => {
    const m: Matrix4[] = []
    const c: string[] = []
    const color = slotColor(slot)
    const q = new Quaternion()
    for (let i = 0; i < layout.n; i++) {
      const a = contactAngle(layout, i)
      const y = ROTOR.contactR * Math.cos(a)
      const z = ROTOR.contactR * Math.sin(a)
      // pins on the right ('in') face, plates on the left ('out') face
      m.push(new Matrix4().compose(new Vector3(ROTOR.inFaceX - 0.12, y, z), q, new Vector3(1.6, 1, 1)))
      m.push(new Matrix4().compose(new Vector3(ROTOR.outFaceX + 0.07, y, z), q, new Vector3(0.5, 1.3, 1.3)))
      c.push(color, color)
    }
    return { matrices: m, colors: c }
  }, [layout, slot])
  return (
    <>
      <mesh name={`core-body-${slot}`} geometry={body} material={coreMaterial} userData={{ part: `core-${slot}` }} />
      <mesh name={`core-index-${slot}`} geometry={index} material={indexMaterial} userData={{ part: `core-${slot}` }} />
      <StaticInstances
        name={`core-contacts-${slot}`}
        geometry={pin}
        material={contactMaterial}
        matrices={matrices}
        colors={colors}
        userData={{ part: `core-${slot}` }}
      />
      <mesh
        name={`rotor-wheel-${slot}`}
        geometry={wheel}
        material={wheelMaterial}
        userData={{ part: `rotor-${slot}` }}
      />
      {annotate ? (
        <mesh
          name={`ring-setting-leader-${slot}`}
          geometry={line}
          material={leaderMaterial}
          renderOrder={3}
          userData={{ annotation: 'ring-setting' }}
        />
      ) : null}
    </>
  )
}

function WindowFrame({ slot, explode }: { slot: RotorView['slot']; explode: boolean }): JSX.Element {
  const k = explode ? EXPLODE_SCALE : 1
  const frame = useGeometry(() => windowFrame(ROTOR.bandR * k + 0.14), [k])
  const material = usePartMaterial(
    `ring-${slot}`,
    () => new MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.35, metalness: 0.8 }),
  )
  return <mesh name={`window-${slot}`} geometry={frame} material={material} userData={{ part: `ring-${slot}` }} />
}

const Rotor = memo(function Rotor({ layout, index, rotor, letters, numbers, explode }: RotorProps): JSX.Element {
  const { slot } = rotor
  const { dimmed } = useFocus()
  const annotate = numbers && explode && !dimmed.has(`ring-${slot}`)
  return (
    <group
      name={`rotor-${slot}`}
      position={[slotX(layout, index), AXIS_Y, AXIS_Z]}
      userData={{ part: `rotor-${slot}`, slot, name: rotor.name }}
    >
      <group
        name={`ring-${slot}`}
        rotation-x={ringAngle(layout, rotor.ringTurn)}
        userData={{ part: `ring-${slot}`, window: rotor.window, turn: rotor.ringTurn }}
      >
        <AlphabetRing
          layout={layout}
          rotor={rotor}
          letters={letters}
          numbers={numbers}
          explode={explode}
          annotate={annotate}
        />
      </group>
      <group
        name={`core-${slot}`}
        rotation-x={coreAngle(layout, rotor.coreTurn)}
        userData={{ part: `core-${slot}`, offset: rotor.coreTurn }}
      >
        <WiringCore layout={layout} rotor={rotor} annotate={annotate} />
      </group>
      <WindowFrame slot={slot} explode={explode} />
    </group>
  )
})

export interface RotorStackProps {
  readonly layout: Layout
  readonly rotors: readonly RotorView[]
  readonly letters: readonly Letter[]
  /** Ring numbers 01–26 on the band (exploded view, machine only). */
  readonly numbers: boolean
  readonly explode: boolean
}

export const RotorStack = memo(function RotorStack({
  layout,
  rotors,
  letters,
  numbers,
  explode,
}: RotorStackProps): JSX.Element {
  return (
    <group name="rotor-stack">
      {rotors.map((rotor, i) => (
        <Rotor
          key={`${rotor.slot}-${layout.n}`}
          layout={layout}
          index={i}
          rotor={rotor}
          letters={letters}
          numbers={numbers}
          explode={explode}
        />
      ))}
    </group>
  )
})
