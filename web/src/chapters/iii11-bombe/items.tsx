/**
 * Chapter iii11-bombe's ITEM_UI. Every prompt prints what its instance needs (the loop, one table per scrambler, the
 * hypothesis); L1 hints are text in the prompt (the chapter has no stage). The custom answers are the bombe itself:
 * click-through lights the wires of the learner's own walk round the loop, grid-probe is a wire grid of buttons.
 * Worked examples and rollbacks draw their own instance's wires. Nothing answer-bearing is drawn during a question.
 */

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import type { Choice } from '../../contracts/core'
import type { WireState } from '../../crypto/bombe'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import type { Letter } from '../../engine'
import { INPUT, Mono, QUIET_BUTTON, SubmitButton } from '../../lesson'
import {
  BOARD_MYTH_QUESTION,
  TOY_LETTERS,
  VERDICT_STAGE,
  cell,
  probeBanks,
  probeStart,
  registerWires,
  testOf,
  toyLive,
  tripChain,
  walkState,
  type ClickInstance,
  type LiveInstance,
  type ProbeInstance,
  type Toy,
} from './gates'
import { ScramblerTable, WireBench, loopText, registerText } from './scenes'

const up = (i: number) => String.fromCharCode(65 + i)
const idx = (l: string) => l.toUpperCase().charCodeAt(0) - 65
const lower = (l: string) => l.toLowerCase()

function Hint({ level, children }: { level: HintLevel; children: ReactNode }): JSX.Element | null {
  if (level < 1) return null
  return (
    <p className="rounded-md border border-sky-800/60 bg-sky-950/30 p-2 text-sky-100" data-testid="item-hint">
      {children}
    </p>
  )
}

/** A wire state from a list of cells ('CF' = wire f of cable C): the first is the hypothesis, the rest follow in order. */
function stateOfCells(cells: readonly string[], n = 8): WireState {
  const live = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const order: { bank: number; wire: number; via: number | 'hypothesis' | 'diagonal' }[] = []
  cells.forEach((c, k) => {
    const [b, w] = [idx(c[0]!), idx(c[1]!)]
    if (b < 0 || b >= n || w < 0 || w >= n || live[b]![w]) return
    live[b]![w] = true
    order.push({ bank: b, wire: w, via: k === 0 ? 'hypothesis' : 1 + ((k - 1) % 26) })
  })
  return { n, live, order }
}

/** The cells of one trip round the loop from "loop[0] ↔ h", given the partner after each scrambler. */
function tripCells(loop: readonly Letter[], h: string, partners: readonly (string | null)[]): string[] {
  const k = loop.length
  const out = [cell(loop[0]!, h as Letter)]
  partners.forEach((x, j) => {
    if (x) out.push(cell(loop[(j + 1) % k]!, x as Letter))
  })
  return out
}

/** The toy in one paragraph: the loop, the test letter and the drums. */
function ToyIntro({ toy, drums }: { toy: Toy; drums?: 'true' | 'wrong' }): JSX.Element {
  return (
    <p>
      A toy bombe on the letters A–H. The menu is one loop, <Mono>{loopText(toy.loop)}</Mono>, with one scrambler per link; cable{' '}
      <Mono>{testOf(toy)}</Mono> is the test register.
      {drums === 'true' ? ' The drums are at the day’s true position.' : drums === 'wrong' ? ' The drums are at a wrong position.' : ''}
    </p>
  )
}

// ---------------------------------------------------------------------------
// click-through
// ---------------------------------------------------------------------------

