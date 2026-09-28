/**
 * Shared views for chapter iii11-bombe: the scrambler tables of a toy loop, the wire bench (WireGrid and TestRegister
 * side by side, the register read from the same replayed state), and small text helpers. Scenes and items.tsx use
 * them; every instance renders its own data.
 */

import type { JSX, ReactNode } from 'react'
import type { WireState } from '../../../crypto/bombe'
import type { Menu } from '../../../crypto/menu'
import type { Letter } from '../../../engine'
import { TestRegister, WireGrid } from '../../../viz'
import { TOY_LETTERS, type Toy } from '../gates'

const up = (i: number) => String.fromCharCode(65 + i)

/** The loop in order, back to its first letter: "C → F → D → C". */
export const loopText = (loop: readonly Letter[]): string => [...loop, loop[0]!].join(' → ')

/** Row labels for a toy loop's scramblers: "1: C–F", "2: F–D", … */
export const loopLabels = (toy: Toy): string[] =>
  toy.loop.map((a, j) => `${j + 1}: ${a}–${toy.loop[(j + 1) % toy.loop.length]}`)

/** Row labels for any menu's scramblers, by crib position. */
export const menuLabels = (menu: Menu): string[] =>
  [...menu.edges].sort((x, y) => x.pos - y.pos).map((e) => `${e.pos}: ${e.a}–${e.b}`)

/**
 * Scramblers as one table: a column per letter A–H, a row per scrambler. Read a partner in the top row; the letter
 * under it in a scrambler's row is the partner of the other letter that scrambler joins.
 */
export function ScramblerTable(p: {
  labels: readonly string[]
  tables: readonly string[]
  caption?: ReactNode
  testId?: string
}): JSX.Element {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse font-mono text-sm" data-testid={p.testId ?? 'scrambler-table'}>
        {p.caption ? <caption className="pb-1 text-left font-sans text-xs text-stone-400">{p.caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col" className="pr-3 text-left font-sans text-xs font-normal text-stone-400">
              Partner in
            </th>
            {TOY_LETTERS.map((l) => (
              <th key={l} scope="col" className="w-7 border-b border-stone-600 text-center font-semibold text-stone-100">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.tables.map((t, j) => (
            <tr key={j} data-scrambler={j + 1}>
              <th scope="row" className="pr-3 text-left font-sans text-xs font-normal whitespace-nowrap text-stone-300">
                {p.labels[j]}
              </th>
              {[...t].map((c, w) => (
                <td key={w} className="w-7 text-center text-amber-200">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The test register's wires after the first `step` events of a state (all of them when step is undefined). */
export function registerAt(state: WireState, test: Letter, step?: number): boolean[] {
  const bank = test.charCodeAt(0) - 65
  const events = step === undefined ? state.order : state.order.slice(0, Math.max(0, step))
  const live = new Array<boolean>(state.n).fill(false)
  for (const e of events) if (e.bank === bank) live[e.wire] = true
  return live
}

/** A plain-text reading of a register: "a b c". */
export function registerText(live: readonly boolean[]): string {
  const on = live.flatMap((x, w) => (x ? [up(w).toLowerCase()] : []))
  return on.length ? on.join(' ') : 'none'
}

/** A sideways scroller for the 26-wire views: focusable, so the keyboard can scroll it (axe scrollable-region). */
function scroller(wide: boolean, label: string): Record<string, unknown> {
  return wide
    ? { className: 'max-w-full overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-amber-400', tabIndex: 0, role: 'region', 'aria-label': label }
    : {}
}

/**
 * The wire bench: the test register above, the wire grid below (26 wires scroll inside their own box on a phone).
 * `testIds` names the two views when a page shows more than one bench.
 */
export function WireBench(p: {
  state: WireState
  step?: number
  test: Letter
  diagonal: boolean
  onToggleWire?(bank: number, wire: number): void
  testIds?: { grid: string; register: string }
}): JSX.Element {
  const n = p.state.n
  const wide = n > 8
  const register = registerAt(p.state, p.test, p.step)
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 ${wide ? '' : 'sm:flex-row-reverse sm:items-start sm:justify-end sm:gap-6'}`}
      data-testid={p.testIds ? `${p.testIds.grid}-bench` : 'wire-bench'}
    >
      <div {...scroller(wide, `Test register ${p.test}, scrolls sideways`)}>
        <div style={wide ? { minWidth: 580, maxWidth: 680 } : { width: 'min(100%, 340px)' }}>
          <TestRegister live={register} testLetter={p.test} testId={p.testIds?.register} />
        </div>
      </div>
      {/* The grid scrolls sideways inside its own focusable region (viz). */}
      <div className="min-w-0">
        <div style={wide ? { maxWidth: 520 } : { width: 'min(100%, 300px)' }}>
          <WireGrid
            state={p.state}
            step={p.step}
            diagonal={p.diagonal}
            testLetter={p.test}
            onToggleWire={p.onToggleWire}
            testId={p.testIds?.grid}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Event k of a propagation as a sentence: "Scrambler 2 (F–D): F↔b gives D↔h". The source wire is found from the
 * scrambler itself (it is an involution: the wire it came from is its image in the other cable).
 */
export function describeEvent(state: WireState, k: number, menu: Menu, tables: readonly string[]): string {
  const e = state.order[k]!
  const bank = up(e.bank)
  const wire = up(e.wire).toLowerCase()
  if (e.via === 'hypothesis') return `The voltage goes onto wire ${wire} of cable ${bank}: the hypothesis ${bank}↔${wire}.`
  if (e.via === 'diagonal') return `The diagonal board: ${up(e.wire)}↔${bank.toLowerCase()} lights ${bank}↔${wire}.`
  const pos = e.via
  const edge = menu.edges.find((x) => x.pos === pos)
  const table = tables[pos - 1]
  if (!edge || !table) return `Scrambler ${pos}: ${bank}↔${wire}.`
  const other = edge.a === bank ? edge.b : edge.a
  const from = table[e.wire]!
  return `Scrambler ${pos} (${edge.a}–${edge.b}): ${other}↔${from.toLowerCase()} gives ${bank}↔${wire}.`
}

/**
 * A crib under its message at an offset: two rows of letters, the crib's columns marked. It scrolls sideways inside a
 * focusable region on a phone. Nothing moves: the offset is the one without a crash.
 */
export function CribLine({ cipher, crib, offset }: { cipher: string; crib: string; offset: number }): JSX.Element {
  return (
    <div
      className="max-w-full overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-amber-400"
      role="region"
      aria-label={`The crib ${crib} under the message, from letter ${offset + 1}`}
      tabIndex={0}
      data-testid="crib-line"
      data-offset={offset}
    >
      <table className="border-collapse font-mono text-sm">
        <tbody>
          <tr>
            <th scope="row" className="pr-2 text-left font-sans text-xs font-normal text-stone-400">
              Message
            </th>
            {[...cipher].map((c, k) => (
              <td key={k} className={`w-5 text-center ${k >= offset && k < offset + crib.length ? 'text-stone-100' : 'text-stone-500'}`}>
                {c}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-2 text-left font-sans text-xs font-normal text-stone-400">
              Crib
            </th>
            {[...cipher].map((_, k) => (
              <td key={k} className="w-5 text-center text-amber-200">
                {k >= offset && k < offset + crib.length ? crib[k - offset] : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
