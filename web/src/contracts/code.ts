/**
 * Contracts v1 · code runner (PLAN §3.7). 05 implements code/runner.ts (runCode, countLines),
 * code/CodeItem.tsx and code/CodeEditor.tsx (a textarea; 17 swaps in CodeMirror 6 with the same props).
 */

import type { PathHop } from './stage'

export interface CodeCase {
  readonly label: string
  readonly fn: string
  readonly args: readonly unknown[]
  readonly expect: unknown
  readonly compare?: 'deep' | 'hops'
}

export interface CodeTask<I> {
  readonly fnNames: readonly string[]
  readonly signature: string
  readonly brief: string
  readonly starter: string
  /** Helper source prepended in the worker (e.g. the instrumented parts). */
  readonly provided: string
  /** Non-blank, non-comment lines per function; > maxLines → status 'too-long', not submitted. */
  readonly maxLines: number
  /** Default 1500. */
  readonly timeoutMs?: number
  /** Reference solution: reviewer agent-paste probe and e2e; never rendered before reveal. */
  readonly reference: string
  /** The worker records the PathHops produced through `parts`. */
  readonly instrument?: 'keypress-parts'
  /** ≥ 20 random + edge cases from i.seed. */
  cases(i: I): readonly CodeCase[]
  /** Typed before Run unlocks. */
  probe(i: I): { readonly call: string; readonly expected: string }
}

export interface CodeRunSummary {
  readonly status: 'pass' | 'fail' | 'error' | 'timeout' | 'too-long'
  readonly passed: number
  readonly total: number
  readonly instanceSeed: number
  readonly firstFailure?: { readonly label: string; readonly expected: string; readonly actual: string }
  readonly hops?: readonly PathHop[]
}

export interface CodeAnswer {
  readonly probe: string
  readonly run: CodeRunSummary
}

export interface RunRequest {
  readonly id: number
  readonly source: string
  readonly provided: string
  readonly fnNames: readonly string[]
  readonly calls: readonly { readonly fn: string; readonly args: readonly unknown[] }[]
  readonly timeoutMs: number
  readonly instrument?: 'keypress-parts'
}

export type RunResponse =
  | {
      readonly id: number
      readonly ok: true
      readonly results: readonly ({ readonly value: unknown; readonly hops?: readonly PathHop[] } | { readonly error: string })[]
      readonly logs: readonly string[]
    }
  | {
      readonly id: number
      readonly ok: false
      readonly error: 'timeout' | 'syntax' | 'missing-fn'
      readonly message: string
      readonly line?: number
    }
