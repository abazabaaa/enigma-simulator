/**
 * Whether the 3D view loads and mounts the effects chunk (Bloom; effects/index.tsx). PURE, unit-tested.
 * The chunk is only fetched when Bloom can actually mount (PR 17): never under reduced motion, never on a software
 * rasterizer (SwiftShader, llvmpipe) or before the renderer is known, never after the PerformanceMonitor declined or
 * the frame budget gave Bloom up for the session — unless the e2e switch forces it (still not under reduced motion).
 * effects/index.tsx applies the same rules again, so a forced or late change never shows Bloom where it should not.
 */

export interface EffectsInputs {
  /** Reduced motion is on (the glow is decoration). */
  readonly reduced: boolean
  /** The renderer is a software rasterizer; null until the WebGL context exists. */
  readonly software: boolean | null
  /** e2e switch (window.__machine3dSignal.forceBloom): true mounts, false keeps off, null follows the rules. */
  readonly force: boolean | null
  /** The PerformanceMonitor declined (index.tsx drops the effects for this view). */
  readonly declined: boolean
  /** The effects' frame budget gave Bloom up for the session (effectsState.dropped). */
  readonly dropped: boolean
}

export function shouldLoadEffects(i: EffectsInputs): boolean {
  if (i.reduced || i.declined || i.software === null) return false
  if (i.force !== null) return i.force
  return !i.software && !i.dropped
}
