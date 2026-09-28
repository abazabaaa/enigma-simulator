/**
 * The rotors (3, or 4 on the M4; 1–3 on a toy). Each rotor has two separately turning layers
 * (PLAN §2.6):
 *  - AlphabetRing (ring-X), angle = window: the letter band with n glyphs, ring numbers 01–26
 *    beside them when labels are on, and the notch plate(s) (notch-X) at the turnover letters;
 *  - WiringCore (core-X), angle = offset = window − ring: the core with its n contacts on each face
 *    in the slot's symbol colour and a white mark at contact A, plus the thumbwheel and ratchet
 *    (rotor-X), which are fixed to the core.
 * A ring setting turns the core under the ring: the window letter stays, the core angle changes.
 * `explode` (StageDirective.ringLayer) lifts the ring off the core radially.
 */

import { memo, useMemo, type JSX } from 'react'
import { BufferGeometry, ExtrudeGeometry, Matrix4, MeshStandardMaterial, Quaternion, Shape, Vector3 } from 'three'
import type { Letter } from '../../engine'
import { usePartMaterial } from '../focus'
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
import { StaticInstances } from '../StaticInstances'
import type { RotorView } from '../view'

/** How far the ring is lifted off the core in the exploded view. */
export const EXPLODE_SCALE = 1.3

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
  readonly numbers: boolean
  readonly explode: boolean
}

function AlphabetRing({ layout, rotor, letters, numbers, explode }: Omit<RotorProps, 'index'>): JSX.Element {
  const { slot } = rotor
  const k = explode ? EXPLODE_SCALE : 1
  const turnoverKey = rotor.turnovers.join()
  const band = useGeometry(
    () =>
      merge([
        shellX(ROTOR.innerR * k, ROTOR.bandR * k, ROTOR.bandX0, ROTOR.bandX1),
        shellX(ROTOR.innerR * k, ROTOR.notchR * k, ROTOR.notchX0, ROTOR.notchX1),
      ]),
    [k],
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
  const glyphs = useMemo((): GlyphItem[] => {
    const r = ROTOR.bandR * k + 0.02
    const arc = (2 * Math.PI * ROTOR.bandR) / layout.n
    const size = Math.min(0.8, arc * 0.66)
    const out: GlyphItem[] = []
    letters.forEach((letter, i) => {
      const a = contactAngle(layout, i)
      const q = bandQuaternion(a)
      const y = r * Math.cos(a)
      const z = r * Math.sin(a)
      out.push({ glyph: letter, position: [ROTOR.letterX, y, z], quaternion: q, size, color: PALETTE.glyphDark })
      if (numbers) {
        const glyph = String(i + 1).padStart(2, '0')
        out.push({ glyph, position: [ROTOR.numberX, y, z], quaternion: q, size: size * 0.62, color: PALETTE.ringNumber })
      }
    })
    return out
  }, [layout, letters, numbers, k])
  return (
    <>
      <mesh name={`ring-band-${slot}`} geometry={band} material={bandMaterial} userData={{ part: `ring-${slot}` }} />
      {rotor.turnovers.length ? (
        <mesh name={`notch-${slot}`} geometry={notches} material={notchMaterial} userData={{ part: `notch-${slot}` }} />
      ) : null}
      <GlyphMesh name={`ring-glyphs-${slot}`} items={glyphs} part={`ring-${slot}`} />
    </>
  )
}

function WiringCore({ layout, rotor }: { layout: Layout; rotor: RotorView }): JSX.Element {
  const { slot } = rotor
  const body = useGeometry(() => discX(ROTOR.coreR, ROTOR.coreX0, ROTOR.coreX1, 48), [])
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
  const wheelMaterial = usePartMaterial(
    `rotor-${slot}`,
    () => new MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.4, metalness: 0.7 }),
  )
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
    // the core's zero mark: contact A's position on the rim, read against the ring (ring setting)
    const a0 = contactAngle(layout, 0)
    const rMark = ROTOR.coreR + 0.05
    m.push(
      new Matrix4().compose(
        new Vector3(ROTOR.coreX1 - 0.3, rMark * Math.cos(a0), rMark * Math.sin(a0)),
        q,
        new Vector3(2.4, 1.6, 1.6),
      ),
    )
    c.push('#ffffff')
    return { matrices: m, colors: c }
  }, [layout, slot])
  return (
    <>
      <mesh name={`core-body-${slot}`} geometry={body} material={coreMaterial} userData={{ part: `core-${slot}` }} />
      <StaticInstances
        name={`core-contacts-${slot}`}
        geometry={pin}
        material={contactMaterial}
        matrices={matrices}
        colors={colors}
        userData={{ part: `core-${slot}` }}
      />
      <mesh name={`rotor-wheel-${slot}`} geometry={wheel} material={wheelMaterial} userData={{ part: `rotor-${slot}` }} />
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
        <AlphabetRing layout={layout} rotor={rotor} letters={letters} numbers={numbers} explode={explode} />
      </group>
      <group
        name={`core-${slot}`}
        rotation-x={coreAngle(layout, rotor.coreTurn)}
        userData={{ part: `core-${slot}`, offset: rotor.coreTurn }}
      >
        <WiringCore layout={layout} rotor={rotor} />
      </group>
      <WindowFrame slot={slot} explode={explode} />
    </group>
  )
})

export interface RotorStackProps {
  readonly layout: Layout
  readonly rotors: readonly RotorView[]
  readonly letters: readonly Letter[]
  /** Ring numbers 01–26 on the band (labels on, machine only). */
  readonly numbers: boolean
  readonly explode: boolean
}

export const RotorStack = memo(function RotorStack({ layout, rotors, letters, numbers, explode }: RotorStackProps): JSX.Element {
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
