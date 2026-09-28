/**
 * Plain text rows for cribs: the cipher text under an index ruler, and (optionally) the crib under it at an offset.
 * Nothing is coloured: the learner compares the columns (a CribStrip colours the crashes, which would answer the
 * question). Scrolls inside itself on narrow screens.
 */

import type { JSX } from 'react'

/** '0    5    10   15 …' aligned over a text of `n` letters. */
export function ruler(n: number): string {
  let s = ''
  for (let k = 0; k < n; k += 5) s = s.padEnd(k, ' ') + String(k)
  return s.padEnd(n, ' ')
}

export function AlignedRows(p: {
  cipher: string
  crib?: string
  offset?: number
  testId?: string
  label: string
}): JSX.Element {
  const offset = p.offset ?? 0
  return (
    <div
      role="group"
      aria-label={p.label}
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-md border border-stone-700 bg-stone-950/60 p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      data-testid={p.testId}
    >
      <pre className="font-mono text-sm leading-snug text-stone-200">
        <span className="text-stone-400">{ruler(p.cipher.length)}</span>
        {'\n'}
        {p.cipher}
        {p.crib !== undefined ? (
          <>
            {'\n'}
            <span className="text-amber-200">
              {' '.repeat(offset)}
              {p.crib}
            </span>
          </>
        ) : null}
      </pre>
    </div>
  )
}
