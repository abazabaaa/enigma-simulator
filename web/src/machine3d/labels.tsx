/**
 * Labels on the parts and highlight halos (PLAN §2.6). Labels are drei <Billboard>s carrying a
 * procedurally drawn Canvas2D texture (no font download), always drawn on top:
 *  - 'names': the part's name, edged in its symbol colour;
 *  - 'symbols': S, H, N, M, L, G and U in the symbol colours (lib/symbols).
 * Only parts that are not dimmed get a label. Highlighted parts get a halo that pulses, or stays a
 * static outline under reduced motion.
 */

import { Billboard } from '@react-three/drei'
import { memo, useEffect, useMemo, type JSX } from 'react'
import { CanvasTexture, DoubleSide, MeshBasicMaterial, SRGBColorSpace, type Texture } from 'three'
import type { Focus, Highlight, PartId, StageDirective } from '../contracts/stage'
import type { RotorSlot } from '../engine'
import { SYM_FOR_PART } from '../lib/symbols'
import { TONE_COLORS, useFocus } from './focus'
import { FONT_STACK, canvas2d, whiteTexture } from './glyphs'
import {
  AXIS_Y,
  AXIS_Z,
  CASE,
  DECK,
  PAWL_ANGLE,
  ROTOR,
  etwX,
  reflectorX,
  slotX,
  stepAngle,
  type Vec3,
} from './layout'
import { partColor } from './palette'
import { PAWL_DX, PAWL_PIVOT } from './parts/Pawls'
import { EXPLODE_SCALE } from './parts/RotorStack'
import type { SceneView } from './view'

const SLOT_NAME: Readonly<Record<RotorSlot, string>> = { greek: 'Greek', left: 'Left', middle: 'Middle', right: 'Right' }

const slotOf = (p: PartId): RotorSlot => p.slice(p.indexOf('-') + 1) as RotorSlot
const isRotorPart = (p: PartId, prefix: string): boolean => p.startsWith(`${prefix}-`)

/** The label text of a part in 'names' mode. */
export function partName(p: PartId, view: SceneView): string {
  switch (p) {
    case 'keyboard':
      return 'Keyboard'
    case 'lampboard':
      return 'Lampboard'
    case 'plugboard':
      return 'Plugboard'
    case 'etw':
      return 'Entry wheel'
    case 'reflector':
      return view.reflector.name ? `Reflector ${view.reflector.name}` : 'Reflector'
    case 'battery':
      return 'Battery'
    case 'lid':
      return 'Lid'
  }
  const slot = slotOf(p)
  if (isRotorPart(p, 'rotor')) {
    const name = view.rotors.find((r) => r.slot === slot)?.name
    return `${SLOT_NAME[slot]} rotor${name ? ` ${name}` : ''}`
  }
  if (isRotorPart(p, 'ring')) return 'Alphabet ring'
  if (isRotorPart(p, 'core')) return 'Wiring core'
  if (isRotorPart(p, 'notch')) return 'Notch'
  return 'Pawl'
}

/** Where a part is: its label anchor and the halo's centre and radius. */
export function partAnchor(
  p: PartId,
  view: SceneView,
  explode = false,
): { label: Vec3; center: Vec3; radius: number } {
  const l = view.layout
  const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
  switch (p) {
    case 'keyboard':
      return { label: at(0, 1.3, 14.7), center: at(0, DECK.keyTopY, 9.6), radius: l.toy ? 13 : 15 }
    case 'lampboard':
      return { label: at(0, 1.1, 4.75), center: at(0, DECK.lampTopY, 0.3), radius: l.toy ? 13 : 14.5 }
    case 'plugboard':
      return { label: at(0, -11.1, DECK.panelZ + 0.4), center: at(0, -6.4, DECK.panelZ + 0.3), radius: 15 }
    case 'etw':
      return { label: at(etwX(l), AXIS_Y + 6.4, AXIS_Z), center: at(etwX(l), AXIS_Y, AXIS_Z), radius: 5.2 }
    case 'reflector':
      return { label: at(reflectorX(l), AXIS_Y + 6.4, AXIS_Z), center: at(reflectorX(l), AXIS_Y, AXIS_Z), radius: 5.4 }
    case 'battery':
      return { label: at(-13.7, 1.6, -12.5), center: at(-13.7, -2.8, -12.5), radius: 3.8 }
    case 'lid':
      return { label: at(0, CASE.lidTopY + 1.4, -12), center: at(0, CASE.lidTopY, -11), radius: 16 }
  }
  const slot = slotOf(p)
  const i = l.slots.indexOf(slot)
  const x = slotX(l, Math.max(0, i))
  const rotor = view.rotors[i]
  const onRing = (angle: number, r: number, dx: number): Vec3 =>
    at(x + dx, AXIS_Y + r * Math.cos(angle), AXIS_Z + r * Math.sin(angle))
  if (isRotorPart(p, 'ring')) {
    const r = ROTOR.bandR * (explode ? EXPLODE_SCALE : 1)
    return { label: onRing(-0.45, r + 1.7, ROTOR.letterX), center: at(x, AXIS_Y, AXIS_Z), radius: r + 0.8 }
  }
  if (isRotorPart(p, 'core')) {
    return { label: at(x + 0.2, AXIS_Y + 0.2, AXIS_Z + 2.2), center: at(x, AXIS_Y, AXIS_Z), radius: 4.4 }
  }
  if (isRotorPart(p, 'notch')) {
    const t = rotor?.turnovers[0] ?? 0
    const angle = PAWL_ANGLE + ((rotor?.ringTurn ?? 0) - t) * stepAngle(l)
    const c = onRing(angle, ROTOR.notchR + 0.3, (ROTOR.notchX0 + ROTOR.notchX1) / 2)
    return { label: onRing(angle, ROTOR.notchR + 1.8, ROTOR.notchX0), center: c, radius: 1.1 }
  }
  if (isRotorPart(p, 'pawl')) {
    const c = at(x + PAWL_DX, AXIS_Y + PAWL_PIVOT.y, AXIS_Z + PAWL_PIVOT.z)
    return { label: at(c.x, c.y + 1.3, c.z), center: c, radius: 1.3 }
  }
  // rotor labels climb from right to left so that neighbours do not overlap
  const rise = 1.6 * (l.slots.length - 1 - Math.max(0, i))
  return { label: at(x, AXIS_Y + 7.4 + rise, AXIS_Z), center: at(x, AXIS_Y, AXIS_Z), radius: 6.2 }
}

