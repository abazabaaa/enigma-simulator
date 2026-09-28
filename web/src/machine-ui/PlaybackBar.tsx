/**
 * Playback controls (PLAN §3.10) over the one animation clock:
 *  - playback-play: replay the last press from the start (Pause while playing, Resume when paused);
 *  - playback-scrub: a range over t ∈ [0, 1 + hops] that writes only t;
 *  - playback-speed: 0.25×–4× or instant.
 * Disabled while a bet is pending (playback.gated). Under reduced motion every press shows at once.
 */

import { useId, type JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Speed } from '../contracts/machine'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useToyStore } from '../state/toyStore'
import { useReducedMotion } from '../state/uiStore'
import { phaseOf } from './hooks'

export const SPEEDS: readonly Speed[] = [0.25, 0.5, 1, 2, 4, 'instant']

/** What the scrubber's position means, for aria-valuetext. */
export function describeT(t: number, hops: number): string {
  if (hops === 0) return 'No key pressed yet'
  const phase = phaseOf(t, hops)
  if (phase < 0) return 'Rotors stepping'
  if (phase >= hops) return 'Lamp lit'
  return `Hop ${phase + 1} of ${hops}`
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
