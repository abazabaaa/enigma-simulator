/**
 * wire-8: Ellsbury's eight-letter bombe. A menu of two loops through the test letter (six scramblers on A–H). The bet
 * (how many register wires a wrong hypothesis lights) gates the current; then the learner steps it through the
 * scramblers one at a time, tries other hypotheses and a wrong drum position.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { Letter } from '../../../engine'
import { BUTTON, Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { MenuGraph } from '../../../viz'
import { TOY8, TOY8_FIRST_LIVE, TOY8_FIRST_WIRE, TOY_LETTERS, menuToyState } from '../gates'
import { ScramblerTable, WireBench, describeEvent, menuLabels, registerAt, registerText } from './Bench'

const TEST = TOY8.truth.test
const LOOPS = [0, 3].map((j) => [...TOY8.truth.menu.edges.slice(j, j + 3).map((e) => e.a), TOY8.truth.test].join(' → '))

export function Wire8View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('live8')
  const [wire, setWire] = useState<Letter>(TOY8_FIRST_WIRE)
  const [where, setWhere] = useState<'true' | 'wrong'>('true')
  const toy = where === 'true' ? TOY8.truth : TOY8.wrong
  const state = useMemo(() => menuToyState(toy, wire), [toy, wire])
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

  const recent = state.order.slice(0, shown).map((_, k) => describeEvent(state, k, toy.menu, toy.tables)).slice(-4)

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
        letters A–H. Here is such a bombe for a menu with two loops through {TEST}: <Mono>{LOOPS[0]}</Mono> and{' '}
        <Mono>{LOOPS[1]}</Mono>. Each link is a scrambler: an Enigma without its plugboard, at the drum position for that crib
        letter. Every letter of the menu has a cable of eight wires, one per letter: wire <Mono>b</Mono> of cable <Mono>{TEST}</Mono>{' '}
        carries the hypothesis &ldquo;{TEST} is steckered to B&rdquo;. Cable {TEST} is the test register.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-w-sm">
          <MenuGraph menu={TOY8.truth.menu} testId="wire8-menu" />
        </div>
        <div className="flex flex-col gap-2">
          <ScramblerTable
            labels={menuLabels(toy.menu)}
            tables={toy.tables}
            caption={`The six scramblers ${where === 'true' ? 'at the day’s drum position' : 'at a wrong drum position'}: a partner in the top row becomes the partner below`}
            testId="wire8-tables"
          />
          <p>
            A scrambler joins wire x of one cable to wire y of the other exactly when it swaps x and y: if one of its letters is
            steckered to x, the other is steckered to the letter under x. The voltage spreads along every such join.
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
          <span className="font-mono text-xs text-stone-400" data-testid="wire8-count">
            {fired ? `${shown} of ${total} wires lit` : '1 wire lit'}
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
                ? `Round the two loops the current reaches every wire: all 8 register wires are live, so every hypothesis for ${TEST} is refuted at once and the bombe moves on.`
                : `Every trip round a loop changes the partner, and the current keeps going until there is nowhere new to go: ${live} register wires are live (${registerText(register)}). Only wire ${TOY_LETTERS.find((_, w) => !register[w])!.toLowerCase()} stays dead: the one wire no false hypothesis can reach.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
