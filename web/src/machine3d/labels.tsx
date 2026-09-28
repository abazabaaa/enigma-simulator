/**
 * Labels on the parts and highlight halos (PLAN §2.6). Labels are drei <Billboard>s carrying a
 * procedurally drawn Canvas2D texture (no font download), always drawn on top:
 *  - 'names': the part's name, edged in its symbol colour;
 *  - 'symbols': S, H, N, M, L, G and U in the symbol colours (lib/symbols).
 * Only parts that are not dimmed get a label; in the exploded view a ring in focus also gets its
 * ring setting ("ring 05"). Every frame the labels are laid out on screen: each starts at its part's
 * anchor and moves to the nearest free place, clear of the labels placed before it, of the keep-out
 * points (the pawl–notch contacts while pawls or notches are labelled) and of the canvas edges.
 * Highlighted parts get a halo that pulses, or stays a static outline under reduced motion.
 */

import { Billboard } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  MeshBasicMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  type Camera,
  type Group,
  type Texture,
} from 'three'
import type { Focus, Highlight, PartId, StageDirective } from '../contracts/stage'
import type { RotorSlot } from '../engine'
import { SYM_FOR_PART } from '../lib/symbols'
import { HALO_OPACITY, TONE_COLORS, useFocus } from './focus'
import { FONT_STACK, canvas2d, whiteTexture } from './glyphs'
import {
  AXIS_Y,
  AXIS_Z,
  CASE,
  DECK,
  PAWL_ANGLE,
  ROTOR,
  WINDOW_ANGLE,
  etwX,
  reflectorX,
  slotX,
  stepAngle,
  type Vec3,
} from './layout'
import { partColor } from './palette'
import { PAWL_DX, PAWL_PIVOT, pawlTip } from './parts/Pawls'
import { EXPLODE_SCALE, RING_SETTING_COLOR } from './parts/RotorStack'
import type { SceneView } from './view'

const SLOT_NAME: Readonly<Record<RotorSlot, string>> = {
  greek: 'Greek',
  left: 'Left',
  middle: 'Middle',
  right: 'Right',
}

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

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

/** A point on rotor i's circle at `angle`, radius r, dx along the axis from the rotor's centre. */
function onRotor(view: SceneView, i: number, angle: number, r: number, dx: number): Vec3 {
  return at(slotX(view.layout, i) + dx, AXIS_Y + r * Math.cos(angle), AXIS_Z + r * Math.sin(angle))
}

/** World angle of rotor i's notch (its first turnover), following the ring. */
function notchAngle(view: SceneView, i: number): number {
  const rotor = view.rotors[i]
  return PAWL_ANGLE + ((rotor?.ringTurn ?? 0) - (rotor?.turnovers[0] ?? 0)) * stepAngle(view.layout)
}

