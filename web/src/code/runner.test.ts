import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunRequest, RunResponse } from '../contracts/code'
import { createRunner, type WorkerLike } from './runner'
import { countLines, executeRequest, findSyntaxErrorLine } from './runnerCore'
import { summarizeRun } from './summary'

const req = (source: string, o: Partial<RunRequest> = {}): RunRequest => ({
  id: 1,
  source,
  provided: '',
  fnNames: ['double'],
  calls: [{ fn: 'double', args: [21] }],
  timeoutMs: 1500,
  ...o,
})

describe('countLines', () => {
  it.each([
    ['function double(x) {\n  return x * 2\n}\n', 1],
    ['function double(x) { return x * 2 }', 1],
    ['function double(x) {\n  // a comment\n\n  const y = x\n  /* block\n  comment */\n  return y * 2\n}', 2],
    ['const double = (x) => {\n  const y = x\n  return y + y\n}', 2],
    ['const double = x => x * 2', 1],
    ["function double(x) {\n  const s = '{ not a brace'\n  return x * 2\n}", 2],
    ['function other() {\n  return 1\n}', 0],
    ['function double(a = { k: 1 }) {\n  return a\n}\nfunction other() {\n  a()\n  b()\n}', 1],
  ])('%#', (source, n) => {
    expect(countLines(source, 'double')).toBe(n)
  })

  it('counts each function separately', () => {
    const src = 'function compose(p, q) {\n  return p.map((x) => q[x])\n}\nfunction inverse(p) {\n  const out = []\n  p.forEach((x, i) => (out[x] = i))\n  return out\n}'
    expect(countLines(src, 'compose')).toBe(1)
    expect(countLines(src, 'inverse')).toBe(3)
  })
})

describe('executeRequest (the worker core, run in Node)', () => {
  it('runs the calls and captures console output instead of printing it', () => {
    const log = vi.spyOn(console, 'log')
    const res = executeRequest(req('function double(x) {\n  console.log("hi", x)\n  return x * 2\n}', {
      calls: [
        { fn: 'double', args: [21] },
        { fn: 'double', args: [-3] },
      ],
    }))
    expect(res).toEqual({ id: 1, ok: true, results: [{ value: 42 }, { value: -6 }], logs: ['hi 21', 'hi -3'] })
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('reports a syntax error with its line number', () => {
    const res = executeRequest(req('function double(x) {\n  const y = x *\n  return ;;)\n}'))
    expect(res).toMatchObject({ ok: false, error: 'syntax', line: 3 })
    expect(findSyntaxErrorLine('', "function f() {\n  return 'unterminated\n}")).toBe(2)
    expect(findSyntaxErrorLine('', 'function f() {\n  return 1\n')).toBe(3)
    expect(findSyntaxErrorLine('const a = 1\nconst b = 2', 'let c = = 3')).toBe(1)
  })

  it('reports a missing function', () => {
    expect(executeRequest(req('function triple(x) { return 3 * x }'))).toMatchObject({ ok: false, error: 'missing-fn' })
    expect(executeRequest(req('const double = 42'))).toMatchObject({ ok: false, error: 'missing-fn' })
  })

  it.each(['fetch("https://example.com")', 'importScripts("x.js")', 'new XMLHttpRequest()', 'new WebSocket("wss://x")', 'indexedDB.open("x")'])(
    'the shim for %s throws',
    (call) => {
      const res = executeRequest(req(`function double(x) {\n  ${call}\n  return x * 2\n}`))
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.results[0]).toMatchObject({ error: expect.stringMatching(/not available in the code runner|is not a function|undefined/) })
    },
  )

  it('turns runtime errors and top-level errors into per-call errors', () => {
    const res = executeRequest(req('function double(x) { return x.nope.deeper }'))
    expect(res.ok && res.results[0]).toMatchObject({ error: expect.stringContaining('TypeError') })
    const top = executeRequest(req('throw new Error("boom")\nfunction double(x) { return x }'))
    expect(top.ok && top.results[0]).toMatchObject({ error: expect.stringContaining('boom') })
  })

  it('records PathHops through __recordHop for instrumented tasks', () => {
    const provided = `const parts = { hop(stage, input, output) { __recordHop({ kind: 'rotor', stage, input, output, inputIndex: 0, outputIndex: 0 }); return output } }`
    const res = executeRequest(
      req('function double(x) { parts.hop("rotor-right-fwd", "A", "B"); return parts.hop("reflector", "B", "Q") }', {
        provided,
        instrument: 'keypress-parts',
      }),
    )
    expect(res.ok && res.results[0]).toMatchObject({ value: 'Q', hops: [{ stage: 'rotor-right-fwd', output: 'B' }, { stage: 'reflector', output: 'Q' }] })
    const plain = executeRequest(req('function double(x) { parts.hop("reflector", "B", "Q"); return 1 }', { provided }))
    expect(plain.ok && plain.results[0]).toEqual({ value: 1 })
  })

  it('clones arguments so learner code cannot mutate the cases', () => {
    const args = [[1, 2, 3]]
    executeRequest(req('function double(a) { a.push(4); return a }', { calls: [{ fn: 'double', args }] }))
    expect(args).toEqual([[1, 2, 3]])
  })
})

class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = []
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  terminated = false
  readonly behaviour: 'hang' | 'echo'
  constructor(behaviour: 'hang' | 'echo') {
    this.behaviour = behaviour
    FakeWorker.all.push(this)
  }
  postMessage(m: unknown) {
    if (this.behaviour === 'echo') {
      const res = executeRequest(m as RunRequest)
      queueMicrotask(() => this.onmessage?.({ data: res } as MessageEvent))
    }
  }
  terminate() {
    this.terminated = true
  }
}

