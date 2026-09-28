/**
 * Where the signal runs through the 3D machine (PLAN §2.6, brief 11). PURE: no three.js, no React,
 * so unit tests and Playwright (in Node) import it. 1 unit = 1 cm, axes as in layout.ts.
 *
 * signalRoute(hops, layout) returns the control points of the glowing tube: every point of
 * pathPoints(hops, layout) — the ANCHORS, exactly 2 + 2·hops of them — plus routing waypoints
 * between them, so that the tube follows the machine's wiring instead of cutting through it:
 *  - key lead: down through the key, forward under the deck, down behind the front panel and out
 *    through it into the socket's upper ('in') hole; the lamp lead mirrors it up into the lamp;
 *  - plug cable: a plugged letter's hop runs from one socket, along the cable that hangs in front
 *    of the panel (cablePath), into the partner socket; an unplugged letter crosses its own socket;
 *  - harness: from a socket's lower ('out') hole back under the deck to the right of the entry
 *    wheel (the right rotor on a toy, which has none) and into its contact from the right;
 *  - entry wheel and rotors: straight wires, face to face, at the contacts' fixed positions;
 *  - reflector: through the disc to its outer face, along that pair's arc (reflectorArc), and
 *    back to the contact face.
 * The same cablePath, reflectorArc and harnessPath shape the cables, the reflector's 13 arcs and
 * the toys' wiring, so the glowing tube runs exactly along the part it lights.
 */

import type { PathHop } from '../../contracts/stage'
import {
  AXIS_Y,
  AXIS_Z,
  CASE,
  DECK,
  contactPoint,
  pathPoints,
  reflectorWidth,
  reflectorX,
  socketPosition,
  type Layout,
  type Vec3,
} from '../layout'

export interface Route {
  /** The tube's control points, in order (anchors and waypoints). */
  readonly points: readonly Vec3[]
  /** anchors[i]: the index in `points` of pathPoints(hops, layout)[i]. Exactly 2 + 2·hops entries. */
  readonly anchors: readonly number[]
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const lerp = (a: number, b: number, f: number): number => a + (b - a) * f
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Heights under the deck (whose underside is at y = −0.4) for leads and for the harness. */
const LEAD_Y = -1.1
const HARNESS_Y = -2.3
/** Just behind the front panel (the panel is z ∈ [15.2, 15.6]). */
const BEHIND_PANEL_Z = DECK.panelZ - 0.75
/** The front of a plug (its pins go into the socket holes at the panel). */
export const PLUG_FRONT_Z = DECK.panelZ + 0.75

// ---------------------------------------------------------------------------
// Shared shapes: leads, harness, cables, reflector arcs
// ---------------------------------------------------------------------------

/** Waypoints from the top of a key (or lamp) to a socket hole, excluding both ends. */
function leadPath(top: Vec3, hole: Vec3): Vec3[] {
  return [v(top.x, LEAD_Y, top.z), v(top.x, LEAD_Y, BEHIND_PANEL_Z - 0.6), v(hole.x, hole.y, BEHIND_PANEL_Z)]
}

/** x of the harness where it rises to the rotor axis: right of the first ring contact. */
function harnessX(face: Vec3): number {
  return Math.min(CASE.x1 - 1, face.x + 2.2)
}

/**
 * Waypoints from a socket's lower ('out') hole to a contact on the entry face of the ring parts
 * (the entry wheel, or a toy's right rotor), excluding both ends: back through the panel, under
 * the deck to the back right, up beside the entry face and in from the right.
 */
export function harnessPath(hole: Vec3, face: Vec3): Vec3[] {
  const x = harnessX(face)
  // The wires gather behind the deck (in the rotor well) as a loom that already fans out the way
  // the contacts sit around the axis, then rise to them.
  const dy = (face.y - AXIS_Y) * 0.3
  const dz = (face.z - AXIS_Z) * 0.3
  const back = v(x, HARNESS_Y + dy, CASE.deckZ0 - 0.9 + dz)
  return [
    v(hole.x, hole.y, BEHIND_PANEL_Z),
    v(hole.x, HARNESS_Y, BEHIND_PANEL_Z - 1.2),
    v(lerp(hole.x, x, 0.8), HARNESS_Y + dy * 0.5, lerp(BEHIND_PANEL_Z - 1.2, back.z, 0.85)),
    back,
    v(x, lerp(back.y, face.y, 0.6), lerp(back.z, face.z, 0.6)),
    v(x, face.y, face.z),
    v(face.x + 0.8, face.y, face.z),
  ]
}

/**
 * The centre line of the cable between the plugs in sockets a and b, from the front of plug a to
 * the front of plug b: it sags below the sockets and bows out in front of the panel.
 */
export function cablePath(l: Layout, a: number, b: number): Vec3[] {
  const A = socketPosition(l, a)
  const B = socketPosition(l, b)
  const span = Math.hypot(A.x - B.x, A.y - B.y)
  const sag = 1.4 + 0.18 * span
  const out: Vec3[] = []
  const N = 12
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const bow = Math.sin(Math.PI * f)
    out.push(v(lerp(A.x, B.x, f), lerp(A.y, B.y, f) - sag * bow, PLUG_FRONT_Z + 0.05 + 1.5 * bow))
  }
  return out
}

/** x of the reflector's outer face (away from the rotors), where its wire pairs are drawn. */
export function reflectorOuterX(l: Layout): number {
  return reflectorX(l) - reflectorWidth(l) / 2 - 0.12
}

