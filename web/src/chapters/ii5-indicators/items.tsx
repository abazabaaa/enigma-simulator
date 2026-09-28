/**
 * Chapter ii5-indicators' ITEM_UI. Every Prompt prints what its item needs (the indicators, the letters to fill);
 * `fill-ad` brings its own Answer (the AD table, editable only in its 8 outlined cells) and, like `build-ad`, a
 * Feedback for its perm rollback: the indicator that defines each wrong cell slides into it.
 */

import { useState, type JSX } from 'react'
import type { Choice } from '../../contracts/core'
import type { CodeAnswer } from '../../contracts/code'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { Mono, SubmitButton } from '../../lesson'
import { PermTable } from '../../machine-ui'
import { useReducedMotion } from '../../state/uiStore'
import {
  FILL_COUNT,
  L,
  adOf,
  idx,
  indicatorWith,
  spaced,
  type BuildAdInstance,
  type FillAdAnswer,
  type FillAdInstance,
  type FixedPointInstance,
} from './gates'
import { DefiningPair, FillTable, IndicatorChips, IndicatorPair, Wide } from './scenes/parts'

// ---------------------------------------------------------------------------
// fill-ad
// ---------------------------------------------------------------------------

function FillAdPrompt({ instance, hintLevel }: { instance: FillAdInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        {instance.indicators.length} indicators sent on one day. Each is a three-letter message key typed twice from the
        day&apos;s Grundstellung.
      </p>
      <IndicatorChips indicators={instance.indicators} label="The day's indicators" testId="fill-ad-indicators" />
      <p>
        Fill the {FILL_COUNT} outlined cells of AD&apos;s table: under each outlined letter, type the letter AD sends it
        to.
      </p>
      {hintLevel >= 1 ? (
        <p data-testid="fill-ad-hint" className="text-sky-200">
          Letters 1 and 4 of an indicator come from the same key letter. Find an indicator that starts with the outlined
          letter: its 4th letter is where AD sends it.
        </p>
      ) : null}
    </div>
  )
}

function FillAdAnswerView({ instance, disabled, submit }: AnswerProps<FillAdInstance, FillAdAnswer>): JSX.Element {
  const [values, setValues] = useState<string[]>(() => instance.targets.map(() => ''))
  const complete = values.every((v) => /^[A-Z]$/.test(v))
  return (
    <div className="flex flex-col gap-3" data-testid="fill-ad">
      <FillTable
        targets={instance.targets}
        values={values}
        onChange={(k, v) => setValues((all) => all.map((x, j) => (j === k ? v : x)))}
        disabled={disabled}
        testId="fill-ad-table"
        label="AD's table: the outlined cells are yours"
      />
      <p className="text-xs text-stone-400" aria-live="polite">
        {values.filter((v) => v).length} of {FILL_COUNT} cells filled.
      </p>
      <div>
        <SubmitButton disabled={disabled || !complete} onClick={() => submit([...values])} />
      </div>
    </div>
  )
}

/** For each wrong cell, the indicator that defines it (the first one starting with that letter). */
function PermWhy(p: {
  indicators: readonly string[]
  wrongCells: readonly number[]
  typed: (cell: number) => string
  testId: string
}): JSX.Element {
  const reducedMotion = useReducedMotion()
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label="The indicators that define the wrong cells">
      {p.wrongCells.map((x) => {
        const ind = indicatorWith(p.indicators, 0, x)
        return ind ? (
          <DefiningPair
            key={x}
            indicator={ind}
            typed={p.typed(x)}
            reducedMotion={reducedMotion}
            testId={`${p.testId}-${L(x)}`}
          />
        ) : null
      })}
    </ul>
  )
}

function FillAdFeedback({
  instance,
  answer,
  result,
}: {
  instance: FillAdInstance
  answer: FillAdAnswer
  result: CheckResult
}): JSX.Element | null {
  if (result.rollback.kind !== 'perm') return null
  const wrong = result.rollback.wrongCells
  const typed = (x: number) => String(answer?.[instance.targets.indexOf(x)] ?? '')
  const mine = Array.from({ length: 26 }, (_, x) => {
    const k = instance.targets.indexOf(x)
    const v = k === -1 ? '' : typed(x)
    return v ? idx(v) : null
  })
  return (
    <div className="flex flex-col gap-2" data-testid="fill-ad-feedback">
      <p>
        Your table, with the {wrong.length === 1 ? 'wrong cell' : `${wrong.length} wrong cells`} outlined. The indicator
        that defines each one slides into it: its letter 1 goes to its letter 4.
      </p>
      <Wide>
        <PermTable perm={mine} highlight={wrong} label="Your cells of AD" testId="fill-ad-yours" />
      </Wide>
      <PermWhy indicators={instance.indicators} wrongCells={wrong} typed={typed} testId="fill-ad-why" />
    </div>
  )
}

