/**
 * Named camera shots through drei <CameraControls> (PLAN §2.6), fitted to the canvas's aspect ratio
 * (shots.ts frameShot). A shot change flies the camera there, or cuts to it under reduced motion; a
 * resize re-fits the shot with a cut. The frame step fed to the controls is capped, so the first
 * frame after an idle spell (demand frame loop: a large clock delta) does not skip the flight.
 * The wheel is left to the page (no zoom) and one finger scrolls the page on touch screens; two
 * fingers pinch to zoom and drag to orbit.
 */

import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type JSX } from 'react'
import type { CameraShot, StageDirective } from '../contracts/stage'
import type { Layout } from './layout'
import { markChange, monitor } from './monitor'
import { CAMERA_FOV, frameShot, type Shot } from './shots'

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
  /** Where the current shot puts the camera. */
  expected: null as Shot | null,
  controls: null as CameraControlsImpl | null,
}

const { ACTION } = CameraControlsImpl

export function CameraRig({
  directive,
  layout,
  reducedMotion,
}: {
  directive: StageDirective
  layout: Layout
  reducedMotion: boolean
}): JSX.Element {
  const ref = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => (s.size.height > 0 ? s.size.width / s.size.height : 16 / 9))
  const last = useRef<string | null>(null)
  const { shot, focus, ringLayer } = directive
  const labels = directive.labels !== 'off'
  const layoutKey = `${layout.n}|${layout.slots.join()}|${layout.toy}`
  const framing = `${shot}|${focus === 'pawls' ? 'pawls' : ''}|${labels}|${ringLayer}|${layoutKey}`

  useEffect(() => {
    const controls = ref.current
    if (!controls) return
    rig.controls = controls
    const s = frameShot(shot, layout, { aspect, fov: CAMERA_FOV, focus, labels, ringLayer })
    // Fly only when the framing itself changed; the first shot and a resize are cuts.
    const animate = !reducedMotion && last.current !== null && last.current !== framing
    last.current = framing
    rig.shot = shot
    rig.expected = s
    rig.requestedAt = monitor.frames
    rig.settleFrames = null
    void controls.setLookAt(s.position.x, s.position.y, s.position.z, s.target.x, s.target.y, s.target.z, animate)
    markChange()
    invalidate()
    // framing stands for shot, focus, labels, ringLayer and layout
  }, [framing, aspect, reducedMotion, invalidate])

  useEffect(() => {
    // camera-controls sets touch-action: none; keep vertical page scrolling on touch screens.
    gl.domElement.style.touchAction = 'pan-y'
  }, [gl])

  useEffect(() => () => void (rig.controls = null), [])

  useFrame(() => {
    const s = rig.expected
    if (rig.settleFrames !== null || !s) return
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
      maxDistance={320}
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
