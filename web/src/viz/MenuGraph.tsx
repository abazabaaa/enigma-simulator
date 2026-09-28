import type { JSX, KeyboardEvent } from 'react'
import type { Letter } from '../engine'
import { closures, loops, type MenuEdge } from '../crypto/menu'
import type { MenuGraphProps } from './types'

const W = 520
const H = 400
const R = 150

/** Letters on a circle in depth-first order from the busiest letter, so loops tend to sit on the rim. */
function circleOrder(edges: readonly MenuEdge[]): Letter[] {
  const adj = new Map<Letter, Letter[]>()
  for (const e of edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
    adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
  }
  const letters = [...adj.keys()].sort((x, y) => adj.get(y)!.length - adj.get(x)!.length || x.localeCompare(y))
  const order: Letter[] = []
  const seen = new Set<Letter>()
  const visit = (l: Letter) => {
    if (seen.has(l)) return
    seen.add(l)
    order.push(l)
    for (const m of [...adj.get(l)!].sort()) visit(m)
  }
  for (const l of letters) visit(l)
  return order
}

const key = (e: MenuEdge) => [e.a, e.b].sort().join('')

/**
 * A menu as a graph: letters are nodes, each crib position p is an edge a–b labelled p (a scrambler). `available`
 * edges not yet in the menu are drawn dashed and listed as "Add" buttons (Enter or click → onAddEdge); menu edges
 * are listed as "Remove" buttons (Enter, Delete or Backspace → onRemoveEdge). The closure count E − V + C is shown
 * and exposed as data-closures, with data-edges, data-letters and data-loops.
 */
