import { useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { letterToIndex } from '../engine'
import type { WireGridProps } from './types'

const up = (i: number) => String.fromCharCode(65 + i)

/**
 * The bombe's wires: one row per bank (letter), one column per wire; a lit cell means "the row letter is steckered
 * to the column letter" follows from the hypothesis. Cells lit through a scrambler use the signal colour, through
 * the diagonal board the plugboard colour (S), and the hypothesis is ringed in gold. `step` replays the propagation
 * (the first `step` events of state.order). The test register's row is outlined. With onToggleWire every cell is a
 * button (one tab stop; arrow keys move, Enter or Space presses). data-live-total, data-test-live and data-step.
 */
export function WireGrid(p: WireGridProps): JSX.Element {
  const { n } = p.state
  const testId = p.testId ?? 'wire-grid'
  const events = p.step === undefined ? p.state.order : p.state.order.slice(0, Math.max(0, p.step))
  const via = new Map<number, number | 'hypothesis' | 'diagonal'>()
  for (const e of events) via.set(e.bank * n + e.wire, e.via)
  const test = letterToIndex(p.testLetter)
  const rowLive = Array.from({ length: n }, (_, b) => {
    let c = 0
    for (let w = 0; w < n; w++) if (via.has(b * n + w)) c++
    return c
  })
  const cell = n <= 8 ? 30 : 14
  const left = 22
  const topPad = 18
  const right = 30
  const W = left + n * cell + right
  const H = topPad + n * cell + 4
  const registerText = `test register ${p.testLetter}: ${rowLive[test]} live`
  const gridLabel = `Wire grid, ${n} banks by ${n} wires: ${via.size} live; ${registerText}`
  const [focus, setFocus] = useState(test * n)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent) => {
    const [b, w] = [Math.floor(focus / n), focus % n]
    const moves: Record<string, [number, number]> = { ArrowUp: [b - 1, w], ArrowDown: [b + 1, w], ArrowLeft: [b, w - 1],
      ArrowRight: [b, w + 1], Home: [b, 0], End: [b, n - 1] }
    const to = moves[e.key]
    if (!to) return
    e.preventDefault()
    const [nb, nw] = [Math.max(0, Math.min(n - 1, to[0])), Math.max(0, Math.min(n - 1, to[1]))]
    setFocus(nb * n + nw)
    buttons.current[nb * n + nw]?.focus()
  }

  return (
    <figure className="m-0 flex flex-col gap-1" data-testid={testId} data-live-total={via.size}
      data-test-live={rowLive[test]} data-step={events.length} data-diagonal={String(p.diagonal)}>
      <div className="relative w-full" style={{ maxWidth: `${Math.max(W, 260)}px`, aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img"
          aria-label={gridLabel}>
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <text x={left + i * cell + cell / 2} y={12} textAnchor="middle" fontSize={n <= 8 ? 12 : 9}
                className="fill-stone-400 font-mono">{up(i).toLowerCase()}</text>
              <text x={left - 6} y={topPad + i * cell + cell / 2} textAnchor="end" dominantBaseline="central"
                fontSize={n <= 8 ? 13 : 10} className={`${i === test ? 'fill-stone-100' : 'fill-stone-400'} font-mono`}>
                {up(i)}
              </text>
              <text x={left + n * cell + 6} y={topPad + i * cell + cell / 2} dominantBaseline="central"
                fontSize={n <= 8 ? 12 : 9} className="fill-stone-400 tabular-nums">
                {rowLive[i] || ''}
              </text>
            </g>
          ))}
          <rect x={left} y={topPad} width={n * cell} height={n * cell} className="fill-stone-900" />
          {p.diagonal && (
            <line x1={left} y1={topPad} x2={left + n * cell} y2={topPad + n * cell} stroke="var(--sym-S)"
              strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          )}
          {[...via].map(([k, v]) => {
            const [b, w] = [Math.floor(k / n), k % n]
            const fill = v === 'diagonal' ? 'var(--sym-S)' : 'var(--sym-signal)'
            return (
              <g key={k} data-cell={`${up(b)}${up(w)}`} data-via={String(v)}>
                <rect x={left + w * cell + 1} y={topPad + b * cell + 1} width={cell - 2} height={cell - 2} rx={2}
                  fill={fill} />
                {v === 'hypothesis' && (
                  <rect x={left + w * cell + 0.5} y={topPad + b * cell + 0.5} width={cell - 1} height={cell - 1} rx={2}
                    fill="none" stroke="var(--sym-reference)" strokeWidth={2} />
                )}
              </g>
            )
          })}
          <rect x={left - 0.5} y={topPad + test * cell - 0.5} width={n * cell + 1} height={cell + 1} fill="none"
            stroke="var(--sym-reference)" strokeWidth={1.5} />
        </svg>
        {p.onToggleWire && (
          <div role="group" aria-label={`Wires: ${n} banks by ${n} wires. Arrow keys move, Enter toggles.`}
            onKeyDown={onKey} className="absolute grid"
            style={{
              left: `${(left / W) * 100}%`,
              top: `${(topPad / H) * 100}%`,
              width: `${((n * cell) / W) * 100}%`,
              height: `${((n * cell) / H) * 100}%`,
              gridTemplateColumns: `repeat(${n}, 1fr)`,
              gridTemplateRows: `repeat(${n}, 1fr)`,
            }}>
            {Array.from({ length: n * n }, (_, k) => {
              const [b, w] = [Math.floor(k / n), k % n]
              const live = via.has(k)
              return (
                <button key={k} type="button" ref={(el) => void (buttons.current[k] = el)} tabIndex={k === focus ? 0 : -1}
                  aria-label={`Bank ${up(b)}, wire ${up(w).toLowerCase()}: ${live ? 'live' : 'dead'}`}
                  aria-pressed={live} data-testid={`${testId}-cell-${up(b)}-${up(w)}`} data-live={String(live)}
                  onFocus={() => setFocus(k)} onClick={() => p.onToggleWire?.(b, w)}
                  className="min-h-0 min-w-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-300" />
              )
            })}
          </div>
        )}
      </div>
      <figcaption className="text-xs text-stone-400">
        Row {p.testLetter} is the test register: {rowLive[test]} of {n} wires live.
        {p.diagonal ? ' Diagonal board on.' : ''}
      </figcaption>
    </figure>
  )
}