function ClickPrompt({ instance, hintLevel }: { instance: ClickInstance; hintLevel: HintLevel }): JSX.Element {
  const t = testOf(instance)
  return (
    <div className="flex flex-col gap-2">
      <ToyIntro toy={instance} />
      <p>
        The voltage goes onto wire <Mono>{lower(instance.hypothesis)}</Mono> of cable {t}: the hypothesis{' '}
        <Mono>
          {t}↔{lower(instance.hypothesis)}
        </Mono>
        . Click it through the loop one scrambler at a time: for each, pick the partner it gives the next letter. Then say whether the
        loop brings back the partner you started from (C, consistent) or another one (X, a contradiction).
      </p>
      <ScramblerTable toy={instance} caption="The scramblers: a partner in the top row becomes the partner in the scrambler’s row" />
      <Hint level={hintLevel}>
        Scrambler 1 joins {instance.loop[0]} and {instance.loop[1]}: find {instance.hypothesis} in the top row; the letter under it
        in row 1 is the partner of {instance.loop[1]}. Carry that letter to row 2, and so on round the loop. The last row gives a
        partner of {t} again: compare it with {instance.hypothesis}.
      </Hint>
    </div>
  )
}

function ClickAnswer({ instance, disabled, submit }: AnswerProps<ClickInstance, string[]>): JSX.Element {
  const k = instance.loop.length
  const t = testOf(instance)
  const [picks, setPicks] = useState<(string | null)[]>(() => instance.loop.map(() => null))
  const [call, setCall] = useState<'C' | 'X' | null>(null)
  const next = picks.findIndex((x) => x === null)
  const state = useMemo(() => stateOfCells(tripCells(instance.loop, instance.hypothesis, picks)), [instance, picks])
  const complete = next === -1 && call !== null
  const pick = (j: number, l: string) => setPicks((ps) => ps.map((x, i) => (i === j ? l : x)))
  return (
    <div className="flex flex-col gap-3" data-testid="click-answer" data-picks={picks.map((x) => x ?? '-').join('')}>
      <ol className="flex flex-col gap-2">
        {instance.loop.map((a, j) => {
          const from = j === 0 ? instance.hypothesis : picks[j - 1]
          const to = instance.loop[(j + 1) % k]!
          const open = j <= (next === -1 ? k : next)
          return (
            <li key={j} className="flex flex-col gap-1">
              <span className="text-stone-300">
                Scrambler {j + 1} ({a}–{to}): {a}↔{from ? lower(from) : '?'} gives {to}↔
                <Mono>{picks[j] ? lower(picks[j]!) : '?'}</Mono>
              </span>
              <div role="radiogroup" aria-label={`Partner of ${to} after scrambler ${j + 1}`} className="flex flex-wrap gap-1">
                {TOY_LETTERS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={picks[j] === l}
                    disabled={disabled || !open}
                    data-testid={`click-pick-s${j + 1}-${l}`}
                    onClick={() => pick(j, l)}
                    className={`${QUIET_BUTTON} w-9 px-0 font-mono ${picks[j] === l ? 'border-amber-400 text-amber-100' : ''}`}
                  >
                    {lower(l)}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
      <WireBench state={state} test={t} diagonal={false} testIds={{ grid: 'click-grid', register: 'click-register' }} />
      <div role="radiogroup" aria-label="Verdict" className="flex flex-wrap gap-2">
        {(['C', 'X'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={call === v}
            disabled={disabled || next !== -1}
            data-testid={`click-verdict-${v}`}
            onClick={() => setCall(v)}
            className={`${QUIET_BUTTON} ${call === v ? 'border-amber-400 text-amber-100' : ''}`}
          >
            {v === 'C' ? 'C: consistent' : 'X: contradiction'}
          </button>
        ))}
      </div>
      <div>
        <SubmitButton disabled={disabled || !complete} onClick={() => submit([...picks.map((x) => x!), call!])} />
      </div>
    </div>
  )
}

function ClickWorked({ instance, solution }: { instance: ClickInstance; solution: string[] }): JSX.Element {
  const t = testOf(instance)
  const k = instance.loop.length
  const partners = solution.slice(0, k)
  const back = partners.at(-1)!
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ToyIntro toy={instance} />
      <ScramblerTable toy={instance} testId="worked-tables" />
      <ol className="flex flex-col gap-0.5 font-mono text-xs">
        {partners.map((x, j) => (
          <li key={j}>
            scrambler {j + 1}: {instance.loop[j]}↔{lower(j === 0 ? instance.hypothesis : partners[j - 1]!)} gives{' '}
            {instance.loop[(j + 1) % k]}↔{lower(x)}
          </li>
        ))}
      </ol>
      <p>
        Round the loop, {t}↔{lower(instance.hypothesis)} comes back as {t}↔{lower(back)}:{' '}
        {solution.at(-1) === 'C' ? 'the same partner, so C (consistent).' : 'a second partner for the same letter, so X (a contradiction).'}{' '}
        Answer <Mono>{solution.join(' ')}</Mono>.
      </p>
      <WireBench
        state={stateOfCells(tripCells(instance.loop, instance.hypothesis, partners))}
        test={t}
        diagonal={false}
        testIds={{ grid: 'worked-grid', register: 'worked-register' }}
      />
    </div>
  )
}

function ClickFeedback({ instance, answer, result }: { instance: ClickInstance; answer: string[]; result: CheckResult }): JSX.Element | null {
  const rb = result.rollback
  const k = instance.loop.length
  const reference = useMemo(() => stateOfCells(tripCells(instance.loop, instance.hypothesis, tripChain(instance, instance.hypothesis))), [instance])
  const [step, setStep] = useState(() => (rb.kind === 'wires' ? Math.min(rb.scrambler + 2, k + 1) : k + 1))
  if (rb.kind !== 'wires') return null
  const got = Array.isArray(answer) ? answer : []
  return (
    <div className="flex flex-col gap-2" data-testid="wires-feedback" data-scrambler={rb.scrambler}>
      <table className="font-mono text-xs">
        <thead>
          <tr className="text-stone-400">
            <th className="pr-3 text-left font-normal">Stage</th>
            <th className="pr-3 text-left font-normal">The scramblers give</th>
            <th className="text-left font-normal">You gave</th>
          </tr>
        </thead>
        <tbody>
          {instance.stages.map((s, j) => (
            <tr key={s.id} data-first-wrong={j === rb.scrambler ? 'true' : undefined} className={j === rb.scrambler ? 'text-red-200' : ''}>
              <td className="pr-3">{s.id === VERDICT_STAGE ? 'verdict' : `scrambler ${j + 1}`}</td>
              <td className="pr-3">{rb.expected[j]}</td>
              <td>{got[j] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="flex flex-wrap items-center gap-2 text-xs">
        Replay the current
        <input
          type="range"
          min={1}
          max={k + 1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={`${step} of ${k + 1} wires`}
          data-testid="wires-replay"
        />
      </label>
      <WireBench state={reference} step={step} test={testOf(instance)} diagonal={false} testIds={{ grid: 'rollback-grid', register: 'rollback-register' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// live-count
// ---------------------------------------------------------------------------

function LivePrompt({ instance, hintLevel }: { instance: LiveInstance; hintLevel: HintLevel }): JSX.Element {
  const t = testOf(instance)
  const [x, y] = instance.hypotheses
  return (
    <div className="flex flex-col gap-2">
      <ToyIntro toy={instance} drums="true" />
      <ScramblerTable toy={instance} caption="The scramblers: a partner in the top row becomes the partner in the scrambler’s row" />
      <p>
        The voltage goes onto wire <Mono>{lower(x)}</Mono> of cable {t} (the hypothesis {t}↔{lower(x)}), and in a second test onto wire{' '}
        <Mono>{lower(y)}</Mono> ({t}↔{lower(y)}). Once the current has spread through every scrambler, how many of the 8 wires of the
        test register are live in each test?
      </p>
      <Hint level={hintLevel}>
        Take each hypothesis once round the loop with the tables. If it comes back as the same partner, the current has nowhere else
        to go. If it comes back changed, the current carries on round the loop from the new wire, and on, until it returns to the wire
        it started from: every wire it passes in cable {t} is live.
      </Hint>
    </div>
  )
}

function LiveAnswer({ instance, disabled, submit }: AnswerProps<LiveInstance, number[]>): JSX.Element {
  const [fields, setFields] = useState(['', ''])
  const values = fields.map((f) => (f.trim() === '' ? NaN : Number(f)))
  const valid = values.every((v) => Number.isInteger(v))
  const t = testOf(instance)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !disabled) submit(values)
      }}
    >
      <div className="flex flex-wrap gap-4">
        {instance.hypotheses.map((h, k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-stone-300">
            {t}↔{lower(h)}: live register wires
            <input
              data-testid={`answer-number-${k}`}
              className={`${INPUT} w-16`}
              value={fields[k]}
              disabled={disabled}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => setFields((all) => all.map((f, j) => (j === k ? e.target.value : f)))}
            />
          </label>
        ))}
      </div>
      <div>
        <SubmitButton form disabled={disabled || !valid} />
      </div>
    </form>
  )
}

function LiveWorked({ instance, solution }: { instance: LiveInstance; solution: number[] }): JSX.Element {
  const t = testOf(instance)
  const falseOne = instance.hypotheses.find((h) => toyLive(instance, h) !== 1) ?? instance.hypotheses[0]
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ToyIntro toy={instance} drums="true" />
      <ScramblerTable toy={instance} testId="worked-tables" />
      <ul className="flex flex-col gap-1">
        {instance.hypotheses.map((h, k) => {
          const back = tripChain(instance, h).at(-1)!
          return (
            <li key={k}>
              {t}↔{lower(h)} comes back round the loop as {t}↔{lower(back)}
              {back === h
                ? ': the same partner, so the current stops there. 1 wire.'
                : `: changed, so the current carries on. Live: ${registerText(TOY_LETTERS.map((w) => registerWires(instance, h).includes(w)))}.`}
            </li>
          )
        })}
      </ul>
      <p>
        Answer <Mono>{solution.join(' and ')}</Mono>.
      </p>
      <WireBench state={walkState(instance, falseOne)} test={t} diagonal={false} testIds={{ grid: 'worked-grid', register: 'worked-register' }} />
    </div>
  )
}

function LiveFeedback({ instance, result }: { instance: LiveInstance; answer: number[]; result: CheckResult }): JSX.Element | null {
  const rb = result.rollback
  const h = rb.kind === 'wires' ? instance.hypotheses[rb.scrambler] ?? instance.hypotheses[0] : instance.hypotheses[0]
  const state = useMemo(() => walkState(instance, h), [instance, h])
  const [step, setStep] = useState(state.order.length)
  if (rb.kind !== 'wires') return null
  return (
    <div className="flex flex-col gap-2" data-testid="wires-feedback" data-scrambler={rb.scrambler}>
      <p>
        The current from {testOf(instance)}↔{lower(h)}, scrambler by scrambler:
      </p>
      <label className="flex flex-wrap items-center gap-2 text-xs">
        Replay the current
        <input
          type="range"
          min={1}
          max={state.order.length}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={`${step} of ${state.order.length} wires`}
          data-testid="wires-replay"
        />
      </label>
      <WireBench state={state} step={step} test={testOf(instance)} diagonal={false} testIds={{ grid: 'rollback-grid', register: 'rollback-register' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// board-myth
// ---------------------------------------------------------------------------

const boardMyth = {
  Prompt: () => <p>{BOARD_MYTH_QUESTION}</p>,
  Worked: ({ instance, solution }: { instance: { options: readonly Choice[] }; solution: string }) => (
    <p className="text-sm">
      {instance.options.find((o) => o.id === solution)?.label}. The board is Welchman’s: it joins wire k of cable A to wire a of cable
      K, because a plugboard cable works both ways.
    </p>
  ),
}

// ---------------------------------------------------------------------------
// grid-probe (the fallback)
// ---------------------------------------------------------------------------

function ProbePrompt({ instance, hintLevel }: { instance: ProbeInstance; hintLevel: HintLevel }): JSX.Element {
  const t = testOf(instance)
  const h = lower(instance.hypothesis)
  return (
    <div className="flex flex-col gap-2">
      <ToyIntro toy={instance} drums={instance.mode === 'register' ? instance.position : undefined} />
      <ScramblerTable toy={instance} caption="The scramblers: a partner in the top row becomes the partner in the scrambler’s row" />
      {instance.mode === 'trip' ? (
        <p>
          The voltage is on wire {h} of cable {t} (lit). On the wire grid, mark every wire that one trip round the loop lights: the
          partner each scrambler gives the next letter, up to and including the partner the last scrambler gives {t}.
        </p>
      ) : (
        <p>
          The voltage is on wire {h} of cable {t} (lit). On the wire grid, mark every wire of row {t}, the test register, that is live
          once the current has spread through the loop as far as it can. The other rows are yours for working.
        </p>
      )}
      <Hint level={hintLevel}>
        Follow the partner through the tables one scrambler at a time and mark each wire as you reach it
        {instance.mode === 'register' ? '; when the loop brings back a new wire of cable ' + t + ', go round again from that wire' : ''}.
      </Hint>
    </div>
  )
}

function ProbeAnswer({ instance, disabled, submit }: AnswerProps<ProbeInstance, string[]>): JSX.Element {
  const start = probeStart(instance)
  const [marked, setMarked] = useState<readonly string[]>([])
  const state = useMemo(() => stateOfCells([start, ...marked]), [start, marked])
  const toggle = (b: number, w: number) => {
    const c = up(b) + up(w)
    if (disabled || c === start) return
    setMarked((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c]))
  }
  const judged = new Set(probeBanks(instance))
  return (
    <div className="flex flex-col gap-3" data-testid="probe-answer" data-marked={[...marked].sort().join(' ')}>
      <p className="text-xs text-stone-400">
        Click a cell (or move with the arrow keys and press Enter) to mark it live; click again to clear it. Judged: row
        {judged.size > 1 ? 's' : ''} {[...judged].join(', ')}.
      </p>
      <WireBench state={state} test={testOf(instance)} diagonal={false} onToggleWire={toggle} testIds={{ grid: 'probe-grid', register: 'probe-register' }} />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit([start, ...marked])} />
      </div>
    </div>
  )
}

function ProbeWorked({ instance, solution }: { instance: ProbeInstance; solution: string[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ToyIntro toy={instance} drums={instance.mode === 'register' ? instance.position : undefined} />
      <ScramblerTable toy={instance} testId="worked-tables" />
      <p>
        From {testOf(instance)}↔{lower(instance.hypothesis)} the live wires are{' '}
        <Mono>{solution.map((c) => `${c[0]}${lower(c[1]!)}`).join(' ')}</Mono>.
      </p>
      <WireBench state={stateOfCells([probeStart(instance), ...solution])} test={testOf(instance)} diagonal={false} testIds={{ grid: 'worked-grid', register: 'worked-register' }} />
    </div>
  )
}

function ProbeFeedback({ instance, result }: { instance: ProbeInstance; answer: string[]; result: CheckResult }): JSX.Element | null {
  const rb = result.rollback
  if (rb.kind !== 'wires') return null
  const reference = instance.mode === 'register' ? walkState(instance, instance.hypothesis) : stateOfCells([probeStart(instance), ...tripCells(instance.loop, instance.hypothesis, tripChain(instance, instance.hypothesis)).slice(1)])
  return (
    <div className="flex flex-col gap-2" data-testid="wires-feedback">
      <p>The wires the current really reaches:</p>
      <WireBench state={reference} test={testOf(instance)} diagonal={false} testIds={{ grid: 'rollback-grid', register: 'rollback-register' }} />
    </div>
  )
}

export const ITEM_UI: ItemUiMap = {
  'click-through': { Prompt: ClickPrompt, Answer: ClickAnswer, Worked: ClickWorked, Feedback: ClickFeedback },
  'live-count': { Prompt: LivePrompt, Answer: LiveAnswer, Worked: LiveWorked, Feedback: LiveFeedback },
  'board-myth': boardMyth,
  'grid-probe': { Prompt: ProbePrompt, Answer: ProbeAnswer, Worked: ProbeWorked, Feedback: ProbeFeedback },
}
