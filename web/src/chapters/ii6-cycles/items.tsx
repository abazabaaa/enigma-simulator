/**
 * Chapter ii6-cycles' ITEM_UI. Every Prompt prints what its item needs: the two swap tables, the day's AD and cables,
 * the cycles to line up. During a question no diagram shows an answer: the stecker item draws the day's own AD, never
 * the one after the learner's cable. The cycles rollbacks draw the product and walk the cycle the learner missed.
 */

import { useState, type JSX } from 'react'
import type { CodeAnswer } from '../../contracts/code'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import type { MachineConfig } from '../../contracts/core'
import { alignmentPairs } from '../../crypto'
import { compose, cycles, formatCycles, fromPairs } from '../../engine'
import { LetterTable, Mono, SubmitButton } from '../../lesson'
import { CycleAlign } from '../../viz'
import {
  L,
  adOf,
  alignRight,
  alignTruth,
  canonLengths,
  cycleOf,
  cycleText,
  dash,
  idx,
  relabelAnswer,
  steckerSolutions,
  type AlignAnswer,
  type AlignInstance,
  type AlignPair,
  type Alignment,
  type CycleLengthsInstance,
  type LengthsInstance,
  type RelabelInstance,
  type SteckerInstance,
} from './gates'
import { Diagram } from './scenes/parts'

const images = (p: readonly number[]) => p.map(L).join('')
const cables = (c: MachineConfig) => (c.plugboard.length ? c.plugboard.map(dash).join(', ') : 'none')