describe('runner (fake worker adapter)', () => {
  afterEach(() => {
    FakeWorker.all = []
    vi.useRealTimers()
  })

  it('a run past its timeout terminates the worker and respawns a fresh one', async () => {
    vi.useFakeTimers()
    let n = 0
    const runner = createRunner(() => new FakeWorker(n++ === 0 ? 'hang' : 'echo'))
    const pending = runner.run({ source: 'while (true) {}', provided: '', fnNames: ['double'], calls: [], timeoutMs: 1500 })
    await vi.advanceTimersByTimeAsync(1499)
    expect(FakeWorker.all[0]!.terminated).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    const res = await pending
    expect(res).toMatchObject({ ok: false, error: 'timeout' })
    expect(FakeWorker.all[0]!.terminated).toBe(true)
    expect(runner.spawned()).toBe(2)
    vi.useRealTimers()
    const next = await runner.run({ source: 'function double(x) { return 2 * x }', provided: '', fnNames: ['double'], calls: [{ fn: 'double', args: [4] }], timeoutMs: 1500 })
    expect(next).toMatchObject({ ok: true, results: [{ value: 8 }] })
  })

  it('runs requests one at a time with increasing ids', async () => {
    const runner = createRunner(() => new FakeWorker('echo'))
    const base = { provided: '', fnNames: ['double'], calls: [{ fn: 'double', args: [1] }], timeoutMs: 1500 }
    const [a, b] = await Promise.all([
      runner.run({ ...base, source: 'function double(x) { return 2 * x }' }),
      runner.run({ ...base, source: 'function double(x) { return 3 * x }' }),
    ])
    expect([a.id, b.id]).toEqual([1, 2])
    expect(a.ok && a.results[0]).toEqual({ value: 2 })
    expect(b.ok && b.results[0]).toEqual({ value: 3 })
    expect(runner.spawned()).toBe(1)
  })
})

describe('summarizeRun', () => {
  const cases = [
    { label: 'a', fn: 'double', args: [1], expect: 2 },
    { label: 'b', fn: 'double', args: [2], expect: 4 },
  ]
  const ok = (values: unknown[]): RunResponse => ({ id: 1, ok: true, results: values.map((value) => ({ value })), logs: [] })

  it('passes when every case matches, and fails on the first mismatch', () => {
    expect(summarizeRun(cases, ok([2, 4]), 9)).toEqual({ status: 'pass', passed: 2, total: 2, instanceSeed: 9 })
    expect(summarizeRun(cases, ok([2, 5]), 9)).toEqual({
      status: 'fail',
      passed: 1,
      total: 2,
      instanceSeed: 9,
      firstFailure: { label: 'b', expected: '4', actual: '5' },
    })
  })

  it('maps runner errors', () => {
    expect(summarizeRun(cases, { id: 1, ok: false, error: 'timeout', message: 'x' }, 9)).toMatchObject({ status: 'timeout', passed: 0 })
    expect(summarizeRun(cases, { id: 1, ok: false, error: 'syntax', message: 'bad', line: 3 }, 9)).toMatchObject({
      status: 'error',
      firstFailure: { actual: 'bad (line 3)' },
    })
  })
})
