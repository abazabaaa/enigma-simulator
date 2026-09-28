import type { JSX } from 'react'
import type { CycleDiagramProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function CycleDiagram(p: CycleDiagramProps): JSX.Element {
  return <div data-testid={p.testId ?? 'cycle-diagram'} data-stub="CycleDiagram" />
}
