/**
 * runCode (PLAN §3.7): one module worker runs one request at a time. A run that exceeds `timeoutMs` has its
 * worker terminated (which kills an infinite loop) and a fresh worker spawned for the next run.
 */

import type { RunRequest, RunResponse } from '../contracts/code'

export { countLines } from './runnerCore'

/** The part of Worker the runner uses (tests pass a fake). */
export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
}

export const DEFAULT_TIMEOUT_MS = 1500

export interface Runner {
  run(req: Omit<RunRequest, 'id'>): Promise<RunResponse>
  /** Workers spawned so far (1 + one per timeout or crash). */
  spawned(): number
  dispose(): void
}

export function createRunner(spawn: () => WorkerLike): Runner {
  let worker: WorkerLike | null = null
  let spawned = 0
  let nextId = 1
  let queue: Promise<unknown> = Promise.resolve()

  const fresh = (): WorkerLike => {
    spawned++
    worker = spawn()
    return worker
  }
  const kill = () => {
    worker?.terminate()
    worker = null
  }

  function runOne(req: Omit<RunRequest, 'id'>): Promise<RunResponse> {
    return new Promise<RunResponse>((resolve) => {
      const id = nextId++
      const w = worker ?? fresh()
      const timeoutMs = req.timeoutMs > 0 ? req.timeoutMs : DEFAULT_TIMEOUT_MS
      const done = (res: RunResponse) => {
        clearTimeout(timer)
        w.onmessage = null
        w.onerror = null
        resolve(res)
      }
      const timer = setTimeout(() => {
        kill()
        fresh()
        done({ id, ok: false, error: 'timeout', message: `Stopped after ${timeoutMs} ms: is there an endless loop?` })
      }, timeoutMs)
      w.onmessage = (e) => {
        const data = e.data as RunResponse | undefined
        if (data && data.id === id) done(data)
      }
      w.onerror = (e) => {
        e.preventDefault?.()
        kill()
        done({ id, ok: false, error: 'syntax', message: e.message || 'The code runner failed to start' })
      }
      w.postMessage({ ...req, id, timeoutMs })
    })
  }

  return {
    run(req) {
      const job = queue.then(() => runOne(req))
      queue = job.catch(() => undefined)
      return job
    },
    spawned: () => spawned,
    dispose: kill,
  }
}

let shared: Runner | null = null

function spawnWorker(): WorkerLike {
  return new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module', name: 'code-runner' })
}

/** Run learner code in the shared module worker. */
export function runCode(req: Omit<RunRequest, 'id'>): Promise<RunResponse> {
  shared ??= createRunner(spawnWorker)
  return shared.run(req)
}