function FillAdWorked({ instance, solution }: { instance: FillAdInstance; solution: FillAdAnswer }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <IndicatorChips indicators={instance.indicators} label="That day's indicators" />
      <p>For each outlined letter, the indicator that starts with it gives its image as letter 4:</p>
      <ul className="flex flex-col gap-0.5">
        {instance.targets.map((x, k) => {
          const ind = indicatorWith(instance.indicators, 0, x)
          return (
            <li key={x}>
              {ind ? <IndicatorPair indicator={ind} pos={0} /> : null} ⇒ AD sends <Mono>{L(x)}</Mono> to{' '}
              <Mono>{solution[k]}</Mono>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ad-fixed-point
// ---------------------------------------------------------------------------

const adFixedPoint = {
  Prompt: ({ instance }: { instance: FixedPointInstance }) => (
    <div className="flex flex-col gap-1">
      <p>
        Two indicators sent on one day: <Mono>{spaced(instance.evidence[0]!)}</Mono> and{' '}
        <Mono>{spaced(instance.evidence[1]!)}</Mono>. In both, letters 1 and 4 are <Mono>{instance.letter}</Mono>: this
        day&apos;s AD sends <Mono>{instance.letter}</Mono> to <Mono>{instance.letter}</Mono>.
      </p>
      <p>What does that tell you?</p>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: FixedPointInstance; solution: string }) => (
    <p className="text-sm">
      {instance.options.find((o: Choice) => o.id === solution)?.label}. Press 1 (A) takes {instance.letter} to a key
      letter, and press 4 (D) takes that key letter back to {instance.letter}. Neither press sends a letter to itself;
      only their product does, which is allowed.
    </p>
  ),
}

// ---------------------------------------------------------------------------
// build-ad (code)
// ---------------------------------------------------------------------------

function BuildAdPrompt({ instance, hintLevel }: { instance: BuildAdInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>Indicators sent on one day:</p>
      <IndicatorChips indicators={instance.indicators} label="The day's indicators" testId="build-ad-indicators" />
      <p>
        Predict <Mono>AD({instance.letter})</Mono> for these indicators, then write <Mono>buildAD</Mono> and run it on the
        hidden tests.
      </p>
      {hintLevel >= 1 ? (
        <p data-testid="build-ad-hint" className="text-sky-200">
          AD sends letter 1 of an indicator to its letter 4; a letter that starts no indicator stays &apos;?&apos;.
        </p>
      ) : null}
    </div>
  )
}

function BuildAdFeedback({
  instance,
  answer,
  result,
}: {
  instance: BuildAdInstance
  answer: CodeAnswer
  result: CheckResult
}): JSX.Element | null {
  if (result.rollback.kind !== 'perm') return null
  const wrong = result.rollback.wrongCells
  const probeCell = idx(instance.letter)
  if (wrong.length === 1 && wrong[0] === probeCell && indicatorWith(instance.indicators, 0, probeCell)) {
    return (
      <div className="flex flex-col gap-1" data-testid="build-ad-feedback">
        <p>
          Your prediction for <Mono>AD({instance.letter})</Mono> was <Mono>{String(answer?.probe ?? '') || '—'}</Mono>.
          The cell comes from this indicator:
        </p>
        <PermWhy
          indicators={instance.indicators}
          wrongCells={wrong}
          typed={() => String(answer?.probe ?? '').toUpperCase()}
          testId="build-ad-why"
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1" data-testid="build-ad-feedback">
      <p>
        {wrong.length
          ? `In the first failing case your function got ${wrong.length === 1 ? 'the cell of' : 'the cells of'} ${wrong.map(L).join(', ')} wrong.`
          : 'Your function did not return 26 characters for the first failing case.'}{' '}
        Each indicator fills the cell of its first letter with its fourth letter; the rest stay &apos;?&apos;.
      </p>
    </div>
  )
}

const buildAd = {
  Prompt: BuildAdPrompt,
  // Never the reference source: the method, applied to that instance's indicators.
  Worked: ({ instance, solution }: { instance: BuildAdInstance; solution: CodeAnswer }) => {
    const ind = indicatorWith(instance.indicators, 0, idx(instance.letter))
    const known = adOf(instance.indicators).filter((x) => x !== null).length
    return (
      <div className="flex flex-col gap-1 text-sm">
        <IndicatorChips indicators={instance.indicators} label="That day's indicators" />
        <p>
          Go through the indicators and fill the cell of letter 1 with letter 4. These {instance.indicators.length}{' '}
          indicators fill {known} of the 26 cells; the others stay &apos;?&apos;.
        </p>
        {ind ? (
          <p>
            <IndicatorPair indicator={ind} pos={0} /> ⇒ <Mono>AD({instance.letter})</Mono> = <Mono>{solution.probe}</Mono>.
          </p>
        ) : null}
      </div>
    )
  },
  Feedback: BuildAdFeedback,
}

// ---------------------------------------------------------------------------
// rejewski-steps (order)
// ---------------------------------------------------------------------------

const rejewskiSteps = {
  Prompt: () => (
    <p>Put the route from a message key typed twice to AD written as cycles in order, first step first.</p>
  ),
  Worked: ({ instance, solution }: { instance: { blocks: readonly Choice[] }; solution: string[] }) => (
    <ol className="list-decimal pl-5 text-sm">
      {solution.map((id) => (
        <li key={id}>{instance.blocks.find((b) => b.id === id)?.label}</li>
      ))}
    </ol>
  ),
}

export const ITEM_UI: ItemUiMap = {
  'fill-ad': { Prompt: FillAdPrompt, Answer: FillAdAnswerView, Worked: FillAdWorked, Feedback: FillAdFeedback },
  'ad-fixed-point': adFixedPoint,
  'build-ad': buildAd,
  'rejewski-steps': rejewskiSteps,
}
