/**
 * Generic item builders (PLAN §3.6). PURE: chapters' gates.ts build their items with these, and the
 * generic Answer widgets (kinds/widgets/*.tsx) read the metadata the builders attach (`meta`).
 *
 * Defaults:
 *  - compute: true for letter, letters, numbers, chain, set-machine and code; false for choice, order, ghost-pick.
 *  - inPage: true for set-machine and ghost-pick. A custom item declares both flags itself.
 *  - sampleAnswer: a uniform, well-formed answer (the guess bot); mutate: a wrong answer near `a` (the lint).
 */

import type { Choice, Letter, MachineConfig, ModelName, Rng } from '../../contracts/core'
import type { CodeAnswer, CodeRunSummary, CodeTask } from '../../contracts/code'
import type { ChapterGates, CheckResult, ItemLogic, ItemSetup, Rollback } from '../../contracts/lesson'
import type { LockKey, MachineLocks } from '../../contracts/machine'
import type { Ghost, PartId } from '../../contracts/stage'
import { LETTERS, normalizeConfig, type MachineConfigInput } from '../../engine'
import { int, pick, randLetter, sample, shuffle } from '../../lib/rng'

export * from './helpers'

type Base<I, A> = Omit<ItemLogic<I, A>, 'kind' | 'sampleAnswer' | 'mutate' | 'compute' | 'inPage'> &
  Partial<Pick<ItemLogic<I, A>, 'sampleAnswer' | 'mutate' | 'compute' | 'inPage'>>

/** What the generic widgets need to know about an item, beyond its instance. */
export interface ItemMeta {
  /** letter / letters / chain: the alphabet size (A–F, A–H or A–Z). */
  readonly alphabet?: 6 | 8 | 26
  /** numbers: inclusive [lo, hi] or the list of allowed values. */
  readonly range?: readonly [number, number] | readonly number[]
  readonly tolerance?: number | { readonly relative: number }
  readonly multiset?: true
  /** code: the task (brief, cases, probe, reference). */
  readonly task?: CodeTask<any>
}

export type BuiltItem<I, A> = ItemLogic<I, A> & { readonly meta: ItemMeta }

/** The builder metadata of an item ({} for hand-written custom items). */
export function metaOf(l: ItemLogic): ItemMeta {
  return (l as Partial<BuiltItem<unknown, unknown>>).meta ?? {}
}

const letterAt = (i: number): Letter => LETTERS[i]!
const nextLetter = (l: string, n = 26): Letter => letterAt((LETTERS.indexOf(l.toUpperCase() as Letter) + 1 + n) % n)

function alphabetOf(i: unknown, fallback: 6 | 8 | 26 = 26): 6 | 8 | 26 {
  const n = (i as { alphabet?: unknown } | null)?.alphabet
  return n === 6 || n === 8 || n === 26 ? n : fallback
}

function built<I, A>(logic: ItemLogic<I, A>, meta: ItemMeta): BuiltItem<I, A> {
  return Object.freeze({ ...logic, meta: Object.freeze(meta) })
}

// ---------------------------------------------------------------------------
// letter, letters
// ---------------------------------------------------------------------------

export function letterItem<I>(s: Base<I, Letter> & { alphabet?: 6 | 8 | 26 }): ItemLogic<I, Letter> {
  const { alphabet = 26, ...rest } = s
  return built<I, Letter>(
    {
      compute: true,
      inPage: false,
      sampleAnswer: (_i, r) => randLetter(r, alphabet),
      mutate: (_i, a) => nextLetter(a, alphabet),
      ...rest,
      kind: 'letter',
    },
    { alphabet },
  )
}

/** Answers are strings of `instance.length` letters (A–Z, or A–F/A–H when the instance has `alphabet`). */
export function lettersItem<I extends { length: number }>(s: Base<I, string>): ItemLogic<I, string> {
  return built<I, string>(
    {
      compute: true,
      inPage: false,
      sampleAnswer: (i, r) => Array.from({ length: i.length }, () => randLetter(r, alphabetOf(i))).join(''),
      mutate: (i, a, r) => {
        if (a.length === 0) return 'A'
        const k = int(r, a.length)
        return a.slice(0, k) + nextLetter(a[k]!, alphabetOf(i)) + a.slice(k + 1)
      },
      ...s,
      kind: 'letters',
    },
    {},
  )
}

