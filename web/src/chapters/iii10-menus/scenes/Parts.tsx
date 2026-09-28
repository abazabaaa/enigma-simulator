/**
 * Small displays shared by the scenes and the items: a crib's columns as numbered links (flagging a turnover), a menu
 * as a list of links, a menu drawn as a plain graph (no closure counter: the closures item asks for that number), and
 * a scrambler table on the toy's eight letters.
 */

import type { JSX } from 'react'
import type { Letter } from '../../../contracts/core'
import type { MenuEdge } from '../../../crypto/menu'

const SCROLL = 'max-w-full overflow-x-auto rounded-md border border-stone-700 bg-stone-950/60 p-2'

/** The crib over its cipher letters, one column per crib position (1-based); positions ≥ turnover marked !. */
export function CribColumns(p: { crib: string; cipher: string; turnover?: number }): JSX.Element {
  const late = (k: number) => p.turnover !== undefined && k + 1 >= p.turnover
  return (
    <div className={SCROLL} role="group" aria-label="The crib's columns, numbered from 1" tabIndex={0} data-testid="crib-columns">
      <table className="border-separate border-spacing-x-1 text-center font-mono text-sm">
        <tbody>
          <tr className="text-xs text-stone-400">
            <th scope="row" className="pr-2 text-left font-sans font-normal">
              Link
            </th>
            {[...p.crib].map((_, k) => (
              <td key={k} data-late={late(k) ? 'true' : undefined} className={late(k) ? 'text-red-300' : ''}>
                {k + 1}
                {late(k) ? '!' : ''}
              </td>
            ))}
          </tr>
          <tr className="text-amber-200">
            <th scope="row" className="pr-2 text-left font-sans text-xs font-normal text-stone-400">
              Crib
            </th>
            {[...p.crib].map((c, k) => (
              <td key={k}>{c}</td>
            ))}
          </tr>
          <tr className="text-stone-100">
            <th scope="row" className="pr-2 text-left font-sans text-xs font-normal text-stone-400">
              Cipher
            </th>
            {[...p.cipher].map((c, k) => (
              <td key={k}>{c}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** "1: A–K · 2: K–L · …" */
export function LinkList({ edges }: { edges: readonly MenuEdge[] }): JSX.Element {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm" aria-label="The menu's links" data-testid="link-list">
      {[...edges]
        .sort((a, b) => a.pos - b.pos)
        .map((e) => (
          <li key={e.pos}>
            {e.pos}: {e.a}–{e.b}
          </li>
        ))}
    </ul>
  )
}

const W = 360
const H = 300
const R = 115

/** A menu drawn as a graph: letters on a circle, one line per link labelled with its position. No counts. */
export function LinkDrawing({ edges, label }: { edges: readonly MenuEdge[]; label: string }): JSX.Element {
  const letters = [...new Set(edges.flatMap((e) => [e.a, e.b]))].sort() as Letter[]
  const at = new Map(
    letters.map((l, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / letters.length
      return [l, [W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a)] as const]
    }),
  )
  const seen = new Map<string, number>()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label={label} data-testid="link-drawing">
      {edges.map((e) => {
        const [x1, y1] = at.get(e.a)!
        const [x2, y2] = at.get(e.b)!
        const pair = [e.a, e.b].sort().join('')
        const n = seen.get(pair) ?? 0
        seen.set(pair, n + 1)
        const bend = n === 0 ? 0 : (n % 2 ? 1 : -1) * 28 * Math.ceil(n / 2)
        const d = Math.hypot(x2 - x1, y2 - y1) || 1
        const flip = e.a < e.b ? 1 : -1
        const [nx, ny] = [(-(y2 - y1) / d) * flip, ((x2 - x1) / d) * flip]
        const [qx, qy] = [(x1 + x2) / 2 + nx * bend * 2, (y1 + y2) / 2 + ny * bend * 2]
        const [lx, ly] = [(x1 + x2) / 4 + qx / 2, (y1 + y2) / 4 + qy / 2]
        return (
          <g key={e.pos}>
            <path d={`M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`} fill="none" stroke="var(--sym-reference)" strokeWidth={2} />
            <rect x={lx - 11} y={ly - 9} width={22} height={18} rx={4} className="fill-stone-900" stroke="var(--sym-reference)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="11" className="fill-stone-100">
              {e.pos}
            </text>
          </g>
        )
      })}
      {letters.map((l) => {
        const [x, y] = at.get(l)!
        return (
          <g key={l} transform={`translate(${x} ${y})`}>
            <circle r={15} className="fill-stone-900" stroke="var(--sym-reference)" strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="14" className="fill-stone-100 font-mono">
              {l}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** A scrambler on the toy's letters: the alphabet on top, the partner each one becomes below. */
export function ToyTable(p: { alphabet: readonly Letter[]; images: string; label: string; testId?: string }): JSX.Element {
  return (
    <div className="max-w-full overflow-x-auto" data-testid={p.testId}>
      <div className="text-xs text-stone-400">{p.label}</div>
      <table className="border-separate border-spacing-x-2 text-center font-mono text-sm">
        <tbody>
          <tr className="text-stone-400">
            {p.alphabet.map((l) => (
              <td key={l}>{l}</td>
            ))}
          </tr>
          <tr className="text-stone-100">
            {[...p.images].map((l, k) => (
              <td key={k}>{l}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
