/**
 * The code runner's core (PLAN §3.7): compiles the learner's source behind shims and runs the requested
 * calls. runner.worker.ts runs it inside a module Worker; the unit tests run it directly in Node.
 *
 * Inside the compiled code, fetch, importScripts, XMLHttpRequest, WebSocket and indexedDB are throwing
 * shims (the worker also replaces the globals), `console` only records to `logs`, and `__recordHop(hop)`
 * records a PathHop for the current call when the request is instrumented ('keypress-parts'): a task's
 * `provided` helpers (e.g. the instrumented `parts`) call it.
 */

import type { RunRequest, RunResponse } from '../contracts/code'
import type { PathHop } from '../contracts/stage'

export const SHIMMED = ['fetch', 'importScripts', 'XMLHttpRequest', 'WebSocket', 'indexedDB'] as const

export function blocked(name: string): () => never {
  return function blockedApi(): never {
    throw new Error(`${name} is not available in the code runner`)
  }
}

function compiles(code: string): boolean {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code)
    return true
  } catch {
    return false
  }
}

/** The text that closes every bracket, template and block comment still open at the end of `code`. */
export function closersFor(code: string): string {
  const stack: string[] = []
  let inComment = false
  let i = 0
  while (i < code.length) {
    const c = code[i]!
    const n = code[i + 1]
    const top = stack.at(-1)
    if (top === '`') {
      if (c === '\\') i += 2
      else if (c === '`') {
        stack.pop()
        i++
      } else if (c === '$' && n === '{') {
        stack.push('${')
        i += 2
      } else i++
      continue
    }
    if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++
    } else if (c === '/' && n === '*') {
      const e = code.indexOf('*/', i + 2)
      if (e === -1) {
        inComment = true
        i = code.length
      } else i = e + 2
    } else if (c === '"' || c === "'") {
      i++
      while (i < code.length && code[i] !== c && code[i] !== '\n') i += code[i] === '\\' ? 2 : 1
      i++
    } else if (c === '`' || c === '(' || c === '[' || c === '{') {
      stack.push(c)
      i++
    } else if (c === ')' || c === ']' || c === '}') {
      stack.pop()
      i++
    } else i++
  }
  const close: Record<string, string> = { '(': ')', '[': ']', '{': '}', '`': '`', '${': '}' }
  return (
    (inComment ? '*/' : '') +
    stack
      .reverse()
      .map((s) => close[s])
      .join('')
  )
}

/**
 * The 1-based line of the learner's source where a syntax error is (V8 gives new Function errors no
 * position): the first prefix of lines that fails to compile even with its open brackets closed and with an
 * expression appended (so an unfinished expression such as `x *` does not count as the error).
 */
export function findSyntaxErrorLine(provided: string, source: string): number {
  const lines = source.split('\n')
  const head = provided ? `${provided}\n` : ''
  for (let k = 1; k <= lines.length; k++) {
    const prefix = head + lines.slice(0, k).join('\n')
    const closers = closersFor(prefix)
    if (!compiles(`${prefix}\n${closers}`) && !compiles(`${prefix}\n0\n${closers}`)) return k
  }
  return lines.length
}

function safeValue(v: unknown): unknown {
  if (v === undefined) return undefined
  try {
    return structuredClone(v)
  } catch {
    return String(v)
  }
}

