/**
 * Playback controls (PLAN §3.10) over the one animation clock:
 *  - playback-play: replay the last press from the start (Pause while playing, Resume when paused);
 *  - playback-prev-hop / playback-next-hop ('[' and ']'): pause and step the clock one stop back or
 *    on. The stops are the stepping phase (t = 0.5), the middle of each hop k (t = 1.5 + k, where
 *    hopAt = k) and the lit lamp (t = 1 + hops). They move t with the store's scrub(), like the range;
 *  - playback-scrub: a range over t ∈ [0, 1 + hops] that writes only t;
 *  - playback-speed: 0.25×–4× or instant.
 * Disabled while a bet is pending (playback.gated) or when no press is on show. Under reduced motion
 * every press shows at once.
 */

import { useLayoutEffect, useId, type JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Speed } from '../contracts/machine'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useToyStore } from '../state/toyStore'
import { useReducedMotion } from '../state/uiStore'
import { phaseOf } from './hooks'
import { isTextEntry } from './Keyboard'

export const SPEEDS: readonly Speed[] = [0.25, 0.5, 1, 2, 4, 'instant']

/** What the scrubber's position means, for aria-valuetext. */
export function describeT(t: number, hops: number): string {
  if (hops === 0) return 'No key pressed yet'
  const phase = phaseOf(t, hops)
  if (phase < 0) return 'Rotors stepping'
  if (phase >= hops) return 'Lamp lit'
  return `Hop ${phase + 1} of ${hops}`
}

/** The stops of hop stepping: the stepping phase, the middle of each hop, and the lit lamp. */
export function hopStops(hops: number): number[] {
  if (hops <= 0) return []
  return [0.5, ...Array.from({ length: hops }, (_, k) => 1.5 + k), 1 + hops]
}

/** The next stop after t (dir 1) or before it (dir −1), or null at either end. */
export function nextStop(t: number, hops: number, dir: 1 | -1): number | null {
  const stops = hopStops(hops)
  const eps = 1e-6
  return (dir > 0 ? stops.find((s) => s > t + eps) : [...stops].reverse().find((s) => s < t - eps)) ?? null
}

/** The clock's press is still on show (a new setting clears the machine's last press), and no bet is pending. */
function pressOnShow(): boolean {
  const pb = usePlaybackStore.getState()
  if (pb.hops <= 0 || pb.gated) return false
  const store = pb.source === 'toy' ? useToyStore.getState() : useMachineStore.getState()
  return store.last !== null && store.seq === pb.seq
}

/** Pause and move the clock to the previous or next hop stop. Returns whether it moved. */
export function stepHop(dir: 1 | -1): boolean {
  if (!pressOnShow()) return false
  const pb = usePlaybackStore.getState()
  const to = nextStop(pb.t, pb.hops, dir)
  if (to === null) return false
  pb.scrub(to)
  return true
}

/** '[' and ']' step the clock from anywhere but a text field (one listener however many bars). */
let bars = 0
function onKeyDown(e: KeyboardEvent): void {
  // AltGr (Ctrl+Alt) types '[' on some layouts; plain Ctrl/Meta combinations are left alone.
  if (e.defaultPrevented || e.metaKey || (e.ctrlKey && !e.altKey)) return
  if ((e.key !== '[' && e.key !== ']') || isTextEntry(e.target)) return
  if (stepHop(e.key === ']' ? 1 : -1)) e.preventDefault()
}

export function PlaybackBar(): JSX.Element {
  const { source, seq, hops, t, playing, speed, gated } = usePlaybackStore(
    useShallow((s) => ({ source: s.source, seq: s.seq, hops: s.hops, t: s.t, playing: s.playing, speed: s.speed, gated: s.gated })),
  )
  const reduced = useReducedMotion()
  const speedId = useId()
  const scrubId = useId()
  // The clock's press is still on show (a new setting clears the machine's last press).
  const machineShows = useMachineStore((s) => s.last !== null && s.seq === seq)
  const toyShows = useToyStore((s) => s.last !== null && s.seq === seq)
  const end = 1 + hops
  const hasPress = hops > 0 && (source === 'toy' ? toyShows : machineShows)
  const paused = !playing && t > 0 && t < end
  const canStep = hasPress && !gated
  const canPrev = canStep && nextStop(t, hops, -1) !== null
  const canNext = canStep && nextStop(t, hops, 1) !== null

  useLayoutEffect(() => {
    if (++bars === 1) window.addEventListener('keydown', onKeyDown)
    return () => {
      if (--bars === 0) window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const onPlay = () => {
    const pb = usePlaybackStore.getState()
    if (pb.gated || !hasPress) return
    if (pb.playing) pb.scrub(pb.t)
    else if (pb.t > 0 && pb.t < 1 + pb.hops && pb.speed !== 'instant' && !reduced) usePlaybackStore.setState({ playing: true })
    else pb.play(pb.source, pb.seq, pb.hops)
  }

  return (
    <div role="group" aria-label="Playback" data-testid="playback-bar" data-source={source} data-seq={seq} className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-testid="playback-play"
        disabled={!hasPress || gated}
        onClick={onPlay}
        className="w-20 rounded border border-stone-600 px-3 py-1 text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
      >
        {playing ? 'Pause' : paused ? 'Resume' : 'Replay'}
      </button>
      <div className="flex gap-1">
        <button
          type="button"
          data-testid="playback-prev-hop"
          aria-label="Previous hop"
          aria-keyshortcuts="["
          title="Previous hop ( [ )"
          disabled={!canPrev}
          onClick={() => stepHop(-1)}
          className="rounded border border-stone-600 px-2 py-1 text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
        >
          ◀ hop
        </button>
        <button
          type="button"
          data-testid="playback-next-hop"
          aria-label="Next hop"
          aria-keyshortcuts="]"
          title="Next hop ( ] )"
          disabled={!canNext}
          onClick={() => stepHop(1)}
          className="rounded border border-stone-600 px-2 py-1 text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
        >
          hop ▶
        </button>
      </div>
      <label htmlFor={scrubId} className="sr-only">
        Playback position
      </label>
      <input
        id={scrubId}
        type="range"
        data-testid="playback-scrub"
        min={0}
        max={end}
        step={0.01}
        value={Math.min(t, end)}
        disabled={!hasPress || gated}
        aria-valuetext={describeT(t, hops)}
        onChange={(e) => usePlaybackStore.getState().scrub(Number(e.target.value))}
        className="min-w-24 flex-1 accent-amber-300"
      />
      <label htmlFor={speedId} className="text-sm text-stone-300">
        Speed
      </label>
      <select
        id={speedId}
        data-testid="playback-speed"
        value={String(speed)}
        onChange={(e) => {
          const v = e.target.value
          usePlaybackStore.getState().setSpeed(v === 'instant' ? 'instant' : (Number(v) as Speed))
        }}
        className="rounded border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100"
      >
        {SPEEDS.map((s) => (
          <option key={String(s)} value={String(s)}>
            {s === 'instant' ? 'Instant' : `${s}×`}
          </option>
        ))}
      </select>
      {reduced ? <span className="w-full text-xs text-stone-300">Reduced motion: every press is shown at once.</span> : null}
    </div>
  )
}
