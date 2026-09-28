/**
 * toy-trace: two held rotors on the toy, the trace (one row per hop, synced to the playback clock) and the playback
 * bar. The bet asks which letter reaches the reflector when A is pressed; then the learner scrubs back into the
 * reflector's hop and presses keys of their own.
 */

import { useEffect, useRef, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { hopAt } from '../../../contracts/machine'
import { Mono, useRevealFired } from '../../../lesson'
import { toyPress } from '../../../lib/toy'
import { Announcer, PlaybackBar, TracePanel } from '../../../machine-ui'
import { usePlaybackStore } from '../../../state/playbackStore'
import { useToyStore } from '../../../state/toyStore'
import { TOY_TRACE_KEY, TOY_TWO, reflectorHop } from '../gates'
import { PRESSES } from './ToyWire'
import { ToyMachine } from './ToyControls'

/** The press the bet is about: key A on TOY_TWO (constant, from lib/toy). */
export const TOY_TRACE_PRESS = toyPress(TOY_TWO, TOY_TRACE_KEY)
/** Its reflector hop: the bet's truth is the letter that enters it. */
export const TOY_TRACE_REFLECTOR = TOY_TRACE_PRESS.hops[reflectorHop(TOY_TRACE_PRESS.hops)]!

const HOP_NAME = (stage: string) => (stage === 'reflector' ? 'reflector' : `${stage.split('-')[1]} rotor${stage.endsWith('-bwd') ? ' (back)' : ''}`)

export function ToyTraceView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('toy-path')
  const seq = useToyStore((s) => s.seq)
  const base = useRef(seq)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('toy-path').resolve(TOY_TRACE_REFLECTOR.input)
  }, [fired, bet])

  const presses = seq - base.current
  useEffect(() => {
    if (presses >= PRESSES) completeTask('press3')
  }, [presses, completeTask])

  // scrub-reflector: the playback of a toy press, stopped by the learner inside the reflector's hop.
  useEffect(
    () =>
      usePlaybackStore.subscribe((s) => {
        if (s.source !== 'toy' || s.playing || s.gated || s.hops === 0 || s.t >= 1 + s.hops) return
        const last = useToyStore.getState().last
        if (!last || s.seq !== useToyStore.getState().seq) return
        if (hopAt(s.t, s.hops) === reflectorHop(last.hops)) completeTask('scrub-reflector')
      }),
    [completeTask],
  )

  const letters = TOY_TRACE_PRESS.hops.filter((h) => h.kind !== 'plugboard')
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="toy-trace-view">
      <p>
        Two rotors now: the current crosses the right rotor, then the middle one, turns in the reflector and crosses both again.
        The trace lists every hop and lights each row as the current passes; the playback bar replays a press slowly or stops it
        anywhere.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ToyMachine>
          <Announcer />
        </ToyMachine>
        <div className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
          <PlaybackBar />
          <TracePanel source="toy" />
        </div>
      </div>
      {fired ? (
        <p data-testid="toy-trace-result" className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
          Key <Mono>{TOY_TRACE_KEY}</Mono>
          {letters.map((h, k) => (
            <span key={k}>
              {' '}
              → {HOP_NAME(h.stage)} <Mono>{h.output}</Mono>
            </span>
          ))}
          . <Mono>{TOY_TRACE_REFLECTOR.input}</Mono> entered the reflector. Now drag the playback bar back until the reflector&apos;s
          row is the last one lit, and press three keys of your own.
        </p>
      ) : (
        <p>
          Bet first, then press <Mono>{TOY_TRACE_KEY}</Mono>.
        </p>
      )}
    </div>
  )
}
