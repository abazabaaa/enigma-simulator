/**
 * wire-26: the same circuit with 26 wires in every cable, on a day with a cribbed message over ATTACKATDAWN. The bet
 * (a wrong hypothesis at the day's true position) gates the current; then the learner replays the spread, moves the
 * voltage onto the wire that stayed dead, and moves the drums to a wrong position.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { LETTERS, type Letter } from '../../../engine'
import { INPUT, Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { MenuGraph } from '../../../viz'
import { B26, B26_CRIB, b26State } from '../gates'
import { CribLine, WireBench, registerAt } from './Bench'

const TEST = B26.test

export function Wire26View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('live26')
  const [wire, setWire] = useState<Letter>(B26.firstWire)
  const [where, setWhere] = useState<'true' | 'wrong'>('true')
  const positions = where === 'true' ? B26.truth : B26.wrong
  const state = useMemo(() => b26State(positions, wire, false), [positions, wire])
  const [replay, setReplay] = useState<number | null>(null)
  const total = state.order.length
  const shown = fired ? Math.min(replay ?? total, total) : 1
  const register = registerAt(state, TEST, shown)
  const live = register.filter(Boolean).length
  const finalLive = registerAt(state, TEST).filter(Boolean).length
  const dead = LETTERS.filter((_, w) => !registerAt(state, TEST)[w])
  const resolved = useRef(false)
  const { bet, completeTask } = p

  // The bet's truth is fixed by the scene: the first hypothesis at the day's true position.
  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('live26').resolve(String(registerAt(b26State(B26.truth, B26.firstWire, false), TEST).filter(Boolean).length))
  }, [fired, bet])

  const complete = fired && shown === total
  useEffect(() => {
    if (!complete) return
    if (where === 'true' && finalLive === 1) completeTask('dead-wire')
    if (where === 'wrong' && finalLive === 26) completeTask('wrong-pos')
  }, [complete, where, finalLive, completeTask])

  const choose = (next: { wire?: Letter; where?: 'true' | 'wrong' }) => {
    if (next.wire) setWire(next.wire)
    if (next.where) setWhere(next.where)
    setReplay(null)
  }

  return (
    <div
      className="flex flex-col gap-4 text-sm text-stone-300"
      data-testid="wire26-view"
      data-hypothesis={wire}
      data-positions={positions}
      data-step={shown}
      data-total={total}
    >
      <p>
        A real crib: <Mono>{B26_CRIB}</Mono> under a message, at a place with no crash. Its twelve links make a menu of{' '}
        {B26.menu.letters.length} letters with loops. The bombe tests letter <Mono>{TEST}</Mono>, the busiest letter of the menu:
        cable {TEST} is the test register. Each cable now has 26 wires, and each link is a scrambler of 26 letters.
      </p>
      <CribLine cipher={B26.cipher} crib={B26_CRIB} offset={B26.offset} />
      <div className="max-w-md">
        <MenuGraph menu={B26.menu} testId="wire26-menu" />
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-stone-700 p-3">
        <legend className="px-1 text-sm font-semibold text-stone-200">The voltage and the drums</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            Hypothesis {TEST} ↔
            <select
              value={wire}
              disabled={!fired}
              onChange={(e) => choose({ wire: e.target.value as Letter })}
              className={INPUT}
              data-testid="wire26-hyp"
            >
              {LETTERS.map((l) => (
                <option key={l} value={l}>
                  {l.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Drum position" className="flex flex-wrap gap-2">
            {(['true', 'wrong'] as const).map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={where === w}
                disabled={!fired}
                data-testid={`wire26-position-${w}`}
                onClick={() => choose({ where: w })}
                className={`${QUIET_BUTTON} ${where === w ? 'border-amber-400 bg-amber-400/25 text-amber-100' : ''}`}
              >
                {w === 'true' ? `The day’s position ${B26.truth}` : `A wrong position ${B26.wrong}`}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-wrap items-center gap-2">
          Replay the spread
          <input
            type="range"
            min={1}
            max={fired ? total : 1}
            value={shown}
            disabled={!fired}
            onChange={(e) => setReplay(Number(e.target.value))}
            aria-valuetext={fired ? `${shown} of ${total} wires lit` : '1 wire lit'}
            data-testid="wire26-replay"
            className="w-48"
          />
          <span className="font-mono text-xs text-stone-400" data-testid="wire26-count">
            {fired ? `${shown} of ${total} wires lit` : '1 wire lit'}
          </span>
        </label>
        {!fired ? <p className="text-stone-400">Place your bet below, then switch on the current.</p> : null}
      </fieldset>

      <WireBench state={state} step={shown} test={TEST} diagonal={false} testIds={{ grid: 'wire26-grid', register: 'wire26-register' }} />

      <p aria-live="polite" className="text-stone-200" data-testid="wire26-result">
        {!fired
          ? ''
          : shown < total
            ? `Replaying: ${live} register wires live so far.`
            : finalLive === 26
              ? `All 26 register wires are live: every hypothesis for ${TEST} is refuted at ${positions}, and the bombe moves on to the next position.`
              : finalLive === 1
                ? `Only wire ${wire.toLowerCase()} is live: ${TEST}↔${wire.toLowerCase()} is consistent with every loop. This is the stop the bombe is looking for.`
                : `${finalLive} register wires are live and ${dead.length === 1 ? `one stays dead, wire ${dead[0]!.toLowerCase()}` : `${dead.length} stay dead`}. The bombe stops: the true partner of ${TEST} is the one wire a false hypothesis cannot reach.`}
      </p>
    </div>
  )
}
