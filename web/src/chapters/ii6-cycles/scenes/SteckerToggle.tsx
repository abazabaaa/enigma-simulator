/**
 * stecker-toggle: the day's machine at its Grundstellung and a live cycle diagram of its AD (the engine's presses 1
 * and 4). After the `lengths` bet the toggle reveal adds one cable (F–N): two letters trade places and every cycle
 * keeps its length. The plugboard is then the learner's, and so is the F–N cable (task toggle3: three changes).
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import type { Letter } from '../../../contracts/core'
import { cycleSignature, formatCycles } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { DAY, DAY_AD, DEMO_CABLE, adOf, dash, lengthsTruth } from '../gates'
import { Diagram } from './parts'

interface Change {
  readonly cables: string
  readonly lengths: string
}

const lengthsOf = (p: readonly number[]) => cycleSignature(p).join(' ')
const [DX, DY] = [DEMO_CABLE[0] as Letter, DEMO_CABLE[1] as Letter]

/** Once fired, the reveal's own button would do nothing more: the View's toggle below takes its place. */
const HIDE_FIRED = '[data-scene="stecker-toggle"] [data-testid="reveal-lengths"][data-fired="true"]{display:none}'

export function SteckerToggleView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('lengths')
  const { completeTask, bet, store } = p
  const plugs = useStore(store, (s) => s.machine.config.plugboard.join(' '))
  const cables = plugs ? plugs.split(' ') : []
  const ad = useMemo(() => adOf(store.getState().snapshot()), [store, plugs])
  const [demo, setDemo] = useState<{ after: number[] } | null>(null)
  const [changes, setChanges] = useState<readonly Change[]>([])
  const baseline = useRef<string | null>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  // The reveal: add the demo cable, resolve the bet from the two ADs, then hand the plugboard to the learner.
  useEffect(() => {
    if (!fired || baseline.current !== null) return
    const m = store.getState()
    const before = adOf(m.snapshot())
    m.setLocks({ ...m.locks, plugboard: false })
    if (!m.machine.config.plugboard.some((pair) => pair.includes(DX) || pair.includes(DY))) store.getState().togglePlug(DX, DY)
    const after = adOf(store.getState().snapshot())
    baseline.current = store.getState().machine.config.plugboard.join(' ')
    setDemo({ after })
    bet('lengths').resolve(lengthsTruth(before, after))
    // The reveal button hides once fired: keep the keyboard user's place on its replacement.
    queueMicrotask(() => toggle.current?.focus())
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

  const demoIn = cables.some((c) => c === DX + DY || c === DY + DX)
  const demoFree = !cables.some((c) => c.includes(DX) || c.includes(DY))
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="stecker-view">
      <style>{HIDE_FIRED}</style>
      <p data-testid="stecker-now">
        The day&apos;s machine at its Grundstellung <Mono>{DAY.positions.join('')}</Mono>
        {fired ? ', with the cables now on the plugboard: ' : ", with the day's cables: "}
        <Mono>{cables.length ? cables.map(dash).join(', ') : 'none'}</Mono>. Its AD, from presses 1 and 4, is drawn as
        cycles; the drawing follows the plugboard.
      </p>
      <Diagram perm={ad} testId="stecker-ad" label="AD as cycles" />
      <div aria-live="polite">
        {demo ? (
          <section
            data-testid="stecker-result"
            className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3"
          >
            <h3 className="font-semibold text-stone-100">One more cable: {dash(DEMO_CABLE)}</h3>
            <p>
              Before: <Mono className="break-all">{formatCycles(DAY_AD)}</Mono>, lengths <Mono>{lengthsOf(DAY_AD)}</Mono>.
            </p>
            <p>
              After: <Mono className="break-all">{formatCycles(demo.after)}</Mono>, lengths{' '}
              <Mono>{lengthsOf(demo.after)}</Mono>.
            </p>
            <p>
              {DX.toLowerCase()} and {DY.toLowerCase()} traded places, even between cycles of different lengths, and nothing
              else moved. Here is why. Call the plugboard S, and the machine without it A′ at press 1 and D′ at press 4.
              Each press goes through S, then the scrambler, then S again:
            </p>
            <p className="font-mono text-stone-100" data-testid="stecker-formula">
              A = S·A′·S⁻¹ and D = S·D′·S⁻¹, so AD = S·A′·S⁻¹·S·D′·S⁻¹ = S·(A′D′)·S⁻¹
            </p>
            <p>
              AD is the plugboard-free product A′D′ with every letter renamed through S. A renamed permutation (a
              conjugate) has exactly the cycle lengths of the original: the cables never show in them.
            </p>
            <p>The plugboard is yours now: add or remove cables, this one included, and watch the diagram.</p>
            <div>
              <button
                ref={toggle}
                type="button"
                className={QUIET_BUTTON}
                data-testid="stecker-demo-toggle"
                disabled={!demoIn && !demoFree}
                onClick={() => {
                  const m = store.getState()
                  if (!m.locks.plugboard) m.togglePlug(DX, DY)
                }}
              >
                {demoIn ? `Take the cable ${dash(DEMO_CABLE)} out` : `Put the cable ${dash(DEMO_CABLE)} back`}
              </button>
            </div>
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
