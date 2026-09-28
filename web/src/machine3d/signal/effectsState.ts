/**
 * What the lazily loaded effects chunk (effects/index.tsx) has mounted, for the e2e debug hook.
 * It lives here, in the 3D chunk, so the debug hook can read it without importing the effects chunk.
 */

export interface EffectsState {
  /** An EffectComposer with Bloom is mounted. */
  bloom: boolean
  luminanceThreshold: number | null
  mipmapBlur: boolean | null
  /** The effects' frame budget gave Bloom up for the session (effects/budget.ts). */
  dropped: boolean
}

export const effectsState: EffectsState = { bloom: false, luminanceThreshold: null, mipmapBlur: null, dropped: false }