// ---------------------------------------------------------------------------
// numbers
// ---------------------------------------------------------------------------

/** All integer partitions of m (parts descending). */
export function partitions(m: number): number[][] {
  const out: number[][] = []
  const rec = (left: number, max: number, acc: number[]) => {
    if (left === 0) {
      out.push([...acc])
      return
    }
    for (let p = Math.min(left, max); p >= 1; p--) rec(left - p, p, [...acc, p])
  }
  rec(m, m, [])
  return out
}

const partitionCache = new Map<number, number[][]>()

/** A uniformly random paired partition of n (n even): every cycle length appears twice, descending. */
export function randomPairedPartition(r: Rng, n: number): number[] {
  const m = Math.floor(n / 2)
  let parts = partitionCache.get(m)
  if (!parts) partitionCache.set(m, (parts = partitions(m)))
  return pick(r, parts).flatMap((p) => [p, p])
}

function rangeValues(range: readonly [number, number] | readonly number[]): readonly number[] {
  if (range.length === 2) {
    const [lo, hi] = range as readonly [number, number]
    return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => lo + k)
  }
  return range
}

/**
 * Compare number lists: in order, or as multisets (`multiset`), each within `tolerance` (absolute, or
 * `{ relative }` as a fraction of the expected value).
 */
export function numbersMatch(
  expected: readonly number[],
  got: readonly number[],
  o: { tolerance?: number | { relative: number }; multiset?: boolean } = {},
): boolean {
  if (!Array.isArray(got) || expected.length !== got.length) return false
  if (got.some((x) => typeof x !== 'number' || !Number.isFinite(x))) return false
  const e = o.multiset ? [...expected].sort((a, b) => b - a) : expected
  const g = o.multiset ? [...got].sort((a, b) => b - a) : got
  const tol = (x: number) =>
    o.tolerance === undefined ? 0 : typeof o.tolerance === 'number' ? o.tolerance : Math.abs(x) * o.tolerance.relative
  return e.every((x, k) => Math.abs(x - g[k]!) <= tol(x) + 1e-9)
}

export function numbersItem<I extends { count: number | 'any' }>(
  s: Base<I, number[]> & {
    range: readonly [number, number] | readonly number[]
    tolerance?: number | { relative: number }
    multiset?: true
  },
): ItemLogic<I, number[]> {
  const { range, tolerance, multiset, ...rest } = s
  const values = rangeValues(range)
  const pairedDefault = multiset && range.length === 2 && range[0] === 0 && range[1] === 26
  return built<I, number[]>(
    {
      compute: true,
      inPage: false,
      sampleAnswer: (i, r) => {
        const n = (i as { n?: unknown }).n
        if (pairedDefault && typeof n === 'number') return randomPairedPartition(r, n)
        if (i.count === 'any') {
          const k = int(r, Math.min(6, values.length) + 1)
          return sample(r, values, k).sort((a, b) => a - b)
        }
        return Array.from({ length: i.count }, () => pick(r, values))
      },
      mutate: (_i, a) => (a.length === 0 ? [values[0] ?? 0] : [a[0]! + 1, ...a.slice(1)]),
      ...rest,
      kind: 'numbers',
    },
    { range, ...(tolerance !== undefined ? { tolerance } : {}), ...(multiset ? { multiset } : {}) },
  )
}

// ---------------------------------------------------------------------------
// choice, order, chain
// ---------------------------------------------------------------------------

export function choiceItem<I extends { options: readonly Choice[] }>(s: Base<I, string>): ItemLogic<I, string> {
  return built<I, string>(
    {
      compute: false,
      inPage: false,
      sampleAnswer: (i, r) => pick(r, i.options).id,
      mutate: (i, a) => {
        const k = i.options.findIndex((o) => o.id === a)
        return i.options[(k + 1) % i.options.length]!.id
      },
      ...s,
      kind: 'choice',
    },
    {},
  )
}

