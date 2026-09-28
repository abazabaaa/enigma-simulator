import type { JSX } from 'react'
import type { MenuGraphProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function MenuGraph(p: MenuGraphProps): JSX.Element {
  return <div data-testid={p.testId ?? 'menu-graph'} data-stub="MenuGraph" />
}
