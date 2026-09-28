/**
 * Geometry of the 2D "flattened circuit" (PLAN §2.6). PURE: no React, no DOM.
 *
 * Columns are drawn as the operator sees the machine, LEFT → RIGHT:
 *   reflector (U) | [Greek (G)] | left (L) | middle (M) | right (N) | [ETW (H)] | plugboard (S) | keys | lamps
 * which is the signal order keys → plugboard → ETW → R → M → L → (G) → UKW read right to left. Each
 * column has n contacts (26, or 6/8 for a toy), contact 0 at the top. The current travels between
 * columns along a contact row (a hop's output index is the next hop's input index), so a hop is
 * drawn from its input row on one face of its column to its output row on the other face:
 * forward hops (towards the reflector) enter on the right face and leave on the left; return hops
 * the other way round; the reflector turns the current back on its right face.
 * A drawn path has 2 + 2·hops points: the key, an entry and an exit point per hop, and the lamp.
 */

import type { PathHop } from '../contracts/stage'
import type { RotorSlot } from '../engine'

export type ColumnId = 'reflector' | RotorSlot | 'etw' | 'plugboard' | 'keyboard' | 'lampboard'

export interface Column {
  readonly id: ColumnId
  /** Left and right faces. */
  readonly x0: number
  readonly x1: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface CircuitLayout {
  readonly n: number
  readonly slots: readonly RotorSlot[]
  readonly etw: boolean
  readonly ringLayer: boolean
  readonly width: number
  readonly height: number
  /** y of the top edge of contact row 0. */
  readonly top: number
  /** Vertical distance between contact rows. */
  readonly pitch: number
  readonly columns: Readonly<Partial<Record<ColumnId, Column>>>
}

const MARGIN = 14
const GAP = 34

/** Column widths. A rotor holds its ring band (left) and core (right); its pawl sits in the gap to its right. */
const WIDTH: Readonly<Record<'reflector' | 'rotor' | 'etw' | 'plugboard' | 'keyboard' | 'lampboard', number>> = {
  reflector: 40,
  rotor: 88,
  etw: 28,
  plugboard: 56,
  keyboard: 22,
  lampboard: 22,
}

export function makeCircuitLayout(o: {
  n: number
  slots: readonly RotorSlot[]
  etw: boolean
  ringLayer?: boolean
}): CircuitLayout {
  const pitch = o.n > 8 ? 18 : 38
  const top = 78
  const columns: Partial<Record<ColumnId, Column>> = {}
  let x = MARGIN
  const add = (id: ColumnId, width: number, gap: number) => {
    columns[id] = { id, x0: x, x1: x + width }
    x += width + gap
  }
  add('reflector', WIDTH.reflector, GAP)
  for (const slot of o.slots) add(slot, WIDTH.rotor, GAP + (o.ringLayer ? 14 : 0))
  if (o.etw) add('etw', WIDTH.etw, GAP)
  add('plugboard', WIDTH.plugboard, GAP)
  add('keyboard', WIDTH.keyboard, 16)
  add('lampboard', WIDTH.lampboard, 0)
  return {
    n: o.n,
    slots: o.slots,
    etw: o.etw,
    ringLayer: !!o.ringLayer,
    width: x + MARGIN,
    height: top + pitch * o.n + 16,
    top,
    pitch,
    columns,
  }
}

/** The centre y of contact row i. */
export function rowY(l: CircuitLayout, i: number): number {
  return l.top + l.pitch * (i + 0.5)
}

const center = (c: Column): number => (c.x0 + c.x1) / 2

/** The column a trace stage passes through, or null for an unknown stage. */
export function columnOfStage(stage: string): ColumnId | null {
  if (stage === 'plugboard-in' || stage === 'plugboard-out') return 'plugboard'
  if (stage === 'etw-in' || stage === 'etw-out') return 'etw'
  if (stage === 'reflector') return 'reflector'
  const m = /^rotor-(greek|left|middle|right)-(fwd|bwd)$/.exec(stage)
  return m ? (m[1] as RotorSlot) : null
}

/** Whether a stage carries the current back from the reflector. */
export function isReturnStage(stage: string): boolean {
  return stage === 'plugboard-out' || stage === 'etw-out' || stage.endsWith('-bwd')
}

const inRange = (l: CircuitLayout, i: number): boolean => Number.isInteger(i) && i >= 0 && i < l.n

/** The polyline of one hop, entry point first and exit point last; null if it cannot be placed. */
export function hopPoints(l: CircuitLayout, hop: PathHop): Point[] | null {
  const id = columnOfStage(hop.stage)
  const c = id ? l.columns[id] : undefined
  if (!c || !inRange(l, hop.inputIndex) || !inRange(l, hop.outputIndex)) return null
  const yIn = rowY(l, hop.inputIndex)
  const yOut = rowY(l, hop.outputIndex)
  if (id === 'reflector') {
    // In on the right face, a turn inside the reflector, out on the right face.
    const depth = c.x0 + 8 + ((Math.min(hop.inputIndex, hop.outputIndex) * 5) % Math.max(1, c.x1 - c.x0 - 16))
    return [
      { x: c.x1, y: yIn },
      { x: depth, y: yIn },
      { x: depth, y: yOut },
      { x: c.x1, y: yOut },
    ]
  }
  return isReturnStage(hop.stage)
    ? [
        { x: c.x0, y: yIn },
        { x: c.x1, y: yOut },
      ]
    : [
        { x: c.x1, y: yIn },
        { x: c.x0, y: yOut },
      ]
}

/** The key's point (keyboard column) and the lamp's point (lampboard column). */
export function keyPoint(l: CircuitLayout, i: number): Point | null {
  const c = l.columns.keyboard
  return c && inRange(l, i) ? { x: center(c), y: rowY(l, i) } : null
}

export function lampPoint(l: CircuitLayout, i: number): Point | null {
  const c = l.columns.lampboard
  return c && inRange(l, i) ? { x: center(c), y: rowY(l, i) } : null
}

export interface SignalPath {
  /** Piece k runs from the previous point (the key, or hop k−1's exit) through hop k. */
  readonly pieces: readonly (readonly Point[])[]
  /** From the last hop's exit to the lamp. */
  readonly tail: readonly Point[]
}

/** The whole path for a list of hops, or null if any hop cannot be placed. */
export function signalPath(l: CircuitLayout, hops: readonly PathHop[]): SignalPath | null {
  if (hops.length === 0) return null
  const start = keyPoint(l, hops[0]!.inputIndex)
  const end = lampPoint(l, hops[hops.length - 1]!.outputIndex)
  if (!start || !end) return null
  const pieces: Point[][] = []
  let prev = start
  for (const hop of hops) {
    const pts = hopPoints(l, hop)
    if (!pts) return null
    pieces.push([prev, ...pts])
    prev = pts[pts.length - 1]!
  }
  return { pieces, tail: [prev, end] }
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

/** The first `frac` (0…1) of a polyline, by length. */
export function partialPolyline(points: readonly Point[], frac: number): Point[] {
  if (points.length < 2 || frac >= 1) return [...points]
  if (frac <= 0) return points.length ? [points[0]!] : []
  const total = points.slice(1).reduce((sum, p, i) => sum + dist(points[i]!, p), 0)
  let left = total * frac
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const d = dist(a, b)
    if (d >= left) {
      const f = d === 0 ? 1 : left / d
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
      return out
    }
    out.push(b)
    left -= d
  }
  return out
}

/**
 * The points drawn at playback time t (PLAN §3.2 timing): nothing during the stepping phase [0,1);
 * hop k grows during [1+k, 2+k) (from the previous point through the hop); the lamp lead is added
 * once lit (t ≥ 1 + hops). `all` draws the whole path regardless of t (trace 'static').
 */
export function drawnPoints(path: SignalPath, t: number, all = false): Point[] {
  const hops = path.pieces.length
  if (all || t >= 1 + hops) return joinPieces([...path.pieces, path.tail])
  if (t < 1) return []
  const k = Math.min(hops - 1, Math.floor(t - 1))
  const done = path.pieces.slice(0, k)
  const live = partialPolyline(path.pieces[k]!, t - 1 - k)
  return joinPieces([...done, live])
}

function joinPieces(pieces: readonly (readonly Point[])[]): Point[] {
  const out: Point[] = []
  for (const piece of pieces) {
    piece.forEach((p, i) => {
      if (i === 0 && out.length) return // shared with the previous piece's last point
      out.push(p)
    })
  }
  return out
}

/** The reported StageReport.pathPoints: 2 + 2·(hops drawn), or 0 when nothing is drawn. */
export function pathPointCount(hopsDrawn: number): number {
  return hopsDrawn > 0 ? 2 + 2 * hopsDrawn : 0
}

export const polyline = (points: readonly Point[]): string => points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
const round = (v: number): number => Math.round(v * 10) / 10
