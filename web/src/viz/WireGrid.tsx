import type { JSX } from 'react'
import type { WireGridProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function WireGrid(p: WireGridProps): JSX.Element {
  return <div data-testid={p.testId ?? 'wire-grid'} data-stub="WireGrid" />
}
