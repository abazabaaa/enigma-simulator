/**
 * step-first (worked): the bet on the first key press at AAA (any key fires the reveal: every key is unlocked once
 * the bet is committed), then a worked example of "step first, then encipher", and one more press of the learner's
 * own.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { ROTORS } from '../../../engine'
import { START, movedChoice, stepsFrom, turnoversOf } from '../gates'
import { PressLog, usePressLog } from './PressLog'

/** What the first press from AAA does (the bet's truth), from the engine: the same for every key. */
const FIRST = stepsFrom(START, 1)[0]!

/** Where each notch is cut in the ring, against the turnover letter it produces (8 letters on). */
const NOTCHES = START.rotors.map((r) => `${r} at ${ROTORS[r].notches} (turnover ${ROTORS[r].turnovers})`).join(', ')

export function StepFirstView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('first-press')
  const seq = useStore(p.store, (s) => s.seq)
  const log = usePressLog(p.store)
  const [base, setBase] = useState<number | null>(null)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  useEffect(() => {
    if (!fired) return
    if (!resolved.current) {
      resolved.current = true
      bet('first-press').resolve(movedChoice(FIRST))
    }
    if (base === null) setBase(seq)
  }, [fired, base, seq, bet])

  const pressedAgain = base !== null && seq > base
  useEffect(() => {
    if (pressedAgain) completeTask('press1')
  }, [pressedAgain, completeTask])

  const right = START.rotors[2]!
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="step-first-view">
      <p>
        Rotors <Mono>{START.rotors.join(' ')}</Mono>, rings <Mono>01 01 01</Mono>, windows <Mono>AAA</Mono>. On the stage each rotor has
        a pawl on its right-hand side and a notch cut into its alphabet ring. Bet first, then press any key.
      </p>
      <p data-testid="notch-offset">
        The stage draws each notch where it is cut in the ring: {NOTCHES}. The pawl meets the ring 8 letters away from the
        window, so a notch sits under its pawl exactly when the window shows the turnover letter.
      </p>
      {fired ? (
        <section data-testid="step-first-worked" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <h3 className="font-semibold text-stone-100">Worked example: one key press</h3>
          <ol className="list-decimal pl-5">
            <li>
              <strong>Step.</strong> Your key {log[0] ? <Mono>{log[0].key}</Mono> : null} pushed the pawls. The right pawl always catches the right rotor:{' '}
              <Mono>
                {FIRST.before} → {FIRST.after}
              </Mono>
              . The middle pawl rests on the right rotor&apos;s ring and drops into its notch only at the turnover letter{' '}
              <Mono>{turnoversOf(right)}</Mono> of rotor {right}; the window showed <Mono>A</Mono>, so the middle rotor stayed.
            </li>
            <li>
              <strong>Then the current.</strong> Only now does the current flow, through the rotors at <Mono>{FIRST.after}</Mono>. The
              trace lists every hop, and its first row shows the step.
            </li>
          </ol>
          <p>
            In Rejewski&apos;s notation the right rotor turned one place is its wiring N moved round by P, the shift of the whole
            alphabet by one place. Step first, then read: even the very first letter of a message is enciphered one place on.
          </p>
          <p>Now press another key of your own: the right rotor steps again.</p>
        </section>
      ) : null}
      <PressLog entries={log} />
    </div>
  )
}
