/**
 * Letters and numbers drawn procedurally: one Canvas2D glyph atlas (A–Z, 01–26, 0–9) in the
 * system's sans-serif, sampled by instanced quads. No font file is downloaded — troika's <Text>
 * would fetch its default font from a CDN — and every ring's 26 letters and 26 numbers are one
 * draw call instead of 52.
 */

import { useLayoutEffect, useMemo, useRef, type JSX } from 'react'
import {
  CanvasTexture,
  Color,
  DataTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three'
import { LETTERS } from '../engine'
import { usePartMaterial, type PartKey } from './focus'

const COLS = 8
const CELL = 128
const SIZE = COLS * CELL

/** Every glyph in the atlas: 26 letters, the ring numbers 01–26 and the digits. */
export const GLYPHS: readonly string[] = [
  ...LETTERS,
  ...Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, '0')),
  ...'0123456789'.split(''),
]
const INDEX = new Map(GLYPHS.map((g, i) => [g, i]))

export const FONT_STACK = '"DejaVu Sans", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif'

/** UV rectangle (u0, v0, du, dv) of a glyph in the atlas. */
export function glyphRect(glyph: string): [number, number, number, number] {
  const i = INDEX.get(glyph)
  if (i === undefined) throw new RangeError(`No glyph for ${JSON.stringify(glyph)}`)
  const col = i % COLS
  const row = Math.floor(i / COLS)
  return [col / COLS, 1 - (row + 1) / COLS, 1 / COLS, 1 / COLS]
}

let atlas: Texture | null = null

/** A 2D canvas context, or null where there is none (unit tests under happy-dom). */
export function canvas2d(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/** A plain white texel: glyphs render as solid quads when no 2D canvas exists. */
export function whiteTexture(): Texture {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

/** The shared glyph atlas, drawn on first use. */
export function glyphAtlas(): Texture {
  if (atlas) return atlas
  const ctx = canvas2d(SIZE, SIZE)
  if (!ctx) return (atlas = whiteTexture())
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  GLYPHS.forEach((g, i) => {
    const px = g.length === 1 ? 100 : 78
    ctx.font = `700 ${px}px ${FONT_STACK}`
    const m = ctx.measureText(g)
    const ascent = m.actualBoundingBoxAscent || px * 0.72
    const descent = m.actualBoundingBoxDescent || 0
    const cx = (i % COLS) * CELL + CELL / 2
    const cy = Math.floor(i / COLS) * CELL + CELL / 2
    ctx.fillText(g, cx, cy + (ascent - descent) / 2)
  })
  const texture = new CanvasTexture(ctx.canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return (atlas = texture)
}

export interface GlyphItem {
  readonly glyph: string
  readonly position: readonly [number, number, number]
  /** Orientation of the quad (its +z is the reading side, +y the glyph's up). */
  readonly quaternion: Quaternion
  /** Height of the quad in cm (glyphs are square cells). */
  readonly size: number
  readonly color: string
}

const _m = new Matrix4()
const _p = new Vector3()
const _s = new Vector3()
const _c = new Color()

function glyphMaterial(): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ map: glyphAtlas(), transparent: true, alphaTest: 0.08, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 glyphRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * glyphRect.zw + glyphRect.xy;\n#endif')
  }
  m.customProgramCacheKey = () => 'enigma-glyph'
  return m
}

/**
 * Instanced glyph quads for one part. Remounts when the number of glyphs changes (an instanced
 * mesh's capacity is fixed).
 */
export function GlyphMesh({ items, part, name }: { items: readonly GlyphItem[]; part: PartKey; name?: string }): JSX.Element {
  return <GlyphInstances key={items.length} items={items} part={part} name={name} />
}

function GlyphInstances({ items, part, name }: { items: readonly GlyphItem[]; part: PartKey; name?: string }): JSX.Element {
  const count = items.length
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1)
    const rects = new InstancedBufferAttribute(new Float32Array(count * 4), 4)
    rects.setUsage(DynamicDrawUsage)
    g.setAttribute('glyphRect', rects)
    return g
  }, [count])
  const material = usePartMaterial(part, glyphMaterial)
  useLayoutEffect(() => () => geometry.dispose(), [geometry])
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = mesh.current
    if (!im) return
    const rects = geometry.getAttribute('glyphRect') as InstancedBufferAttribute
    items.forEach((it, i) => {
      _p.set(it.position[0], it.position[1], it.position[2])
      _s.set(it.size, it.size, it.size)
      im.setMatrixAt(i, _m.compose(_p, it.quaternion, _s))
      im.setColorAt(i, _c.set(it.color))
      rects.setXYZW(i, ...glyphRect(it.glyph))
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    rects.needsUpdate = true
    im.computeBoundingSphere()
  }, [items, geometry, mesh])
  return (
    <instancedMesh
      ref={mesh}
      name={name}
      args={[geometry, material, count]}
      userData={{ part, glyphs: items.map((it) => it.glyph) }}
      renderOrder={2}
    />
  )
}
