/**
 * stecker-toggle: the day's machine at its Grundstellung and a live cycle diagram of its AD (the engine's presses 1
 * and 4). After the `lengths` bet the toggle reveal adds one cable (F–N): two letters trade places and every cycle
 * keeps its length. The plugboard then unlocks and the learner changes the cables three times (task toggle3).
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import type { Letter } from '../../../contracts/core'
import { cycleSignature, formatCycles } from '../../../engine'
import { Mono, useRevealFired } from '../../../lesson'
import { CycleDiagram } from '../../../viz'
import { DAY, DAY_AD, DEMO_CABLE, adOf, dash, lengthsTruth } from '../gates'

interface Change {
  readonly cables: string
  readonly lengths: string
}

const lengthsOf = (p: readonly number[]) => cycleSignature(p).join(' ')

export function SteckerToggleView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('lengths')
  const { completeTask, bet, store } = p
  const plugs = useStore(store, (s) => s.machine.config.plugboard.join(' '))
  const ad = useMemo(() => adOf(store.getState().snapshot()), [store, plugs])
  const [demo, setDemo] = useState<{ after: number[] } | null>(null)
  const [changes, setChanges] = useState<readonly Change[]>([])
  const baseline = useRef<string | null>(null)

  // The reveal: add the demo cable, resolve the bet from the two ADs, then hand the plugboard to the learner.
  useEffect(() => {
    if (!fired || baseline.current !== null) return
    const m = store.getState()
    const before = adOf(m.snapshot())
    m.setLocks({ ...m.locks, plugboard: false })
    const [a, b] = [DEMO_CABLE[0] as Letter, DEMO_CABLE[1] as Letter]
    if (!m.machine.config.plugboard.some((pair) => pair.includes(a) || pair.includes(b))) store.getState().togglePlug(a, b)
    const after = adOf(store.getState().snapshot())
    baseline.current = store.getState().machine.config.plugboard.join(' ')
    setDemo({ after })
    bet('lengths').resolve(lengthsTruth(before, after))
  }, [fired, bet, store])

  // Each change the learner makes afterwards, with the lengths it leaves.
  useEffect(() => {
    if (baseline.current === null || plugs === baseline.current) return
    baseline.current = plugs
    setChanges((c) => [...c, { cables: plugs, lengths: lengthsOf(ad) }])
  }, [plugs, ad])
  useEffect(() => {
    if (changes.length >= 3) completeTask('toggle3')
  }, [changes.length, completeTask])

  const [x, y] = [DEMO_CABLE[0]!, DEMO_CABLE[1]!]
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="stecker-view">
      <p>
        The day&apos;s machine at its Grundstellung <Mono>{DAY.positions.join('')}</Mono>, with the cables{' '}
        <Mono>{DAY.plugboard.map(dash).join(', ')}</Mono>. Its AD, from presses 1 and 4, drawn as cycles; the drawing
        follows the plugboard.
      </p>
      <CycleDiagram perm={ad} testId="stecker-ad" />
      <div aria-live="polite">
        {demo ? (
          <section
            data-testid="stecker-result"
            className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3"
          >
            <h3 className="font-semibold text-stone-100">One more cable: {dash(DEMO_CABLE)}</h3>
            <p>
              Before: <Mono className="break-all">{formatCycles(DAY_AD)}</Mono>, lengths{' '}
              <Mono>{lengthsOf(DAY_AD)}</Mono>.
            </p>
            <p>
              After: <Mono className="break-all">{formatCycles(demo.after)}</Mono>, lengths{' '}
              <Mono>{lengthsOf(demo.after)}</Mono>.
            </p>
            <p>
              {x.toLowerCase()} and {y.toLowerCase()} traded places, even between cycles of different lengths, and nothing
              else moved. With the plugboard S, each press is S, then the scrambler, then S again, so AD is the plugboard-free
              product with every letter renamed through S. A renamed permutation (a conjugate) has exactly the cycle lengths
              of the original: the plugboard never shows in them.
            </p>
            <p>The plugboard is yours now: add or remove cables and watch the diagram.</p>
          </section>
        ) : null}
      </div>
      {changes.length ? (
        <div className="max-w-full overflow-x-auto">
          <table className="text-left text-xs" data-testid="stecker-log">
            <caption className="text-left text-xs text-stone-400">Your changes</caption>
            <thead>
              <tr className="text-stone-400">
                <th className="pr-3 font-normal">Cables</th>
                <th className="font-normal">AD lengths</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, k) => (
                <tr key={k} data-testid={`stecker-change-${k}`} data-lengths={c.lengths}>
                  <td className="pr-3 font-mono">{c.cables || 'none'}</td>
                  <td className="font-mono">{c.lengths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