function message(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

function show(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
}

/** Compile the source and run the calls. Synchronous: the caller (the worker) is killed on a timeout. */
export function executeRequest(req: RunRequest): RunResponse {
  const logs: string[] = []
  const record = (...args: unknown[]) => {
    if (logs.length < 200) logs.push(show(args))
  }
  const consoleShim = { log: record, info: record, warn: record, error: record, debug: record }
  let hops: PathHop[] | null = null
  const recordHop = (hop: PathHop) => {
    if (hops && hops.length < 64) hops.push({ ...hop })
  }
  const exportsOf = req.fnNames
    .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
    .join(', ')
  const body = `'use strict';\n${req.provided}\n${req.source}\n;return { ${exportsOf} }`
  let factory: (...a: unknown[]) => Record<string, unknown>
  try {
    // eslint-disable-next-line no-new-func
    factory = new Function(...SHIMMED, 'console', '__recordHop', body) as typeof factory
  } catch (e) {
    const line = findSyntaxErrorLine(req.provided, req.source)
    return { id: req.id, ok: false, error: 'syntax', message: message(e), line }
  }

  let fns: Record<string, unknown>
  try {
    fns = factory(...SHIMMED.map(blocked), consoleShim, recordHop)
  } catch (e) {
    const error = `Error while loading your code: ${message(e)}`
    return { id: req.id, ok: true, results: req.calls.map(() => ({ error })), logs }
  }
  const missing = req.fnNames.filter((n) => typeof fns[n] !== 'function')
  if (missing.length) {
    return {
      id: req.id,
      ok: false,
      error: 'missing-fn',
      message: `Define ${missing.map((n) => `function ${n}(…)`).join(' and ')}.`,
    }
  }

  const results = req.calls.map((call) => {
    const fn = fns[call.fn]
    if (typeof fn !== 'function') return { error: `${call.fn} is not one of ${req.fnNames.join(', ')}` }
    hops = req.instrument === 'keypress-parts' ? [] : null
    try {
      const value = safeValue((fn as (...a: unknown[]) => unknown)(...structuredClone(call.args)))
      return hops ? { value, hops } : { value }
    } catch (e) {
      return { error: message(e) }
    } finally {
      hops = null
    }
  })
  return { id: req.id, ok: true, results, logs }
}

// ---------------------------------------------------------------------------
// countLines
// ---------------------------------------------------------------------------

/** Blank string and comment contents so braces inside them do not count (keeps line breaks). */
function mask(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const c = source[i]!
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' '
        i++
      }
    } else if (c === '/' && next === '*') {
      out += '  '
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' '
        i++
      }
      out += '  '
      i += 2
    } else if (c === '"' || c === "'" || c === '`') {
      out += c
      i++
      while (i < source.length && source[i] !== c) {
        if (source[i] === '\\') {
          out += ' '
          i++
        }
        out += source[i] === '\n' ? '\n' : ' '
        i++
      }
      out += c
      i++
    } else {
      out += c
      i++
    }
  }
  return out
}

/**
 * Non-blank, non-comment lines in the body of function `fn` (a declaration, or a const/let/var bound to a
 * function or arrow). A body on the signature's line counts as one line. 0 when `fn` is not defined.
 */
export function countLines(source: string, fn: string): number {
  const masked = mask(source)
  const name = fn.replace(/[$]/g, '\\$')
  const decl = new RegExp(`(?:function\\s*\\*?\\s*${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`)
  const m = decl.exec(masked)
  if (!m) return 0
  let i = m.index + m[0].length
  let depth = m[0].endsWith('(') ? 1 : 0
  // Walk past the parameters to the body: '{' at depth 0, or an arrow's expression.
  for (; i < masked.length; i++) {
    const c = masked[i]!
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (depth === 0 && c === '{') break
    else if (depth === 0 && c === '=' && masked[i + 1] === '>') {
      let j = i + 2
      while (j < masked.length && /\s/.test(masked[j]!)) j++
      if (masked[j] === '{') {
        i = j
        break
      }
      return nonBlank(expressionAt(masked, j))
    } else if (depth === 0 && c === ';') return 0
  }
  if (i >= masked.length) return 0
  const open = i
  depth = 0
  for (; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}' && --depth === 0) break
  }
  const body = masked.slice(open + 1, i)
  return Math.max(nonBlank(body), body.trim() === '' ? 0 : 1)
}

/** An arrow's expression body: up to ';' or a line break at bracket depth 0. */
function expressionAt(masked: string, from: number): string {
  let depth = 0
  let j = from
  for (; j < masked.length; j++) {
    const x = masked[j]!
    if ('([{'.includes(x)) depth++
    else if (')]}'.includes(x)) {
      if (depth === 0) break
      depth--
    } else if (depth === 0 && (x === ';' || x === '\n')) break
  }
  return masked.slice(from, j)
}

function nonBlank(text: string): number {
  return text.split('\n').filter((l) => l.trim() !== '').length
}