/** Answers are block ids in order. */
export function orderItem<I extends { blocks: readonly Choice[] }>(s: Base<I, string[]>): ItemLogic<I, string[]> {
  return built<I, string[]>(
    {
      compute: false,
      inPage: false,
      sampleAnswer: (i, r) => shuffle(r, i.blocks.map((b) => b.id)),
      mutate: (_i, a, r) => {
        if (a.length < 2) return [...a, '?']
        const [x, y] = sample(r, a.map((_, k) => k), 2) as [number, number]
        const out = [...a]
        ;[out[x], out[y]] = [out[y]!, out[x]!]
        return out
      },
      ...s,
      kind: 'order',
    },
    {},
  )
}

/** Answers are one token (a letter by default) per stage. */
export function chainItem<I extends { stages: readonly { id: string; label: string }[] }>(
  s: Base<I, string[]>,
): ItemLogic<I, string[]> {
  return built<I, string[]>(
    {
      compute: true,
      inPage: false,
      sampleAnswer: (i, r) => i.stages.map(() => randLetter(r, alphabetOf(i))),
      mutate: (i, a, r) => {
        if (a.length === 0) return ['A']
        const k = int(r, a.length)
        return a.map((t, j) => (j === k ? nextLetter(t || 'A', alphabetOf(i)) : t))
      },
      ...s,
      kind: 'chain',
    },
    { alphabet: 26 },
  )
}

// ---------------------------------------------------------------------------
// set-machine
// ---------------------------------------------------------------------------

export const LOCKABLE: readonly Exclude<LockKey, 'keyboard'>[] = ['model', 'rotors', 'reflector', 'rings', 'positions', 'plugboard']

/**
 * The locks a set-the-machine item applies (G8): the keyboard is locked, the lamps are hidden, and every
 * control except `unlocked` is locked. Extra locks from the instance's own setup (e.g. hold) are kept.
 */
export function setMachineLocks(unlocked: readonly LockKey[], base: MachineLocks = {}): MachineLocks {
  const locks: Record<string, boolean> = { ...base }
  for (const k of LOCKABLE) locks[k] = !unlocked.includes(k)
  locks.keyboard = true
  locks.lampsHidden = true
  return locks as MachineLocks
}

type SetMachineInstance = { setup: ItemSetup; unlocked: readonly LockKey[]; trial: 'locked' | 'preview'; maxPlugs?: number }

