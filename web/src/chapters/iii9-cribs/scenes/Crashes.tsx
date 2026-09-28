/**
 * crashes: the crib ATTACKATDAWN under an intercept that starts with vector 14. Before the bet the rows are plain
 * (nothing coloured); the bet asks whether the crib can sit where it is shown. The toggle reveal colours the crash,
 * explains it, and turns the rows into a CribStrip slider; the task is sliding the crib to an offset with no crash
 * (only vector 14's). A "press T" demonstration on an Enigma I shows why a crash is impossible.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { createMachine, positionsToString, pressKey, type Letter } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { CribStrip } from '../../../viz'
import { BET_CRASH, BET_OFFSET, DEMO_MACHINE, FITS_TRUTH, INTERCEPT, INTERCEPT_FREE, V14 } from '../gates'
import { AlignedRows } from './Rows'

const ringNumber = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')

/** Press one letter again and again on the demonstration machine: it never lights itself. */
function NoSelfDemo({ letter }: { letter: Letter }): JSX.Element {
  const [state, setState] = useState(() => createMachine(DEMO_MACHINE))
  const [lamps, setLamps] = useState<readonly string[]>([])
  const press = () => {
    const res = pressKey(state, letter)
    setState(res.state)
    setLamps((l) => [...l, res.output])
  }
  const self = lamps.filter((l) => l === letter).length
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="no-self-demo">
      <h3 className="font-semibold text-stone-100">Check it on a machine</h3>
      <p>
        An Enigma I set up with a wartime-style key: rotors <Mono>{DEMO_MACHINE.rotors.join(' ')}</Mono>, rings{' '}
        <Mono>{DEMO_MACHINE.rings.map(ringNumber).join(' ')}</Mono>, {DEMO_MACHINE.plugboard.length} cables. Every press steps the
        rotors, so every press is a different scrambler. Press <Mono>{letter}</Mono> as often as you like.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={QUIET_BUTTON} onClick={press} data-testid="demo-press">
          Press {letter}
        </button>
        <span className="text-stone-400">
          windows <Mono>{positionsToString(state)}</Mono>
        </span>
      </div>
      <p aria-live="polite" data-testid="demo-lamps" data-presses={lamps.length} data-self={self}>
        {lamps.length === 0 ? (
          'No presses yet.'
        ) : (
          <>
            {lamps.length} press{lamps.length === 1 ? '' : 'es'} lit <Mono>{lamps.join(' ')}</Mono>. {letter} lit {letter}{' '}
            {self} times.
          </>
        )}
      </p>
    </section>
  )
}

export function CrashesView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('fits')
  const [offset, setOffset] = useState(BET_OFFSET)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('fits').resolve(FITS_TRUTH)
  }, [fired, bet])

  const found = fired && INTERCEPT_FREE.includes(offset)
  useEffect(() => {
    if (found) completeTask('slide')
  }, [found, completeTask])

  const { index, letter } = BET_CRASH
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="crashes-view">
      <p>
        An intercept of {INTERCEPT.length} letters. The analysts expect the plaintext to hold the crib <Mono>{V14.crib}</Mono> (“attack at
        dawn”) somewhere, but not where. Its first twelve letters and the crib are the worked example of the Bombe article; the other
        letters are made up for this exercise.
      </p>
      {!fired ? (
        <>
          <p>
            Here the crib is written under the cipher text starting at offset {BET_OFFSET} (offsets count from 0). If it really sat
            there, each crib letter would be what the operator typed, and the cipher letter above it what the lamp showed.
          </p>
          <AlignedRows
            cipher={INTERCEPT}
            crib={V14.crib}
            offset={BET_OFFSET}
            testId="crashes-rows"
            label={`The crib ${V14.crib} under the intercept ${INTERCEPT} at offset ${BET_OFFSET}`}
          />
        </>
      ) : (
        <section className="flex flex-col gap-3" data-testid="crashes-result" aria-live="polite">
          <p>
            At offset {BET_OFFSET} letter {index + 1} of the crib, <Mono>{letter}</Mono>, sits under a cipher <Mono>{letter}</Mono>: a{' '}
            <strong>crash</strong>, shown in red. If the crib were there, the operator typed {letter} and the lamp showed {letter}. The
            reflector never sends a letter back to itself, so that cannot happen: one crash rules the offset out.
          </p>
          <p>Slide the crib with the arrow keys (or the buttons) until no column is red.</p>
          <CribStrip cipher={INTERCEPT} crib={V14.crib} offset={offset} onOffset={setOffset} testId="crashes-strip" />
          {found ? (
            <p className="rounded-md border border-emerald-800 bg-emerald-950/30 p-2" data-testid="crashes-found">
              No crash at offset {offset}: <Mono>{INTERCEPT.slice(offset, offset + V14.crib.length)}</Mono> over{' '}
              <Mono>{V14.crib}</Mono>, the Bombe article’s example. No crash does not prove the crib is there; it only means it may
              be.{' '}
              {INTERCEPT_FREE.length === 1 ? 'Every other offset of this intercept crashes, so this is the one place left. ' : ''}The next chapter turns this alignment into
              a menu for the bombe.
            </p>
          ) : null}
          <NoSelfDemo letter={letter} />
        </section>
      )}
    </div>
  )
}