/** Where a part is: its label anchor and the halo's centre and radius. */
export function partAnchor(p: PartId, view: SceneView, explode = false): { label: Vec3; center: Vec3; radius: number } {
  const l = view.layout
  switch (p) {
    case 'keyboard':
      // left of the middle row, clear of the keys
      return { label: at(-15.3, 1.3, 9.6), center: at(0, DECK.keyTopY, 9.6), radius: l.toy ? 13 : 15 }
    case 'lampboard':
      // right of the middle row, clear of the lamps
      return { label: at(15.3, 0.9, 0.3), center: at(0, DECK.lampTopY, 0.3), radius: l.toy ? 13 : 14.5 }
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
  const i = Math.max(0, l.slots.indexOf(slotOf(p)))
  const x = slotX(l, i)
  const center = at(x, AXIS_Y, AXIS_Z)
  if (isRotorPart(p, 'ring')) {
    const r = ROTOR.bandR * (explode ? EXPLODE_SCALE : 1)
    return { label: onRotor(view, i, -0.45, r + 1.7, ROTOR.letterX), center, radius: r + 0.8 }
  }
  if (isRotorPart(p, 'core')) {
    return { label: at(x + 0.2, AXIS_Y + 0.2, AXIS_Z + 2.2), center, radius: 4.4 }
  }
  if (isRotorPart(p, 'notch')) {
    const a = notchAngle(view, i)
    const c = onRotor(view, i, a, ROTOR.notchR + 0.3, (ROTOR.notchX0 + ROTOR.notchX1) / 2)
    // away from the pawl line: further out, towards the front, and to the rotor's left
    return { label: onRotor(view, i, a + 0.3, ROTOR.notchR + 2.3, ROTOR.notchX0 - 0.9), center: c, radius: 1.1 }
  }
  if (isRotorPart(p, 'pawl')) {
    const c = at(x + PAWL_DX, AXIS_Y + PAWL_PIVOT.y, AXIS_Z + PAWL_PIVOT.z)
    // above the shaft
    return { label: at(c.x, c.y + 1.6, c.z - 0.4), center: c, radius: 1.3 }
  }
  // rotor labels climb from right to left so that neighbours do not overlap
  const rise = 1.6 * (l.slots.length - 1 - i)
  return { label: at(x, AXIS_Y + 7.4 + rise, AXIS_Z), center, radius: 6.2 }
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

/** Placement order: pawls stay above their shaft; notches, which move, give way. */
function rank(key: string): number {
  if (key.startsWith('pawl-')) return 0
  if (key.startsWith('rotor-') || key.startsWith('setting-')) return 1
  if (key === 'etw' || key === 'reflector') return 3
  if (key.startsWith('notch-')) return 4
  return 2
}

export interface LabelEntry {
  readonly key: string
  readonly text: string
  readonly color: string
  readonly symbol: boolean
  readonly anchor: Vec3
}

/**
 * The labels to draw, in placement order, and the keep-out points they must not cover: the pawl–notch
 * contacts while pawls or notches are labelled, and the picked-out ring-setting number.
 */
export function labelPlan(
  view: SceneView,
  directive: StageDirective,
  present: readonly PartId[],
  dimmed: ReadonlySet<PartId>,
): { entries: LabelEntry[]; keepOut: Vec3[] } {
  if (directive.labels === 'off') return { entries: [], keepOut: [] }
  const symbols = directive.labels === 'symbols'
  const parts = labelledParts(directive.focus, present).filter((p) => !dimmed.has(p) && (!symbols || SYM_FOR_PART[p]))
  const entries: LabelEntry[] = parts.map((p) => ({
    key: p,
    text: symbols ? SYM_FOR_PART[p]! : partName(p, view),
    color: partColor(p),
    symbol: symbols,
    anchor: partAnchor(p, view, directive.ringLayer).label,
  }))
  const keepOut: Vec3[] = []
  // The exploded view names the ring setting: the number that faces the core's index (kept clear).
  if (directive.ringLayer && view.source === 'machine') {
    view.rotors.forEach((r, i) => {
      if (dimmed.has(`ring-${r.slot}`) || !present.includes(`ring-${r.slot}`)) return
      const angle = WINDOW_ANGLE + r.coreTurn * stepAngle(view.layout)
      entries.push({
        key: `setting-${r.slot}`,
        text: `ring ${String(r.ring + 1).padStart(2, '0')}`,
        color: RING_SETTING_COLOR,
        symbol: false,
        anchor: onRotor(view, i, angle, ROTOR.bandR * EXPLODE_SCALE + 1.3, ROTOR.bandX1 + 0.6),
      })
      keepOut.push(onRotor(view, i, angle, ((ROTOR.innerR + ROTOR.bandR) * EXPLODE_SCALE) / 2, ROTOR.bandX1))
    })
  }
  if (entries.some((e) => e.key.startsWith('pawl-') || e.key.startsWith('notch-'))) {
    view.rotors.forEach((r, i) => {
      if (r.pawl) keepOut.push(pawlTip(view.layout, i, r.engaged))
      if (r.turnovers.length) {
        const a = notchAngle(view, i)
        keepOut.push(onRotor(view, i, a, ROTOR.notchR + 0.3, (ROTOR.notchX0 + ROTOR.notchX1) / 2))
      }
    })
  }
  entries.sort((a, b) => rank(a.key) - rank(b.key))
  return { entries, keepOut }
}

// ---------------------------------------------------------------------------
// Screen layout
// ---------------------------------------------------------------------------

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const GAP = 4
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

/** Candidate moves, in units of the label's height (dy) and half width (dx), nearest first. */
const MOVES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -2],
  [0, 2],
  [-2, 0],
  [2, 0],
  [-2, -1],
  [2, -1],
  [-2, 1],
  [2, 1],
  [0, -3],
  [0, 3],
  [-3, 0],
  [3, 0],
  [-3, -2],
  [3, -2],
  [-3, 2],
  [3, 2],
  [0, -4],
  [0, 4],
]

/**
 * Places labels (centre x, y and size in pixels, in placement order) inside a viewport so that they
 * overlap neither each other nor the obstacles; returns each label's rectangle. PURE.
 */
export function placeLabels(
  labels: readonly { x: number; y: number; w: number; h: number }[],
  obstacles: readonly Rect[],
  viewport: { w: number; h: number },
): Rect[] {
  const placed: Rect[] = []
  const clamp = (r: Rect): Rect => ({
    ...r,
    x: Math.min(Math.max(r.x, GAP), Math.max(GAP, viewport.w - r.w - GAP)),
    y: Math.min(Math.max(r.y, GAP), Math.max(GAP, viewport.h - r.h - GAP)),
  })
  for (const l of labels) {
    let best: Rect | null = null
    let bestHits = Infinity
    for (const [mx, my] of MOVES) {
      const r = clamp({
        x: l.x - l.w / 2 + (mx * (l.w + GAP)) / 2,
        y: l.y - l.h / 2 + my * (l.h + GAP),
        w: l.w,
        h: l.h,
      })
      const hits = [...placed, ...obstacles].filter((o) => overlaps(r, o)).length
      if (hits < bestHits) {
        best = r
        bestHits = hits
      }
      if (hits === 0) break
    }
    placed.push(best!)
  }
  return placed
}

