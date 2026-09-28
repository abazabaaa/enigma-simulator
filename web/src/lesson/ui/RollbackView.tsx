import { useState, type JSX } from 'react'
import type { Choice } from '../../contracts/core'
import type { CheckResult, ItemLogic, ItemUi, Rollback } from '../../contracts/lesson'
import { createMachine, positionsToString, step, type MachineConfig } from '../../engine'
import { partForStage } from '../kinds/helpers'
import { partList, partName } from '../partNames'
import { BUTTON, QUIET_BUTTON } from './controls'

type Of<K extends Rollback['kind']> = Extract<Rollback, { kind: K }>

function PathView({ rb, picked, correct }: { rb: Of<'path'>; picked?: string; correct?: string }): JSX.Element {
  const hop = rb.ghost.hops[rb.ghost.divergeAt]
  const where = hop ? ` at the ${partName(partForStage(hop.stage))}, hop ${rb.ghost.divergeAt + 1}` : ''
  return (
    <div className="flex flex-col gap-1">
      {picked !== undefined ? (
        // ghost-pick: the red path is the seeded fault, not the learner's path.
        <p data-testid="ghost-pick-verdict">
          You picked the <strong>{partName(picked as never)}</strong>; the fault is in the{' '}
          <strong>{partName(correct as never)}</strong>. The faulty path (red on the stage) leaves the reference (gold)
          {where}.
        </p>
      ) : (
        <p>Your path (red on the stage) leaves the reference (gold){where}.</p>
      )}
      <ol className="flex flex-wrap gap-1 font-mono text-xs" aria-label="Your path, hop by hop">
        {rb.ghost.hops.map((h, k) => (
          <li
            key={k}
            data-diverge={k === rb.ghost.divergeAt ? 'true' : undefined}
            className={`rounded border px-1 ${k >= rb.ghost.divergeAt ? 'border-red-500/70 text-red-200' : 'border-stone-700 text-stone-300'}`}
          >
            {h.input}→{h.output}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The machine stepped press by press from `from`, up to the first wrong window. */
function WindowsView({ rb }: { rb: Of<'windows'> }): JSX.Element {
  const presses: { before: string; after: string; moved: string }[] = []
  let state = createMachine(rb.from as MachineConfig)
  for (let k = 0; k < rb.expected.length; k++) {
    const s = step(state)
    const moved = (['left', 'middle', 'right'] as const).filter((slot) => s.stepped[slot]).join(' + ')
    presses.push({
      before: positionsToString(state),
      after: positionsToString(s.state),
      moved: `${moved}${s.doubleStep ? ' (double step)' : ''}`,
    })
    state = s.state
  }
  const [shown, setShown] = useState(rb.firstWrong)
  const p = presses[shown]
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-full overflow-x-auto">
        <table className="font-mono text-sm" data-testid="windows-diff">
          <thead>
            <tr className="text-xs text-stone-400">
              <th className="pr-4 text-left font-normal">Press</th>
              <th className="pr-4 text-left font-normal">Expected</th>
              <th className="text-left font-normal">You typed</th>
            </tr>
          </thead>
          <tbody>
            {rb.expected.map((e, k) => (
              <tr
                key={k}
                data-first-wrong={k === rb.firstWrong ? 'true' : undefined}
                className={k === rb.firstWrong ? 'text-red-200' : ''}
              >
                <td className="pr-4">{k + 1}</td>
                <td className="pr-4">{e}</td>
                <td>{rb.got[k] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p ? (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="stepping-preview">
          <button
            type="button"
            className={QUIET_BUTTON}
            disabled={shown === 0}
            onClick={() => setShown(shown - 1)}
            aria-label="Previous press"
          >
            ◀
          </button>
          <span>
            Press {shown + 1}: {p.before} → {p.after}, {p.moved || 'nothing'} moves.
          </span>
          <button
            type="button"
            className={QUIET_BUTTON}
            disabled={shown >= presses.length - 1}
            onClick={() => setShown(shown + 1)}
            aria-label="Next press"
          >
            ▶
          </button>
        </div>
      ) : null}
    </div>
  )
}

function OrderView({
  rb,
  logic,
  instance,
  answer,
}: {
  rb: Of<'order'>
  logic: ItemLogic
  instance: unknown
  answer: unknown
}): JSX.Element {
  const blocks = ((instance as { blocks?: readonly Choice[] }).blocks ?? []) as readonly Choice[]
  const label = (id: string) => blocks.find((b) => b.id === id)?.label ?? id
  const got = Array.isArray(answer) ? (answer as string[]) : []
  const right = logic.solve(instance) as string[]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs text-stone-400">Your order</p>
        <ol className="list-decimal pl-5 text-sm">
          {got.map((id, k) => (
            <li
              key={id}
              data-first-wrong={k === rb.firstWrong ? 'true' : undefined}
              className={k === rb.firstWrong ? 'text-red-200' : ''}
            >
              {label(id)}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="text-xs text-stone-400">The order</p>
        <ol className="list-decimal pl-5 text-sm text-emerald-200">
          {right.map((id) => (
            <li key={id}>{label(id)}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** G5: the learner's own answer rolled back per kind (§4.1 table), then Continue. */
export function RollbackView(p: {
  result: CheckResult
  answer: unknown
  instance: unknown
  logic: ItemLogic
  ui: ItemUi
  passed: boolean
  gatePassed: boolean
  onContinue(): void
}): JSX.Element {
  const { result } = p
  const rb = result.rollback
  const Feedback = p.ui.Feedback
  return (
    <section
      data-testid="rollback"
      data-kind={rb.kind}
      data-correct={String(result.correct)}
      className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${result.correct ? 'border-emerald-700 bg-emerald-950/30' : 'border-red-800 bg-red-950/20'}`}
    >
      <p className="font-semibold">{result.correct ? 'Correct.' : 'Not quite.'}</p>
      {result.feedback && !(rb.kind === 'machine' && rb.message === result.feedback) ? <p>{result.feedback}</p> : null}
      {!result.correct && rb.kind === 'path' ? (
        p.logic.kind === 'ghost-pick' ? (
          <PathView rb={rb} picked={String(p.answer)} correct={String(p.logic.solve(p.instance))} />
        ) : (
          <PathView rb={rb} />
        )
      ) : null}
      {!result.correct && rb.kind === 'windows' ? <WindowsView rb={rb} /> : null}
      {!result.correct && rb.kind === 'machine' ? (
        <p>
          {rb.message} <span className="text-stone-400">(highlighted: {partList(rb.highlight)})</span>
        </p>
      ) : null}
      {!result.correct && rb.kind === 'order' ? (
        <OrderView rb={rb} logic={p.logic} instance={p.instance} answer={p.answer} />
      ) : null}
      {!result.correct && Feedback && !['path', 'windows', 'machine', 'order'].includes(rb.kind) ? (
        <Feedback instance={p.instance} answer={p.answer} result={result} />
      ) : null}
      {p.passed ? <p className="text-emerald-300">Item passed.</p> : null}
      {p.gatePassed ? <p className="text-emerald-300">Gate passed.</p> : null}
      <div>
        <button type="button" data-testid="gate-continue" className={BUTTON} onClick={p.onContinue}>
          {p.gatePassed ? 'Done' : 'Continue'}
        </button>
      </div>
    </section>
  )
}
