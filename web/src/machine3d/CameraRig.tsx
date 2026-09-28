/**
 * Named camera shots through drei <CameraControls> (PLAN §2.6). A shot change flies the camera there,
 * or cuts to it under reduced motion. The frame step fed to the controls is capped, so the first
 * frame after an idle spell (demand frame loop: a large clock delta) does not skip the flight.
 * The wheel is left to the page (no zoom) and one finger scrolls the page on touch screens; two
 * fingers pinch to zoom and drag to orbit.
 */

import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type JSX } from 'react'
import type { CameraShot } from '../contracts/stage'
import type { Layout } from './layout'
import { markChange, monitor } from './monitor'
import { shotFor } from './shots'

const MAX_STEP = 1 / 30

class SteadyControls extends CameraControlsImpl {
  override update(delta: number): boolean {
    return super.update(Math.min(delta, MAX_STEP))
  }
}

/** The rig's state, read by the e2e debug hook. */
export const rig = {
  shot: null as CameraShot | null,
  /** Frame count when the current shot was requested. */
  requestedAt: 0,
  /** Frames from the request until the camera reached the shot, or null while still moving. */
  settleFrames: null as number | null,
  controls: null as CameraControlsImpl | null,
}

const { ACTION } = CameraControlsImpl

export function CameraRig({
  shot,
  layout,
  reducedMotion,
}: {
  shot: CameraShot
  layout: Layout
  reducedMotion: boolean
}): JSX.Element {
  const ref = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const first = useRef(true)
  const layoutKey = `${layout.n}|${layout.slots.join()}|${layout.toy}`

  useEffect(() => {
    const controls = ref.current
    if (!controls) return
    rig.controls = controls
    const s = shotFor(shot, layout)
    rig.shot = shot
    rig.requestedAt = monitor.frames
    rig.settleFrames = null
    const animate = !reducedMotion && !first.current
    first.current = false
    void controls.setLookAt(s.position.x, s.position.y, s.position.z, s.target.x, s.target.y, s.target.z, animate)
    markChange()
    invalidate()
    // layoutKey stands for layout
  }, [shot, layoutKey, reducedMotion, invalidate])

  useEffect(() => {
    // camera-controls sets touch-action: none; keep vertical page scrolling on touch screens.
    gl.domElement.style.touchAction = 'pan-y'
  }, [gl])

  useEffect(() => () => void (rig.controls = null), [])

  useFrame(() => {
    if (rig.settleFrames !== null || !rig.shot) return
    const s = shotFor(rig.shot, layout)
    const p = camera.position
    if (Math.hypot(p.x - s.position.x, p.y - s.position.y, p.z - s.position.z) < 1e-3) {
      rig.settleFrames = monitor.frames - rig.requestedAt
    }
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      impl={SteadyControls}
      smoothTime={0.45}
      minDistance={8}
      maxDistance={140}
      mouseButtons-wheel={ACTION.NONE}
      mouseButtons-middle={ACTION.NONE}
      touches-one={ACTION.NONE}
      touches-two={ACTION.TOUCH_DOLLY_ROTATE}
      touches-three={ACTION.NONE}
      onUpdate={markChange}
      onControl={markChange}
    />
  )
}
