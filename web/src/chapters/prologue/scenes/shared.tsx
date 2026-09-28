/**
 * What the Prologue's first scene and the home page share: the lid slider (the case opens under the learner's
 * hand, in 3D and in the 2D view) and the paper tape's round trip (type a word, rewind, type the ciphertext: the
 * word comes back).
 */

import { useEffect, useId, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../../../contracts/machine'
import type { StageDirective } from '../../../contracts/stage'
import { groups5 } from '../../../machine-ui/hooks'
import { roundtripDone, type Tape } from '../gates'

export type Lid = StageDirective['lid']
export const LIDS: readonly Lid[] = ['closed', 'open', 'cutaway']
const LID_TEXT: Readonly<Record<Lid, string>> = {
  closed: 'Lid closed',
  open: 'Lid open: the rotors show',
  cutaway: 'Cut away: the wiring shows',
}

/** A range over closed → open → cut away (data-testid lid-slider). */
export function LidSlider({ value, onChange }: { value: Lid; onChange(lid: Lid): void }): JSX.Element {
  const id = useId()
  const k = LIDS.indexOf(value)
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
      <label htmlFor={id}>Open the case</label>
      <input
        id={id}
        type="range"
        min={0}
        max={LIDS.length - 1}
        step={1}
        value={k}
        data-testid="lid-slider"
        data-lid={value}
        aria-valuetext={LID_TEXT[value]}
        onChange={(e) => onChange(LIDS[Number(e.target.value)] ?? 'closed')}
        className="w-40 accent-amber-300"
      />
      <span aria-hidden="true" className="text-stone-400">
        {LID_TEXT[value]}
      </span>
    </div>
  )
}

export interface Roundtrip {
  /** The word came back: an earlier tape's output was typed and lit that tape's input. */
  readonly done: boolean
  /** Tapes cleared since the view mounted, oldest first. */
  readonly earlier: readonly Tape[]
  readonly current: Tape
}

/** Watch `store`'s paper tape: every cleared tape is remembered, and the current one is compared with them. */
export function useRoundtrip(store: MachineStoreHook): Roundtrip {
  const current = useStore(store, useShallow((s) => ({ input: s.input, output: s.output })))
  const [earlier, setEarlier] = useState<readonly Tape[]>([])
  const [done, setDone] = useState(false)
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.input === '' && prev.input !== '') setEarlier((e) => [...e, { input: prev.input, output: prev.output }].slice(-8))
      }),
    [store],
  )
  const now = roundtripDone(earlier, current)
  useEffect(() => {
    if (now) setDone(true)
  }, [now])
  return { done: done || now, earlier, current }
}

/** What the round trip asks for next, and (once done) the word that came back. */
export function RoundtripNote({ trip, testId = 'roundtrip' }: { trip: Roundtrip; testId?: string }): JSX.Element {
  const last = trip.earlier.at(-1)
  let text: string
  if (trip.done) {
    const word = trip.earlier.find((t) => t.output === trip.current.input)?.input ?? trip.current.output
    text = `You typed the ciphertext and got ${groups5(word)} back: from the same start, the machine undoes itself.`
  } else if (last && last.input.length > 0 && trip.current.input === '') {
    text = `Now type the ciphertext ${groups5(last.output)} from the tape, and watch the output.`
  } else if (trip.current.input.length > 0) {
    text = 'When your word is on the tape, press “Clear and rewind” to start the machine from the same windows again.'
  } else {
    text = 'Type a word: the tape keeps what you typed (in) and what lit (out).'
  }
  return (
    <p data-testid={testId} data-done={String(trip.done)} className={trip.done ? 'text-emerald-300' : 'text-stone-300'}>
      {text}
    </p>
  )
}
