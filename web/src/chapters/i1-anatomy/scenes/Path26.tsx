/**
 * path-26: the full machine with keys, lamps, the trace and the playback bar (rotors held). A bet on the lamp of Q
 * gates the keyboard; the press reveals it, and the learner then slows the playback down and scrubs through a press.
 */

import { useEffect, useRef, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { usePlaybackStore } from '../../../state/playbackStore'
import { MACHINE, PATH_KEY, traceOf } from '../gates'

/** The press the bet is about: Q on the held machine at SUN (constant, from the engine). */
export const PATH_TRACE = traceOf(MACHINE, PATH_KEY)
export const PATH_LAMP = PATH_TRACE.at(-1)!.output

export function Path26View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('q-lamp')
  const resolved = useRef(false)
  const { completeTask, bet, store } = p

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('q-lamp').resolve(PATH_LAMP)
  }, [fired, bet])

  // speed: the playback speed changed; scrub: a machine press stopped by the learner part-way.
  useEffect(() => {
    const speed = usePlaybackStore.getState().speed
    return usePlaybackStore.subscribe((s, prev) => {
      if (s.speed !== speed && s.speed !== prev.speed) completeTask('speed')
      const m = store.getState()
      const scrubbed = s.t !== prev.t && !s.playing && !s.gated && s.source === 'machine' && s.hops > 0 && s.t < 1 + s.hops
      if (scrubbed && m.last && s.seq === m.seq) completeTask('scrub')
    })
  }, [store, completeTask])

  const changes = PATH_TRACE.filter((h) => h.input !== h.output).length
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="path-26-view">
      <p>
        The same machine, now with its keyboard, lamps and the trace. The rotors are still held, so a key lights the same lamp
        every time.
      </p>
      {fired ? (
        <p data-testid="path-26-result" className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
          <Mono>{PATH_KEY}</Mono> lights <Mono>{PATH_LAMP}</Mono>, changed {changes} times on the way: the trace shows every hop.
          Slow the playback down with the speed menu, press a key, and drag the bar to stop the current anywhere on its path.
        </p>
      ) : (
        <p>
          Bet first, then press <Mono>{PATH_KEY}</Mono>.
        </p>
      )}
    </div>
  )
}
