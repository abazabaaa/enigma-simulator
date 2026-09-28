/**
 * Renderer stats for window.__stage.stats() (PLAN §3.9) and, with ?e2e=1, window.__machine3d
 * (debugApi.ts). Both are mounted once inside the Canvas.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Matrix4, Vector3, type InstancedMesh, type Mesh, type Object3D } from 'three'
import type { PartId } from '../contracts/stage'
import { LETTERS } from '../engine'
import { isE2E } from '../lib/flags'
import { registerStageStats } from '../stage/stageApi'
import { rig } from './CameraRig'
import { scenePartStates, useFocus } from './focus'
import type { Machine3DDebugApi } from './debugApi'
import { labelLayout } from './labels'
import { ROTOR, WINDOW_ANGLE } from './layout'
import { idleMs, monitor, useFrameMonitor } from './monitor'
import { PAWL_TIP_LOCAL } from './parts/Pawls'

const _v = new Vector3()
const _m = new Matrix4()

/** World position of an object, or of a point in its local frame. */
function worldOf(o: Object3D, local: Vector3 | null): Vector3 {
  o.updateWorldMatrix(true, false)
  return local ? local.clone().applyMatrix4(o.matrixWorld) : new Vector3().setFromMatrixPosition(o.matrixWorld)
}

/** Frame accounting and stats: calls, triangles, geometries, textures and framesWhileIdle. */
export function StatsHook(): null {
  const gl = useThree((s) => s.gl)
  useFrameMonitor()
  useEffect(
    () =>
      registerStageStats(() => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        framesWhileIdle: monitor.framesWhileIdle,
      })),
    [gl],
  )
  return null
}

