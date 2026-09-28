/**
 * Geometry helpers for the signal layer and the parts it lights (reflector arcs, plug cables, toy
 * wiring): tubes along a list of points, and merges that keep one colour per input and record where
 * each input landed, so that one draw call shows every wire and a second one (a copy of the same
 * geometry with a draw range) shows only the lit wire — no geometry is built or freed per key press.
 */

import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Vec3 } from '../layout'

/** A tube through `points` (a centripetal Catmull–Rom curve), with fixed segment counts. */
export function tubeAlong(points: readonly Vec3[], radius: number, segments: number, radial = 8): TubeGeometry {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(p.x, p.y, p.z)),
    false,
    'centripetal',
  )
  return new TubeGeometry(curve, segments, radius, radial, false)
}

export interface Merged {
  readonly geometry: BufferGeometry
  /** [first vertex, vertex count] of each input, in order. */
  readonly ranges: readonly (readonly [number, number])[]
}

const _c = new Color()

/**
 * Merges geometries (made non-indexed; position and normal kept) into one, painting each input in
 * its colour (a vertex colour; `null` leaves it white), and disposes the inputs.
 */
export function mergeColored(parts: readonly { geometry: BufferGeometry; color: string | null }[]): Merged {
  const ranges: [number, number][] = []
  let start = 0
  const flat = parts.map(({ geometry, color }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    g.clearGroups()
    const count = g.getAttribute('position').count
    _c.set(color ?? '#ffffff')
    const rgb = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) rgb.set([_c.r, _c.g, _c.b], i * 3)
    g.setAttribute('color', new BufferAttribute(rgb, 3))
    ranges.push([start, count])
    start += count
    return g
  })
  const merged = flat.length ? mergeGeometries(flat, false) : null
  if (flat.length && !merged) throw new Error('mergeGeometries failed')
  for (const g of new Set([...parts.map((p) => p.geometry), ...flat])) g.dispose()
  return { geometry: merged ?? new BufferGeometry(), ranges }
}

/** Shows only input `i` of a merged geometry (or nothing for null). Returns whether anything shows. */
export function showRange(m: Merged, i: number | null): boolean {
  const r = i === null ? undefined : m.ranges[i]
  if (!r) {
    m.geometry.setDrawRange(0, 0)
    return false
  }
  m.geometry.setDrawRange(r[0], r[1])
  return true
}
