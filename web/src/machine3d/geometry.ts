/**
 * Procedural geometry helpers (PLAN §2.6: solids of revolution, boxes and extrusions only; no
 * downloaded assets). Rotor parts are built with their axis along x.
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** An axis-aligned box from corner bounds. */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): BufferGeometry {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

/** A solid disc about the x axis, from x0 to x1. */
export function discX(r: number, x0: number, x1: number, segments = 48): BufferGeometry {
  const g = new CylinderGeometry(r, r, x1 - x0, segments)
  g.rotateZ(-Math.PI / 2)
  g.translate((x0 + x1) / 2, 0, 0)
  return g
}

/** A thick tube (annulus of revolution) about the x axis. */
export function shellX(r0: number, r1: number, x0: number, x1: number, segments = 64): BufferGeometry {
  const profile = [
    new Vector2(r0, x0),
    new Vector2(r1, x0),
    new Vector2(r1, x1),
    new Vector2(r0, x1),
    new Vector2(r0, x0),
  ]
  const g = new LatheGeometry(profile, segments)
  g.rotateZ(-Math.PI / 2)
  return g
}

/**
 * A toothed annulus about the x axis (thumbwheel, ratchet): `teeth` teeth between radii rIn (root)
 * and rOut (tip), with a hole of radius rHole, from x0 to x1.
 */
export function gearX(teeth: number, rHole: number, rIn: number, rOut: number, x0: number, x1: number): BufferGeometry {
  const shape = new Shape()
  const steps = teeth * 2
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = i % 2 === 0 ? rOut : rIn
    if (i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a))
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a))
  }
  const hole = new Shape()
  hole.absarc(0, 0, rHole, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const g = new ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 })
  g.rotateY(Math.PI / 2)
  g.translate(x0, 0, 0)
  return g
}

/** Merges geometries (converted to non-indexed, keeping position, normal and uv) and disposes the inputs. */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  const flat = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(n.attributes))
      if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name)
    n.clearGroups()
    return n
  })
  const merged = mergeGeometries(flat, false)
  if (!merged) throw new Error('mergeGeometries failed')
  for (const g of new Set([...parts, ...flat])) g.dispose()
  return merged
}
