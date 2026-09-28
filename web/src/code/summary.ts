/**
 * Turns a RunResponse into the CodeRunSummary a code item submits (PLAN §3.7). PURE.
 */

import type { CodeCase, CodeRunSummary, RunResponse } from '../contracts/code'
import type { PathHop } from '../contracts/stage'

export function display(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return JSON.stringify(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Deep equality through JSON (the cases' `expect` values are JSON data). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b))
  return display(a) === display(b)
}

function hopsMatch(expect: unknown, hops: readonly PathHop[] | undefined): boolean {
  if (!Array.isArray(expect) || !hops || hops.length !== expect.length) return false
  return expect.every((e: { stage?: string; input?: string; output?: string }, k) => {
    const h = hops[k]!
    return (
      (e.stage === undefined || e.stage === h.stage) &&
      (e.input === undefined || e.input === h.input) &&
      e.output === h.output
    )
  })
}

export function summarizeRun(cases: readonly CodeCase[], res: RunResponse, instanceSeed: number): CodeRunSummary {
  const total = cases.length
  if (!res.ok) {
    const where = res.line ? ` (line ${res.line})` : ''
    return {
      status: res.error === 'timeout' ? 'timeout' : 'error',
      passed: 0,
      total,
      instanceSeed,
      firstFailure: { label: res.error, expected: '', actual: `${res.message}${where}` },
    }
  }
  let passed = 0
  let firstFailure: CodeRunSummary['firstFailure']
  let hops: readonly PathHop[] | undefined
  cases.forEach((c, k) => {
    const r = res.results[k]
    let ok = false
    let actual = 'no result'
    if (r && 'error' in r) actual = r.error
    else if (r) {
      if (c.compare === 'hops') {
        ok = hopsMatch(c.expect, r.hops)
        actual = display((r.hops ?? []).map((h) => h.output).join(''))
        hops ??= r.hops
      } else {
        ok = deepEqual(c.expect, r.value)
        actual = display(r.value)
      }
    }
    if (ok) passed++
    else
      firstFailure ??= {
        label: c.label,
        expected:
          c.compare === 'hops'
            ? display((c.expect as { output: string }[]).map((h) => h.output).join(''))
            : display(c.expect),
        actual,
      }
  })
  return {
    status: passed === total && total > 0 ? 'pass' : 'fail',
    passed,
    total,
    instanceSeed,
    ...(firstFailure ? { firstFailure } : {}),
    ...(hops ? { hops: hops.map((h) => ({ ...h })) } : {}),
  }
}
