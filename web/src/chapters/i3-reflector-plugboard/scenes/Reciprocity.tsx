/**
 * reciprocity (free presses): with the reflector and four cables the machine at any one setting joins the 26 letters
 * in 13 pairs, so the setting that enciphers a word also deciphers it. The task: type a word, rewind the tape, type
 * the ciphertext, and read the word back.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { machinePermutation, positionsToString, step } from '../../../engine'
import { Mono } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { pairsOf } from '../gates'

/** One tape: the windows before its first letter, what was typed and what lit. */
export interface Tape {
  readonly start: string
  readonly input: string
  readonly output: string
}

/** A later tape typed from the same windows as an earlier one, whose input is that tape's output and back: a round trip. */
export function roundTrip(tapes: readonly Tape[], min = 3): Tape | null {
  const now = tapes.at(-1)
  if (!now || now.input.length < min) return null
  return tapes.slice(0, -1).find((t) => t.start === now.start && t.output === now.input && t.input === now.output) ?? null
}

export function ReciprocityView(p: SceneProps): JSX.Element {
  const machine = useStore(p.store, (s) => s.machine)
  const [tapes, setTapes] = useState<readonly Tape[]>([])
  const seen = useRef(p.store.getState().seq)
  const { completeTask, store } = p

  // Every press extends the current tape; a press on an empty tape starts a new one.
  useEffect(
    () =>
      store.subscribe((s) => {
        if (s.seq === seen.current || !s.last) return
        seen.current = s.seq
        const start = s.input.length === 1 ? positionsToString(s.last.stepping.before) : null
        setTapes((list) => {
          if (start !== null || !list.length) {
            return [...list, { start: start ?? positionsToString(s.last!.stepping.before), input: s.input, output: s.output }]
          }
          return [...list.slice(0, -1), { ...list.at(-1)!, input: s.input, output: s.output }]
        })
      }),
    [store],
  )

  const trip = roundTrip(tapes)
  useEffect(() => {
    if (trip) completeTask('roundtrip')
  }, [trip, completeTask])

  // The machine's pairs for the next press (the rotors step first).
  const next = useMemo(() => step(machine).state, [machine])
  const pairs = useMemo(() => pairsOf(machinePermutation(next)), [next])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="reciprocity-view">
      <p>
        Cables <Mono>{machine.config.plugboard.join(' ')}</Mono>, rotors <Mono>{machine.config.rotors.join(' ')}</Mono>. At any one
        setting the current goes in through <Sym s="S" />, the rotors and the reflector <Sym s="U" />, and comes back out the same way
        in reverse, so the machine joins the letters in pairs: if one key lights a lamp, that lamp&apos;s key lights the first key.
      </p>
      <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="reciprocity-pairs">
        <p>
          The next press steps the windows <Mono>{positionsToString(machine)}</Mono> → <Mono>{positionsToString(next)}</Mono>. There the
          machine pairs the letters like this:
        </p>
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
          {pairs.map((pair) => (
            <Mono key={pair}>({pair.toLowerCase()})</Mono>
          ))}
        </p>
      </div>
      <p>
        So the setting that enciphers a message also deciphers it. Type a word of three letters or more, rewind the tape to where it
        began, type the ciphertext, and read the tape.
      </p>
      <div aria-live="polite">
      {trip ? (
        <p data-testid="reciprocity-result" className="text-emerald-300">
          From <Mono>{trip.start}</Mono>, <Mono>{trip.input}</Mono> enciphered to <Mono>{trip.output}</Mono>, and{' '}
          <Mono>{trip.output}</Mono> deciphered back to <Mono>{trip.input}</Mono>: the same setting did both.
        </p>
      ) : null}
      </div>
    </div>
  )
}
