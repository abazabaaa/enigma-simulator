import type { JSX, KeyboardEvent } from 'react'
import { alignmentPairs } from '../crypto/rejewski'
import type { CycleAlignProps } from './types'

const CELL = 34
const up = (i: number) => String.fromCharCode(65 + i)

/**
 * Two equal-length cycles, one written under the other (Rejewski's pairing device). The lower cycle can be shifted
 * (arrow keys or buttons; Home resets) and read backwards (R or the button). Each column is a transposition of a
 * candidate factor; the pairs are listed below. data-offset, data-reversed and data-pairs ('AB CD …') describe it.
 */
export function CycleAlign(p: CycleAlignProps): JSX.Element {
  const L = p.a.length
  const testId = p.testId ?? 'cycle-align'
  if (L === 0 || p.b.length !== L) {
    return (
      <div data-testid={testId} data-error="length" className="text-sm text-stone-400">
        The two cycles must have the same length.
      </div>
    )
  }
  const offset = ((p.offset % L) + L) % L
  const pairs = alignmentPairs(p.a, p.b, offset, p.reversed)
  const pairText = pairs.map(([x, y]) => up(x) + up(y)).join(' ')
  const set = (o: number, r = p.reversed) => p.onChange(((o % L) + L) % L, r)

  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => set(offset - 1),
      ArrowRight: () => set(offset + 1),
      Home: () => set(0),
      r: () => set(offset, !p.reversed),
      R: () => set(offset, !p.reversed),
    }
    const act = keys[e.key]
    if (act) {
      e.preventDefault()
      act()
    }
  }

  const width = L * CELL + 20
  return (
    <div className="flex flex-col gap-2" data-testid={testId} data-offset={offset} data-reversed={String(p.reversed)}
      data-pairs={pairText}>
      <div
        role="group"
        tabIndex={0}
        aria-label={`Cycle alignment, offset ${offset}${p.reversed ? ', reversed' : ''}. Arrow keys shift, R reverses.`}
        onKeyDown={onKey}
        className="max-w-full overflow-x-auto rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        data-testid={`${testId}-strip`}
      >
        <svg viewBox={`0 0 ${width} 96`} width={width} height={96} aria-hidden="true">
          {pairs.map(([x, y], i) => {
            const cx = 10 + i * CELL + CELL / 2
            return (
              <g key={i}>
                <line x1={cx} y1={32} x2={cx} y2={62} stroke="var(--sym-reference)" strokeWidth={1.5} />
                <rect x={cx - 13} y={6} width={26} height={26} rx={4} className="fill-stone-900"
                  stroke="var(--sym-H)" />
                <text x={cx} y={19} textAnchor="middle" dominantBaseline="central" fontSize="15"
                  className="fill-stone-100 font-mono">{up(x).toLowerCase()}</text>
                <rect x={cx - 13} y={62} width={26} height={26} rx={4} className="fill-stone-900"
                  stroke="var(--sym-H)" />
                <text x={cx} y={75} textAnchor="middle" dominantBaseline="central" fontSize="15"
                  className="fill-stone-100 font-mono">{up(y).toLowerCase()}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800"
          onClick={() => set(offset - 1)} data-testid={`${testId}-left`} aria-label="Shift the lower cycle left">
          ← shift
        </button>
        <button type="button" className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800"
          onClick={() => set(offset + 1)} data-testid={`${testId}-right`} aria-label="Shift the lower cycle right">
          shift →
        </button>
        <button type="button" aria-pressed={p.reversed}
          className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800"
          onClick={() => set(offset, !p.reversed)} data-testid={`${testId}-reverse`}>
          {p.reversed ? 'read backwards' : 'read forwards'}
        </button>
        <span className="font-mono text-stone-300">
          offset {offset} of {L}
        </span>
      </div>
      <p className="font-mono text-sm break-all text-stone-300" data-testid={`${testId}-pairs`}>
        {pairs.map(([x, y]) => `(${up(x).toLowerCase()}${up(y).toLowerCase()})`).join('')}
      </p>
    </div>
  )
}
