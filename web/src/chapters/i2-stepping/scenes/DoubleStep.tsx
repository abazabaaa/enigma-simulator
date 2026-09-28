/**
 * double-step: from ADU (rotors I II III), three bets gate three Step reveals (key A, lamps hidden). Each reveal
 * explains its press; the double step is the third. The task is reaching BFX.
 */

import { useEffect, useRef, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { positionsToString, type RotorName } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { usePlaybackStore } from '../../../state/playbackStore'
import { DOUBLE_START, movedChoice, stepsFrom, turnoversOf } from '../gates'
import { PressLog, usePressLog } from './PressLog'

/** The three presses from ADU, from the engine: ADV, AEW, BFX. */
export const DOUBLE_SEQUENCE = stepsFrom(DOUBLE_START, 3)
export const DOUBLE_BETS = ['adu', 'adv', 'aew'] as const

const [LEFT, MIDDLE, RIGHT] = DOUBLE_START.rotors as [RotorName, RotorName, RotorName]

function Explain({ k }: { k: number }): JSX.Element {
  const s = DOUBLE_SEQUENCE[k]!
  const head = (
    <Mono>
      {s.before} → {s.after}
    </Mono>
  )
  if (k === 0) {
    return (
      <p>
        {head}: only the right rotor moved. It now shows <Mono>{s.after[2]}</Mono>, the turnover letter of rotor {RIGHT}: its notch now
        sits under the middle pawl.
      </p>
    )
  }
  if (k === 1) {
    return (
      <p>
        {head}: the right rotor left its turnover letter and its notch carried the middle rotor, <Mono>{s.before[1]}</Mono> →{' '}
        <Mono>{s.after[1]}</Mono>. But <Mono>{s.after[1]}</Mono> is the turnover letter of rotor {MIDDLE}: the middle rotor&apos;s own
        notch now sits under the left pawl.
      </p>
    )
  }
  return (
    <p>
      {head}: <strong>the double step.</strong> The left pawl dropped into the middle rotor&apos;s notch and pushed on it, so the left
      rotor moved (<Mono>{s.before[0]}</Mono> → <Mono>{s.after[0]}</Mono>) and the middle rotor moved again (<Mono>{s.before[1]}</Mono> →{' '}
      <Mono>{s.after[1]}</Mono>), on its second press in a row. The right rotor stepped as always.
    </p>
  )
}

export function DoubleStepView(p: SceneProps): JSX.Element {
  const fired = [useRevealFired('adu'), useRevealFired('adv'), useRevealFired('aew')]
  const count = fired.filter(Boolean).length
  const windows = useStore(p.store, (s) => positionsToString(s.machine))
  const log = usePressLog(p.store)
  const resolved = useRef(new Set<string>())
  const { completeTask, bet, store } = p

  // Each bet's truth is what the machine does on that press from ADU (constant: the engine's sequence).
  useEffect(() => {
    DOUBLE_BETS.forEach((id, k) => {
      if (!fired[k] || resolved.current.has(id)) return
      resolved.current.add(id)
      bet(id).resolve(movedChoice(DOUBLE_SEQUENCE[k]!))
    })
  })

  // When the learner starts the next bet the playback is gated (t pinned at 0), and every window display
  // would fall back to the previous press's `before`. Settle the machine at its current windows first.
  useEffect(
    () =>
      usePlaybackStore.subscribe((s, prev) => {
        if (!s.gated || prev.gated) return
        const m = store.getState()
        if (m.last) m.setConfig(m.snapshot())
      }),
    [store],
  )

  const reached = count === 3 && windows === DOUBLE_SEQUENCE[2]!.after
  useEffect(() => {
    if (reached) completeTask('reach-bfx')
  }, [reached, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="double-step-view">
      <p>
        Rotors <Mono>{DOUBLE_START.rotors.join(' ')}</Mono>, rings <Mono>01 01 01</Mono>, windows <Mono>{DOUBLE_START.positions.join('')}</Mono>
        . Turnover letters: {LEFT} <Mono>{turnoversOf(LEFT)}</Mono>, {MIDDLE} <Mono>{turnoversOf(MIDDLE)}</Mono>,{' '}
        {RIGHT} <Mono>{turnoversOf(RIGHT)}</Mono>. Each Step presses <Mono>A</Mono> with the lamps hidden: watch the windows,
        the pawls and the notches.
      </p>
      <p className="text-stone-200" data-testid="double-step-now">
        The windows show <Mono>{windows}</Mono>.{' '}
        {count < 3 ? `Bet on step ${count + 1} of 3, then press it.` : 'All three steps done.'}
      </p>
      <ol className="flex flex-col gap-2" data-testid="double-step-explained">
        {DOUBLE_BETS.map((id, k) =>
          fired[k] ? (
            <li key={id} className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
              <Explain k={k} />
            </li>
          ) : null,
        )}
      </ol>
      {count === 3 ? (
        <div className="flex flex-col gap-2">
          <p>
            The middle rotor moved on two presses in a row: that is the double step, and it happens every time the right rotor carries
            the middle rotor onto its own turnover letter.
          </p>
          <div>
            <button type="button" className={QUIET_BUTTON} data-testid="double-step-restart" onClick={() => store.getState().setConfig(DOUBLE_START)}>
              Back to {DOUBLE_START.positions.join('')}
            </button>
          </div>
        </div>
      ) : null}
      <PressLog entries={log} />
    </div>
  )
}
