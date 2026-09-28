/**
 * The signal's head and its tag (PLAN §2.6; review round 1, N2 and the "count the transformations"
 * teaching aid):
 *  - the head is a glowing sphere at curve.getPointAt(f), never smaller on screen than HEAD_MIN_PX
 *    (it grows with the camera's distance, so it stays findable at 390 px), with a see-through copy
 *    drawn over the parts that hide it;
 *  - the tag beside it names the part the current is in and what it does to the letter there
 *    ('N  E → W', the symbol in its slot's colour, ⁻¹ on the way back) and counts the letter changes
 *    ('change 4 of 7'; the entry wheel and an unplugged socket: 'no change'). It is a flat label of
 *    a fixed on-screen size, drawn over the machine and never bloomed. It shows with the head, so
 *    not under lampsHidden, nor once the lamp is lit.
 * Sizes follow the camera inside useFrame, so they cost no frame of their own. The tag's texture is
 * one canvas redrawn in place (no texture per hop), and both meshes are primed (usePrimed.ts).
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react'
import {
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
  type Mesh,
  type Texture,
} from 'three'
import { FONT_STACK, canvas2d, whiteTexture } from '../glyphs'
import { useGeometry } from '../hooks'
import { swatch } from '../palette'
import type { V3 } from './debugApi'
import { GLOW_INTENSITY, overlayMaterial } from './materials'
import type { HeadTag } from './tag'
import { usePrimed } from './usePrimed'

export const HEAD_RADIUS = 0.42
/** Smallest on-screen diameter of the head, in CSS pixels. */
export const HEAD_MIN_PX = 14
/** On-screen height of the tag, in CSS pixels. */
export const TAG_PX = 38
const TAG_W = 256
const TAG_H = 112

const _up = new Vector3()
const _right = new Vector3()
const _p = new Vector3()

/** CSS pixels per world unit at distance d in front of a perspective camera. */
export function pxPerUnit(fovDeg: number, heightPx: number, d: number): number {
  return heightPx / (2 * Math.max(d, 1e-3) * Math.tan(((fovDeg / 2) * Math.PI) / 180))
}

