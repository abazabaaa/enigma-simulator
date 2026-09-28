/**
 * Post-processing, in its own lazily loaded chunk (PLAN §2.6, brief 11): index.tsx lazy-loads this
 * module inside the Canvas and unmounts it when the PerformanceMonitor reports a decline.
 *  - <Bloom mipmapBlur luminanceThreshold={1}>: only what is brighter than 1 blooms — the live
 *    wire, its head, the lit reflector pair and plug cables and the lit lamp (emissive > 1,
 *    toneMapped false); lit metal and the ghost stay below the threshold.
 *  - The composer renders in linear HDR with the renderer's tone mapping off, so a final
 *    <ToneMapping> (ACES filmic, the renderer's default) keeps the scene's look.
 *  - Not under reduced motion: the glow is decoration, and the plain renderer draws the same state.
 *  - Only where the renderer can afford it. A software rasterizer (SwiftShader, llvmpipe) gets none:
 *    each Bloom frame costs it about as much as the scene itself. On a GPU, a frame budget
 *    (budget.ts) gives Bloom up for the session after a run of slow animation frames — which the
 *    demand frame loop hides from the PerformanceMonitor on very slow renderers.
 *  - e2e: window.__machine3dSignal.forceBloom(true) mounts it anyway (signal/effectsState.ts).
 * The composer renders only when the demand frame loop asks. Mounting renders a few warm-up frames
 * (the composer builds its passes and compiles its shaders over them) and unmounting one frame
 * without it; each counts as a change, so none of them is an idle frame, however slow.
 */

import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { usePlaybackStore } from '../../state/playbackStore'
import { useReducedMotion } from '../../state/uiStore'
import { markChange } from '../monitor'
import { effectsState, useEffectsSwitch } from '../signal/effectsState'
import { FrameBudget, isSoftwareRenderer } from './budget'

/**
 * luminanceThreshold 1 with a wide soft knee: the pass keeps a pixel's whole colour, weighted by
 * smoothstep(1, 1 + smoothing, luminance). The core's lights put the white ring bands near 1.5
 * (weight ≈ 0.16), the live wire (emissive 5) near 4 and the lit lamp near 2.5: the wire and the lamp
 * glow, lit metal barely does.
 */
export const BLOOM = { luminanceThreshold: 1, luminanceSmoothing: 2, mipmapBlur: true, intensity: 0.75, radius: 0.7 }

const WARM_FRAMES = 3
/** Before the frame monitor (monitor.ts, priority −1000), so a warm-up frame is never counted idle. */
const BEFORE_MONITOR = -1001

/** Set once the frame budget gave Bloom up: no Bloom for the rest of the session. */
let tooSlow = false

function rendererName(gl: RootState['gl']): string {
  try {
    const ctx = gl.getContext()
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
  } catch {
    return ''
  }
}

function Bloomed({ software, onSlow }: { software: boolean; onSlow: (() => void) | null }): JSX.Element {
  const invalidate = useThree((s) => s.invalidate)
  const warm = useRef(0)
  const budget = useRef(new FrameBudget())

  useEffect(() => {
    Object.assign(effectsState, {
      bloom: true,
      luminanceThreshold: BLOOM.luminanceThreshold,
      mipmapBlur: BLOOM.mipmapBlur,
    })
    markChange()
    invalidate()
    return () => {
      Object.assign(effectsState, { bloom: false, luminanceThreshold: null, mipmapBlur: null })
      markChange()
      invalidate()
    }
  }, [invalidate])

  useFrame((state) => {
    if (warm.current < WARM_FRAMES) {
      // Warm-up frames compile shaders: they count as changes, not against the budget.
      warm.current++
      markChange()
      invalidate()
      return
    }
    if (!onSlow) return
    // Another frame is already asked for (a camera flight, a highlight pulse) or the playback plays.
    const pending = state.internal.frames > 1 || usePlaybackStore.getState().playing
    if (budget.current.frame(performance.now(), pending)) onSlow()
  }, BEFORE_MONITOR)

  return (
    <EffectComposer multisampling={software ? 0 : 4}>
      <Bloom
        mipmapBlur={BLOOM.mipmapBlur}
        luminanceThreshold={BLOOM.luminanceThreshold}
        luminanceSmoothing={BLOOM.luminanceSmoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
      />
      <ToneMapping />
    </EffectComposer>
  )
}

export default function Effects(): JSX.Element | null {
  const reduced = useReducedMotion()
  const gl = useThree((s) => s.gl)
  const software = useMemo(() => isSoftwareRenderer(rendererName(gl)), [gl])
  const force = useEffectsSwitch((s) => s.force)
  const [slow, setSlow] = useState(tooSlow)
  effectsState.software = software
  const on = !reduced && (force ?? (!software && !slow))
  if (!on) return null
  return (
    <Bloomed
      software={software}
      onSlow={
        force
          ? null
          : () => {
              tooSlow = true
              effectsState.dropped = true
              setSlow(true)
            }
      }
    />
  )
}
