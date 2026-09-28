/**
 * Small views shared by the chapter's scenes and items. On a phone a cycle diagram keeps a readable size and scrolls
 * sideways (with a visible cue) instead of shrinking its letters to a few pixels.
 */

import type { JSX, ReactNode } from 'react'
import type { CycleDiagramProps } from '../../../viz'
import { CycleDiagram } from '../../../viz'

/** A sideways scroller of at least `minWidth`; below 640 px an edge fade and a "scroll" cue show there is more. */
export function SideScroll(p: { children: ReactNode; label: string; minWidth?: string }): JSX.Element {
  return (
    <div className="relative flex flex-col gap-1">
      <div className="max-w-full overflow-x-auto rounded" role="region" aria-label={p.label} tabIndex={0}>
        <div style={{ minWidth: p.minWidth ?? '36rem' }}>{p.children}</div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-6 w-10 bg-gradient-to-l from-stone-950 to-transparent sm:hidden"
      />
      <p aria-hidden="true" className="text-xs text-stone-400 sm:hidden">
        Scroll sideways for the rest →
      </p>
    </div>
  )
}

/** A CycleDiagram at a readable size (see SideScroll). */
export function Diagram(p: CycleDiagramProps & { label: string; minWidth?: string }): JSX.Element {
  const { label, minWidth, ...rest } = p
  return (
    <SideScroll label={label} {...(minWidth ? { minWidth } : {})}>
      <CycleDiagram {...rest} />
    </SideScroll>
  )
}
