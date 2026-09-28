import type { JSX } from 'react'
import type { CatalogueHistogramProps } from './types'

interface Bin {
  readonly lo: number
  readonly hi: number
  /** Characteristics whose bucket size falls in [lo, hi]. */
  readonly characteristics: number
  /** Settings filed under them. */
  readonly settings: number
}

/** Bucket sizes in powers-of-two bins: 1, 2, 3–4, 5–8, … up to the largest bucket. */
export function histogramBins(histogram: readonly { size: number; count: number }[], maxBucket: number): Bin[] {
  const bins: Bin[] = []
  for (let lo = 1, hi = 1; lo <= Math.max(1, maxBucket); lo = hi + 1, hi = hi * 2) {
    const inBin = histogram.filter((h) => h.size >= lo && h.size <= hi)
    bins.push({
      lo,
      hi,
      characteristics: inBin.reduce((s, h) => s + h.count, 0),
      settings: inBin.reduce((s, h) => s + h.size * h.count, 0),
    })
  }
  return bins
}

const fmt = (n: number) => n.toLocaleString('en-US')
const range = (b: Bin) => (b.lo === b.hi ? fmt(b.lo) : `${fmt(b.lo)}–${fmt(b.hi)}`)

const W = 560
const H = 240
const M = { top: 28, right: 12, bottom: 46, left: 52 }

/**
 * How the catalogue's settings spread over characteristics: columns count the characteristics whose bucket (the
 * settings sharing it) has a given size, in powers-of-two bins, on a log scale. `highlight` marks the bin of one
 * bucket size (e.g. the day's candidates). A table view carries every number.
 */
export function CatalogueHistogram(p: CatalogueHistogramProps): JSX.Element {
  const { stats } = p
  const testId = p.testId ?? 'catalogue-histogram'
  const bins = histogramBins(stats.histogram, stats.maxBucket)
  const unique = stats.histogram.find((h) => h.size === 1)?.count ?? 0
  const top = Math.max(1, ...bins.map((b) => b.characteristics))
  const decades = Math.max(1, Math.ceil(Math.log10(top + 1)))
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  // log scale from 10^-0.3 so a bin holding one characteristic still shows a column
  const frac = (v: number) => (v <= 0 ? 0 : (Math.log10(v) + 0.3) / (decades + 0.3))
  const y = (v: number) => M.top + plotH - frac(v) * plotH
  const band = plotW / Math.max(1, bins.length)
  const barW = Math.min(24, band - 2)
  const mark = p.highlight !== undefined ? Number(p.highlight) : NaN
  const summary = bins.map((b) => `${range(b)}: ${b.characteristics}`).join('; ')
  const markBin = Number.isFinite(mark) ? bins.findIndex((b) => mark >= b.lo && mark <= b.hi) : -1

  return (
    <figure className="m-0 flex flex-col gap-2" data-testid={testId} data-entries={stats.entries}
      data-distinct={stats.distinct} data-max-bucket={stats.maxBucket} data-unique={unique}
      data-highlight-bin={markBin >= 0 ? range(bins[markBin]!) : undefined}>
      <figcaption className="text-sm text-stone-300">
        <span className="font-semibold text-stone-100">{fmt(stats.entries)}</span> settings filed under{' '}
        <span className="font-semibold text-stone-100">{fmt(stats.distinct)}</span> characteristics.{' '}
        {fmt(unique)} characteristics name a single setting; the largest bucket holds {fmt(stats.maxBucket)}.
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img"
        aria-label={`Histogram: characteristics by bucket size, ${summary}`}>
        {Array.from({ length: decades + 1 }, (_, d) => {
          const v = 10 ** d
          const yy = y(v)
          return (
            <g key={d}>
              <line x1={M.left} x2={W - M.right} y1={yy} y2={yy} className="stroke-stone-800" strokeWidth={1} />
              <text x={M.left - 6} y={yy} textAnchor="end" dominantBaseline="central" fontSize="11"
                className="fill-stone-400 tabular-nums">{fmt(v)}</text>
            </g>
          )
        })}
        {bins.map((b, i) => {
          const x = M.left + i * band + (band - barW) / 2
          const top = b.characteristics > 0 ? y(b.characteristics) : M.top + plotH
          const h = M.top + plotH - top
          const marked = i === markBin
          const fill = marked ? 'var(--sym-signal)' : 'var(--sym-U)'
          const r = Math.min(4, h / 2, barW / 2)
          return (
            <g key={b.lo} data-bin={range(b)} data-count={b.characteristics}>
              <title>
                {`bucket size ${range(b)}: ${fmt(b.characteristics)} characteristics, ${fmt(b.settings)} settings`}
              </title>
              <rect x={M.left + i * band} y={M.top} width={band} height={plotH} fill="transparent" />
              {h > 0 && (
                <path fill={fill}
                  d={`M ${x} ${M.top + plotH} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${
                    x + barW
                  } ${top + r} V ${M.top + plotH} Z`} />
              )}
              {marked && (
                <text x={x + barW / 2} y={top - 8} textAnchor="middle" fontSize="11" className="fill-stone-100">
                  {`${fmt(mark)}`}
                </text>
              )}
              <text x={M.left + i * band + band / 2} y={M.top + plotH + 14} textAnchor="middle" fontSize="10"
                className="fill-stone-400 tabular-nums"
                transform={bins.length > 8 ? `rotate(-35 ${M.left + i * band + band / 2} ${M.top + plotH + 14})` : undefined}>
                {range(b)}
              </text>
            </g>
          )
        })}
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} className="stroke-stone-500" />
        <text x={M.left + plotW / 2} y={H - 4} textAnchor="middle" fontSize="11" className="fill-stone-400">
          settings sharing one characteristic
        </text>
        <text x={12} y={M.top + plotH / 2} textAnchor="middle" fontSize="11" className="fill-stone-400"
          transform={`rotate(-90 12 ${M.top + plotH / 2})`}>
          characteristics (log)
        </text>
      </svg>
      <details className="text-sm text-stone-300">
        <summary className="cursor-pointer text-stone-200">Table view</summary>
        <table className="mt-2 font-mono text-xs tabular-nums" data-testid={`${testId}-table`}>
          <thead>
            <tr className="text-left text-stone-400">
              <th className="pr-4 font-normal">bucket size</th>
              <th className="pr-4 font-normal">characteristics</th>
              <th className="font-normal">settings</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.lo}>
                <td className="pr-4">{range(b)}</td>
                <td className="pr-4">{fmt(b.characteristics)}</td>
                <td>{fmt(b.settings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