/** One cycle of XY traced: each letter goes through X, then Y. */
function CycleWalk({ x, y, cycle }: { x: readonly number[]; y: readonly number[]; cycle: readonly number[] }): JSX.Element {
  return (
    <ol className="flex flex-col gap-0.5 font-mono text-sm" aria-label="The cycle, letter by letter">
      {cycle.map((c) => (
        <li key={c}>
          {L(c).toLowerCase()} →<sub>X</sub> {L(x[c]!).toLowerCase()} →<sub>Y</sub> {L(y[x[c]!]!).toLowerCase()}
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// lengths
// ---------------------------------------------------------------------------

function LengthsPrompt({ instance, hintLevel }: { instance: LengthsInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        X and Y each swap the first {instance.n} letters in pairs. What are the cycle lengths of XY, X first and then Y?
        List them, longest first.
      </p>
      <LetterTable images={images(instance.x)} label="X" n={instance.n} />
      <LetterTable images={images(instance.y)} label="Y" n={instance.n} />
      {hintLevel >= 1 ? (
        <p data-testid="lengths-hint" className="text-sky-200">
          Start at A: look A up in X, then look the result up in Y. Keep going until you are back at A; that is one cycle.
          Then start again at the first letter you have not visited.
        </p>
      ) : null}
    </div>
  )
}

/** What a wrong list of cycle lengths missed: the cycle to walk, or too many numbers. */
function Missed({ rb }: { rb: { cycle: readonly number[]; expected: readonly number[]; got: readonly number[] } }): JSX.Element {
  return rb.cycle.length ? (
    <>
      Walk the highlighted cycle, {cycleText(rb.cycle)}: {rb.cycle.length} {rb.cycle.length === 1 ? 'letter' : 'letters'}.
    </>
  ) : (
    <>
      Every cycle is in your list, but you listed {rb.got.length} lengths for {rb.expected.length} cycles.
    </>
  )
}

function LengthsFeedback({ instance, result }: { instance: LengthsInstance; answer: number[]; result: CheckResult }): JSX.Element | null {
  const rb = result.rollback
  if (rb.kind !== 'cycles') return null
  return (
    <div className="flex flex-col gap-2" data-testid="lengths-feedback">
      <p>
        You counted <Mono>{rb.got.join(' ') || 'nothing'}</Mono>. Here is XY drawn as cycles. <Missed rb={rb} />
      </p>
      {rb.cycle.length ? <CycleWalk x={instance.x} y={instance.y} cycle={rb.cycle} /> : null}
      <Diagram perm={rb.perm} n={instance.n} highlightCycle={rb.cycle} testId="lengths-diagram" label="XY as cycles" />
    </div>
  )
}

const lengths = {
  Prompt: LengthsPrompt,
  Worked: ({ instance, solution }: { instance: LengthsInstance; solution: number[] }) => {
    const p = compose(instance.x, instance.y)
    return (
      <div className="flex flex-col gap-1 text-sm">
        <LetterTable images={images(instance.x)} label="X" n={instance.n} />
        <LetterTable images={images(instance.y)} label="Y" n={instance.n} />
        <p>From A, through X and then Y, until A comes back:</p>
        <CycleWalk x={instance.x} y={instance.y} cycle={cycles(p)[0]!} />
        <p>
          XY = <Mono>{formatCycles(p)}</Mono>: lengths <Mono>{solution.join(' ')}</Mono>, in equal pairs.
        </p>
      </div>
    )
  },
  Feedback: LengthsFeedback,
}

// ---------------------------------------------------------------------------
// relabel
// ---------------------------------------------------------------------------

function DayAd({ day }: { day: MachineConfig }): JSX.Element {
  return (
    <p>
      The day&apos;s machine at its Grundstellung has the cables <Mono>{cables(day)}</Mono>. Its AD is{' '}
      <Mono className="break-all">{formatCycles(adOf(day))}</Mono>.
    </p>
  )
}

function RelabelPrompt({ instance, hintLevel }: { instance: RelabelInstance; hintLevel: HintLevel }): JSX.Element {
  const [x, y] = [instance.cable[0]!, instance.cable[1]!]
  return (
    <div className="flex flex-col gap-2">
      <DayAd day={instance.day} />
      <p>
        An operator adds one more cable, <Mono>{dash(instance.cable)}</Mono>. Write the cycle of the new AD that contains{' '}
        <Mono>{x}</Mono>, starting with <Mono>{x}</Mono> ({instance.length} letters).
      </p>
      {hintLevel >= 1 ? (
        <p data-testid="relabel-hint" className="text-sky-200">
          A new cable renames letters: wherever {x.toLowerCase()} stands in AD&apos;s cycles, write{' '}
          {y.toLowerCase()}, and the other way round. Nothing else moves.
        </p>
      ) : null}
    </div>
  )
}

function RelabelFeedback({ instance, answer, result }: { instance: RelabelInstance; answer: string; result: CheckResult }): JSX.Element | null {
  if (result.rollback.kind !== 'cycles') return null
  const ad = adOf(instance.day)
  const [x, y] = [idx(instance.cable[0]!), idx(instance.cable[1]!)]
  const moved = cycleOf(ad, y)
  return (
    <div className="flex flex-col gap-2" data-testid="relabel-feedback">
      <p>
        You wrote <Mono>{String(answer ?? '') || '—'}</Mono>. The cable swaps {L(x).toLowerCase()} and {L(y).toLowerCase()}{' '}
        in every cycle of AD: {cycleText(moved)} becomes {cycleText(moved.map((c) => (c === y ? x : c)))}, which read from{' '}
        {L(x)} is <Mono>{relabelAnswer(instance)}</Mono>. The diagram keeps AD&apos;s shape and renames the two letters.
      </p>
      <Diagram
        perm={ad}
        relabelBy={fromPairs([instance.cable])}
        highlightCycle={moved}
        testId="relabel-diagram"
        label="The new AD as cycles"
      />
    </div>
  )
}

const relabel = {
  Prompt: RelabelPrompt,
  Worked: ({ instance, solution }: { instance: RelabelInstance; solution: string }) => {
    const ad = adOf(instance.day)
    const y = idx(instance.cable[1]!)
    return (
      <div className="flex flex-col gap-1 text-sm">
        <DayAd day={instance.day} />
        <p>
          The new cable <Mono>{dash(instance.cable)}</Mono> renames {instance.cable[0]!.toLowerCase()} and{' '}
          {instance.cable[1]!.toLowerCase()}. The cycle {cycleText(cycleOf(ad, y))} that held{' '}
          {instance.cable[1]!.toLowerCase()} now holds {instance.cable[0]!.toLowerCase()}: from {instance.cable[0]} it reads{' '}
          <Mono>{solution}</Mono>.
        </p>
      </div>
    )
  },
  Feedback: RelabelFeedback,
}

// ---------------------------------------------------------------------------
// stecker-set (set-machine)
// ---------------------------------------------------------------------------

function SteckerPrompt({ instance, hintLevel }: { instance: SteckerInstance; hintLevel: HintLevel }): JSX.Element {
  const day = instance.setup.machine
  const ad = adOf(day)
  const [x, y] = [idx(instance.x), idx(instance.y)]
  return (
    <div className="flex flex-col gap-2">
      <DayAd day={day} />
      <p>
        <Mono>{instance.x}</Mono> is in {cycleText(cycleOf(ad, x))} and <Mono>{instance.y}</Mono> in{' '}
        {cycleText(cycleOf(ad, y))}. Add exactly one new cable so that {instance.x} and {instance.y} end up in the same
        cycle of AD. Keep the day&apos;s cables.
      </p>
      <Diagram perm={ad} highlightCycle={[x, y]} testId="stecker-set-ad" label="The day's AD as cycles" />
      {hintLevel >= 1 ? (
        <p data-testid="stecker-set-hint" className="text-sky-200">
          A new cable joining two free letters swaps those two letters in AD&apos;s cycles. Which swap moves{' '}
          {instance.x} into the cycle of {instance.y}, or {instance.y} into the cycle of {instance.x}?
        </p>
      ) : null}
    </div>
  )
}

const steckerSet = {
  Prompt: SteckerPrompt,
  Worked: ({ instance, solution }: { instance: SteckerInstance; solution: MachineConfig }) => {
    const day = instance.setup.machine
    const added = solution.plugboard.find((p) => !day.plugboard.includes(p)) ?? steckerSolutions(day, instance.x, instance.y)[0]!
    const ad = adOf(solution)
    return (
      <div className="flex flex-col gap-1 text-sm">
        <DayAd day={day} />
        <p>
          The cable <Mono>{dash(added)}</Mono> swaps {added[0]!.toLowerCase()} and {added[1]!.toLowerCase()} in AD, so AD
          becomes <Mono className="break-all">{formatCycles(ad)}</Mono>: {instance.x} and {instance.y} now share{' '}
          {cycleText(cycleOf(ad, idx(instance.x)))}.
        </p>
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// cycle-lengths (code)
// ---------------------------------------------------------------------------

function CycleLengthsPrompt({ instance, hintLevel }: { instance: CycleLengthsInstance; hintLevel: HintLevel }): JSX.Element {
  const ad = adOf(instance.day)
  return (
    <div className="flex flex-col gap-2">
      <p>
        A day&apos;s machine with the cables <Mono>{cables(instance.day)}</Mono> gives this AD (the letter each letter is sent
        to):
      </p>
      <LetterTable images={images(ad)} label="AD" />
      <p className="text-xs text-stone-300">
        As an array: <Mono className="break-all">[{ad.join(', ')}]</Mono>
      </p>
      <p>
        Predict <Mono>cycleLengths(AD)</Mono>, then write <Mono>cycleLengths</Mono> and run it on the hidden tests.
      </p>
      {hintLevel >= 1 ? (
        <p data-testid="cycle-lengths-hint" className="text-sky-200">
          Follow A through the table until it comes back, counting the letters; then start again at the first letter not
          yet visited. The lengths come in equal pairs.
        </p>
      ) : null}
    </div>
  )
}

function CycleLengthsFeedback({ instance, answer, result }: { instance: CycleLengthsInstance; answer: CodeAnswer; result: CheckResult }): JSX.Element | null {
  const rb = result.rollback
  if (rb.kind !== 'cycles') return null
  const predictedRight = canonLengths(answer?.probe) === rb.expected.join(' ')
  return (
    <div className="flex flex-col gap-2" data-testid="cycle-lengths-feedback" data-prediction={predictedRight ? 'right' : 'wrong'}>
      {predictedRight ? (
        <p>
          Your prediction <Mono>{String(answer?.probe ?? '')}</Mono> was right: this day&apos;s AD has the lengths{' '}
          <Mono>{rb.expected.join(' ')}</Mono>. It is your function that failed a hidden case; the case above shows what it
          returned.
        </p>
      ) : (
        <p>
          You predicted <Mono>{String(answer?.probe ?? '') || '—'}</Mono>. This day&apos;s AD has the lengths{' '}
          <Mono>{rb.expected.join(' ')}</Mono>. <Missed rb={rb} />
        </p>
      )}
      <Diagram perm={adOf(instance.day)} highlightCycle={rb.cycle} testId="cycle-lengths-diagram" label="This day's AD as cycles" />
    </div>
  )
}

const cycleLengths = {
  Prompt: CycleLengthsPrompt,
  // Never the reference source: the method on that instance.
  Worked: ({ instance, solution }: { instance: CycleLengthsInstance; solution: CodeAnswer }) => (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Walk each letter not yet seen until it returns, and count. That day&apos;s AD is{' '}
        <Mono className="break-all">{formatCycles(adOf(instance.day))}</Mono>, so the lengths, longest first, are{' '}
        <Mono>{solution.probe}</Mono>.
      </p>
    </div>
  ),
  Feedback: CycleLengthsFeedback,
}

// ---------------------------------------------------------------------------
// align-pair (custom)
// ---------------------------------------------------------------------------

function AlignPrompt({ instance, hintLevel }: { instance: AlignInstance; hintLevel: HintLevel }): JSX.Element {
  const [c, h] = instance.pairs[0]!.clue
  return (
    <div className="flex flex-col gap-2">
      <p>
        X and Y each swap {instance.n} letters in pairs, and XY (X first) is{' '}
        <Mono className="break-all">{formatCycles(instance.product)}</Mono>. X pairs each cycle with a partner of the same
        length, one letter to one letter. One swap of X is known for each pair:
      </p>
      <ol className="list-decimal pl-5">
        {instance.pairs.map((p, k) => (
          <li key={k}>
            <Mono>{cycleText(p.a)}</Mono> with <Mono>{cycleText(p.b)}</Mono>: X swaps <Mono>{L(p.clue[0])}</Mono> and{' '}
            <Mono>{L(p.clue[1])}</Mono>.
          </li>
        ))}
      </ol>
      <p>Slide and turn each lower cycle until every column is a swap of X, then submit.</p>
      {hintLevel >= 1 ? (
        <p data-testid="align-pair-hint" className="text-sky-200">
          In pair 1, put {L(c).toLowerCase()} and {L(h).toLowerCase()} in one column. Moving right along the upper cycle,
          the partner moves left along the lower one. The same holds in every pair.
        </p>
      ) : null}
    </div>
  )
}

function AlignAnswerView({ instance, disabled, submit }: AnswerProps<AlignInstance, AlignAnswer>): JSX.Element {
  const [answer, setAnswer] = useState<Alignment[]>(() => instance.pairs.map(() => ({ offset: 0, reversed: false })))
  return (
    <div className="flex flex-col gap-3" data-testid="align-pair">
      {instance.pairs.map((p, k) => (
        <section key={k} className="flex flex-col gap-1" aria-label={`Pair ${k + 1}`}>
          <p className="text-xs text-stone-400">
            Pair {k + 1}: {cycleText(p.a)} over {cycleText(p.b)}; X swaps {L(p.clue[0])} and {L(p.clue[1])}
          </p>
          <CycleAlign
            a={p.a}
            b={p.b}
            offset={answer[k]!.offset}
            reversed={answer[k]!.reversed}
            onChange={(offset, reversed) => {
              if (!disabled) setAnswer((all) => all.map((x, j) => (j === k ? { offset, reversed } : x)))
            }}
            testId={`align-pair-${k}`}
          />
        </section>
      ))}
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(answer.map((x) => ({ ...x })))} />
      </div>
    </div>
  )
}

function AlignColumns({ pair, alignment, label }: { pair: AlignPair; alignment: Alignment | undefined; label: string }): JSX.Element {
  const truth = new Set(alignTruth(pair))
  const cols = alignmentPairs(pair.a, pair.b, Number(alignment?.offset) || 0, !!alignment?.reversed)
  return (
    <ol className="flex flex-wrap gap-1 font-mono text-sm" aria-label={label}>
      {cols.map(([u, v]) => {
        const ok = truth.has([L(u), L(v)].sort().join(''))
        return (
          <li
            key={u}
            data-ok={String(ok)}
            className={`rounded border px-1 ${ok ? 'border-emerald-600 text-emerald-200' : 'border-red-500/70 text-red-200'}`}
          >
            {L(u).toLowerCase()}
            {L(v).toLowerCase()} {ok ? '✓' : '✗'}
          </li>
        )
      })}
    </ol>
  )
}

const alignPair = {
  Prompt: AlignPrompt,
  Answer: AlignAnswerView,
  Worked: ({ instance, solution }: { instance: AlignInstance; solution: AlignAnswer }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        XY = <Mono className="break-all">{formatCycles(instance.product)}</Mono>. In each pair the clue sits in one column
        and the lower cycle is read backwards:
      </p>
      {instance.pairs.map((p, k) => (
        <div key={k} className="flex flex-col gap-1">
          <p>
            {cycleText(p.a)} over {cycleText(p.b)}, {L(p.clue[0]).toLowerCase()} over {L(p.clue[1]).toLowerCase()} (offset{' '}
            {solution[k]?.offset}):
          </p>
          <AlignColumns pair={p} alignment={solution[k]} label={`Pair ${k + 1}, lined up`} />
        </div>
      ))}
    </div>
  ),
  Feedback: ({ instance, answer, result }: { instance: AlignInstance; answer: AlignAnswer; result: CheckResult }) =>
    result.correct ? null : (
      <div className="flex flex-col gap-2" data-testid="align-pair-feedback">
        <p>Your columns; the crossed ones are not swaps of X:</p>
        {instance.pairs.map((p, k) => (
          <div key={k} className="flex flex-col gap-1" data-testid={`align-pair-feedback-${k}`} data-right={String(alignRight(p, answer?.[k]))}>
            <p className="text-xs text-stone-400">
              Pair {k + 1}, the lower cycle read {answer?.[k]?.reversed ? 'backwards' : 'forwards'}
            </p>
            <AlignColumns pair={p} alignment={answer?.[k]} label={`Pair ${k + 1}, your columns`} />
          </div>
        ))}
      </div>
    ),
}

export const ITEM_UI: ItemUiMap = {
  lengths,
  relabel,
  'stecker-set': steckerSet,
  'cycle-lengths': cycleLengths,
  'align-pair': alignPair,
}
