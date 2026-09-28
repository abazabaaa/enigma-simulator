// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CodeEditor } from './CodeEditor'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The CodeMirror chunk cannot be loaded (offline, a failed deploy): the textarea takes its place.
vi.mock('./codemirror', () => {
  throw new Error('chunk failed to load')
})

it('falls back to the textarea, with the same test id, label and hint, when CodeMirror fails to load', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const changes: string[] = []
  await act(async () => root.render(<CodeEditor value="let a = 1" onChange={(v) => void changes.push(v)} />))
  await vi.waitFor(() => expect(container.querySelector('textarea')).not.toBeNull())
  const ta = container.querySelector<HTMLTextAreaElement>('[data-testid="code-editor"]')!
  expect(ta.tagName).toBe('TEXTAREA')
  expect(ta.value).toBe('let a = 1')
  expect(ta.getAttribute('aria-label')).toBe('Your code')
  expect(document.getElementById(ta.getAttribute('aria-describedby')!)?.textContent).toMatch(/Esc, then Tab/)
  expect(container.querySelector('.cm-content')).toBeNull()
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/failed to load/), expect.anything())
  await act(async () => root.unmount())
  container.remove()
  warn.mockRestore()
})