/** window.__machine3d, only when the page was opened with ?e2e=1. */
export function DebugHook({ slots }: { slots: readonly string[] }): null {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const { registry } = useFocus()
  const slotKey = slots.join()
  useEffect(() => {
    if (!isE2E()) return
    const toClient = (p: Vector3) => {
      _v.copy(p).project(camera)
      const rect = gl.domElement.getBoundingClientRect()
      return { x: rect.left + ((_v.x + 1) / 2) * rect.width, y: rect.top + ((1 - _v.y) / 2) * rect.height }
    }
    const api: Machine3DDebugApi = {
      camera() {
        const target = rig.controls?.getTarget(new Vector3()) ?? new Vector3()
        return {
          shot: rig.shot,
          position: camera.position.toArray() as [number, number, number],
          target: target.toArray() as [number, number, number],
          settleFrames: rig.settleFrames,
        }
      },
      rotors() {
        return slotKey.split(',').map((slot) => {
          const ring = scene.getObjectByName(`ring-${slot}`)
          const core = scene.getObjectByName(`core-${slot}`)
          const pawl = scene.getObjectByName(`pawl-${slot}`)
          return {
            slot,
            window: (ring?.userData.window as number | undefined) ?? -1,
            ringAngle: ring?.rotation.x ?? NaN,
            coreAngle: core?.rotation.x ?? NaN,
            engaged: pawl ? !!pawl.userData.engaged : null,
          }
        })
      },
      parts() {
        const states = scenePartStates(registry)
        const present: string[] = []
        const dimmed: string[] = []
        const highlighted: string[] = []
        for (const [part, s] of states) {
          if (part === 'scenery') continue
          present.push(part)
          if (s.dimmed) dimmed.push(part)
          if (s.tone) highlighted.push(part as PartId)
        }
        return { present, dimmed, highlighted }
      },
      frames: () => monitor.frames,
      idleMs,
      canvas() {
        const r = gl.domElement.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      },
      keyPoint(letter) {
        const key = scene.getObjectByName(`key-${letter.toUpperCase()}`)
        return key ? toClient(worldOf(key, null)) : null
      },
      screenPoints(kind) {
        const out: Record<string, { x: number; y: number }> = {}
        const add = (name: string, o: Object3D | undefined, local: Vector3 | null) => {
          if (o) out[name] = toClient(worldOf(o, local))
        }
        if (kind === 'key' || kind === 'lamp' || kind === 'socket') {
          for (const l of LETTERS) add(l, scene.getObjectByName(`${kind}-${l}`), null)
        } else if (kind === 'reflector') {
          add('U', scene.getObjectByName('reflector'), null)
        } else {
          for (const slot of slotKey.split(',')) {
            if (kind === 'pawl') {
              add(slot, scene.getObjectByName(`pawl-${slot}`), new Vector3(PAWL_TIP_LOCAL.x, PAWL_TIP_LOCAL.y, 0))
            } else if (kind === 'core-index') {
              const r = ROTOR.coreR + 0.2
              const tip = new Vector3(ROTOR.coreX1 - 0.3, r * Math.cos(WINDOW_ANGLE), r * Math.sin(WINDOW_ANGLE))
              add(slot, scene.getObjectByName(`core-${slot}`), tip)
            } else {
              const frame = scene.getObjectByName(`window-${slot}`) as Mesh | undefined
              if (!frame) continue
              frame.geometry.computeBoundingSphere()
              add(slot, frame, frame.geometry.boundingSphere!.center.clone())
            }
          }
        }
        return out
      },
      rings() {
        return slotKey.split(',').map((slot) => {
          const glyphs = scene.getObjectByName(`ring-glyphs-${slot}`)
          return {
            slot,
            digits: [...((glyphs?.userData.numbers as string[] | undefined) ?? [])],
            windowNumber: !!glyphs?.userData.windowNumber,
            ringSetting: (glyphs?.userData.ringSetting as string | null | undefined) ?? null,
            leader: !!scene.getObjectByName(`ring-setting-leader-${slot}`),
          }
        })
      },
      labels() {
        const r = gl.domElement.getBoundingClientRect()
        const shift = <T extends { x: number; y: number }>(b: T): T => ({ ...b, x: b.x + r.left, y: b.y + r.top })
        return {
          labels: labelLayout.labels.map((l) => ({
            ...shift(l),
            leader: l.leader
              ? { x1: l.leader.x1 + r.left, y1: l.leader.y1 + r.top, x2: l.leader.x2 + r.left, y2: l.leader.y2 + r.top }
              : null,
          })),
          keepOut: labelLayout.keepOut.map(shift),
          soft: labelLayout.soft.map(shift),
        }
      },
      glyphs(slot) {
        const mesh = scene.getObjectByName(`ring-glyphs-${slot}`) as InstancedMesh | undefined
        const ring = scene.getObjectByName(`ring-${slot}`)
        if (!mesh || !ring) return { window: null, dialMin: null }
        mesh.updateWorldMatrix(true, false)
        const glyphs = mesh.userData.glyphs as string[]
        /** Projected lengths of a glyph cell's own x and y axes. */
        const cell = (i: number) => {
          mesh.getMatrixAt(i, _m)
          _m.premultiply(mesh.matrixWorld)
          const at = (x: number, y: number) => toClient(new Vector3(x, y, 0).applyMatrix4(_m))
          const [l, rr, b, t] = [at(-0.5, 0), at(0.5, 0), at(0, -0.5), at(0, 0.5)]
          return { w: Math.hypot(rr.x - l.x, rr.y - l.y), h: Math.hypot(t.x - b.x, t.y - b.y) }
        }
        const letter = LETTERS[ring.userData.window as number]!
        const w = glyphs.indexOf(letter)
        const digits = glyphs.map((g, i) => (/^\d+$/.test(g) ? cell(i).h : null)).filter((h) => h !== null)
        return { window: w >= 0 ? cell(w) : null, dialMin: digits.length ? Math.min(...digits) : null }
      },
    }
    window.__machine3d = api
    return () => {
      if (window.__machine3d === api) delete window.__machine3d
    }
  }, [scene, camera, gl, registry, slotKey])
  return null
}
