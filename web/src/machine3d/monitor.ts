/**
 * Frame accounting for the demand frame loop (PLAN §2.6, brief 06 stats):
 *  - markChange() is called for everything that legitimately needs a frame: store updates, camera
 *    moves, resizes, highlight pulses;
 *  - every rendered frame is counted, and counted as idle when nothing changed for > IDLE_MS;
 *  - renderer info is reset at the start of each frame (autoReset off), so calls and triangles
 *    cover the whole frame even when a composer renders several passes.
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

export const IDLE_MS = 1000

interface Monitor {
  frames: number
  framesWhileIdle: number
  lastChange: number
  /** Timestamps of the latest frames. */
  stamps: number[]
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now())

export const monitor: Monitor = { frames: 0, framesWhileIdle: 0, lastChange: now(), stamps: [] }

export function markChange(): void {
  monitor.lastChange = now()
}

export function resetMonitor(): void {
  monitor.frames = 0
  monitor.framesWhileIdle = 0
  monitor.lastChange = now()
  monitor.stamps = []
}

const RECENT = 20

/** Whether the latest frames came back to back (an animation), rather than on demand after idle gaps. */
export function isRenderingContinuously(): boolean {
  const s = monitor.stamps
  return s.length >= RECENT && s[s.length - 1]! - s[s.length - RECENT]! < 2000 && now() - s[s.length - 1]! < 500
}

/** Milliseconds since the last change. */
export function idleMs(): number {
  return now() - monitor.lastChange
}

/** Mount once inside the Canvas. */
export function useFrameMonitor(): void {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])
  useEffect(() => markChange(), [size.width, size.height, dpr])
  useFrame(() => {
    gl.info.reset()
    monitor.frames++
    monitor.stamps.push(now())
    if (monitor.stamps.length > RECENT) monitor.stamps.shift()
    if (idleMs() > IDLE_MS) monitor.framesWhileIdle++
  }, -1000)
}
