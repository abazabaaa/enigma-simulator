/**
 * runBombeAsync: runBombe in a module worker, so a whole wheel order (17,576 positions) never blocks the page.
 * Without Worker support, or if the worker fails to start, it runs on the main thread after a yield. Aborting
 * terminates the worker and rejects with an AbortError. Views only: gates.ts must not import this file.
 */

import { runBombe, type RunBombeOptions, type Stop } from './bombe'

function abortError(): Error {
  const e = new Error('The bombe run was aborted')
  e.name = 'AbortError'
  return e
}

function inWorker(o: RunBombeOptions, signal?: AbortSignal): Promise<Stop[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bombe.worker.ts', import.meta.url), { type: 'module' })
    const onAbort = () => {
      worker.terminate()
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    const finish = () => {
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'progress'; done: number; total: number }
        | { type: 'done'; stops: Stop[] }
        | { type: 'error'; message: string }
      if (msg.type === 'progress') o.onProgress?.(msg.done, msg.total)
      else {
        finish()
        if (msg.type === 'done') resolve(msg.stops)
        else reject(new Error(msg.message))
      }
    }
    worker.onerror = (e) => {
      e.preventDefault()
      finish()
      reject(new Error(e.message || 'bombe worker failed'))
    }
    const { onProgress: _drop, ...plain } = o
    void _drop
    worker.postMessage(plain)
  })
}

/** runBombe off the main thread; resolves with the same stops as runBombe(o). */
export async function runBombeAsync(o: RunBombeOptions, signal?: AbortSignal): Promise<Stop[]> {
  if (signal?.aborted) throw abortError()
  if (typeof Worker !== 'undefined') {
    try {
      return await inWorker(o, signal)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
    }
  }
  await new Promise((r) => setTimeout(r, 0))
  if (signal?.aborted) throw abortError()
  return runBombe(o)
}
