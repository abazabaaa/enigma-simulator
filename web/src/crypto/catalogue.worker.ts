/**
 * Builds the catalogue off the main thread (catalogueClient.ts spawns it). Request: { reflector }. Replies:
 * { type: 'progress', done, total } a few dozen times, then { type: 'done', packed } with its typed arrays
 * transferred, or { type: 'error', message }.
 */

import type { ReflectorName } from '../engine'
import { buildPackedCatalogue } from './catalogue'

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ reflector: ReflectorName }>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (e) => {
  try {
    const packed = buildPackedCatalogue({
      reflector: e.data.reflector,
      onProgress: (done, total) => {
        if (done % 2704 === 0 || done === total) scope.postMessage({ type: 'progress', done, total })
      },
    })
    scope.postMessage({ type: 'done', packed }, [packed.starts.buffer, packed.codes.buffer])
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
