/**
 * The British workbench (the british-tools scene on a practice day, and the british gate's items): the crib slid
 * under the intercept, the menu built from its links, the bombe run in a worker over the three candidate wheel orders,
 * the checking machine on each stop, and the preview of the message. Every tool runs on what the learner gives it.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { MachineStoreHook } from '../../../contracts/machine'
import { checkStop, type Stop } from '../../../crypto'
import { runBombeAsync } from '../../../crypto/bombeClient'
import { closures, menuFromEdges, type Menu } from '../../../crypto/menu'
import type { RotorName } from '../../../engine'
import { BUTTON, Mono, QUIET_BUTTON } from '../../../lesson'
import { CribStrip, MenuGraph } from '../../../viz'
import { MAX_LINKS, VOCABULARY, cribLinks, encipherFast, keyOfConfig, pieces } from '../gates'

/** Stops listed per wheel order (a menu with few closures can stop thousands of times). */
const SHOWN_STOPS = 12

// ---------------------------------------------------------------------------
// The crib and the menu
// ---------------------------------------------------------------------------

/** Slide the crib under the intercept; the window the crib is known to start in is named, the crashes shown. */
export function CribPlacer(p: {
  cipher: string
  crib: string
  window: readonly [number, number]
  offset: number
  onOffset(o: number): void
  disabled?: boolean
  /** The tool scene introduces the strip itself; inside an item the prompt already has. */
  intro?: boolean
}): JSX.Element {
  const inWindow = p.offset >= p.window[0] && p.offset <= p.window[1]
  return (
    <div className="flex flex-col gap-2" data-testid="crib-placer">
      {p.intro ? (
        <p className="text-sm text-stone-300">
          The crib <Mono>{p.crib}</Mono> starts at an offset from {p.window[0]} to {p.window[1]} (the numbers above the strip). Slide
          it (arrow keys on the strip) to the offset where no crib letter sits under the same cipher letter.
        </p>
      ) : null}
      <CribStrip cipher={p.cipher} crib={p.crib} offset={p.offset} onOffset={p.disabled ? undefined : p.onOffset} testId="crib-strip" />
      {inWindow ? null : (
        <p className="text-sm text-amber-200" data-testid="crib-outside">
          Offset {p.offset} is outside the range the crib can start in ({p.window[0]} to {p.window[1]}).
        </p>
      )}
    </div>
  )
}

