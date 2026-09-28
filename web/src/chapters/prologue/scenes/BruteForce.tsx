/**
 * brute-force: could anyone simply try every key? The bet gates the count; the reveal builds the key space
 * factor by factor (every number from lib/keyspace), then explains the 676 ring settings, and a slider asks how
 * fast a searcher would have to be.
 */

import { useEffect, useId, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { BRUTE_TRUTH, RING_SETTINGS, formatYears, grouped, keyspaceLines, yearsToTry } from '../gates'

/** Milliseconds between two lines of the figure (reduced motion: all at once). */
export const LINE_MS = 700

const RATES = [3, 6, 9, 12] as const
const RATE_TEXT: Readonly<Record<(typeof RATES)[number], string>> = {
  3: 'a thousand',
  6: 'a million',
  9: 'a billion',
  12: 'a trillion',
}

function KeyspaceFigure({ shown }: { shown: number }): JSX.Element {
  const lines = useMemo(keyspaceLines, [])
  return (
    <ol className="flex flex-col gap-2" data-testid="keyspace-figure" data-shown={shown}>
      {lines.slice(0, shown).map((l) => (
        <li
          key={l.id}
          data-line={l.id}
          className={`rounded-md border p-2 ${
            l.id === 'total' || l.id === 'rings' ? 'border-amber-400/60 bg-amber-400/5' : 'border-stone-700'
          }`}
        >
          <span className="block text-xs text-stone-400">{l.label}</span>
          <span className="font-mono text-stone-100">
            {l.factors.length ? `${l.factors.join(' × ')} = ` : ''}
            <span className={l.id === 'total' || l.id === 'rings' ? 'text-amber-200' : ''}>{l.shown}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function BruteForceView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('brute')
  const lines = useMemo(keyspaceLines, [])
  const [shown, setShown] = useState(0)
  const [rate, setRate] = useState<(typeof RATES)[number]>(9)
  const resolved = useRef(false)
  const rateId = useId()
  const { completeTask, bet, reducedMotion } = p

  useEffect(() => {
    if (!fired) return
    if (!resolved.current) {
      resolved.current = true
      bet('brute').resolve(BRUTE_TRUTH)
    }
    if (reducedMotion) {
      setShown(lines.length)
      return
    }
    if (shown >= lines.length) return
    const t = setTimeout(() => setShown((s) => Math.min(lines.length, s + 1)), shown === 0 ? 0 : LINE_MS)
    return () => clearTimeout(t)
  }, [fired, shown, lines.length, reducedMotion, bet])

  const all = shown >= lines.length
  useEffect(() => {
    if (all) completeTask('seen')
  }, [all, completeTask])

  const total = lines.find((l) => l.id === 'total')!.value
  const withRings = lines.find((l) => l.id === 'rings')!.value
  const perSecond = 10n ** BigInt(rate)

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="brute-force-view">
      <p>
        A day&apos;s key sets three rotors in order, a start letter in each window, the ring of each rotor and the
        plugboard cables. Anyone who captured a machine but not the key could, in principle, try every key until the
        message made sense.
      </p>
      <div aria-live="polite" className="flex flex-col gap-3">
        {fired ? <KeyspaceFigure shown={shown} /> : null}
        {all ? (
          <section className="flex flex-col gap-3" data-testid="brute-force-result">
            <p>
              <strong>Why only {grouped(RING_SETTINGS)} ring settings?</strong> Turn a ring and its rotor by the same
              amount and the wiring sits exactly where it was; the window just shows another letter. So a ring only
              changes <em>when</em> its notch carries the next rotor along. The right rotor&apos;s notch moves the
              middle rotor and the middle rotor&apos;s notch moves the left one, but the left rotor&apos;s notch has
              nothing to move: only the right and the middle ring count, 26 × 26 = {grouped(RING_SETTINGS)}.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor={rateId}>Settings tried per second:</label>
              <input
                id={rateId}
                type="range"
                min={0}
                max={RATES.length - 1}
                step={1}
                value={RATES.indexOf(rate)}
                data-testid="rate-slider"
                aria-valuetext={`${RATE_TEXT[rate]} per second`}
                onChange={(e) => setRate(RATES[Number(e.target.value)] ?? 9)}
                className="w-40 accent-amber-300"
              />
              <Mono>{RATE_TEXT[rate]}</Mono>
            </div>
            <p data-testid="brute-force-years">
              At {RATE_TEXT[rate]} settings a second, trying them all takes{' '}
              <strong>{formatYears(yearsToTry(total, perSecond))}</strong>, and{' '}
              <strong>{formatYears(yearsToTry(withRings, perSecond))}</strong> once the ring settings count.
            </p>
            <p className="text-stone-200">
              So the answer is no: nobody broke Enigma by trying every key. This course follows the people who found how
              to throw almost all of them away without trying them. First, the machine itself.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
