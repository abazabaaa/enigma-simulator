import type { JSX, KeyboardEvent } from 'react'
import { conjugate, cycleSignature, cycles, formatCycles } from '../engine'
import type { CycleDiagramProps } from './types'

const R_NODE = 12
const GAP = 18
const WIDTH = 640

interface Placed {
  readonly cycle: readonly number[]
  readonly cx: number
  readonly cy: number
  readonly r: number
}

/** Ring radius for a cycle of `len` letters (a 1-cycle is a node with a self-loop). */
function ringRadius(len: number): number {
  if (len === 1) return 0
  if (len === 2) return 26
  return Math.max(30, (len * (2 * R_NODE + 16)) / (2 * Math.PI))
}

/** Longest cycles first (equal lengths side by side), then by first letter; rows fill WIDTH. */
function layout(perm: readonly number[]): { placed: Placed[]; height: number } {
  const list = cycles(perm).sort((a, b) => b.length - a.length || a[0]! - b[0]!)
  const placed: Placed[] = []
  let x = GAP
  let y = GAP
  let rowHeight = 0
  for (const cycle of list) {
    const r = ringRadius(cycle.length)
    const loop = cycle.length === 1 ? 16 : 0
    const box = 2 * (r + R_NODE)
    if (x + box > WIDTH - GAP && x > GAP) {
      x = GAP
      y += rowHeight + GAP
      rowHeight = 0
    }
    placed.push({ cycle, cx: x + box / 2, cy: y + loop + box / 2, r })
    x += box + GAP
    rowHeight = Math.max(rowHeight, box + loop)
  }
  return { placed, height: y + rowHeight + GAP }
}

const letterOf = (i: number, n: number) => (n <= 26 ? String.fromCharCode(97 + i) : String(i))

/**
 * A permutation drawn as its cycles: each cycle is a ring of letters with arrows x → perm[x]. Equal-length cycles
 * sit side by side, so the pairing in a product of two involutions is visible. The cycle notation and the lengths
 * are printed below. data-cycles / data-lengths describe what is shown (after relabelling).
 */
export function CycleDiagram(p: CycleDiagramProps): JSX.Element {
  const n = p.n ?? p.perm.length
  const perm = p.perm.slice(0, n)
  const relabel = p.relabelBy?.slice(0, n)
  const label = (i: number) => letterOf(relabel ? relabel[i]! : i, n)
  const shown = relabel ? conjugate(perm, relabel) : perm
  const notation = n <= 26 ? formatCycles(shown) : shown.join(' ')
  const lengths = cycleSignature(shown).join('.')
  const { placed, height } = layout(perm)
  const hi = new Set(p.highlightCycle ?? [])
  const testId = p.testId ?? 'cycle-diagram'
  const pick = p.onPickLetter

  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick?.(i)
    }
  }

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2" data-testid={testId} data-cycles={notation} data-lengths={lengths}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full max-w-2xl"
        role={pick ? 'group' : 'img'}
        aria-label={`Cycle diagram: ${notation}, lengths ${lengths.replaceAll('.', ' ')}`}
      >
        <defs>
          {(['H', 'signal'] as const).map((s) => (
            <marker key={s} id={`${testId}-arrow-${s}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6"
              markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill={`var(--sym-${s})`} />
            </marker>
          ))}
        </defs>
        {placed.map(({ cycle, cx, cy, r }) => {
          const highlighted = hi.size > 0 && cycle.some((x) => hi.has(x))
          const tone = highlighted ? 'signal' : 'H'
          const stroke = `var(--sym-${tone})`
          const width = highlighted ? 2.5 : 1.5
          const marker = `url(#${testId}-arrow-${tone})`
          const k = cycle.length
          const at = (j: number) => {
            const a = -Math.PI / 2 + (2 * Math.PI * j) / k
            return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
          }
          return (
            <g key={cycle[0]} data-cycle={cycle.map(label).join('')} data-highlight={highlighted ? 'true' : undefined}>
              {k === 1 ? (
                <path
                  d={`M ${cx - 6} ${cy - R_NODE + 1} C ${cx - 16} ${cy - R_NODE - 22}, ${cx + 16} ${cy - R_NODE - 22}, ${
                    cx + 6
                  } ${cy - R_NODE + 1}`}
                  fill="none" stroke={stroke} strokeWidth={width} markerEnd={marker} />
              ) : (
                cycle.map((_, j) => {
                  const [x1, y1] = at(j)
                  const [x2, y2] = at((j + 1) % k)
                  const d = Math.hypot(x2 - x1, y2 - y1)
                  const t = (R_NODE + 2) / d
                  const [sx, sy] = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
                  const [ex, ey] = [x2 - (x2 - x1) * t, y2 - (y2 - y1) * t]
                  // bow each arrow outwards so the two arrows of a 2-cycle do not overlap
                  const bulge = k === 2 ? 10 : Math.min(8, r * 0.15)
                  const [mx, my] = [(sx + ex) / 2, (sy + ey) / 2]
                  const out = Math.hypot(mx - cx, my - cy) || 1
                  const [qx, qy] = k === 2
                    ? [mx + ((ey - sy) / d) * bulge, my - ((ex - sx) / d) * bulge]
                    : [mx + ((mx - cx) / out) * bulge, my + ((my - cy) / out) * bulge]
                  return (
                    <path key={j} d={`M ${sx} ${sy} Q ${qx} ${qy} ${ex} ${ey}`} fill="none" stroke={stroke}
                      strokeWidth={width} markerEnd={marker} />
                  )
                })
              )}
              {cycle.map((x, j) => {
                const [nx, ny] = k === 1 ? [cx, cy] : at(j)
                const name = label(x)
                const interactive = pick
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `Letter ${name.toUpperCase()}`,
                      'data-testid': `${testId}-letter-${name.toUpperCase()}`,
                      onClick: () => pick(x),
                      onKeyDown: onKey(x),
                      className: 'cursor-pointer outline-none focus-visible:[&>circle]:stroke-[3.5]',
                    }
                  : {}
                return (
                  <g key={x} transform={`translate(${nx} ${ny})`} data-letter={name.toUpperCase()} {...interactive}>
                    <circle r={R_NODE} className="fill-stone-900" stroke={stroke} strokeWidth={width} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="13" pointerEvents="none"
                      className="fill-stone-100 font-mono select-none">
                      {name}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <figcaption className="font-mono text-sm break-all text-stone-300">
        <span data-testid={`${testId}-notation`}>{notation}</span>
        <span className="text-stone-400"> · lengths {lengths.replaceAll('.', ' ')}</span>
      </figcaption>
    </figure>
  )
}
