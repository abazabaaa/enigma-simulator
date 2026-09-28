/**
 * The code item's Answer (PLAN §3.5 rule 6, §3.7, G7): the brief, the signature and three visible tests; a
 * "Copy brief for your agent" button; the editor; the prediction (gate-prediction) that must be typed before
 * Run unlocks and locks when Run starts. The run is checked against this instance's cases in the worker,
 * and {probe, run} is submitted automatically. Functions over maxLines are 'too-long' and not submitted.
 * The learner's source persists per item in localStorage['enigma.code.<itemKey>'].
 */

import { Suspense, lazy, useEffect, useMemo, useState, type JSX } from 'react'
import type { ItemKey } from '../contracts/core'
import type { CodeAnswer, CodeRunSummary, CodeTask } from '../contracts/code'
import { storage } from '../lib/storage'
import { BUTTON, INPUT, QUIET_BUTTON } from '../lesson/ui/controls'
import { countLines, runCode } from './runner'
import { display, summarizeRun } from './summary'

const CodeEditor = lazy(() => import('./CodeEditor'))

export const codeStorageKey = (itemKey: ItemKey) => `enigma.code.${itemKey}`

export interface CodeItemProps {
  readonly task: CodeTask<any>
  readonly instance: { readonly seed: number }
  readonly itemKey: ItemKey
  readonly disabled: boolean
  submit(a: CodeAnswer): void
}

function briefText(task: CodeTask<any>, instance: { seed: number }): string {
  const probe = task.probe(instance)
  const visible = task
    .cases(instance)
    .slice(0, 3)
    .map((c) => `  ${c.fn}(${c.args.map((a) => display(a)).join(', ')}) → ${display(c.expect)}`)
  return [
    task.brief,
    '',
    `Signature: ${task.signature}`,
    `Keep each function within ${task.maxLines} lines.`,
    '',
    'Visible tests:',
    ...visible,
    '',
    `Before running, predict: ${probe.call} = ?`,
  ].join('\n')
}

export function CodeItem({ task, instance, itemKey, disabled, submit }: CodeItemProps): JSX.Element {
  const [source, setSource] = useState(() => storage.get(codeStorageKey(itemKey)) ?? task.starter)
  const [probe, setProbe] = useState('')
  const [locked, setLocked] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CodeRunSummary | null>(null)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const cases = useMemo(() => task.cases(instance), [task, instance])
  const call = task.probe(instance).call
  const brief = useMemo(() => briefText(task, instance), [task, instance])

  useEffect(() => {
    storage.set(codeStorageKey(itemKey), source)
  }, [itemKey, source])

  const run = async () => {
    if (!probe.trim() || running || disabled) return
    setLocked(true)
    setRunning(true)
    try {
      const long = task.fnNames.find((fn) => countLines(source, fn) > task.maxLines)
      if (long) {
        setResult({
          status: 'too-long',
          passed: 0,
          total: cases.length,
          instanceSeed: instance.seed,
          firstFailure: { label: long, expected: `≤ ${task.maxLines} lines`, actual: `${countLines(source, long)} lines` },
        })
        return
      }
      const res = await runCode({
        source,
        provided: task.provided,
        fnNames: task.fnNames,
        calls: cases.map((c) => ({ fn: c.fn, args: c.args })),
        timeoutMs: task.timeoutMs ?? 1500,
        ...(task.instrument ? { instrument: task.instrument } : {}),
      })
      const summary = summarizeRun(cases, res, instance.seed)
      setResult(summary)
      submit({ probe: probe.trim(), run: summary })
    } finally {
      setRunning(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="code-item">
      <div className="rounded-md border border-stone-700 p-3 text-sm">
        <p className="text-stone-200">{task.brief}</p>
        <p className="mt-2 font-mono text-xs text-stone-400">Signature: {task.signature}</p>
        <p className="font-mono text-xs text-stone-400">Keep each function within {task.maxLines} lines.</p>
        <div className="mt-2 max-w-full overflow-x-auto">
          <table className="font-mono text-xs text-stone-300" aria-label="Visible tests">
            <tbody>
              {cases.slice(0, 3).map((c) => (
                <tr key={c.label}>
                  <td className="pr-3">
                    {c.fn}({c.args.map((a) => display(a)).join(', ')})
                  </td>
                  <td>→ {display(c.expect)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" data-testid="copy-brief" className={QUIET_BUTTON} onClick={() => void copy()}>
            Copy brief for your agent
          </button>
          {copied === 'done' ? <span className="text-xs text-emerald-300">Copied.</span> : null}
          {copied === 'failed' ? (
            <details className="text-xs text-stone-400" open>
              <summary>Copying is blocked here: select the brief below.</summary>
              <textarea readOnly className={`${INPUT} mt-1 h-32 w-full text-xs`} value={brief} data-testid="copy-brief-text" />
            </details>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">Loading the editor…</p>}>
        <CodeEditor value={source} onChange={setSource} readOnly={disabled} testId="code-editor" />
      </Suspense>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-stone-300">
          <span>
            Predict first: <span className="font-mono">{call}</span> = ?
          </span>
          <input
            data-testid="gate-prediction"
            className={`${INPUT} w-40`}
            value={probe}
            readOnly={locked}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setProbe(e.target.value)}
          />
        </label>
        <button type="button" data-testid="code-run" className={BUTTON} disabled={disabled || running || probe.trim() === ''} onClick={() => void run()}>
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
      {locked ? <p className="text-xs text-stone-500">Your prediction is locked for this instance.</p> : null}
      {result ? (
        <div className="rounded-md border border-stone-700 p-2 text-sm" data-testid="code-result" data-status={result.status}>
          <p>
            {result.status === 'pass'
              ? `All ${result.total} cases passed.`
              : result.status === 'too-long'
                ? `Too long: ${result.firstFailure?.label} has ${result.firstFailure?.actual} (limit ${task.maxLines}). Not submitted.`
                : result.status === 'timeout'
                  ? 'Stopped: your code ran too long.'
                  : `${result.passed} of ${result.total} cases passed.`}
          </p>
          {result.firstFailure && result.status !== 'too-long' ? (
            <p className="font-mono text-xs text-stone-400">
              {result.firstFailure.label}: expected {result.firstFailure.expected}, got {result.firstFailure.actual}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
