import type { JSX } from 'react'
import type { CatalogueHistogramProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function CatalogueHistogram(p: CatalogueHistogramProps): JSX.Element {
  return <div data-testid={p.testId ?? 'catalogue-histogram'} data-stub="CatalogueHistogram" />
}
