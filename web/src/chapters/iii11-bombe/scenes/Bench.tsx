/**
 * Shared views for chapter iii11-bombe: the scrambler tables of a toy loop, the wire bench (WireGrid and TestRegister
 * side by side, the register read from the same replayed state), and small text helpers. Scenes and items.tsx use
 * them; every instance renders its own data.
 */

import type { JSX, ReactNode } from 'react'
import type { WireState } from '../../../crypto/bombe'
import type { Letter } from '../../../engine'
import { TestRegister, WireGrid } from '../../../viz'
import { TOY_LETTERS, type Toy } from '../gates'

const up = (i: number) => String.fromCharCode(65 + i)

/** The loop in order, back to its first letter: "C → F → D → C". */
export const loopText = (loop: readonly Letter[]): string => [...loop, loop[0]!].join(' → ')

/**
 * The scramblers of a toy loop as one table: a column per letter A–H, a row per scrambler. Read a partner in the
 * top row; the letter under it in scrambler j's row is the partner of the next letter round the loop.
 */
export function ScramblerTable({ toy, caption, testId }: { toy: Toy; caption?: ReactNode; testId?: string }): JSX.Element {
  const k = toy.loop.length
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse font-mono text-sm" data-testid={testId ?? 'scrambler-table'}>
        {caption ? <caption className="pb-1 text-left font-sans text-xs text-stone-400">{caption}</caption> : null}
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
          {toy.tables.map((t, j) => (
            <tr key={j} data-scrambler={j + 1}>
              <th scope="row" className="pr-3 text-left font-sans text-xs font-normal whitespace-nowrap text-stone-300">
                {j + 1}: {toy.loop[j]}–{toy.loop[(j + 1) % k]}
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

/** A plain-text reading of a register: "a b c (3 of 8)". */
export function registerText(live: readonly boolean[]): string {
  const on = live.flatMap((x, w) => (x ? [up(w).toLowerCase()] : []))
  return `${on.length ? on.join(' ') : 'none'} (${on.length} of ${live.length})`
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
    <div className="flex min-w-0 flex-col gap-3" data-testid={p.testIds ? `${p.testIds.grid}-bench` : 'wire-bench'}>
      <div className={wide ? 'max-w-full overflow-x-auto' : ''}>
        <div style={wide ? { minWidth: 580, maxWidth: 680 } : { maxWidth: 420 }}>
          <TestRegister live={register} testLetter={p.test} testId={p.testIds?.register} />
        </div>
      </div>
      <div className={wide ? 'max-w-full overflow-x-auto' : ''}>
        <div style={wide ? { minWidth: 416, maxWidth: 520 } : { maxWidth: 360 }}>
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

/** The events of a state as sentences: "Scrambler 2 (F–D): F↔b gives D↔h". */
export function describeEvent(
  state: WireState,
  k: number,
  loop: readonly Letter[] | null,
): string {
  const e = state.order[k]!
  const bank = up(e.bank)
  const wire = up(e.wire).toLowerCase()
  if (e.via === 'hypothesis') return `The voltage goes onto wire ${wire} of cable ${bank}: the hypothesis ${bank}↔${wire}.`
  if (e.via === 'diagonal') return `The diagonal board: ${up(e.wire)}↔${bank.toLowerCase()} lights ${bank}↔${wire}.`
  const prev = state.order[k - 1]
  const from = prev ? `${up(prev.bank)}↔${up(prev.wire).toLowerCase()}` : ''
  const link = loop ? ` (${loop[e.via - 1]}–${loop[e.via % loop.length]})` : ''
  return `Scrambler ${e.via}${link}: ${from} gives ${bank}↔${wire}.`
}
