/**
 * toy-wire (worked): the circuit built up from a battery and a bulb to the toy on the stage (one rotor and a
 * reflector, held), then a bet on the lamp of key C, the press that reveals it, and three presses of the learner's own.
 */

import { useEffect, useRef, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { Announcer } from '../../../machine-ui'
import { useToyStore } from '../../../state/toyStore'
import { TOY_ONE, TOY_WIRE_KEY, TOY_WIRE_PRESS } from '../gates'
import { CircuitBuild } from './CircuitBuild'
import { useStageKeysOff } from './stage'
import { ToyMachine } from './ToyControls'

/** Presses in this visit that complete `press3`. */
export const PRESSES = 3

export function ToyWireView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('toy-lamp')
  const seq = useToyStore((s) => s.seq)
  const base = useRef(seq)
  const resolved = useRef(false)
  const { completeTask, bet } = p
  // Until C has been pressed, C is the only key (on the stage, no key at all).
  useStageKeysOff('toy', !fired)

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('toy-lamp').resolve(TOY_WIRE_PRESS.lamp)
  }, [fired, bet])

  const presses = seq - base.current
  useEffect(() => {
    if (presses >= PRESSES) completeTask('press3')
  }, [presses, completeTask])

  const [into, back] = [TOY_WIRE_PRESS.hops[1]!, TOY_WIRE_PRESS.hops[3]!]
  const reflect = TOY_WIRE_PRESS.hops[2]!
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="toy-wire-view">
      <CircuitBuild spec={TOY_ONE} />
      <ToyMachine only={fired ? null : TOY_WIRE_KEY}>
        <Announcer />
      </ToyMachine>
      {fired ? (
        <p data-testid="toy-wire-result" className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
          Key <Mono>{TOY_WIRE_KEY}</Mono>: the rotor&apos;s wire took it to <Mono>{into.output}</Mono>, the reflector
          swapped <Mono>{reflect.input}</Mono> for <Mono>{reflect.output}</Mono>, and the rotor carried{' '}
          <Mono>{back.input}</Mono> back to lamp <Mono>{back.output}</Mono>. Follow the lit path on the stage. Now press
          keys of your own and follow each one.
        </p>
      ) : (
        <p>
          Bet first, then press <Mono>{TOY_WIRE_KEY}</Mono> on the toy&apos;s keyboard.
        </p>
      )}
    </div>
  )
}
