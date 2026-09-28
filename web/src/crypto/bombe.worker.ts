/**
 * Runs the bombe off the main thread (bombeClient.ts spawns one per run). Request: RunBombeOptions without
 * onProgress. Replies: { type: 'progress', done, total } every 676 positions, then { type: 'done', stops } or
 * { type: 'error', message }.
 */

import { runBombe, type RunBombeOptions } from './bombe'

interface WorkerScope {
  onmessage: ((e: MessageEvent<Omit<RunBombeOptions, 'onProgress'>>) => void) | null
  postMessage(message: unknown): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (e) => {
  try {
    const stops = runBombe({ ...e.data, onProgress: (done, total) => scope.postMessage({ type: 'progress', done, total }) })
    scope.postMessage({ type: 'done', stops })
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
