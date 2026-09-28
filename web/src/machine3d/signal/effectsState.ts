/**
 * The effects chunk's state (effects/index.tsx), kept here in the 3D chunk so the e2e debug hook can
 * read it — and switch Bloom on or off — without importing the effects chunk.
 */

import { create } from 'zustand'

export interface EffectsState {
  /** An EffectComposer with Bloom is mounted. */
  bloom: boolean
  luminanceThreshold: number | null
  mipmapBlur: boolean | null
  /** The effects' frame budget gave Bloom up for the session (effects/budget.ts). */
  dropped: boolean
  /** The renderer is a software rasterizer (SwiftShader, llvmpipe): no Bloom unless forced. */
  software: boolean
}

export const effectsState: EffectsState = {
  bloom: false,
  luminanceThreshold: null,
  mipmapBlur: null,
  dropped: false,
  software: false,
}

/**
 * e2e only (window.__machine3dSignal.forceBloom): true mounts Bloom whatever the renderer and the
 * budget say (not under reduced motion), false keeps it off, null restores the normal rules.
 */
export const useEffectsSwitch = create<{ force: boolean | null }>()(() => ({ force: null }))