const TOP_LEVEL: readonly PartId[] = ['keyboard', 'lampboard', 'plugboard', 'etw', 'reflector', 'battery', 'lid']

/** The parts that carry a label for this focus (before removing dimmed or absent parts). */
export function labelledParts(focus: Focus, present: readonly PartId[]): PartId[] {
  const rotorsOnly = present.filter((p) => isRotorPart(p, 'rotor'))
  switch (focus) {
    case 'overview':
    case 'wire':
      return present.filter((p) => TOP_LEVEL.includes(p) || isRotorPart(p, 'rotor'))
    case 'rotor-stack':
      return rotorsOnly
    case 'pawls':
      return present.filter((p) => isRotorPart(p, 'pawl') || isRotorPart(p, 'notch'))
  }
  if (isRotorPart(focus, 'rotor')) {
    const slot = slotOf(focus)
    return present.filter((p) => p === focus || p === `ring-${slot}` || p === `core-${slot}`)
  }
  return present.filter((p) => p === focus)
}

function labelTexture(text: string, color: string, symbol: boolean): { texture: Texture; aspect: number } {
  const h = symbol ? 128 : 88
  const font = symbol ? `700 84px ${FONT_STACK}` : `600 50px ${FONT_STACK}`
  const probe = canvas2d(8, 8)
  if (!probe) return { texture: whiteTexture(), aspect: symbol ? 1 : 4 }
  probe.font = font
  const w = symbol ? h : Math.ceil(probe.measureText(text).width + 56)
  const ctx = canvas2d(w, h)!
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const r = symbol ? h / 2 - 4 : h / 2 - 4
  ctx.fillStyle = 'rgba(12, 10, 9, 0.82)'
  ctx.strokeStyle = color
  ctx.lineWidth = symbol ? 7 : 5
  ctx.beginPath()
  if (symbol) ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  else ctx.roundRect(3, 3, w - 6, h - 6, r)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = symbol ? color : '#f5f5f4'
  ctx.fillText(text, w / 2, h / 2 + (symbol ? 4 : 3))
  const texture = new CanvasTexture(ctx.canvas)
  texture.colorSpace = SRGBColorSpace
  return { texture, aspect: w / h }
}

function Label({ text, color, symbol, position }: { text: string; color: string; symbol: boolean; position: Vec3 }): JSX.Element {
  const { texture, aspect } = useMemo(() => labelTexture(text, color, symbol), [text, color, symbol])
  const material = useMemo(
    () => new MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    [texture],
  )
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )
  const h = symbol ? 1.9 : 1.25
  return (
    <Billboard position={[position.x, position.y, position.z]}>
      <mesh name={`label-${text}`} material={material} renderOrder={10} userData={{ label: text }}>
        <planeGeometry args={[h * aspect, h]} />
      </mesh>
    </Billboard>
  )
}

export const PartLabels = memo(function PartLabels({
  view,
  directive,
  present,
}: {
  view: SceneView
  directive: StageDirective
  present: readonly PartId[]
}): JSX.Element | null {
  const { dimmed } = useFocus()
  if (directive.labels === 'off') return null
  const symbols = directive.labels === 'symbols'
  const parts = labelledParts(directive.focus, present).filter((p) => !dimmed.has(p) && (!symbols || SYM_FOR_PART[p]))
  return (
    <group name="labels">
      {parts.map((p) => {
        const text = symbols ? SYM_FOR_PART[p]! : partName(p, view)
        return <Label key={p} text={text} color={partColor(p)} symbol={symbols} position={partAnchor(p, view, directive.ringLayer).label} />
      })}
    </group>
  )
})

function Halo({ part, tone, view, explode }: { part: PartId; tone: Highlight['tone']; view: SceneView; explode: boolean }): JSX.Element {
  const { registry } = useFocus()
  const { center, radius } = partAnchor(part, view, explode)
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({
      color: TONE_COLORS[tone],
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
    })
    m.userData = { halo: true, tone }
    return m
  }, [tone])
  useEffect(() => {
    registry.materials.set(material, part)
    return () => {
      registry.materials.delete(material)
      material.dispose()
    }
  }, [registry, material, part])
  const w = Math.max(0.18, radius * 0.05)
  return (
    <Billboard position={[center.x, center.y, center.z]}>
      <mesh name={`halo-${part}`} material={material} renderOrder={11} userData={{ halo: part, tone }}>
        <ringGeometry args={[radius, radius + w, 64]} />
      </mesh>
    </Billboard>
  )
}

export const Halos = memo(function Halos({ view, explode }: { view: SceneView; explode: boolean }): JSX.Element {
  const { highlight } = useFocus()
  return (
    <group name="halos">
      {[...highlight].map(([part, tone]) => (
        <Halo key={part} part={part} tone={tone} view={view} explode={explode} />
      ))}
    </group>
  )
})
