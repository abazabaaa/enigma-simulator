/**
 * The code editor (PLAN §3.7): a monospace textarea where Tab inserts two spaces. PR 17 swaps in CodeMirror 6
 * behind the same props and test id. Loaded lazily by CodeItem, so it is its own chunk.
 */

import type { JSX, KeyboardEvent } from 'react'

export function CodeEditor(p: {
  value: string
  onChange(v: string): void
  readOnly?: boolean
  testId?: string
}): JSX.Element {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey || p.readOnly) return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: a, selectionEnd: b, value } = el
    const next = `${value.slice(0, a)}  ${value.slice(b)}`
    p.onChange(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = a + 2
    })
  }
  return (
    <textarea
      data-testid={p.testId ?? 'code-editor'}
      aria-label="Your code"
      className="min-h-48 w-full rounded-md border border-stone-600 bg-stone-900 p-3 font-mono text-sm leading-relaxed text-stone-100 focus:border-amber-400 focus:outline-none"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      value={p.value}
      readOnly={p.readOnly}
      onChange={(e) => p.onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

export default CodeEditor
