import type { JSX } from 'react'
import type { LightTableProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function LightTable(p: LightTableProps): JSX.Element {
  return <div data-testid={p.testId ?? 'light-table'} data-stub="LightTable" />
}
