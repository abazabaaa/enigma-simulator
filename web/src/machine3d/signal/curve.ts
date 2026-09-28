/**
 * The signal's curve and tube (PLAN §2.6): a CatmullRomCurve3 (centripetal, so it does not loop at
 * the route's corners) through the route's points, and a TubeGeometry over it that is drawn up to a
 * fraction of its length with setDrawRange. TubeGeometry samples the curve evenly by arc length
 * (getPointAt), so the first ⌈f·segments⌉ segments are the first f of the path, and the head sits
 * at getPointAt(f).
 */

import { BufferAttribute, CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry } from 'three'
import type { Vec3 } from '../layout'
import type { Route } from './route'

/** Tube resolution: one segment per this many cm of path. */
const SEGMENT_CM = 0.45
const MAX_SEGMENTS = 3000
/** Arc-length samples per control point (the u of each anchor is read from this table). */
const SAMPLES = 10

export interface SignalCurve {
  readonly curve: CatmullRomCurve3
  /** u[i] ∈ [0, 1]: the fraction of the length at which the curve passes anchor i. */
  readonly u: readonly number[]
  /** Length in cm. */
  readonly length: number
}

/** The curve through a route (shifted by `offset`), or null for an empty route. */
export function buildCurve(route: Route, offset: Vec3 = { x: 0, y: 0, z: 0 }): SignalCurve | null {
  if (route.points.length < 2) return null
  const points = route.points.map((p) => new Vector3(p.x + offset.x, p.y + offset.y, p.z + offset.z))
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  const divisions = (points.length - 1) * SAMPLES
  curve.arcLengthDivisions = divisions
  const lengths = curve.getLengths(divisions)
  const length = lengths[divisions]!
  // The curve passes control point i at t = i / (points − 1), i.e. at division i·SAMPLES.
  const u = route.anchors.map((i) => lengths[i * SAMPLES]! / length)
  return { curve, u, length }
}

export interface Tube {
  readonly geometry: TubeGeometry
  readonly segments: number
  readonly radial: number
}

/** A tube over the whole curve. */
export function buildTube(c: SignalCurve, radius: number, radial = 6): Tube {
  const segments = Math.max(16, Math.min(MAX_SEGMENTS, Math.ceil(c.length / SEGMENT_CM)))
  return { geometry: new TubeGeometry(c.curve, segments, radius, radial, false), segments, radial }
}

/** Tube segments covering the first `fraction` of the length. */
export function segmentsFor(tube: Tube, fraction: number): number {
  if (fraction <= 0) return 0
  return Math.min(tube.segments, Math.ceil(fraction * tube.segments - 1e-9))
}

/** Draws only the first `segments` segments of a tube (indices come segment by segment). */
export function drawSegments(tube: Tube, segments: number): void {
  tube.geometry.setDrawRange(0, segments * tube.radial * 6)
}

/** Keeps every other run of `dash` segments: a dashed tube (the ghost path). */
export function dashTube(tube: Tube, dash: number): BufferGeometry {
  const index = tube.geometry.index!
  const per = tube.radial * 6
  const kept: number[] = []
  for (let j = 0; j < tube.segments; j++) {
    if (Math.floor(j / dash) % 2 !== 0) continue
    for (let i = 0; i < per; i++) kept.push(index.getX(j * per + i))
  }
  tube.geometry.setIndex(new BufferAttribute(new Uint32Array(kept), 1))
  return tube.geometry
}

/** The point at fraction f of the curve's length, as a tuple. */
export function pointAt(c: SignalCurve, f: number): [number, number, number] {
  const p = c.curve.getPointAt(Math.min(1, Math.max(0, f)))
  return [p.x, p.y, p.z]
}
