/**
 * The 3D Enigma (PLAN §2.6, brief 06): default export ComponentType<StageViewProps>, lazy-loaded by
 * StageHost. All geometry is procedural (1 unit = 1 cm).
 *  - <Canvas frameloop="demand" dpr={[1, 1.5]}>: a frame is rendered only when something changes;
 *    the canvas is aria-hidden (the DOM machine is the accessible surface).
 *  - It reads the machine (or toy) store, the playback clock and the stage store once, here, and
 *    both renders and reports (onReport) from that snapshot, so the report is what is shown.
 *  - window.__stage.stats(): renderer calls, triangles, geometries, textures and framesWhileIdle.
 *  - A lost WebGL context or a failed shader calls onError: StageHost switches to the 2D view for
 *    the session. Only while mounted: the context R3F loses on purpose when the view unmounts (a
 *    scene change) is not a failure.
 *  - PerformanceMonitor lowers the pixel ratio and drops the effects chunk (PR 11) on a decline.
 *  - The effects chunk is fetched only when Bloom can mount (effectsPolicy.ts, PR 17): not under reduced motion,
 *    not on a software rasterizer (unless the e2e switch forces it), not after a decline.
 */

import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { StageViewProps } from '../contracts/stage'
import type { Letter } from '../engine'
import { useMachineApi } from '../state/activeMachine'
import { useToyStore } from '../state/toyStore'
import { isSoftwareRenderer } from './effects/budget'
import { shouldLoadEffects } from './effectsPolicy'
import { isRenderingContinuously, resetMonitor } from './monitor'
import { Machine3DScene } from './Scene'
import { CAMERA_FOV, frameShot } from './shots'
import { effectsState, useEffectsSwitch } from './signal/effectsState'
import { buildReport, useStageView } from './useStageView'

const Effects = lazy(() => import('./effects'))

const GL = { antialias: true } as const

function gpuString(root: RootState): string {
  const ctx = root.gl.getContext()
  const ext = ctx.getExtension('WEBGL_debug_renderer_info')
  return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
}

export default function Machine3DView({ directive, reducedMotion, onReport, onError }: StageViewProps): JSX.Element {
  const api = useMachineApi()
  const state = useStageView(directive.source)
  const [gpu, setGpu] = useState<string | null>(null)
  const [dpr, setDpr] = useState<number | [number, number]>([1, 1.5])
  const [effects, setEffects] = useState(true)
  const force = useEffectsSwitch((s) => s.force)
  const software = gpu === null ? null : isSoftwareRenderer(gpu)
  if (software !== null) effectsState.software = software
  const loadEffects = shouldLoadEffects({
    reduced: reducedMotion,
    software,
    force,
    declined: !effects,
    dropped: effectsState.dropped,
  })
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  // Errors count only while this view is mounted: after unmount R3F tears the renderer down with
  // forceContextLoss(), and that loss must not send the session to 2D.
  const mounted = useRef(true)
  const detach = useRef<(() => void) | null>(null)
  const fail = useCallback((e: Error) => {
    if (mounted.current) onErrorRef.current(e)
  }, [])

  // A layout-effect cleanup: React runs it (parent first) before the Canvas's own, which starts R3F's
  // teardown; a passive cleanup would come after that loss.
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      detach.current?.()
      detach.current = null
    }
  }, [])
  useEffect(() => resetMonitor(), [])

  const report = gpu === null ? null : buildReport(state, directive, gpu)
  const reportKey = report ? JSON.stringify(report) : ''
  useEffect(() => {
    if (report) onReport(report)
    // reportKey stands for report
  }, [reportKey, onReport])

  const onCreated = useCallback(
    (root: RootState) => {
      const canvas = root.gl.domElement
      const lost = () => fail(new Error('The WebGL context was lost'))
      canvas.addEventListener('webglcontextlost', lost, { once: true })
      detach.current?.()
      detach.current = () => canvas.removeEventListener('webglcontextlost', lost)
      // A shader that fails to compile is not a React error: hand it to StageHost too (and keep three
      // from logging it as a console error; StageHost warns instead).
      root.gl.debug.onShaderError = () => fail(new Error('A WebGL shader failed to compile'))
      setGpu(gpuString(root))
    },
    [fail],
  )

  const { interactive, source } = directive
  const onPress = useCallback(
    (letter: Letter) => {
      const store = api.getState()
      if (!interactive || store.locks.keyboard) return
      if (source === 'toy') useToyStore.getState().press(letter)
      else store.pressKey(letter)
    },
    [api, interactive, source],
  )

  // The first shot only (CameraRig re-fits it to the measured canvas and owns the camera from then on).
  const initialShot = useRef(frameShot(directive.shot, state.view.layout, { aspect: 16 / 9 })).current
  const camera = useMemo(
    () => ({
      fov: CAMERA_FOV,
      near: 1,
      far: 600,
      position: [initialShot.position.x, initialShot.position.y, initialShot.position.z] as [number, number, number],
    }),
    [initialShot],
  )

  const onDecline = useCallback(() => {
    // With a demand frame loop, gaps between frames are idle time, not slowness.
    if (!isRenderingContinuously()) return
    setDpr(1)
    setEffects(false)
  }, [])
  const onFallback = useCallback(() => {
    setDpr(1)
    setEffects(false)
  }, [])

  return (
    <div
      aria-hidden="true"
      data-testid="machine3d"
      className="relative h-[min(68vh,560px,max(20rem,90vw))] min-h-80 w-full"
    >
      <Canvas frameloop="demand" dpr={dpr} gl={GL} camera={camera} onCreated={onCreated}>
        <Machine3DScene
          directive={directive}
          reducedMotion={reducedMotion}
          state={state}
          onPress={interactive && !state.keyboardLocked ? onPress : undefined}
        />
        <PerformanceMonitor flipflops={3} onDecline={onDecline} onFallback={onFallback} />
        {loadEffects ? (
          <Suspense fallback={null}>
            <Effects />
          </Suspense>
        ) : null}
      </Canvas>
    </div>
  )
}