/** Choose links of the crib at `offset` for the menu: MenuGraph with a closure count. */
export function MenuBuilder(p: {
  cipher: string
  crib: string
  offset: number
  chosen: readonly number[]
  onChosen(c: readonly number[]): void
  disabled?: boolean
  testId?: string
}): JSX.Element {
  const all = cribLinks(p.cipher, p.crib, p.offset)
  const edges = all.filter((e) => p.chosen.includes(e.pos))
  const menu = menuFromEdges(edges)
  const parts = edges.length ? pieces(edges).length : 0
  const c = closures(menu)
  return (
    <div className="flex flex-col gap-2" data-testid={p.testId ?? 'menu-builder'} data-links={[...p.chosen].sort((a, b) => a - b).join(',')}>
      <p className="text-sm text-stone-300">
        Each crib position is a link between the crib letter and the cipher letter under it. Choose at most {MAX_LINKS} links in one
        connected piece with at least 2 closures (closures = links − letters + pieces). The more links, the fewer the bombe&apos;s stops.
      </p>
      <MenuGraph
        menu={menu}
        available={all}
        onAddEdge={p.disabled ? undefined : (pos) => p.onChosen(p.chosen.includes(pos) ? p.chosen : [...p.chosen, pos])}
        onRemoveEdge={p.disabled ? undefined : (pos) => p.onChosen(p.chosen.filter((x) => x !== pos))}
        testId="menu-graph"
      />
      <p className="text-sm text-stone-300" data-testid="menu-count" data-closures={c} data-pieces={parts}>
        {edges.length} of at most {MAX_LINKS} links, in {parts} piece{parts === 1 ? '' : 's'}
        {parts > 1 ? ': the bombe feeds its current in at one letter, so keep one connected piece' : ''}.
      </p>
      <div>
        <button
          type="button"
          className={QUIET_BUTTON}
          disabled={p.disabled}
          onClick={() => p.onChosen(all.map((e) => e.pos))}
          data-testid="menu-all"
        >
          Add every link
        </button>{' '}
        <button type="button" className={QUIET_BUTTON} disabled={p.disabled} onClick={() => p.onChosen([])} data-testid="menu-clear">
          Clear
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The bombe and the checking machine
// ---------------------------------------------------------------------------

interface Run {
  readonly rotors: readonly RotorName[]
  readonly stops: readonly Stop[]
}

type BombeState =
  | { phase: 'idle' }
  | { phase: 'running'; order: number; done: number; runs: readonly Run[] }
  | { phase: 'done'; runs: readonly Run[]; menu: string }

/**
 * Run the bombe (in a worker) with the learner's menu over the three candidate wheel orders, board on or off; list
 * each order's stops, and check any stop on the checking machine: the steckers it implies along the whole crib, or
 * the letter the stop would need to plug twice.
 */
export function BombeBench(p: {
  menu: Menu
  orders: readonly (readonly RotorName[])[]
  cipher: string
  crib: string
  offset: number
  onUse?(stop: Stop, steckers: readonly string[]): void
  onChecked?(): void
  onRun?(): void
}): JSX.Element {
  const [diagonal, setDiagonal] = useState(true)
  const [state, setState] = useState<BombeState>({ phase: 'idle' })
  const [checks, setChecks] = useState<Readonly<Record<string, ReturnType<typeof checkStop>>>>({})
  const abort = useRef<AbortController | null>(null)
  const menuKey = `${p.offset}|${p.menu.edges.map((e) => e.pos).join(',')}|${diagonal}`
  useEffect(() => () => abort.current?.abort(), [])
  // A different menu or crib position makes old stops meaningless.
  useEffect(() => {
    setState((s) => (s.phase === 'done' && s.menu !== menuKey ? { phase: 'idle' } : s))
    setChecks({})
  }, [menuKey])

  const c = closures(p.menu)
  const run = async () => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    const runs: Run[] = []
    try {
      for (const [k, rotors] of p.orders.entries()) {
        setState({ phase: 'running', order: k, done: 0, runs: [...runs] })
        const stops = await runBombeAsync(
          {
            menu: p.menu,
            rotors,
            reflector: 'B',
            diagonal,
            onProgress: (d, t) => setState({ phase: 'running', order: k, done: d / t, runs: [...runs] }),
          },
          ctl.signal,
        )
        runs.push({ rotors, stops })
      }
      setState({ phase: 'done', runs, menu: menuKey })
      p.onRun?.()
    } catch {
      setState({ phase: 'idle' })
    }
  }
  const stopId = (s: Stop) => `${s.rotors.join('-')}@${s.positions}`
  const total = state.phase === 'done' ? state.runs.reduce((n, r) => n + r.stops.length, 0) : 0
  return (
    <div className="flex flex-col gap-2" data-testid="bombe-bench" data-state={state.phase} data-stops={state.phase === 'done' ? total : ''}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
        <button type="button" className={BUTTON} onClick={() => void run()} disabled={state.phase === 'running' || p.menu.edges.length === 0}
          data-testid="bombe-run">
          Run the bombe on the {p.orders.length} wheel orders
        </button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={diagonal} onChange={(e) => setDiagonal(e.target.checked)} data-testid="bombe-diagonal" />
          diagonal board
        </label>
        <span className="text-xs text-stone-400">
          Your menu: {p.menu.edges.length} links, {c} closure{c === 1 ? '' : 's'}; rings 01, reflector B; 17,576 drum positions per
          order.
        </span>
      </div>
      {state.phase === 'running' ? (
        <p className="text-sm text-stone-300" aria-live="polite" data-testid="bombe-progress">
          Running {p.orders[state.order]!.join('-')} ({state.order + 1} of {p.orders.length}):{' '}
          <progress max={1} value={state.done} className="w-32 align-middle accent-amber-400" aria-label="Bombe run progress" />{' '}
          {Math.round(state.done * 100)} %
        </p>
      ) : null}
      {state.phase === 'done' ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-stone-300" data-testid="bombe-summary">
            {total} stop{total === 1 ? '' : 's'} in all:{' '}
            {state.runs.map((r) => `${r.stops.length} on ${r.rotors.join('-')}`).join(', ')}.
          </p>
          {state.runs.map((r) => (
            <div key={r.rotors.join('-')} className="flex flex-col gap-1">
              <p className="text-xs text-stone-400">
                {r.rotors.join('-')}
                {r.stops.length > SHOWN_STOPS
                  ? `: the first ${SHOWN_STOPS} of ${r.stops.length} stops (a menu with more links and closures stops less often)`
                  : ''}
              </p>
              <ul className="flex flex-col gap-1" data-testid={`stops-${r.rotors.join('-')}`}>
                {r.stops.slice(0, SHOWN_STOPS).map((s) => {
                  const id = stopId(s)
                  const verdict = checks[id]
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`stop-${id}`}
                      data-consistent={verdict ? String(verdict.consistent) : ''}>
                      <Mono>
                        {s.rotors.join('-')} drums {s.positions}
                      </Mono>
                      <span className="text-stone-400">
                        {s.testLetter}↔{s.stecker.toLowerCase()}, {s.live} live
                      </span>
                      <button
                        type="button"
                        className={QUIET_BUTTON}
                        onClick={() => {
                          setChecks((m) => ({ ...m, [id]: checkStop(s, p.cipher, p.crib, p.offset) }))
                          p.onChecked?.()
                        }}
                        data-testid={`stop-check-${id}`}
                      >
                        Check
                      </button>
                      {verdict ? (
                        verdict.consistent ? (
                          <>
                            <span className="text-emerald-300" data-testid={`stop-verdict-${id}`}>
                              Consistent: {verdict.steckers.length} cables ({verdict.steckers.map((x) => `${x[0]}–${x[1]}`).join(' ') || 'none'})
                            </span>
                            {p.onUse ? (
                              <button type="button" className={QUIET_BUTTON} onClick={() => p.onUse?.(s, verdict.steckers)}
                                data-testid={`stop-use-${id}`}>
                                Set these rotors and cables
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-red-300" data-testid={`stop-verdict-${id}`}>
                            False stop: {verdict.contradiction?.letter} would need two partners,{' '}
                            {verdict.contradiction?.partners.join(' and ')}.
                          </span>
                        )
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The words the day's messages are made of (X between words), for reading a partial decrypt. */
export function Vocabulary(): JSX.Element {
  return (
    <details className="text-sm" data-testid="vocabulary">
      <summary className="cursor-pointer text-stone-300">The words the day&apos;s messages use (X between words)</summary>
      <p className="mt-1 font-mono text-xs leading-relaxed text-stone-300">{VOCABULARY.join(' ')}</p>
    </details>
  )
}

/**
 * What the machine's current rotors, windows and cables make of the intercept: its enciphered key read at the start
 * position sent in clear, and the body read from the windows (the trial preview; no key is pressed).
 */
export function InterceptReader(p: {
  store: MachineStoreHook
  config: Parameters<typeof keyOfConfig>[0]
  windows: string
  start: string
  encKey: string
  message: string
}): JSX.Element {
  const k = keyOfConfig(p.config)
  const key = useMemo(() => encipherFast(k, p.start, p.encKey), [k.rotors.join(), k.plugboard.join(), p.start, p.encKey])
  const body = encipherFast(k, p.windows, p.message)
  return (
    <div className="flex flex-col gap-2" data-testid="intercept-reader">
      <p className="text-sm text-stone-300" data-testid="enc-key-read">
        At the start position <Mono>{p.start}</Mono> (sent in clear) the enciphered key <Mono>{p.encKey}</Mono> reads{' '}
        <Mono className="text-amber-200">{key}</Mono> with your rotors and cables.
      </p>
      <div className="rounded-md border border-stone-700 p-2" data-testid="trial-preview">
        <div className="text-xs text-stone-400">The body deciphered from the windows you set ({p.windows})</div>
        <div className="font-mono break-all text-stone-200" data-testid="trial-preview-text">
          {body}
        </div>
      </div>
    </div>
  )
}

