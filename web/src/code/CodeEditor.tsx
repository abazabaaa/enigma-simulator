/**
 * The code editor (PLAN §3.7): CodeMirror 6 with JavaScript highlighting, loaded lazily behind the same props and
 * test id the textarea had (PR 17). CodeItem lazy-loads this module (its own small chunk), and this module lazy-loads
 * CodeMirror (./codemirror.tsx); if that import fails, the textarea below takes its place for the session.
 *
 * Keyboard (both editors): Tab inserts two spaces (with a selection, CodeMirror indents the lines) and Shift-Tab
 * outdents. Tab never traps a keyboard user: Esc, then Tab, moves the focus on (to the prediction, then Run), as
 * the hint under the editor says. `data-testid` sits on the element that takes the text (CodeMirror's
 * contenteditable .cm-content, or the textarea), so `getByTestId('code-editor').fill(source)` works for both.
 */

import { Suspense, lazy, useId, useRef, type JSX, type KeyboardEvent } from 'react'

export interface CodeEditorProps {
  readonly value: string
  onChange(v: string): void
  readonly readOnly?: boolean
  readonly testId?: string
}

/** The editors' own props: the id of the keyboard hint they are described by. */
export interface EditorImplProps extends CodeEditorProps {
  readonly hintId: string
}

/** How long after Esc a Tab leaves the editor (CodeMirror's tab-focus window). */
export const ESCAPE_WINDOW_MS = 2000

export const EDITOR_HINT = 'Tab indents. To leave the editor with the keyboard, press Esc, then Tab.'

const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta']

/** The fallback: a monospace textarea where Tab inserts two spaces, and Esc then Tab moves on. */
export function TextareaEditor(p: EditorImplProps): JSX.Element {
  const escapedAt = useRef<number | null>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      escapedAt.current = Date.now()
      return
    }
    const escaped = escapedAt.current !== null && Date.now() - escapedAt.current <= ESCAPE_WINDOW_MS
    if (!MODIFIERS.includes(e.key)) escapedAt.current = null
    if (e.key !== 'Tab' || e.shiftKey || p.readOnly || escaped) return
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
      data-editor="textarea"
      aria-label="Your code"
      aria-describedby={p.hintId}
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

/** CodeMirror, or the textarea when its chunk cannot be loaded. */
const Editor = lazy(() =>
  import('./codemirror').catch((e: unknown) => {
    console.warn('The code editor failed to load; using a plain text box.', e)
    return { default: TextareaEditor }
  }),
)

export function CodeEditor(p: CodeEditorProps): JSX.Element {
  const hintId = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Suspense fallback={<p className="text-sm text-stone-400">Loading the editor…</p>}>
        <Editor {...p} hintId={hintId} />
      </Suspense>
      <p id={hintId} className="text-xs text-stone-400">
        {EDITOR_HINT}
      </p>
    </div>
  )
}

export default CodeEditor
