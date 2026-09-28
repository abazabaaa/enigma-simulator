/**
 * The UKW-A catalogue for this chapter's views: getCatalogue('A') builds it once per session in a worker (the kit's
 * client memoises it), and this hook follows the build's progress.
 */

import { useEffect, useState } from 'react'
import type { Catalogue } from '../../../crypto/catalogue'
import { getCatalogue } from '../../../crypto/catalogueClient'

export interface CatalogueState {
  readonly catalogue: Catalogue | null
  readonly done: number
  readonly total: number
  /** Milliseconds from the start of this view's request to the catalogue (0 when it was already built). */
  readonly ms: number | null
  readonly failed: boolean
}

const EMPTY: CatalogueState = { catalogue: null, done: 0, total: 105456, ms: null, failed: false }

/** The catalogue once `start` is true (building it if nobody has yet). */
export function useCatalogue(start: boolean): CatalogueState {
  const [state, setState] = useState<CatalogueState>(EMPTY)
  useEffect(() => {
    if (!start) return
    let live = true
    const t0 = performance.now()
    getCatalogue('A', (done, total) => {
      if (live) setState((s) => (s.catalogue ? s : { ...s, done, total }))
    }).then(
      (catalogue) => {
        if (live) setState((s) => ({ ...s, catalogue, done: s.total, ms: Math.round(performance.now() - t0) }))
      },
      () => {
        if (live) setState((s) => ({ ...s, failed: true }))
      },
    )
    return () => {
      live = false
    }
  }, [start])
  return state
}
