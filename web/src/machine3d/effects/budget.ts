/**
 * The effects' frame budget. PerformanceMonitor (index.tsx) drops the effects when the frame rate
 * falls, but with a demand frame loop it can only trust rates measured while frames come back to
 * back (monitor.ts isRenderingContinuously: 20 frames within 2 s), so a renderer too slow for even
 * 10 frames a second — software WebGL, a weak GPU — would keep Bloom for good. The budget watches
 * the same thing from the other side: frames that were asked for while the previous one was being
 * drawn (an animation), and gives Bloom up once RUN of them in a row each took longer than SLOW_MS.
 * PURE, unit-tested.
 */

/** Longer than this between two animation frames is slow (under 20 frames a second). */
export const SLOW_MS = 50
/** This many slow animation frames in a row give Bloom up. */
export const RUN = 4

export class FrameBudget {
  private last: number | null = null
  private slow = 0

  /**
   * Called once per rendered frame at time `now` (ms); `pending` says whether another frame was
   * already asked for (the scene animates). Returns true once the effects should be dropped.
   */
  frame(now: number, pending: boolean): boolean {
    if (this.last !== null) this.slow = now - this.last > SLOW_MS ? this.slow + 1 : 0
    else this.slow = 0
    this.last = pending ? now : null
    return this.slow >= RUN
  }
}

/** Software rasterizers (SwiftShader, llvmpipe): no multisampling in the composer. */
export function isSoftwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software/i.test(name)
}
