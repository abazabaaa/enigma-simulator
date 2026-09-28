/**
 * A permutation as a two-row table (PLAN §3.10): the letters A… on top and their images below
 * ('·' for an unknown cell). `highlight` outlines cells; with `editable` every image cell is a
 * one-letter text box: type a letter to set it (focus moves on), Backspace/Delete to clear it,
 * ArrowLeft/ArrowRight/Home/End to move. onEdit(i, v) receives the index of the letter, or null.
 *
 * Test IDs: `${testId}` on the table, `${testId}-cell-${i}` on each image cell.
 */

import { useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react'
import { LETTERS } from '../engine'
import { Sym as SymChip } from '../lib/Sym'
import type { Sym } from '../lib/symbols'

export function PermTable(p: {
  perm: readonly (number | null)[]
  n?: number
  sym?: Sym
  label?: ReactNode
  highlight?: readonly number[]
  editable?: boolean
  onEdit?(i: number, v: number | null): void
  testId?: string
}): JSX.Element {
  const n = p.n ?? p.perm.length
  const testId = p.testId ?? 'perm-table'
  const cells = useRef<(HTMLInputElement | null)[]>([])
  const marked = new Set(p.highlight ?? [])
  const letter = (v: number | null | undefined) => (v === null || v === undefined || v < 0 || v >= n ? '' : LETTERS[v]!)
  const focus = (i: number) => cells.current[Math.max(0, Math.min(n - 1, i))]?.focus()

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
      e.preventDefault()
      focus(key === 'ArrowLeft' ? i - 1 : key === 'ArrowRight' ? i + 1 : key === 'Home' ? 0 : n - 1)
      return
    }
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault()
      p.onEdit?.(i, null)
      return
    }
    if (key.length === 1) {
      e.preventDefault()
      const v = key.toUpperCase().charCodeAt(0) - 65
      if (v >= 0 && v < n) {
        p.onEdit?.(i, v)
        focus(i + 1)
      }
    }
  }

  const cell = 'h-8 w-7 border border-stone-700 text-center font-mono text-sm'
  return (
    <figure className="flex min-w-0 flex-col gap-1">
      {p.label !== undefined || p.sym ? (
        <figcaption className="flex items-center gap-2 text-sm text-stone-300">
          {p.sym ? <SymChip s={p.sym} /> : null}
          {p.label}
        </figcaption>
      ) : null}
      <div
        className="max-w-full overflow-x-auto"
        role="region"
        aria-label={typeof p.label === 'string' ? p.label : 'Permutation table'}
        tabIndex={p.editable ? undefined : 0}
      >
        <table data-testid={testId} data-editable={p.editable ? 'true' : 'false'} className="border-collapse">
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
                    {p.editable ? (
                      <input
                        ref={(el) => {
                          cells.current[i] = el
                        }}
                        value={value}
                        onChange={(e) => {
                          // Virtual keyboards may skip keydown: take the last character typed.
                          const typed = e.target.value.toUpperCase().replace(value, '')
                          const v = typed.length ? typed.charCodeAt(typed.length - 1) - 65 : -1
                          if (e.target.value === '') p.onEdit?.(i, null)
                          else if (v >= 0 && v < n) p.onEdit?.(i, v)
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