/**
 * The reflector's wire between contacts a and b, on its outer face: an arc from a to b pulled
 * towards the axis (a chord diagram of the 13 pairs) and bulging out of the face, the more the
 * longer the chord, so crossing arcs do not touch. Includes both ends.
 */
export function reflectorArc(l: Layout, a: number, b: number, segments = 14): Vec3[] {
  const x0 = reflectorOuterX(l)
  const A = contactPoint(l, 'reflector', 'in', a, 0)
  const B = contactPoint(l, 'reflector', 'in', b, 0)
  const pull = 0.4
  const cy = AXIS_Y + ((A.y + B.y) / 2 - AXIS_Y) * pull
  const cz = AXIS_Z + ((A.z + B.z) / 2 - AXIS_Z) * pull
  const chord = Math.hypot(A.y - B.y, A.z - B.z)
  const bulge = 0.12 + 0.3 * (chord / (2 * Math.hypot(A.y - AXIS_Y, A.z - AXIS_Z)))
  const out: Vec3[] = []
  for (let i = 0; i <= segments; i++) {
    const f = i / segments
    const g = 1 - f
    // Quadratic Bézier A → (cy, cz) → B in (y, z); a sine bulge in −x.
    out.push(
      v(
        x0 - bulge * Math.sin(Math.PI * f),
        g * g * A.y + 2 * g * f * cy + f * f * B.y,
        g * g * A.z + 2 * g * f * cz + f * f * B.z,
      ),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

const isReturn = (h: PathHop): boolean =>
  h.stage === 'plugboard-out' || h.stage === 'etw-out' || h.stage.endsWith('-bwd')

/** Waypoints inside hop h, from its entry point `a` to its exit point `b` (both excluded). */
function insideHop(l: Layout, h: PathHop, a: Vec3, b: Vec3): Vec3[] {
  if (h.kind === 'plugboard') {
    if (h.inputIndex === h.outputIndex) return []
    // along the cable: out of hole a to the front of its plug, the cable, into hole b
    const cable = cablePath(l, h.inputIndex, h.outputIndex)
    const first = cable[0]!
    const last = cable[cable.length - 1]!
    return [v(first.x, a.y, first.z), ...cable.slice(1, -1), v(last.x, b.y, last.z)]
  }
  if (h.kind === 'reflector') {
    const arc = reflectorArc(l, h.inputIndex, h.outputIndex)
    return arc
  }
  return []
}

/** Waypoints between hop `prev`'s exit `a` and hop `next`'s entry `b` (both excluded). */
function betweenHops(prev: PathHop, next: PathHop, a: Vec3, b: Vec3): Vec3[] {
  if (prev.kind === 'plugboard' && next.kind !== 'plugboard' && !isReturn(prev)) return harnessPath(a, b)
  if (next.kind === 'plugboard' && prev.kind !== 'plugboard' && isReturn(next)) return harnessPath(b, a).reverse()
  return []
}

/**
 * The control points of the signal tube for these hops (see the file comment). Empty without hops.
 * The anchors are exactly pathPoints(hops, l), in order.
 */
export function signalRoute(hops: readonly PathHop[], l: Layout): Route {
  const anchorsAt = pathPoints(hops, l)
  if (anchorsAt.length === 0) return { points: [], anchors: [] }
  const points: Vec3[] = []
  const anchors: number[] = []
  const push = (p: Vec3) => {
    const last = points[points.length - 1]
    if (!last || dist(last, p) > 1e-6) points.push(p)
  }
  const anchor = (p: Vec3) => {
    push(p)
    anchors.push(points.length - 1)
  }
  const H = hops.length
  anchor(anchorsAt[0]!)
  // key → first hop
  if (hops[0]!.kind === 'plugboard') leadPath(anchorsAt[0]!, anchorsAt[1]!).forEach(push)
  for (let k = 0; k < H; k++) {
    const entry = anchorsAt[1 + 2 * k]!
    const exit = anchorsAt[2 + 2 * k]!
    anchor(entry)
    insideHop(l, hops[k]!, entry, exit).forEach(push)
    anchor(exit)
    if (k + 1 < H) betweenHops(hops[k]!, hops[k + 1]!, exit, anchorsAt[3 + 2 * k]!).forEach(push)
  }
  // last hop → lamp
  const lamp = anchorsAt[1 + 2 * H]!
  if (hops[H - 1]!.kind === 'plugboard')
    leadPath(lamp, anchorsAt[2 * H]!)
      .reverse()
      .forEach(push)
  anchor(lamp)
  return { points, anchors }
}

/**
 * Where the drawn tube may start and end for each piece of the path, as anchor indices (PLAN §3.2
 * timing, as in the 2D view): piece k (hop k, live on t ∈ [1+k, 2+k)) runs from anchor 2k — the key,
 * or hop k−1's exit — to anchor 2k+2, hop k's exit; the lamp lead (anchor 2H → 2H+1) follows once lit.
 */
export function pieceAnchors(k: number): readonly [number, number] {
  return [2 * k, 2 * k + 2]
}

/** The reflector's pairs a < b of an involution (13 on the machine, n/2 on a toy). */
export function wirePairs(wiring: readonly number[]): [number, number][] {
  const out: [number, number][] = []
  wiring.forEach((b, a) => {
    if (b > a) out.push([a, b])
  })
  return out
}
