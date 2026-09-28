/**
 * wire-8: Ellsbury's eight-letter bombe. One loop of four scramblers on A–H, the test register on the loop's first
 * letter. The bet (how many register wires a wrong hypothesis lights) gates the current; then the learner steps it
 * round the loop one scrambler at a time, tries other hypotheses and a wrong drum position.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { Letter } from '../../../engine'
import { BUTTON, Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { MenuGraph } from '../../../viz'
import { TOY8, TOY8_FIRST_LIVE, TOY8_FIRST_WIRE, TOY_LETTERS, testOf, toyMenu, walkState } from '../gates'
import { ScramblerTable, WireBench, describeEvent, loopText, registerAt, registerText } from './Bench'

const TEST = testOf(TOY8.toy)

export function Wire8View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('live8')
  const [wire, setWire] = useState<Letter>(TOY8_FIRST_WIRE)
  const [where, setWhere] = useState<'true' | 'wrong'>('true')
  const toy = where === 'true' ? TOY8.toy : TOY8.wrong
  const state = useMemo(() => walkState(toy, wire), [toy, wire])
  const [step, setStep] = useState(1)
  const total = state.order.length
  const shown = fired ? Math.min(step, total) : 1
  const done = fired && shown === total
  const register = registerAt(state, TEST, shown)
  const live = register.filter(Boolean).length
  const resolved = useRef(false)
  const { bet, completeTask } = p

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('live8').resolve(String(TOY8_FIRST_LIVE))
  }, [fired, bet])

  useEffect(() => {
    if (!done) return
    completeTask('run-end')
    if (where === 'true' && live === 1) completeTask('true-hyp')
    if (where === 'wrong') completeTask('wrong-pos')
  }, [done, where, live, completeTask])

  const choose = (next: { wire?: Letter; where?: 'true' | 'wrong' }) => {
    if (next.wire) setWire(next.wire)
    if (next.where) setWhere(next.where)
    setStep(1)
  }

  const recent = state.order.slice(0, shown).map((_, k) => describeEvent(state, k, toy.loop)).slice(-4)

  return (
    <div
      className="flex flex-col gap-4 text-sm text-stone-300"
      data-testid="wire8-view"
      data-hypothesis={wire}
      data-position={where}
      data-step={shown}
      data-total={total}
    >
      <p>
        The real bombe has 26 wires in every cable, too many to follow by eye, so Graham Ellsbury drew one with only the
        letters A–H. Here is such a bombe for a menu with one loop, <Mono>{loopText(TOY8.toy.loop)}</Mono>. Each link of the loop is
        a scrambler: an Enigma without its plugboard, at the drum position for that crib letter. Every letter of the menu has a
        cable of eight wires, one per letter: wire <Mono>b</Mono> of cable <Mono>{TEST}</Mono> carries the hypothesis &ldquo;{TEST}{' '}
        is steckered to B&rdquo;.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-w-sm">
          <MenuGraph menu={toyMenu(TOY8.toy)} highlightLoop={TOY8.toy.loop} testId="wire8-menu" />
        </div>
        <div className="flex flex-col gap-2">
          <ScramblerTable
            toy={toy}
            caption={`The four scramblers ${where === 'true' ? 'at the day’s drum position' : 'at a wrong drum position'}: a partner in the top row becomes the partner below`}
            testId="wire8-tables"
          />
          <p>
            A scrambler joins wire x of one cable to wire y of the next exactly when it swaps x and y: if {TEST} is steckered to x,
            the next letter round the loop is steckered to the letter under x.
          </p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-stone-700 p-3">
        <legend className="px-1 text-sm font-semibold text-stone-200">The voltage and the drums</legend>
        <div role="radiogroup" aria-label={`Hypothesis for ${TEST}: the wire of cable ${TEST} that gets the voltage`} className="flex flex-wrap items-center gap-1">
          <span className="mr-1">Hypothesis {TEST} ↔</span>
          {TOY_LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={wire === l}
              disabled={!fired}
              data-testid={`wire8-hyp-${l}`}
              onClick={() => choose({ wire: l })}
              className={`${QUIET_BUTTON} w-9 px-0 font-mono ${wire === l ? 'border-amber-400 text-amber-100' : ''}`}
            >
              {l.toLowerCase()}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Drum position" className="flex flex-wrap gap-2">
          {(['true', 'wrong'] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={where === w}
              disabled={!fired}
              data-testid={`wire8-position-${w}`}
              onClick={() => choose({ where: w })}
              className={`${QUIET_BUTTON} ${where === w ? 'border-amber-400 text-amber-100' : ''}`}
            >
              {w === 'true' ? 'The day’s drum position' : 'A wrong drum position'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON} disabled={!fired || done} data-testid="wire8-step" onClick={() => setStep(shown + 1)}>
            Next scrambler
          </button>
          <button type="button" className={QUIET_BUTTON} disabled={!fired || done} data-testid="wire8-run" onClick={() => setStep(total)}>
            Run to the end
          </button>
          <span className="font-mono text-xs text-stone-400">
            {shown} of {total} wires lit
          </span>
        </div>
        {!fired ? <p className="text-stone-400">Place your bet below, then switch on the current.</p> : null}
      </fieldset>

      <WireBench state={state} step={shown} test={TEST} diagonal={false} testIds={{ grid: 'wire8-grid', register: 'wire8-register' }} />

      <div aria-live="polite" className="flex flex-col gap-1" data-testid="wire8-log">
        {fired ? (
          <ol className="flex flex-col gap-0.5 font-mono text-xs text-stone-300">
            {recent.map((line, k) => (
              <li key={`${shown}-${k}`}>{line}</li>
            ))}
          </ol>
        ) : null}
        {done ? (
          <p className="text-stone-200" data-testid="wire8-result">
            {live === 1
              ? `The loop gives ${wire.toLowerCase()} straight back, so the current goes nowhere else: 1 register wire is live. ${TEST}↔${wire.toLowerCase()} survives, and the bombe would stop here.`
              : live === 8
                ? `Round and round the loop the current reaches every wire: all 8 register wires are live, so every hypothesis for ${TEST} is refuted at once and the bombe moves on.`
                : `Each trip round the loop changes the partner, and the current keeps going until it is back on wire ${wire.toLowerCase()}: ${live} register wires are live (${registerText(register)}). Only one wire stays dead, and it is the one no false hypothesis can reach.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