/** The latest layout, in canvas pixels: for the e2e debug hook. */
export const labelLayout: { labels: (Rect & { key: string; text: string })[]; keepOut: Rect[] } = {
  labels: [],
  keepOut: [],
}

const KEEP_OUT_PX = 18
const _p = new Vector3()
const _right = new Vector3()
const _up = new Vector3()

/** Pixels per world unit at a point, and its canvas position; null behind the camera. */
function project(camera: Camera, p: Vec3, size: { width: number; height: number }) {
  _p.set(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse)
  const depth = -_p.z
  if (depth <= 0.01) return null
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 35
  const ppu = size.height / (2 * depth * Math.tan((fov * Math.PI) / 360))
  _p.set(p.x, p.y, p.z).project(camera)
  return { x: ((_p.x + 1) / 2) * size.width, y: ((1 - _p.y) / 2) * size.height, ppu }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** World height of a label. */
const labelHeight = (symbol: boolean): number => (symbol ? 1.9 : 1.25)

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
  const r = h / 2 - 4
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

interface Placed {
  readonly group: Group
  readonly entry: LabelEntry
  readonly aspect: number
}

function Label({
  entry,
  register,
}: {
  entry: LabelEntry
  register: (key: string, value: Placed | null) => void
}): JSX.Element {
  const { text, color, symbol, key } = entry
  const { texture, aspect } = useMemo(() => labelTexture(text, color, symbol), [text, color, symbol])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [texture],
  )
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )
  const group = useRef<Group>(null)
  const latest = useRef(entry)
  latest.current = entry
  useLayoutEffect(() => {
    if (!group.current) return
    register(key, {
      group: group.current,
      aspect,
      get entry() {
        return latest.current
      },
    })
    return () => register(key, null)
  }, [key, aspect, register])
  const h = labelHeight(symbol)
  return (
    <Billboard ref={group}>
      <mesh name={`label-${text}`} material={material} renderOrder={10} userData={{ label: text, key }}>
        <planeGeometry args={[h * aspect, h]} />
      </mesh>
    </Billboard>
  )
}

/** Draws the labels and lays them out on screen every frame (before it is rendered). */
function LabelLayer({ entries, keepOut }: { entries: readonly LabelEntry[]; keepOut: readonly Vec3[] }): JSX.Element {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const placed = useRef(new Map<string, Placed>())
  const order = useRef<readonly LabelEntry[]>(entries)
  order.current = entries
  const obstacles = useRef<readonly Vec3[]>(keepOut)
  obstacles.current = keepOut
  const register = useMemo(
    () => (key: string, value: Placed | null) => {
      if (value) placed.current.set(key, value)
      else placed.current.delete(key)
    },
    [],
  )
  useEffect(
    () => () => {
      labelLayout.labels = []
      labelLayout.keepOut = []
    },
    [],
  )
  useFrame(() => {
    camera.updateMatrixWorld()
    const items: { key: string; text: string; x: number; y: number; w: number; h: number; ppu: number; p: Placed }[] =
      []
    for (const entry of order.current) {
      const p = placed.current.get(entry.key)
      if (!p) continue
      const s = project(camera, p.entry.anchor, size)
      if (!s) {
        p.group.visible = false
        continue
      }
      p.group.visible = true
      const h = labelHeight(p.entry.symbol) * s.ppu
      items.push({ key: entry.key, text: p.entry.text, x: s.x, y: s.y, w: h * p.aspect, h, ppu: s.ppu, p })
    }
    const keep: Rect[] = []
    for (const k of obstacles.current) {
      const s = project(camera, k, size)
      if (s) keep.push({ x: s.x - KEEP_OUT_PX / 2, y: s.y - KEEP_OUT_PX / 2, w: KEEP_OUT_PX, h: KEEP_OUT_PX })
    }
    const rects = placeLabels(items, keep, { w: size.width, h: size.height })
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    items.forEach((it, i) => {
      const r = rects[i]!
      const dx = (r.x + r.w / 2 - it.x) / it.ppu
      const dy = (r.y + r.h / 2 - it.y) / it.ppu
      const a = it.p.entry.anchor
      it.p.group.position.set(a.x, a.y, a.z).addScaledVector(_right, dx).addScaledVector(_up, -dy)
    })
    labelLayout.labels = items.map((it, i) => ({ ...rects[i]!, key: it.key, text: it.text }))
    labelLayout.keepOut = keep
  })
  return (
    <group name="labels">
      {entries.map((e) => (
        <Label key={e.key} entry={e} register={register} />
      ))}
    </group>
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
  const { entries, keepOut } = labelPlan(view, directive, present, dimmed)
  if (!entries.length) return null
  return <LabelLayer entries={entries} keepOut={keepOut} />
})

function Halo({
  part,
  tone,
  view,
  explode,
}: {
  part: PartId
  tone: Highlight['tone']
  view: SceneView
  explode: boolean
}): JSX.Element {
  const { registry } = useFocus()
  const { center, radius } = partAnchor(part, view, explode)
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({
      color: TONE_COLORS[tone],
      transparent: true,
      opacity: HALO_OPACITY,
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