/** Draws the tag onto its canvas: symbol in its slot colour, the letters, and the change count. */
function paintTag(ctx: CanvasRenderingContext2D, tag: HeadTag): void {
  const color = swatch(tag.sym)
  ctx.clearRect(0, 0, TAG_W, TAG_H)
  ctx.fillStyle = 'rgba(12, 10, 9, 0.88)'
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.roundRect(3, 3, TAG_W - 6, TAG_H - 6, 16)
  ctx.fill()
  ctx.stroke()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const sym = `${tag.sym}${tag.inverse ? '⁻¹' : ''}`
  ctx.font = `700 46px ${FONT_STACK}`
  const symW = ctx.measureText(sym).width
  const letters = `${tag.input} → ${tag.output}`
  const lettersW = ctx.measureText(letters).width
  const x0 = (TAG_W - (symW + 18 + lettersW)) / 2
  ctx.fillStyle = color
  ctx.fillText(sym, x0, 40)
  ctx.fillStyle = '#fafaf9'
  ctx.fillText(letters, x0 + symW + 18, 40)
  ctx.font = `600 30px ${FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.fillStyle = tag.change === null ? '#a8a29e' : '#fde68a'
  ctx.fillText(tag.detail, TAG_W / 2, 86)
}

export interface HeadInfo {
  readonly head: V3 | null
  /** On-screen diameter of the head (CSS px), 0 when hidden. */
  readonly headPx: number
  readonly tag: (HeadTag & { readonly color: string; readonly px: number }) | null
}

export function Head({ head, tag }: { head: V3 | null; tag: HeadTag | null }): JSX.Element {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const sphere = useGeometry(() => new SphereGeometry(HEAD_RADIUS, 12, 8), [])
  const plane = useGeometry(() => new PlaneGeometry(TAG_W / TAG_H, 1), [])
  const ctx = useMemo(() => canvas2d(TAG_W, TAG_H), [])
  const texture = useMemo((): Texture => {
    if (!ctx) return whiteTexture()
    const t = new CanvasTexture(ctx.canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [ctx])
  const m = useMemo(
    () => ({
      head: new MeshStandardMaterial({
        color: '#fff7d6',
        emissive: swatch('signal'),
        emissiveIntensity: GLOW_INTENSITY,
        toneMapped: false,
      }),
      headXray: overlayMaterial(swatch('signal'), 0.6),
      tag: new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    [texture],
  )
  useEffect(
    () => () => {
      for (const material of Object.values(m)) material.dispose()
      texture.dispose()
    },
    [m, texture],
  )

  const tagKey = tag ? `${tag.title}|${tag.detail}|${tag.sym}` : ''
  useLayoutEffect(() => {
    if (!tag || !ctx) return
    paintTag(ctx, tag)
    texture.needsUpdate = true
    // tagKey stands for tag
  }, [tagKey, ctx, texture])

  const shown = head !== null
  const headPrimed = usePrimed(shown)
  const xrayPrimed = usePrimed(shown)
  const tagPrimed = usePrimed(shown && tag !== null)
  const headRef = useRef<Mesh>(null)
  const xrayRef = useRef<Mesh>(null)
  const tagRef = useRef<Mesh>(null)
  const info = useRef<{ headPx: number; tagPx: number }>({ headPx: 0, tagPx: 0 })

  useFrame(() => {
    const meshes = [headRef.current, xrayRef.current, tagRef.current]
    if (!head || !(camera instanceof PerspectiveCamera)) {
      for (const mesh of meshes) mesh?.scale.setScalar(0)
      info.current = { headPx: 0, tagPx: 0 }
      return
    }
    _p.set(head[0], head[1], head[2])
    const ppu = pxPerUnit(camera.fov, size.height, camera.position.distanceTo(_p))
    const scale = Math.max(1, HEAD_MIN_PX / 2 / (HEAD_RADIUS * ppu))
    headRef.current?.scale.setScalar(scale)
    xrayRef.current?.scale.setScalar(scale)
    const t = tagRef.current
    if (t) {
      const h = TAG_PX / ppu
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      // above and to the right of the head, clear of it
      const lift = HEAD_RADIUS * scale + h * 0.75
      t.position
        .copy(_p)
        .addScaledVector(_up, lift)
        .addScaledVector(_right, h * 0.9)
      t.quaternion.copy(camera.quaternion)
      t.scale.setScalar(tag ? h : 0)
    }
    info.current = { headPx: 2 * HEAD_RADIUS * scale * ppu, tagPx: tag ? TAG_PX : 0 }
  })

  const userData: { info: () => HeadInfo } = {
    info: () => ({
      head,
      headPx: head ? info.current.headPx : 0,
      tag: head && tag ? { ...tag, color: swatch(tag.sym), px: info.current.tagPx } : null,
    }),
  }
  return (
    <group name="signal-head-group" userData={userData}>
      <mesh
        ref={headRef}
        name="signal-head"
        geometry={sphere}
        material={m.head}
        visible={headPrimed.visible}
        onAfterRender={headPrimed.onAfterRender}
        frustumCulled={false}
        position={head ?? [0, 0, 0]}
        userData={{ head }}
      />
      <mesh
        ref={xrayRef}
        name="signal-head-xray"
        geometry={sphere}
        material={m.headXray}
        visible={xrayPrimed.visible}
        onAfterRender={xrayPrimed.onAfterRender}
        frustumCulled={false}
        position={head ?? [0, 0, 0]}
        renderOrder={5}
      />
      <mesh
        ref={tagRef}
        name="signal-tag"
        geometry={plane}
        material={m.tag}
        visible={tagPrimed.visible}
        onAfterRender={tagPrimed.onAfterRender}
        frustumCulled={false}
        renderOrder={12}
        userData={{ tag: head ? tag : null }}
      />
    </group>
  )
}
