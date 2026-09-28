/**
 * getCatalogue (PLAN §3.11): the catalogue for a reflector, built ONCE per session in a module worker and
 * memoised. Without Worker support (Node, old browsers) or when the worker fails, it builds on the main thread.
 * Views only: gates.ts must not import this file (it uses import.meta).
 */

import type { ReflectorName } from '../engine'
import {
  CATALOGUE_ORDERS,
  POSITIONS_PER_ORDER,
  buildPackedCatalogue,
  unpackCatalogue,
  type Catalogue,
  type PackedCatalogue,
} from './catalogue'

type Progress = (done: number, total: number) => void

interface Job {
  readonly promise: Promise<Catalogue>
  readonly listeners: Set<Progress>
  last: [number, number]
}

const jobs = new Map<ReflectorName, Job>()
const TOTAL = CATALOGUE_ORDERS.length * POSITIONS_PER_ORDER

function inWorker(reflector: ReflectorName, report: Progress): Promise<PackedCatalogue> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./catalogue.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      reject(err)
      return
    }
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'progress'; done: number; total: number }
        | { type: 'done'; packed: PackedCatalogue }
        | { type: 'error'; message: string }
      if (msg.type === 'progress') report(msg.done, msg.total)
      else {
        worker.terminate()
        if (msg.type === 'done') resolve(msg.packed)
        else reject(new Error(msg.message))
      }
    }
    worker.onerror = (e) => {
      e.preventDefault()
      worker.terminate()
      reject(new Error(e.message || 'catalogue worker failed'))
    }
    worker.postMessage({ reflector })
  })
}

async function onMainThread(reflector: ReflectorName, report: Progress): Promise<PackedCatalogue> {
  await new Promise((r) => setTimeout(r, 0))
  return buildPackedCatalogue({ reflector, onProgress: report })
}

/**
 * The default catalogue (6 orders of I, II, III; rings AAA) for `reflector`. The first call starts the build;
 * later calls share it. `onProgress(done, total)` follows the build (total 105,456) and is called once with
 * (total, total) when the catalogue is already built.
 */
export function getCatalogue(reflector: ReflectorName, onProgress?: (d: number, t: number) => void): Promise<Catalogue> {
  const existing = jobs.get(reflector)
  if (existing) {
    if (onProgress) {
      existing.listeners.add(onProgress)
      onProgress(...existing.last)
      void existing.promise.then(
        () => existing.listeners.delete(onProgress),
        () => existing.listeners.delete(onProgress),
      )
    }
    return existing.promise
  }
  const listeners = new Set<Progress>(onProgress ? [onProgress] : [])
  const job: Job = {
    listeners,
    last: [0, TOTAL],
    promise: Promise.resolve().then(async () => {
      const report: Progress = (d, t) => {
        job.last = [d, t]
        for (const l of listeners) l(d, t)
      }
      let packed: PackedCatalogue
      try {
        if (typeof Worker === 'undefined') throw new Error('no Worker')
        packed = await inWorker(reflector, report)
      } catch {
        packed = await onMainThread(reflector, report)
      }
      const catalogue = unpackCatalogue(packed)
      report(TOTAL, TOTAL)
      listeners.clear()
      return catalogue
    }),
  }
  jobs.set(reflector, job)
  job.promise.catch(() => jobs.delete(reflector))
  return job.promise
}

/** Forget memoised catalogues (tests). */
export function clearCatalogueCache(): void {
  jobs.clear()
}
