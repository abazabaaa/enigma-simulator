/**
 * The CodeMirror 6 editor behind CodeEditor (its own lazily loaded chunk; budget: the code editor ≤ 150 kB gzip).
 *  - Controlled: `value` is the source of truth. Edits call onChange; a new `value` from outside (another item,
 *    a restored draft) replaces the document without echoing back through onChange.
 *  - The contenteditable (.cm-content) carries the test id, aria-label and aria-describedby (the keyboard hint).
 *  - Tab inserts two spaces (indents a selection), Shift-Tab outdents. Esc then Tab leaves the editor: CodeMirror's
 *    tab-focus mode (Esc switches it on for 2 s; Ctrl-M toggles it for good), so Tab never traps the keyboard.
 *  - readOnly makes the content non-editable (and aria-readonly).
 *  - Dark colours that keep AA contrast on the stone-900 background, the active line included.
 */

import { indentLess, indentMore, defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import {
  HighlightStyle,
  LanguageSupport,
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap, lineNumbers, type Command } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef, type JSX } from 'react'
import type { EditorImplProps } from './CodeEditor'

/** Tab: two spaces at the cursor; with a selection, indent its lines. Nothing in a read-only editor. */
export const insertTwoSpaces: Command = (view) => {
  const { state } = view
  if (state.readOnly) return false
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view)
  view.dispatch(state.update(state.replaceSelection('  '), { scrollIntoView: true, userEvent: 'input' }))
  return true
}

/** Marks the transactions that copy an outside `value` in, so they do not call onChange. */
const External = Annotation.define<boolean>()

// Tailwind stone/amber, and highlight colours with ≥ 4.5:1 contrast on stone-900 and stone-800 (the active line).
const HIGHLIGHT = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#f0abfc' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#86efac' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#fcd34d' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#a8a29e', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#93c5fd' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: '#fde68a' },
  { tag: [t.propertyName], color: '#bae6fd' },
  { tag: [t.className, t.typeName, t.self], color: '#fda4af' },
  { tag: t.invalid, color: '#fca5a5' },
])

const THEME = EditorView.theme(
  {
    '&': { backgroundColor: '#1c1917', color: '#f5f5f4', fontSize: '0.875rem', minHeight: '12rem' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.625', minHeight: '12rem' },
    '.cm-content': { caretColor: '#fbbf24', padding: '0.75rem 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fbbf24' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': { backgroundColor: '#1c1917', color: '#a8a29e', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#292524' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#57534e',
    },
    '.cm-matchingBracket': { backgroundColor: '#44403c', outline: '1px solid #a8a29e' },
  },
  { dark: true },
)

function editable(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]
}

export default function CodeMirrorEditor({ value, onChange, readOnly, testId, hintId }: EditorImplProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const lock = useRef(new Compartment())
  // The props at mount; later changes go through the effects below.
  const initial = useRef({ value, readOnly: !!readOnly, testId: testId ?? 'code-editor', hintId })

  useEffect(() => {
    const init = initial.current
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: init.value,
        extensions: [
          lineNumbers(),
          history(),
          EditorState.tabSize.of(2),
          indentUnit.of('  '),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          new LanguageSupport(javascriptLanguage),
          syntaxHighlighting(HIGHLIGHT),
          keymap.of([{ key: 'Tab', run: insertTwoSpaces, shift: indentLess }, ...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({
            'data-testid': init.testId,
            'aria-label': 'Your code',
            'aria-describedby': init.hintId,
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(External))) {
              onChangeRef.current(u.state.doc.toString())
            }
          }),
          lock.current.of(editable(init.readOnly)),
          THEME,
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [])

  useEffect(() => {
    const v = view.current
    if (!v) return
    const doc = v.state.doc.toString()
    if (doc !== value) v.dispatch({ changes: { from: 0, to: doc.length, insert: value }, annotations: External.of(true) })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: lock.current.reconfigure(editable(!!readOnly)) })
  }, [readOnly])

  return (
    <div
      ref={host}
      data-editor="codemirror"
      className="w-full min-w-0 overflow-hidden rounded-md border border-stone-600 bg-stone-900 focus-within:border-amber-400"
    />
  )
}
