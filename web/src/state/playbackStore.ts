/**
 * The only animation clock (PLAN §2.2, §3.2). A press calls play(); usePlaybackClock() — mounted
 * once in App — advances `t` with requestAnimationFrame while playing and idles otherwise.
 * t runs over [0, 1 + hops]: [0,1) is the stepping phase, hop k is live on [1+k, 2+k), and the
 * lamp is lit at 1 + hops. Speed 'instant' and reduced motion jump straight to the end; `gated`
 * pins t at 0 while a bet is pending.
 */

import { useEffect } from 'react'
import { create } from 'zustand'
import { HOP_MS, STEP_MS, type PlaybackStore, type Speed } from '../contracts/machine'
import { isReducedMotion, registerSpeedSink } from './uiStore'

export { HOP_MS, STEP_MS, hopAt, isLit, type PlaybackStore, type Speed } from '../contracts/machine'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Advance t by dtMs of wall time at `speed`: the stepping phase takes STEP_MS, each hop HOP_MS. */
export function advance(t: number, hops: number, dtMs: number, speed: Exclude<Speed, 'instant'>): number {
  const end = 1 + hops
  let time = dtMs * speed
  let x = t
  while (time > 0 && x < end) {
    const unit = x < 1 ? STEP_MS : HOP_MS
    const boundary = x < 1 ? 1 : Math.min(end, Math.floor(x) + 1)
    const need = (boundary - x) * unit
    if (time >= need) {
      x = boundary
      time -= need
    } else {
      x += time / unit
      time = 0
    }
  }
  return Math.min(x, end)
}

export const usePlaybackStore = create<PlaybackStore>()((set, get) => ({
  source: 'machine',
  seq: 0,
  hops: 0,
  t: 0,
  playing: false,
  speed: 1,
  gated: false,

  play: (source, seq, hops) => {
    if (get().gated) return
    const instant = get().speed === 'instant' || isReducedMotion()
    set({ source, seq, hops, t: instant ? 1 + hops : 0, playing: !instant })
  },

  scrub: (t) => {
    if (get().gated) return
    set({ t: clamp(t, 0, 1 + get().hops), playing: false })
  },

  finish: () => {
    if (get().gated) return
    set({ t: 1 + get().hops, playing: false })
  },

  setSpeed: (speed) => {
    set({ speed })
    if (speed === 'instant' && get().playing) get().finish()
  },

  tick: (dtMs) => {
    const { playing, gated, t, hops, speed } = get()
    if (!playing || gated) return
    if (speed === 'instant' || isReducedMotion()) {
      get().finish()
      return
    }
    const next = advance(t, hops, Math.max(0, dtMs), speed)
    set(next >= 1 + hops ? { t: 1 + hops, playing: false } : { t: next })
  },

  setGated: (gated) => {
    set(gated ? { gated, t: 0, playing: false } : { gated })
  },
}))

registerSpeedSink((speed) => usePlaybackStore.getState().setSpeed(speed))

/** Longest frame step fed to tick(), so a backgrounded tab does not jump the animation. */
const MAX_FRAME_MS = 250

/** Mount once, in App: drives tick() with requestAnimationFrame while playing, idle otherwise. */
export function usePlaybackClock(): void {
  useEffect(() => {
    let raf = 0
    let last = 0
    const frame = (now: number) => {
      const state = usePlaybackStore.getState()
      if (!state.playing) {
        raf = 0
        return
      }
      if (last !== 0) state.tick(Math.min(MAX_FRAME_MS, now - last))
      last = now
      raf = requestAnimationFrame(frame)
    }
    const wake = () => {
      if (raf === 0 && usePlaybackStore.getState().playing) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    const unsubscribe = usePlaybackStore.subscribe(wake)
    wake()
    return () => {
      unsubscribe()
      if (raf !== 0) cancelAnimationFrame(raf)
      raf = 0
    }
  }, [])
}
