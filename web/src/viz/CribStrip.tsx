import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react'
import { crashes } from '../crypto/cribs'
import type { CribStripProps } from './types'

const CELL = 24
const PAD = 8

/**
 * The crib slid along the cipher text. Columns where a crib letter equals the cipher letter above it are crashes
 * (red): Enigma never enciphers a letter to itself, so the crib cannot sit there. When `onOffset` is given (and not
 * readOnly) the strip is a slider: arrow keys move the crib one letter, Home/End jump to the ends, and the buttons
 * do the same. data-offset, data-crashes (crib indices) and data-crash-count describe it.
 */
export function CribStrip(p: CribStripProps): JSX.Element {
  const cipher = p.cipher.toUpperCase()
  const crib = p.crib.toUpperCase()
  const testId = p.testId ?? 'crib-strip'
  const max = Math.max(0, cipher.length - crib.length)
  const offset = Math.max(0, Math.min(max, p.offset))
  const hits = crib.length <= cipher.length ? crashes(cipher, crib, offset) : []
  const crash = new Set(hits)
  const interactive = !!p.onOffset && !p.readOnly
  const move = (o: number) => p.onOffset?.(Math.max(0, Math.min(max, o)))
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowLeft: offset - 1, ArrowDown: offset - 1, ArrowRight: offset + 1,
      ArrowUp: offset + 1, Home: 0, End: max, PageDown: offset - 5, PageUp: offset + 5 }
    if (e.key in keys) {
      e.preventDefault()
      move(keys[e.key]!)
    }
  }
  const crashText = hits.length === 0 ? 'no crash' : `${hits.length} crash${hits.length > 1 ? 'es' : ''}`
  const valueText = `offset ${offset}: ${crashText}`
  const width = cipher.length * CELL + 2 * PAD
  const scroller = useRef<HTMLDivElement>(null)
  // keep the crib in view when it moves along a long cipher
  useEffect(() => {
    const el = scroller.current
    if (!el || el.clientWidth === 0) return
    const x = PAD + offset * CELL
    const end = x + crib.length * CELL
    if (x < el.scrollLeft || end > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, x - PAD)
  }, [offset, crib.length])
  const strip = (
    <svg viewBox={`0 0 ${width} 86`} width={width} height={86} aria-hidden="true" className="block">
      {cipher.split('').map((c, k) => {
        const x = PAD + k * CELL
        const i = k - offset
        const inCrib = i >= 0 && i < crib.length
        const isCrash = inCrib && crash.has(i)
        const tone = isCrash ? 'var(--sym-ghost)' : 'var(--sym-H)'
        return (
          <g key={k} data-col={k} data-crash={isCrash ? 'true' : undefined}>
            <text x={x + CELL / 2} y={10} textAnchor="middle" fontSize="9" className="fill-stone-500 tabular-nums">
              {k % 5 === 0 ? k : ''}
            </text>
            {isCrash && <rect x={x + 1} y={16} width={CELL - 2} height={64} rx={4} fill="var(--sym-ghost)" opacity={0.18} />}
            <rect x={x + 2} y={18} width={CELL - 4} height={26} rx={3} className="fill-stone-900" stroke={tone}
              strokeWidth={isCrash ? 2 : 1} />
            <text x={x + CELL / 2} y={31} textAnchor="middle" dominantBaseline="central" fontSize="14"
              className="fill-stone-100 font-mono">{c}</text>
            {inCrib && (
              <>
                <rect x={x + 2} y={52} width={CELL - 4} height={26} rx={3} className="fill-stone-800" stroke={tone}
                  strokeWidth={isCrash ? 2 : 1} />
                <text x={x + CELL / 2} y={65} textAnchor="middle" dominantBaseline="central" fontSize="14"
                  className="fill-amber-200 font-mono">{crib[i]}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
  return (
    <div className="flex flex-col gap-2" data-testid={testId} data-offset={offset} data-max-offset={max}
      data-crashes={hits.join(',')} data-crash-count={hits.length}>
      {interactive ? (
        <div role="slider" tabIndex={0} aria-label="Crib position under the cipher text" aria-valuemin={0}
          aria-valuemax={max} aria-valuenow={offset} aria-valuetext={valueText} onKeyDown={onKey}
          data-testid={`${testId}-slider`} ref={scroller}
          className="max-w-full overflow-x-auto rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
          {strip}
        </div>
      ) : (
        <div role="img" aria-label={`Crib ${crib} under ${cipher} at ${valueText}`} ref={scroller}
          className="max-w-full overflow-x-auto">
          {strip}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {interactive && (
          <>
            <button type="button" onClick={() => move(offset - 1)} disabled={offset === 0}
              aria-label="Move the crib one letter left" data-testid={`${testId}-left`}
              className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800 disabled:opacity-60">
              ←
            </button>
            <button type="button" onClick={() => move(offset + 1)} disabled={offset === max}
              aria-label="Move the crib one letter right" data-testid={`${testId}-right`}
              className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800 disabled:opacity-60">
              →
            </button>
          </>
        )}
        <span className="font-mono text-stone-300" data-testid={`${testId}-status`}>
          {valueText}
        </span>
      </div>
    </div>
  )
}
