// @vitest-environment happy-dom
import { EditorView } from '@codemirror/view'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CodeEditor, EDITOR_HINT, TextareaEditor } from './CodeEditor'
import { insertTwoSpaces } from './codemirror'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeAll(async () => {
  // Load the CodeMirror chunk up front, so React.lazy resolves inside act().
  await import('./codemirror')
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

/** A keydown as the browser sends it (key and keyCode); returns whether the editor took it (preventDefault). */
function key(el: Element, k: 'Tab' | 'Escape' | 'a', o: { shift?: boolean } = {}): boolean {
  const e = new KeyboardEvent('keydown', { key: k, shiftKey: !!o.shift, bubbles: true, cancelable: true })
  Object.defineProperty(e, 'keyCode', { value: { Tab: 9, Escape: 27, a: 65 }[k] })
  el.dispatchEvent(e)
  return e.defaultPrevented
}

const content = () => container.querySelector<HTMLElement>('[data-testid="code-editor"]')!

async function mount(p: { value?: string; readOnly?: boolean } = {}) {
  const changes: string[] = []
  let setOutside: (v: string) => void = () => {}
  function Harness() {
    const [value, setValue] = useState(p.value ?? '')
    setOutside = setValue
    return (
      <CodeEditor
        value={value}
        readOnly={p.readOnly}
        onChange={(v) => {
          changes.push(v)
          setValue(v)
        }}
      />
    )
  }
  await act(async () => root.render(<Harness />))
  await vi.waitFor(() => expect(container.querySelector('.cm-content')).not.toBeNull())
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  return { changes, view, setOutside: (v: string) => act(async () => setOutside(v)) }
}

describe('CodeEditor (CodeMirror)', () => {
  it('puts the test id on the contenteditable, labelled and described by the keyboard hint', async () => {
    const { view } = await mount({ value: 'function f(x) {\n  return x\n}\n' })
    const el = content()
    expect(el.classList.contains('cm-content')).toBe(true)
    expect(el.getAttribute('contenteditable')).toBe('true')
    expect(el.getAttribute('role')).toBe('textbox')
    expect(el.getAttribute('aria-label')).toBe('Your code')
    const hint = document.getElementById(el.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(EDITOR_HINT)
    expect(view.state.doc.toString()).toBe('function f(x) {\n  return x\n}\n')
    expect(container.querySelector('[data-editor="codemirror"]')).not.toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('reports every edit through onChange; an outside value replaces the document without an echo', async () => {
    const { changes, view, setOutside } = await mount({ value: 'abc' })
    await act(async () => view.dispatch({ changes: { from: 3, insert: 'd' } }))
    expect(changes).toEqual(['abcd'])
    await setOutside('function g() {}')
    expect(view.state.doc.toString()).toBe('function g() {}')
    expect(changes).toEqual(['abcd'])
  })

  it('Tab inserts two spaces and Shift-Tab outdents; Esc then Tab is left to the browser', async () => {
    const { changes, view } = await mount({ value: 'x' })
    await act(async () => view.dispatch({ selection: { anchor: 1 } }))
    let taken = false
    await act(async () => void (taken = key(content(), 'Tab')))
    expect(taken).toBe(true)
    expect(changes.at(-1)).toBe('x  ')
    await act(async () => void key(content(), 'Tab', { shift: true }))
    expect(view.state.doc.toString()).toBe('x  ')
    await act(async () => view.dispatch({ changes: { from: 0, insert: '  ' } }))
    await act(async () => void key(content(), 'Tab', { shift: true }))
    expect(view.state.doc.toString()).toBe('x  ')
    // The escape hatch: after Esc the next Tab is not handled, so the browser moves the focus on.
    const before = view.state.doc.toString()
    await act(async () => void key(content(), 'Escape'))
    await act(async () => void (taken = key(content(), 'Tab')))
    expect(taken).toBe(false)
    expect(view.state.doc.toString()).toBe(before)
    // Another key ends the window: Tab indents again.
    await act(async () => void key(content(), 'Escape'))
    await act(async () => void key(content(), 'a'))
    await act(async () => void (taken = key(content(), 'Tab')))
    expect(taken).toBe(true)
  })

  it('with a selection, Tab indents the selected lines', async () => {
    const { view } = await mount({ value: 'a\nb' })
    await act(async () => view.dispatch({ selection: { anchor: 0, head: 3 } }))
    await act(async () => void key(content(), 'Tab'))
    expect(view.state.doc.toString()).toBe('  a\n  b')
  })

  it('readOnly: not editable, aria-readonly, and Tab changes nothing', async () => {
    const { changes, view } = await mount({ value: 'x', readOnly: true })
    expect(content().getAttribute('contenteditable')).toBe('false')
    expect(content().getAttribute('aria-readonly')).toBe('true')
    expect(insertTwoSpaces(view)).toBe(false)
    await act(async () => void key(content(), 'Tab'))
    expect(view.state.doc.toString()).toBe('x')
    expect(changes).toEqual([])
  })
})

describe('TextareaEditor (the fallback)', () => {
  it('Tab inserts two spaces; Esc then Tab is left to the browser; readOnly inserts nothing', async () => {
    const changes: string[] = []
    const render = (readOnly: boolean) =>
      act(async () =>
        root.render(
          <TextareaEditor value="x" readOnly={readOnly} hintId="h" onChange={(v) => void changes.push(v)} />,
        ),
      )
    await render(false)
    const ta = container.querySelector<HTMLTextAreaElement>('textarea[data-testid="code-editor"]')!
    expect(ta.getAttribute('aria-describedby')).toBe('h')
    ta.setSelectionRange(1, 1)
    expect(key(ta, 'Tab')).toBe(true)
    expect(changes).toEqual(['x  '])
    key(ta, 'Escape')
    expect(key(ta, 'Tab')).toBe(false)
    expect(changes).toEqual(['x  '])
    key(ta, 'Escape')
    key(ta, 'a')
    expect(key(ta, 'Tab')).toBe(true)
    await render(true)
    expect(key(ta, 'Tab')).toBe(false)
    expect(changes).toHaveLength(2)
  })
})
