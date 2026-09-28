/**
 * A permutation as a two-row table (PLAN §3.10): the letters A… on top and their images below
 * ('·' for an unknown cell). `highlight` outlines cells.
 *  - `editable` makes every image cell a one-letter text box; `editableCells` makes only those cells
 *    editable (additive: `editable` still means all). Type a letter to set a cell (focus moves on to
 *    the next editable cell), Backspace/Delete to clear it, ArrowLeft/ArrowRight/Home/End to move
 *    between editable cells (the others are skipped).
 *  - onEdit(i, v) receives the index of the letter, or null; onChange(perm) receives the whole table
 *    after the edit.
 *  - Cells never shrink below 1.75rem: a narrow screen scrolls the table sideways, and the scroller
 *    is then a focusable, labelled region (the same rule as the 2D stage).
 *
 * Test IDs: `${testId}` on the table, `${testId}-cell-${i}` on each image cell.
 */

import { useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react'
import { LETTERS } from '../engine'
import { Sym as SymChip } from '../lib/Sym'
import type { Sym } from '../lib/symbols'
import { useScrollable } from './hooks'

export function PermTable(p: {
  perm: readonly (number | null)[]
  n?: number
  sym?: Sym
  label?: ReactNode
  highlight?: readonly number[]
  editable?: boolean
  onEdit?(i: number, v: number | null): void
  editableCells?: readonly number[]
  onChange?(perm: (number | null)[]): void
  testId?: string
}): JSX.Element {
  const n = p.n ?? p.perm.length
  const testId = p.testId ?? 'perm-table'
  const cells = useRef<(HTMLInputElement | null)[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const scrollable = useScrollable(scroller)
  const marked = new Set(p.highlight ?? [])
  const letter = (v: number | null | undefined) => (v === null || v === undefined || v < 0 || v >= n ? '' : LETTERS[v]!)
  const only = new Set(p.editableCells ?? [])
  const canEdit = (i: number) => !!p.editable || only.has(i)
  const editableIdx = Array.from({ length: n }, (_, i) => i).filter(canEdit)
  const anyEditable = editableIdx.length > 0
  /** Focus the editable cell at or next to i in the direction of travel. */
  const focus = (i: number, dir: 1 | -1 = 1) => {
    const list = dir === 1 ? editableIdx.filter((k) => k >= i) : editableIdx.filter((k) => k <= i).reverse()
    const k = list[0] ?? (dir === 1 ? editableIdx.at(-1) : editableIdx[0])
    if (k !== undefined) cells.current[k]?.focus()
  }
  const edit = (i: number, v: number | null) => {
    p.onEdit?.(i, v)
    if (p.onChange) {
      const next = Array.from({ length: n }, (_, k) => p.perm[k] ?? null)
      next[i] = v
      p.onChange(next)
    }
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
      e.preventDefault()
      if (key === 'ArrowLeft') focus(i - 1, -1)
      else if (key === 'ArrowRight') focus(i + 1, 1)
      else if (key === 'Home') focus(0, 1)
      else focus(n - 1, -1)
      return
    }
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault()
      edit(i, null)
      return
    }
    if (key.length === 1) {
      e.preventDefault()
      const v = key.toUpperCase().charCodeAt(0) - 65
      if (v >= 0 && v < n) {
        edit(i, v)
        focus(i + 1, 1)
      }
    }
  }

  const cell = 'h-8 w-7 min-w-7 border border-stone-700 text-center font-mono text-sm'
  return (
    <figure className="flex min-w-0 flex-col gap-1">
      {p.label !== undefined || p.sym ? (
        <figcaption className="flex items-center gap-2 text-sm text-stone-300">
          {p.sym ? <SymChip s={p.sym} /> : null}
          {p.label}
        </figcaption>
      ) : null}
      <div
        ref={scroller}
        data-testid={`${testId}-scroll`}
        data-scrollable={scrollable ? 'true' : 'false'}
        className="max-w-full overflow-x-auto"
        role={scrollable ? 'region' : undefined}
        aria-label={scrollable ? `${typeof p.label === 'string' ? p.label : 'Permutation table'} (scrolls sideways)` : undefined}
        tabIndex={scrollable ? 0 : undefined}
      >
        <table
          data-testid={testId}
          data-editable={p.editable ? 'true' : anyEditable ? 'some' : 'false'}
          className="border-collapse"
        >
          <tbody>
            <tr>
              {Array.from({ length: n }, (_, i) => (
                <th key={i} scope="col" className={`${cell} bg-stone-900 font-normal text-stone-300`}>
                  {LETTERS[i]}
                </th>
              ))}
            </tr>
            <tr>
              {Array.from({ length: n }, (_, i) => {
                const value = letter(p.perm[i])
                const outline = marked.has(i) ? 'outline-2 -outline-offset-2 outline-amber-300' : ''
                return (
                  <td key={i} data-testid={`${testId}-cell-${i}`} data-value={value} className={`${cell} ${outline} p-0 text-stone-100`}>
                    {canEdit(i) ? (
                      <input
                        ref={(el) => {
                          cells.current[i] = el
                        }}
                        value={value}
                        onChange={(e) => {
                          // Virtual keyboards may skip keydown: take the last character typed.
                          const typed = e.target.value.toUpperCase().replace(value, '')
                          const v = typed.length ? typed.charCodeAt(typed.length - 1) - 65 : -1
                          if (e.target.value === '') edit(i, null)
                          else if (v >= 0 && v < n) edit(i, v)
                        }}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        maxLength={1}
                        aria-label={`Image of ${LETTERS[i]}`}
                        autoComplete="off"
                        spellCheck={false}
                        className="h-full w-full bg-transparent text-center uppercase caret-amber-300 focus:bg-stone-800 focus:outline-none"
                      />
                    ) : (
                      value || <span className="text-stone-400">·</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  )
}
