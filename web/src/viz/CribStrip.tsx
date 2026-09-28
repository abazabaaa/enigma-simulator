import type { JSX } from 'react'
import type { CribStripProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function CribStrip(p: CribStripProps): JSX.Element {
  return <div data-testid={p.testId ?? 'crib-strip'} data-stub="CribStrip" />
}
