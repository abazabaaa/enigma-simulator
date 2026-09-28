import type { JSX } from 'react'
import type { CycleAlignProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function CycleAlign(p: CycleAlignProps): JSX.Element {
  return <div data-testid={p.testId ?? 'cycle-align'} data-stub="CycleAlign" />
}