export function MenuGraph(p: MenuGraphProps): JSX.Element {
  const testId = p.testId ?? 'menu-graph'
  const menuEdges = [...p.menu.edges].sort((x, y) => x.pos - y.pos)
  const inMenu = new Set(menuEdges.map((e) => e.pos))
  const extra = (p.available ?? []).filter((e) => !inMenu.has(e.pos)).sort((x, y) => x.pos - y.pos)
  const all = [...menuEdges, ...extra]
  const order = circleOrder(all)
  const place = new Map(
    order.map((l, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, order.length)
      return [l, [W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a)] as const]
    }),
  )
  const count = closures(p.menu)
  const found = loops(p.menu)
  const warn = new Set(p.warnings ?? [])
  const loopPairs = new Set<string>()
  const hl = p.highlightLoop ?? []
  hl.forEach((l, i) => loopPairs.add([l, hl[(i + 1) % hl.length]!].sort().join('')))
  const inLoop = (e: MenuEdge) => hl.length > 1 && loopPairs.has(key(e)) && hl.includes(e.a) && hl.includes(e.b)
  const loopLetters = new Set(hl)

  // parallel edges between the same two letters bow apart
  const groups = new Map<string, MenuEdge[]>()
  for (const e of all) groups.set(key(e), [...(groups.get(key(e)) ?? []), e])

  const letterCount = p.menu.letters.length
  const edgeList = menuEdges.map((e) => `${e.a}–${e.b} at ${e.pos}`).join(', ') || 'no edges'
  const onRemoveKey = (pos: number) => (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      p.onRemoveEdge?.(pos)
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid={testId} data-closures={count} data-edges={menuEdges.length}
      data-letters={letterCount} data-loops={found.map((l) => l.join('')).join(' ')}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img"
        aria-label={`Menu: ${edgeList}; ${count} closures`}>
        {all.map((e) => {
          const [x1, y1] = place.get(e.a)!
          const [x2, y2] = place.get(e.b)!
          const group = groups.get(key(e))!
          const k = group.indexOf(e)
          const spread = (k - (group.length - 1) / 2) * 26
          const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
          const d = Math.hypot(x2 - x1, y2 - y1) || 1
          // perpendicular in a fixed orientation (by letter order) so parallel edges fan out consistently
          const flip = e.a < e.b ? 1 : -1
          const [nx, ny] = [(-(y2 - y1) / d) * flip, ((x2 - x1) / d) * flip]
          const self = e.a === e.b
          const [qx, qy] = [mx + nx * spread * 2, my + ny * spread * 2]
          const [lx, ly] = self ? [x1, y1 - 44] : [(mx + qx) / 2, (my + qy) / 2]
          const added = inMenu.has(e.pos)
          const loop = added && inLoop(e)
          const warned = warn.has(e.pos)
          const stroke = loop ? 'var(--sym-signal)' : added ? 'var(--sym-reference)' : 'var(--sym-dim)'
          return (
            <g key={e.pos} data-edge={e.pos} data-added={added ? 'true' : 'false'} data-loop={loop ? 'true' : undefined}
              data-warning={warned ? 'true' : undefined}>
              <path
                d={self ? `M ${x1 - 8} ${y1 - 12} C ${x1 - 30} ${y1 - 60}, ${x1 + 30} ${y1 - 60}, ${x1 + 8} ${y1 - 12}`
                  : `M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`}
                fill="none" stroke={stroke} strokeWidth={loop ? 3.5 : added ? 2 : 1.5}
                strokeDasharray={added ? undefined : '5 5'} />
              <rect x={lx - 13} y={ly - 10} width={26} height={20} rx={4} className="fill-stone-900"
                stroke={warned ? 'var(--sym-ghost)' : stroke} strokeWidth={warned ? 2 : 1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="11"
                className={`${added ? 'fill-stone-100' : 'fill-stone-400'} tabular-nums`}>
                {warned ? `${e.pos}!` : e.pos}
              </text>
            </g>
          )
        })}
        {order.map((l) => {
          const [x, y] = place.get(l)!
          const used = p.menu.letters.includes(l)
          return (
            <g key={l} transform={`translate(${x} ${y})`} data-node={l}>
              <circle r={16} className="fill-stone-900"
                stroke={loopLetters.has(l) ? 'var(--sym-signal)' : used ? 'var(--sym-reference)' : 'var(--sym-dim)'}
                strokeWidth={loopLetters.has(l) ? 3 : 2} />
              <text textAnchor="middle" dominantBaseline="central" fontSize="15"
                className={`${used ? 'fill-stone-100' : 'fill-stone-400'} font-mono`}>
                {l}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-sm text-stone-300" data-testid={`${testId}-closures`} aria-live="polite">
        Closures: <span className="font-semibold text-stone-100">{count}</span> (E − V + C with {menuEdges.length}{' '}
        {menuEdges.length === 1 ? 'edge' : 'edges'} and {letterCount} letters)
      </p>
      {p.onAddEdge && extra.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Edges you can add">
          {extra.map((e) => (
            <button key={e.pos} type="button" onClick={() => p.onAddEdge?.(e.pos)} data-testid={`${testId}-add-${e.pos}`}
              aria-label={`Add edge ${e.a}–${e.b} at position ${e.pos}${warn.has(e.pos) ? ' (past the turnover)' : ''}`}
              className="rounded border border-dashed border-stone-500 px-2 py-1 font-mono text-sm text-stone-200 hover:bg-stone-800">
              + {e.pos}: {e.a}–{e.b}
              {warn.has(e.pos) ? ' !' : ''}
            </button>
          ))}
        </div>
      )}
      {p.onRemoveEdge && menuEdges.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Edges in the menu">
          {menuEdges.map((e) => (
            <button key={e.pos} type="button" onClick={() => p.onRemoveEdge?.(e.pos)} onKeyDown={onRemoveKey(e.pos)}
              data-testid={`${testId}-remove-${e.pos}`} aria-label={`Remove edge ${e.a}–${e.b} at position ${e.pos}`}
              className="rounded border border-stone-500 px-2 py-1 font-mono text-sm text-stone-100 hover:bg-stone-800">
              − {e.pos}: {e.a}–{e.b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
