/**
 * Small views shared by the chapter's scenes and items. On a phone a cycle diagram keeps a readable size and scrolls
 * sideways (with a visible cue) instead of shrinking its letters to a few pixels.
 */

import { useLayoutEffect, useRef, useState, type JSX, type ReactNode, type RefObject } from 'react'
import type { CycleDiagramProps } from '../../../viz'
import { CycleDiagram } from '../../../viz'

/** Whether `ref`'s content is wider than the box (re-measured on resize). */
function useOverflows(ref: RefObject<HTMLElement | null>): boolean {
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOver(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return over
}

/**
 * A box at least `minWidth` wide. While it overflows (on a phone) it scrolls sideways as a focusable, labelled region
 * with an edge fade and a cue; otherwise it is a plain box and no extra tab stop.
 */
export function SideScroll(p: { children: ReactNode; label: string; minWidth?: string }): JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const over = useOverflows(scroller)
  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <div
        ref={scroller}
        className="max-w-full overflow-x-auto rounded"
        data-scrollable={over ? 'true' : 'false'}
        role={over ? 'region' : undefined}
        aria-label={over ? `${p.label} (scrolls sideways)` : undefined}
        tabIndex={over ? 0 : undefined}
      >
        <div style={{ minWidth: p.minWidth ?? '36rem' }}>{p.children}</div>
      </div>
      {over ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 bottom-6 w-10 bg-gradient-to-l from-stone-950 to-transparent"
          />
          <p aria-hidden="true" className="text-xs text-stone-400">
            Scroll sideways for the rest →
          </p>
        </>
      ) : null}
    </div>
  )
}

/**
 * A CycleDiagram at a readable size (see SideScroll). `clip` is for a drawing that fills only its left part (a few
 * short cycles): on a phone the empty right side is cut off instead of scrolled to.
 */
export function Diagram(p: CycleDiagramProps & { label: string; minWidth?: string; clip?: boolean }): JSX.Element {
  const { label, minWidth, clip, ...rest } = p
  if (clip)
    return (
      <div className="min-w-0 overflow-hidden">
        <div style={{ minWidth: minWidth ?? '36rem' }}>
          <CycleDiagram {...rest} />
        </div>
      </div>
    )
  return (
    <SideScroll label={label} {...(minWidth ? { minWidth } : {})}>
      <CycleDiagram {...rest} />
    </SideScroll>
  )
}
