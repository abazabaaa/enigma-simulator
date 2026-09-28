import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react'
import type { Letter } from '../engine'
import { closures, loops, type MenuEdge } from '../crypto/menu'
import type { MenuGraphProps } from './types'

const NODE_R = 17
/** Rim length per letter: keeps edge labels clear of the nodes on busy rings. */
const ARC = 76
const GAP = 22
const MAX_ROW = 600
const LOOP_ROOM = 46

const ADD_BUTTON = 'rounded border border-dashed border-stone-500 px-2 py-1 font-mono text-sm text-stone-200 hover:bg-stone-800'
const key = (e: MenuEdge) => [e.a, e.b].sort().join('')
const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`

/**
 * The connected pieces of a graph, each ordered depth-first from its busiest letter (so loops tend to sit on the
 * rim of the piece's circle); largest piece first.
 */
export function menuPieces(edges: readonly MenuEdge[]): Letter[][] {
  const adj = new Map<Letter, Letter[]>()
  for (const e of edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
    if (e.a !== e.b) adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
  }
  const byDegree = [...adj.keys()].sort((x, y) => adj.get(y)!.length - adj.get(x)!.length || x.localeCompare(y))
  const seen = new Set<Letter>()
  const pieces: Letter[][] = []
  for (const start of byDegree) {
    if (seen.has(start)) continue
    const piece: Letter[] = []
    const visit = (l: Letter) => {
      if (seen.has(l)) return
      seen.add(l)
      piece.push(l)
      for (const m of [...new Set(adj.get(l)!)].sort()) visit(m)
    }
    visit(start)
    pieces.push(piece)
  }
  return pieces.sort((x, y) => y.length - x.length || x[0]!.localeCompare(y[0]!))
}

function ringRadius(k: number): number {
  if (k <= 1) return 0
  if (k === 2) return 48
  return Math.max(58, (k * ARC) / (2 * Math.PI))
}

/** One circle per piece, wrapped into rows. */
function layout(pieces: readonly Letter[][], selfLoops: ReadonlySet<Letter>) {
  const place = new Map<Letter, readonly [number, number]>()
  let x = GAP
  let y = GAP
  let rowH = 0
  let width = 0
  for (const piece of pieces) {
    const r = ringRadius(piece.length)
    const top = piece.some((l) => selfLoops.has(l)) ? LOOP_ROOM : 0
    const w = 2 * (r + NODE_R)
    // a pair lies flat: no empty band above and below it
    const flat = piece.length === 2 ? 2 * NODE_R + 24 : 2 * (r + NODE_R)
    const h = flat + top
    if (x + w > MAX_ROW - GAP && x > GAP) {
      x = GAP
      y += rowH + GAP
      rowH = 0
    }
    const [cx, cy] = [x + w / 2, y + top + flat / 2]
    const start = piece.length === 2 ? Math.PI : -Math.PI / 2
    piece.forEach((l, i) => {
      const a = start + (2 * Math.PI * i) / piece.length
      place.set(l, [cx + r * Math.cos(a), cy + r * Math.sin(a)])
    })
    x += w + GAP
    rowH = Math.max(rowH, h)
    width = Math.max(width, x)
  }
  return { place, width: Math.max(width, 2 * GAP + 2 * NODE_R), height: y + rowH + GAP }
}

/**
 * A menu as a graph: letters are nodes and each crib position p is a link a–b labelled p (a scrambler). Every
 * connected piece of the crib's menu gets its own circle, so pieces never tangle. `available` links not yet in the
 * menu are drawn dashed and listed as "+" buttons (Enter or click → onAddEdge); menu links are listed as "−" buttons
 * (Enter, Delete or Backspace → onRemoveEdge). After either, focus moves to the same link's new button. The counter
 * reads closures = links − letters + pieces; data-closures, data-edges, data-letters, data-pieces and data-loops
 * expose it. The drawing keeps at least 85% of its size and scrolls sideways (a focusable region) on narrow screens.
 */
export function MenuGraph(p: MenuGraphProps): JSX.Element {
  const testId = p.testId ?? 'menu-graph'
  const menuEdges = [...p.menu.edges].sort((x, y) => x.pos - y.pos)
  const inMenu = new Set(menuEdges.map((e) => e.pos))
  const extra = (p.available ?? []).filter((e) => !inMenu.has(e.pos)).sort((x, y) => x.pos - y.pos)
  const all = [...menuEdges, ...extra]
  const selfLoopLetters = new Set(all.filter((e) => e.a === e.b).map((e) => e.a))
  const { place, width, height } = layout(menuPieces(all), selfLoopLetters)
  const count = closures(p.menu)
  const found = loops(p.menu)
  const letterCount = p.menu.letters.length
  const pieceCount = count - menuEdges.length + letterCount
  const warn = new Set(p.warnings ?? [])
  const hl = p.highlightLoop ?? []
  const loopPairs = new Set(hl.map((l, i) => [l, hl[(i + 1) % hl.length]!].sort().join('')))
  const inLoop = (e: MenuEdge) => hl.length > 1 && loopPairs.has(key(e))
  const loopLetters = new Set(hl)
  const groups = new Map<string, MenuEdge[]>()
  for (const e of all) groups.set(key(e), [...(groups.get(key(e)) ?? []), e])

  // m3: after a link is added or removed, focus its new button (or a neighbour) instead of dropping it on <body>
  const root = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<readonly string[] | null>(null)
  useEffect(() => {
    const ids = pendingFocus.current
    if (!ids) return
    pendingFocus.current = null
    for (const id of ids) {
      const el = root.current?.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      if (el) {
        el.focus()
        return
      }
    }
  })
  const add = (pos: number) => {
    pendingFocus.current = [`${testId}-remove-${pos}`]
    p.onAddEdge?.(pos)
  }
  const remove = (pos: number) => {
    const i = menuEdges.findIndex((e) => e.pos === pos)
    const next = menuEdges[i + 1] ?? menuEdges[i - 1]
    pendingFocus.current = [`${testId}-add-${pos}`, ...(next ? [`${testId}-remove-${next.pos}`] : []), `${testId}-drawing`]
    p.onRemoveEdge?.(pos)
  }
  const onRemoveKey = (pos: number) => (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(pos)
    }
  }
  const edgeList = menuEdges.map((e) => `${e.a}–${e.b} at ${e.pos}`).join(', ') || 'no links'
  const counter = `${plural(menuEdges.length, 'link', 'links')}, ${plural(letterCount, 'letter', 'letters')}, ${plural(
    pieceCount, 'piece', 'pieces')}`

  return (
    <div ref={root} className="flex min-w-0 flex-col gap-3" data-testid={testId} data-closures={count}
      data-edges={menuEdges.length} data-letters={letterCount} data-pieces={pieceCount}
      data-loops={found.map((l) => l.join('')).join(' ')}>
      <div role="region" tabIndex={0} aria-label={`Menu drawing: ${edgeList}; ${count} closures`}
        data-testid={`${testId}-drawing`}
        className="max-w-full overflow-x-auto rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <svg viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden="true"
          style={{ width, maxWidth: '100%', minWidth: Math.round(width * 0.85) }}>
          {all.map((e) => {
            const [x1, y1] = place.get(e.a)!
            const [x2, y2] = place.get(e.b)!
            const group = groups.get(key(e))!
            const spread = (group.indexOf(e) - (group.length - 1) / 2) * 52
            const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
            const d = Math.hypot(x2 - x1, y2 - y1) || 1
            const flip = e.a < e.b ? 1 : -1
            const [nx, ny] = [(-(y2 - y1) / d) * flip, ((x2 - x1) / d) * flip]
            const self = e.a === e.b
            const [qx, qy] = [mx + nx * spread, my + ny * spread]
            const [lx, ly] = self ? [x1, y1 - 44] : [(mx + qx) / 2, (my + qy) / 2]
            const added = inMenu.has(e.pos)
            const loop = added && inLoop(e)
            const warned = warn.has(e.pos)
            const stroke = loop ? 'var(--sym-signal)' : added ? 'var(--sym-reference)' : 'var(--sym-dim)'
            return (
              <g key={e.pos} data-edge={e.pos} data-added={added ? 'true' : 'false'}
                data-loop={loop ? 'true' : undefined} data-warning={warned ? 'true' : undefined}>
                <path
                  d={self ? `M ${x1 - 8} ${y1 - 14} C ${x1 - 32} ${y1 - 62}, ${x1 + 32} ${y1 - 62}, ${x1 + 8} ${y1 - 14}`
                    : `M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`}
                  fill="none" stroke={stroke} strokeWidth={loop ? 3.5 : added ? 2 : 1.5}
                  strokeDasharray={added ? undefined : '5 5'} />
                <rect x={lx - 15} y={ly - 11} width={30} height={22} rx={4} className="fill-stone-900"
                  stroke={warned ? 'var(--sym-ghost)' : stroke} strokeWidth={warned ? 2 : 1} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="12"
                  className={`${added ? 'fill-stone-100' : 'fill-stone-400'} tabular-nums`}>
                  {warned ? `${e.pos}!` : e.pos}
                </text>
              </g>
            )
          })}
          {[...place].map(([l, [x, y]]) => {
            const used = p.menu.letters.includes(l)
            const ring = loopLetters.has(l) ? 'var(--sym-signal)' : used ? 'var(--sym-reference)' : 'var(--sym-dim)'
            return (
              <g key={l} transform={`translate(${x} ${y})`} data-node={l}>
                <circle r={NODE_R} className="fill-stone-900" stroke={ring} strokeWidth={loopLetters.has(l) ? 3 : 2} />
                <text textAnchor="middle" dominantBaseline="central" fontSize="16"
                  className={`${used ? 'fill-stone-100' : 'fill-stone-400'} font-mono`}>
                  {l}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="text-sm text-stone-300" data-testid={`${testId}-closures`} aria-live="polite">
        Closures: <span className="font-semibold text-stone-100">{count}</span> — {counter} (links − letters + pieces ={' '}
        {count})
      </p>
      {p.onAddEdge && extra.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Links you can add">
          {extra.map((e) => (
            <button key={e.pos} type="button" onClick={() => add(e.pos)} data-testid={`${testId}-add-${e.pos}`}
              aria-label={`Add link ${e.a}–${e.b} at position ${e.pos}${warn.has(e.pos) ? ' (flagged)' : ''}`}
              className={ADD_BUTTON}>
              + {e.pos}: {e.a}–{e.b}
              {warn.has(e.pos) ? ' !' : ''}
            </button>
          ))}
        </div>
      )}
      {p.onRemoveEdge && menuEdges.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Links in the menu">
          {menuEdges.map((e) => (
            <button key={e.pos} type="button" onClick={() => remove(e.pos)} onKeyDown={onRemoveKey(e.pos)}
              data-testid={`${testId}-remove-${e.pos}`} aria-label={`Remove link ${e.a}–${e.b} at position ${e.pos}`}
              className="rounded border border-stone-500 px-2 py-1 font-mono text-sm text-stone-100 hover:bg-stone-800">
              − {e.pos}: {e.a}–{e.b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
