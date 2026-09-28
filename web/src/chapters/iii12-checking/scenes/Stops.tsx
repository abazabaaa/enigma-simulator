/**
 * stops: one bombe run over the day's wheel order (17,576 positions, diagonal board on) in a worker, after the bet on
 * how many of its stops are the key. The stop list, then the link-outs to full-size bombe simulations.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { Stop } from '../../../crypto/bombe'
import { runBombeAsync } from '../../../crypto/bombeClient'
import { Mono, useRevealFired } from '../../../lesson'
import { STOPS_CRIB, STOPS_DAY, trueStopsTruth } from '../gates'

export function StopsView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('true-stops')
  const [done, setDone] = useState(0)
  const [stops, setStops] = useState<readonly Stop[] | null>(null)
  const props = useRef(p)
  props.current = p

  useEffect(() => {
    if (!fired) return
    const abort = new AbortController()
    runBombeAsync(
      {
        menu: STOPS_DAY.menu,
        rotors: STOPS_DAY.day.rotors,
        reflector: STOPS_DAY.day.reflector,
        diagonal: true,
        onProgress: (d) => setDone(d),
      },
      abort.signal,
    )
      .then((list) => {
        setDone(17576)
        setStops(list)
        props.current.bet('true-stops').resolve(trueStopsTruth(list, STOPS_DAY.truth))
        props.current.completeTask('see-stops')
      })
      .catch(() => {
        // Aborted when the learner leaves the scene.
      })
    return () => abort.abort()
  }, [fired])

  return (
    <div className="flex flex-col gap-4 text-sm text-stone-300" data-testid="stops-view" data-stops={stops?.length}>
      <p>
        A new day, a new crib: <Mono>{STOPS_CRIB}</Mono> (&ldquo;nothing special to report&rdquo;), which turned up in message after
        message. Its menu, with the diagonal board, goes onto a bombe set up with the day&apos;s wheel order,{' '}
        <Mono>{STOPS_DAY.day.rotors.join(' ')}</Mono>, and the drums run through all 17,576 positions. Every time the test register
        is not all live, the bombe stops and the operator writes down the drum positions and the register&apos;s reading.
      </p>
      <div className="flex flex-col gap-2 rounded-lg border border-stone-700 p-3" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span>One wheel order, diagonal board on</span>
          <span className="font-mono text-xs text-stone-400">{done.toLocaleString('en-GB')} of 17,576</span>
        </div>
        <progress max={17576} value={done} aria-label={`Bombe run: ${Math.round((100 * done) / 17576)}%`} className="h-2 w-full accent-amber-400" />
        {stops ? (
          <>
            <table className="font-mono text-xs" data-testid="stop-list">
              <caption className="pb-1 text-left font-sans text-sm text-stone-200">
                {stops.length} stop{stops.length === 1 ? '' : 's'}
              </caption>
              <thead>
                <tr className="text-stone-400">
                  <th className="pr-4 text-left font-normal">Drums</th>
                  <th className="pr-4 text-left font-normal">Register</th>
                  <th className="text-left font-normal">Hypothesis</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s) => (
                  <tr key={s.positions} data-stop={s.positions}>
                    <td className="pr-4">{s.positions}</td>
                    <td className="pr-4">{s.live} live</td>
                    <td>
                      {s.testLetter}↔{s.stecker}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-stone-200" data-testid="stops-result">
              This wheel order is the day&apos;s, so one of these {stops.length} stops is the key and the other {stops.length - 1} are
              false stops: places where the menu&apos;s few loops happened to agree. The bombe cannot tell them apart. The next scene
              can.
            </p>
          </>
        ) : fired ? (
          <p className="text-stone-400">Running…</p>
        ) : (
          <p className="text-stone-400">Place your bet below, then run the wheel order.</p>
        )}
      </div>
      <p className="text-xs text-stone-400">
        To see a full-size bombe with its drums turning, try Martin Gillow&apos;s{' '}
        <a className="text-sky-300 underline" href="https://bombe.virtualcolossus.co.uk/" target="_blank" rel="noopener noreferrer">
          Virtual Bombe
        </a>{' '}
        or owenautosport&apos;s{' '}
        <a className="text-sky-300 underline" href="https://owenautosport.github.io/enigma-bombe/" target="_blank" rel="noopener noreferrer">
          3D bombe
        </a>{' '}
        (both open in a new tab).
      </p>
    </div>
  )
}
