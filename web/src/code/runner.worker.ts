/**
 * The code runner's module worker (PLAN §3.7). Network and storage APIs are replaced by throwing shims
 * before any learner code runs; errors never escape to the page's console. runner.ts kills and respawns
 * this worker when a run exceeds its timeout.
 */

import type { RunRequest } from '../contracts/code'
import { SHIMMED, blocked, executeRequest } from './runnerCore'

const scope = self as unknown as Record<string, unknown> & {
  addEventListener: (type: string, fn: (e: Event) => void) => void
  postMessage: (m: unknown) => void
}

for (const name of SHIMMED) {
  try {
    Object.defineProperty(scope, name, { value: blocked(name), configurable: false, writable: false })
  } catch {
    scope[name] = blocked(name)
  }
}

// Asynchronous errors from learner code (timers, promises) stay inside the worker.
scope.addEventListener('error', (e) => e.preventDefault())
scope.addEventListener('unhandledrejection', (e) => e.preventDefault())

scope.addEventListener('message', (e) => {
  const req = (e as MessageEvent<RunRequest>).data
  try {
    scope.postMessage(executeRequest(req))
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: 'syntax', message: String(err) })
  }
})
