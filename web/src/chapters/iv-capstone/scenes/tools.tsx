/**
 * The two tool scenes (explore, no stage): each workbench on a fixed practice day, never a gate's day, with a
 * private machine so the course machine is untouched. polish-tools: indicators → products → characteristic →
 * catalogue card → the doubled-key test → cables → the first message. british-tools: crib → menu → the bombe over three
 * wheel orders (in a worker) → the checking machine → the intercept.
 */

import { useMemo, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { createMachineStore } from '../../../state/machineStore'
import {
  BRITISH_CABLES,
  BRITISH_START,
  KNOWN_LETTERS,
  POLISH_CABLES,
  POLISH_START,
  PRACTICE_BRITISH_SEED,
  PRACTICE_POLISH_SEED,
  britishDay,
  polishDay,
} from '../gates'
import { BritishWorkbench, PolishWorkbench } from './workbench'

export function PolishToolsView(p: SceneProps): JSX.Element {
  const day = useMemo(() => polishDay(PRACTICE_POLISH_SEED), [])
  const store = useMemo(() => createMachineStore({ config: POLISH_START, locks: { model: true, reflector: true, rings: true } }), [])
  const { completeTask } = p
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="polish-tools">
      <p>
        A practice day of the doubled-indicator era: Enigma I with reflector A, rotors I, II and III in an unknown order, rings 01,
        6 cables. Every operator typed his three-letter message key twice at the day&apos;s ground setting, so the first six letters
        of every message came from the same six machine positions. Work through the tools in order; nothing here is scored.
      </p>
      <PolishWorkbench
        store={store}
        indicators={day.indicators}
        message={day.cipher}
        known={day.plain.slice(0, KNOWN_LETTERS)}
        maxCables={POLISH_CABLES}
        onCard={(card) => {
          if (card.length) completeTask('open-tools')
        }}
      />
    </div>
  )
}

export function BritishToolsView(p: SceneProps): JSX.Element {
  const day = useMemo(() => britishDay(PRACTICE_BRITISH_SEED), [])
  const store = useMemo(() => createMachineStore({ config: BRITISH_START, locks: { model: true, reflector: true, rings: true } }), [])
  const { completeTask } = p
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="british-tools">
      <p>
        A practice intercept of the wartime procedure: Enigma I with reflector B, three of rotors I–V, rings 01, 10 cables. The
        operator chose a start position and sent it in clear, then his message key enciphered once there, then the body typed from
        the message key. A crib is a stretch of plaintext you expect in the body.
      </p>
      <BritishWorkbench
        store={store}
        crib={day.crib}
        message={day.cipher}
        window={day.window}
        orders={day.orders}
        start={day.start}
        encKey={day.encKey}
        maxCables={BRITISH_CABLES}
        onChecked={() => completeTask('open-tools')}
      />
    </div>
  )
}
