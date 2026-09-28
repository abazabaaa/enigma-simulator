import { useEffect, useState, type JSX } from 'react'
import type { Choice } from '../../contracts/core'
import type { CheckResult, ItemLogic, ItemUi, Rollback } from '../../contracts/lesson'
import type { MachineStoreHook } from '../../contracts/machine'
import { createMachine, positionsToString, step, type MachineConfig, type MachineConfigInput } from '../../engine'
import { partForStage } from '../kinds/helpers'
import { partName } from '../kinds/widgets'
import { useMachineApi } from '../../state/activeMachine'
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

/**
 * [contracts-v2] G5 'windows' on the machine itself: set the active machine to the windows before one press and
 * press once (key A; the item's locks keep the lamps hidden), so the stage, the rotor windows and the trace's
 * stepping row show that press, double step included. The item's locks are restored afterwards.
 */
export function replayPress(api: MachineStoreHook, from: MachineConfig, before: string): void {
  const locks = api.getState().locks
  try {
    api.getState().setConfig({ ...from, positions: before })
    api.getState().setLocks({ ...locks, keyboard: false, hold: false })
    api.getState().pressKey('A')
  } catch {
    // An unusable configuration leaves the machine as the item set it.
  } finally {
    api.getState().setLocks(locks)
  }
}

/** The machine stepped press by press from `from`, up to the first wrong window, on the stage too. */
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
  const api = useMachineApi()
  const before = p?.before
  useEffect(() => {
    if (!before) return
    // After the effect flush: the gate re-applies the item's setup in the same flush (parents after children).
    let live = true
    queueMicrotask(() => {
      if (live) replayPress(api, rb.from as MachineConfig, before)
    })
    return () => {
      live = false
    }
  }, [api, rb.from, before])
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
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="stepping-preview" data-press={shown}>
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

/**
 * [contracts-v2] G5 'machine' for a set-the-machine item: while its feedback shows, the machine holds the setting
 * the learner submitted (the gate has re-applied the item's start), so the failed predicate's highlighted parts
 * sit on the learner's own setting. The item's locks stay; the gate restores the machine on Continue.
 */
function useSubmittedSetting(api: MachineStoreHook, show: boolean, answer: unknown): void {
  useEffect(() => {
    if (!show) return
    let live = true
    queueMicrotask(() => {
      if (!live) return
      try {
        api.getState().setConfig(answer as MachineConfigInput)
      } catch {
        // Not a usable setting: the machine keeps the item's start.
      }
    })
    return () => {
      live = false
    }
  }, [api, show, answer])
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
  useSubmittedSetting(useMachineApi(), !result.correct && rb.kind === 'machine' && p.logic.kind === 'set-machine', p.answer)
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
          {rb.message} <span className="text-stone-400">(highlighted: {rb.highlight.map(partName).join(', ')})</span>
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
