/**
 * type-a-word: the whole machine and one thing to do, type. The bet on the first press (its own letter, another
 * letter, no lamp) gates the keyboard; then five letters, and the round trip on the paper tape. A slider opens
 * the case (the stage's lid), and in 3D the machine turns under a drag.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useProgress, useRevealFired } from '../../../lesson'
import { useItemStage } from '../../../lesson/ui/itemStage'
import { OWN_LETTER_TRUTH } from '../gates'
import { BetPointer, LidSlider, RoundtripNote, useFinishWhenTraceOff, useRoundtrip, type Lid } from './shared'

/** Letters typed in this visit that complete `type5`. */
export const TYPE_TASK_LETTERS = 5

export function TypeAWordView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('own-letter')
  const seq = useStore(p.store, (s) => s.seq)
  const last = useStore(p.store, (s) => s.last)
  const [lid, setLid] = useState<Lid>('closed')
  const [first, setFirst] = useState<{ key: string; lamp: string } | null>(null)
  const base = useRef(seq)
  const resolved = useRef(false)
  const trip = useRoundtrip(p.store)
  const { completeTask, bet } = p
  const committed = useProgress((s) => s.bets[`${p.chapter}/own-letter`] !== undefined)
  useFinishWhenTraceOff()

  // The slider opens the case: the scene's stage with another lid (the focus stays 'overview').
  const setStage = useItemStage((s) => s.set)
  useEffect(() => {
    setStage({ stage: lid === 'closed' ? undefined : { preset: 'type-a-word', with: { lid } } })
  }, [lid, setStage])
  useEffect(() => () => setStage({ stage: undefined }), [setStage])

  // The reveal: the first press. Its truth is the same for every key (computed from the engine at AAA).
  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('own-letter').resolve(OWN_LETTER_TRUTH)
    if (last) setFirst({ key: last.trace[0]!.input, lamp: last.output })
  }, [fired, last, bet])

  const typed = seq - base.current
  useEffect(() => {
    if (typed >= TYPE_TASK_LETTERS) completeTask('type5')
  }, [typed, completeTask])
  useEffect(() => {
    if (trip.done) completeTask('roundtrip')
  }, [trip.done, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="type-a-word-view">
      <p className="text-base text-stone-100" data-testid="type-hint" aria-live="polite">
        {fired ? (
          <>
            <strong>Type a word</strong> on your keyboard, or click the keys.
          </>
        ) : committed ? (
          <>
            Your bet is in: now <strong>press a key</strong> on your keyboard, or click one.
          </>
        ) : (
          <>
            The keys wake up after your bet: <strong>first bet below</strong> on what will light up, then type a word.
          </>
        )}
      </p>
      <BetPointer
        bet="own-letter"
        pending={!committed}
        text="First bet on what will light up, then type"
        reducedMotion={p.reducedMotion}
      />
      <div className="flex flex-col gap-1">
        <LidSlider value={lid} onChange={setLid} />
        <p className="text-xs text-stone-400">In the 3D view, drag the machine to turn it.</p>
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {fired && first ? (
          <p data-testid="own-letter-result" className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
            <Mono>{first.key}</Mono> lit <Mono>{first.lamp}</Mono>, not <Mono>{first.key}</Mono>. Keep typing: the same
            key can light a different lamp next time, because the rotors turn at every press. Can a key ever light its
            own lamp? Keep an eye out: chapter I.3 answers that.
          </p>
        ) : null}
      </div>
      {fired ? <RoundtripNote trip={trip} /> : null}
    </div>
  )
}
