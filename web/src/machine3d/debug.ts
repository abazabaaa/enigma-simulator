/**
 * Renderer stats for window.__stage.stats() (PLAN §3.9) and, with ?e2e=1, window.__machine3d
 * (debugApi.ts). Both are mounted once inside the Canvas.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import type { PartId } from '../contracts/stage'
import { isE2E } from '../lib/flags'
import { registerStageStats } from '../stage/stageApi'
import { rig } from './CameraRig'
import { scenePartStates, useFocus } from './focus'
import type { Machine3DDebugApi } from './debugApi'
import { idleMs, monitor, useFrameMonitor } from './monitor'

const _v = new Vector3()

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
      keyPoint(letter) {
        const key = scene.getObjectByName(`key-${letter.toUpperCase()}`)
        if (!key) return null
        key.updateWorldMatrix(true, false)
        _v.setFromMatrixPosition(key.matrixWorld).project(camera)
        const rect = gl.domElement.getBoundingClientRect()
        return { x: rect.left + ((_v.x + 1) / 2) * rect.width, y: rect.top + ((1 - _v.y) / 2) * rect.height }
      },
    }
    window.__machine3d = api
    return () => {
      if (window.__machine3d === api) delete window.__machine3d
    }
  }, [scene, camera, gl, registry, slotKey])
  return null
}