/** The fields of a config that each lock guards. */
function fieldOf(c: MachineConfig, k: Exclude<LockKey, 'keyboard'>): unknown {
  switch (k) {
    case 'model':
      return c.model
    case 'rotors':
      return c.rotors
    case 'reflector':
      return c.reflector
    case 'rings':
      return c.rings
    case 'positions':
      return c.positions
    case 'plugboard':
      return [...c.plugboard].map((p) => [...p].sort().join('')).sort()
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The first field the learner could not have changed that differs from the setup (a devtools edit). */
function lockedFieldChanged(i: SetMachineInstance, cfg: MachineConfig): Exclude<LockKey, 'keyboard'> | 'invalid' | null {
  if (!i.setup.machine) return null
  let start: MachineConfig
  try {
    start = normalizeConfig(i.setup.machine)
  } catch {
    return 'invalid'
  }
  // A model switch re-derives rotors, reflector and slots: then only the model's own lock is compared.
  for (const k of LOCKABLE) {
    if (i.unlocked.includes(k)) continue
    if (k !== 'model' && i.unlocked.includes('model')) continue
    if (!same(fieldOf(cfg, k), fieldOf(start, k))) return k
  }
  return null
}

const MODEL_PART: Readonly<Record<Exclude<LockKey, 'keyboard'>, PartId>> = {
  model: 'lid',
  rotors: 'rotor-right',
  reflector: 'reflector',
  rings: 'ring-right',
  positions: 'rotor-right',
  plugboard: 'plugboard',
}

export function setMachineItem<I extends SetMachineInstance>(
  s: Omit<Base<I, MachineConfig>, 'check'> & {
    predicate(i: I, cfg: MachineConfig): true | { field: LockKey; message: string; highlight: readonly PartId[] }
    sampleAnswer(i: I, r: Rng): MachineConfig
  },
): ItemLogic<I, MachineConfig> {
  const { predicate, setup, ...rest } = s
  const fail = (field: LockKey, message: string, highlight: readonly PartId[]): CheckResult => ({
    correct: false,
    feedback: message,
    rollback: { kind: 'machine', field, message, highlight },
  })
  return built<I, MachineConfig>(
    {
      compute: true,
      inPage: true,
      mutate: (_i, a) => {
        const positions = [...a.positions]
        const k = positions.length - 1
        positions[k] = nextLetter(positions[k]!)
        return { ...a, positions }
      },
      ...rest,
      kind: 'set-machine',
      setup(i) {
        const own = setup ? setup(i) : i.setup
        return { ...own, locks: setMachineLocks(i.unlocked, own.locks) }
      },
      check(i, answer) {
        let cfg: MachineConfig
        try {
          cfg = normalizeConfig(answer as MachineConfigInput)
        } catch {
          return fail('model', 'That is not a valid machine setting.', ['lid'])
        }
        const changed = lockedFieldChanged(i, cfg)
        if (changed === 'invalid') return fail('model', 'That is not a valid machine setting.', ['lid'])
        if (changed) return fail(changed, `The ${changed} setting was not yours to change.`, [MODEL_PART[changed]])
        if (i.maxPlugs !== undefined && cfg.plugboard.length > i.maxPlugs) {
          return fail('plugboard', `Use at most ${i.maxPlugs} cable${i.maxPlugs === 1 ? '' : 's'}.`, ['plugboard'])
        }
        const verdict = predicate(i, cfg)
        if (verdict === true) return { correct: true, rollback: { kind: 'none' } }
        return fail(verdict.field, verdict.message, verdict.highlight)
      },
    },
    {},
  )
}

// ---------------------------------------------------------------------------
// ghost-pick
// ---------------------------------------------------------------------------

export function ghostPickItem<I extends { options: readonly PartId[]; ghost: Ghost }>(
  s: Base<I, PartId>,
): ItemLogic<I, PartId> {
  return built<I, PartId>(
    {
      compute: false,
      inPage: true,
      sampleAnswer: (i, r) => pick(r, i.options),
      mutate: (i, a) => i.options[(i.options.indexOf(a) + 1) % i.options.length]!,
      ...s,
      kind: 'ghost-pick',
    },
    {},
  )
}

// ---------------------------------------------------------------------------
// code
// ---------------------------------------------------------------------------

/** Probe answers compare after trimming, dropping surrounding quotes, collapsing spaces and upper-casing. */
export function normalizeProbe(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/^(['"`])(.*)\1$/s, '$2')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

/** A uniform random token of the probe answer's type (letter, integer, boolean or string of that shape). */
export function randomProbeToken(expected: string, r: Rng): string {
  const e = normalizeProbe(expected)
  if (/^[A-Z]$/.test(e)) return randLetter(r)
  if (/^-?\d+$/.test(e)) {
    const m = Math.abs(Number(e))
    const lo = Math.min(-1, -2 * m)
    const hi = Math.max(26, 2 * m)
    return String(lo + int(r, hi - lo + 1))
  }
  if (e === 'TRUE' || e === 'FALSE') return r() < 0.5 ? 'true' : 'false'
  if (/^[A-Z]+$/.test(e)) return Array.from({ length: e.length }, () => randLetter(r)).join('')
  const chars = [...new Set(e)]
  return Array.from({ length: e.length }, () => pick(r, chars)).join('')
}

/** The next token after `probe` (the lint's near miss). */
export function nextProbeToken(probe: string): string {
  const e = normalizeProbe(probe)
  if (/^[A-Z]$/.test(e)) return nextLetter(e)
  if (/^-?\d+$/.test(e)) return String(Number(e) + 1)
  if (e === 'TRUE') return 'false'
  if (e === 'FALSE') return 'true'
  return e.length ? e.slice(0, -1) + (e.endsWith('A') ? 'B' : 'A') : 'A'
}

/** A run that passed every case of this instance (the reveal, the guess bot and Node-side e2e). */
export function passingRun(total: number, instanceSeed: number): CodeRunSummary {
  return { status: 'pass', passed: total, total, instanceSeed }
}

/**
 * Rule 6 / G7: correct ⇔ the probe (typed before Run) matches AND every case of THIS instance passed.
 * `s.rollback` (optional) picks the rollback shown for a wrong answer; by default a run with recorded hops
 * draws them as a ghost against the case whose `compare` is 'hops', and anything else is 'none'.
 */
export function codeItem<I extends { seed: number }>(
  task: CodeTask<I>,
  s: Pick<ItemLogic<I, CodeAnswer>, 'id' | 'rule' | 'generate' | 'same' | 'highlight'> &
    Partial<Pick<ItemLogic<I, CodeAnswer>, 'transfer' | 'constantAnswer' | 'lintSeeds' | 'setup'>> & {
      rollback?(i: I, a: CodeAnswer): Rollback
    },
): ItemLogic<I, CodeAnswer> {
  const { rollback, ...rest } = s
  const defaultRollback = (i: I, a: CodeAnswer): Rollback => {
    const hops = a.run?.hops
    const ref = task.cases(i).find((c) => c.compare === 'hops')
    if (hops && hops.length && ref && Array.isArray(ref.expect)) {
      const expected = ref.expect as readonly { output: string }[]
      let divergeAt = hops.findIndex((h, k) => h.output !== expected[k]?.output)
      if (divergeAt === -1) divergeAt = Math.min(hops.length, expected.length) - 1
      return { kind: 'path', ghost: { hops, divergeAt: Math.max(0, divergeAt) } }
    }
    return { kind: 'none' }
  }
  return built<I, CodeAnswer>(
    {
      compute: true,
      inPage: false,
      ...rest,
      kind: 'code',
      check(i, a) {
        const probe = task.probe(i)
        const run = a?.run
        const probeOk = normalizeProbe(a?.probe) === normalizeProbe(probe.expected) && normalizeProbe(a?.probe) !== ''
        const runOk =
          !!run && run.status === 'pass' && run.total > 0 && run.passed === run.total && run.instanceSeed === i.seed
        if (probeOk && runOk) return { correct: true, rollback: { kind: 'none' } }
        let feedback: string
        if (!run || run.instanceSeed !== i.seed) feedback = 'That run belongs to another instance: run your code again.'
        else if (run.status === 'too-long') feedback = `Keep each function within ${task.maxLines} lines.`
        else if (run.status === 'timeout') feedback = 'Your code ran too long and was stopped.'
        else if (run.status === 'error') feedback = run.firstFailure?.actual ?? 'Your code threw an error.'
        else if (!runOk) {
          const f = run.firstFailure
          feedback = f ? `Case ${f.label}: expected ${f.expected}, got ${f.actual}.` : 'Some cases failed.'
        } else feedback = `Every case passed, but your prediction for ${probe.call} did not match what the function returns.`
        return { correct: false, feedback, rollback: (rollback ?? defaultRollback)(i, a) }
      },
      solve: (i) => ({ probe: task.probe(i).expected, run: passingRun(task.cases(i).length, i.seed) }),
      sampleAnswer: (i, r) => ({
        probe: randomProbeToken(task.probe(i).expected, r),
        run: passingRun(task.cases(i).length, i.seed),
      }),
      mutate: (_i, a) => ({ probe: nextProbeToken(a.probe), run: a.run }),
    },
    { task },
  )
}

/** The code task of a code item (null for other kinds). */
export function codeTaskOf(l: ItemLogic): CodeTask<any> | null {
  return l.kind === 'code' ? (metaOf(l).task ?? null) : null
}

/** Model of the machine a setup configures (for callers that must pick the right parts list). */
export function setupModel(setup: ItemSetup | undefined): ModelName {
  return setup?.machine?.model ?? 'I'
}

/** Every item and fallback of a chapter's gates, each once (fallbacks may repeat an item). */
export function allItems(gates: ChapterGates): ItemLogic[] {
  const seen = new Set<ItemLogic>()
  for (const g of Object.values(gates)) {
    for (const it of g.items) seen.add(it)
    seen.add(g.fallback)
  }
  return [...seen]
}
