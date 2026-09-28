/**
 * diagonal: Welchman's diagonal board. The bet (fewer, the same or more stops with the board) gates the run: the whole
 * wheel order, 17,576 positions, in a worker, once without the board and once with it, with progress bars and both
 * stop counts. Then a close-up of one stop the board removes, with the board switched off and on.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { Stop } from '../../../crypto/bombe'
import { runBombeAsync } from '../../../crypto/bombeClient'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { B26, DIAG_FALSE_STOP, b26State, diagTruth } from '../gates'
import { WireBench, registerAt } from './Bench'

const TEST = B26.test

interface Run {
  readonly done: number
  readonly total: number
  readonly stops: readonly Stop[] | null
  readonly ms: number | null
}

const EMPTY: Run = { done: 0, total: 17576, stops: null, ms: null }

function Progress({ label, run, testId }: { label: string; run: Run; testId: string }): JSX.Element {
  const pct = Math.round((100 * run.done) / run.total)
  return (
    <div className="flex flex-col gap-1" data-testid={testId} data-stops={run.stops?.length} data-done={String(!!run.stops)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-xs text-stone-400">
          {run.stops ? `${run.stops.length} stop${run.stops.length === 1 ? '' : 's'}` : `${run.done.toLocaleString('en-GB')} of 17,576`}
        </span>
      </div>
      <progress max={run.total} value={run.done} aria-label={`${label}: ${pct}%`} className="h-2 w-full accent-amber-400" />
      {run.stops ? (
        <p className="font-mono text-xs break-words text-stone-300">
          {run.stops.map((s) => (s.positions === B26.truth ? `${s.positions}*` : s.positions)).join(' ')}
        </p>
      ) : null}
    </div>
  )
}

export function DiagonalView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('diag')
  const [off, setOff] = useState<Run>(EMPTY)
  const [on, setOn] = useState<Run>(EMPTY)
  const [board, setBoard] = useState(false)
  // The scene's callbacks change identity on every render: read the latest through a ref, so the runs start once per
  // reveal and are aborted only when the learner leaves the scene.
  const props = useRef(p)
  props.current = p

  useEffect(() => {
    if (!fired) return
    const abort = new AbortController()
    const o = { menu: B26.menu, rotors: B26.day.rotors, reflector: B26.day.reflector }
    const go = async () => {
      let t = performance.now()
      const a = await runBombeAsync(
        { ...o, diagonal: false, onProgress: (done, total) => setOff((r) => ({ ...r, done, total })) },
        abort.signal,
      )
      setOff({ done: 17576, total: 17576, stops: a, ms: performance.now() - t })
      t = performance.now()
      const b = await runBombeAsync(
        { ...o, diagonal: true, onProgress: (done, total) => setOn((r) => ({ ...r, done, total })) },
        abort.signal,
      )
      setOn({ done: 17576, total: 17576, stops: b, ms: performance.now() - t })
      props.current.bet('diag').resolve(diagTruth(a.length, b.length))
      props.current.completeTask('both-runs')
    }
    go().catch(() => {
      // Aborted when the learner leaves the scene: nothing to report.
    })
    return () => abort.abort()
  }, [fired])

  const both = !!off.stops && !!on.stops
  const state = useMemo(() => b26State(DIAG_FALSE_STOP, 'A', board), [board])
  const live = registerAt(state, TEST).filter(Boolean).length

  return (
    <div className="flex flex-col gap-4 text-sm text-stone-300" data-testid="diagonal-view" data-board={String(board)}>
      <p>
        A plugboard cable joins two letters both ways: if <Mono>A</Mono> is steckered to <Mono>K</Mono>, then <Mono>K</Mono> is
        steckered to <Mono>A</Mono>. Gordon Welchman&apos;s diagonal board wires that fact into the bombe: wire k of cable A is joined to
        wire a of cable K, for every pair of letters. It adds no scramblers.
      </p>
      <p>
        The run below takes the whole wheel order of this day, <Mono>{B26.day.rotors.join(' ')}</Mono>, through all 17,576 drum
        positions with the menu of the last scene: once without the board and once with it. A stop is any position where the test
        register is not all live.
      </p>
      <div className="flex flex-col gap-3 rounded-lg border border-stone-700 p-3" aria-live="polite">
        <Progress label="Without the diagonal board" run={off} testId="diag-run-off" />
        <Progress label="With the diagonal board" run={on} testId="diag-run-on" />
        {both ? (
          <p className="text-stone-200" data-testid="diag-result">
            {off.stops!.length} stops without the board, {on.stops!.length} with it. The one left is the day&apos;s position,{' '}
            <Mono>{B26.truth}</Mono> (marked *). The board only ever joins more wires, so a register that was full stays full: it can
            remove stops, never add one. Here each run took about {Math.max(1, Math.round((off.ms! + on.ms!) / 2))} ms; a bombe needed
            about 20 minutes for one wheel order.
          </p>
        ) : fired ? (
          <p className="text-stone-400">Running in the background…</p>
        ) : (
          <p className="text-stone-400">Place your bet below, then run the wheel order.</p>
        )}
      </div>

      {both ? (
        <section className="flex flex-col gap-3" data-testid="diag-closeup">
          <h3 className="font-semibold text-stone-100">
            A close-up: the stop at <Mono>{DIAG_FALSE_STOP}</Mono>
          </h3>
          <p>
            Without the board, the voltage on wire a of cable {TEST} leaves a register wire dead at {DIAG_FALSE_STOP}, so the bombe
            stops there. With the board on, the extra joins (the dashed diagonal, in the plugboard colour) carry the current further.
          </p>
          <div role="radiogroup" aria-label="Diagonal board" className="flex flex-wrap gap-2">
            {[false, true].map((b) => (
              <button
                key={String(b)}
                type="button"
                role="radio"
                aria-checked={board === b}
                data-testid={`diag-board-${b ? 'on' : 'off'}`}
                onClick={() => setBoard(b)}
                className={`${QUIET_BUTTON} ${board === b ? 'border-amber-400 bg-amber-400/25 text-amber-100' : ''}`}
              >
                Board {b ? 'on' : 'off'}
              </button>
            ))}
          </div>
          <WireBench state={state} test={TEST} diagonal={board} testIds={{ grid: 'diag-grid', register: 'diag-register' }} />
          <p aria-live="polite" data-testid="diag-closeup-result">
            {live === 26
              ? `With the board all 26 register wires are live: ${DIAG_FALSE_STOP} is no longer a stop.`
              : `Without the board ${live} register wires are live: ${DIAG_FALSE_STOP} is a stop.`}
          </p>
        </section>
      ) : null}
    </div>
  )
}
