import type { JSX } from 'react'
import type { TestRegisterProps } from './types'

const up = (i: number) => String.fromCharCode(65 + i)

/**
 * The test register: the wires of the test letter's bank as a row of lamps. 1 live wire or all but one is what a
 * stop looks like; all live means every hypothesis for the test letter is refuted. data-live-count, data-live-wires
 * (the live wires' letters) and data-test-letter.
 */
export function TestRegister(p: TestRegisterProps): JSX.Element {
  const n = p.live.length
  const testId = p.testId ?? 'test-register'
  const liveWires = p.live.flatMap((on, i) => (on ? [up(i)] : []))
  const step = n <= 8 ? 40 : 22
  const r = n <= 8 ? 14 : 9
  const W = n * step + 8
  return (
    <figure className="m-0 flex flex-col gap-1" data-testid={testId} data-live-count={liveWires.length}
      data-live-wires={liveWires.join('')} data-test-letter={p.testLetter}>
      <svg viewBox={`0 0 ${W} ${2 * r + 22}`} className="w-full" style={{ maxWidth: `${W * 1.5}px` }} role="img"
        aria-label={`Test register ${p.testLetter}: ${liveWires.length} of ${n} wires live${
          liveWires.length ? ` (${liveWires.join(' ').toLowerCase()})` : ''}`}>
        {p.live.map((on, i) => (
          <g key={i} transform={`translate(${4 + i * step + step / 2} ${r + 2})`} data-wire={up(i)}
            data-live={String(on)}>
            <circle r={r} fill={on ? 'var(--sym-signal)' : 'none'} className={on ? undefined : 'stroke-stone-600'}
              strokeWidth={1.5} />
            <text y={r + 12} textAnchor="middle" fontSize={n <= 8 ? 13 : 10} className="fill-stone-300 font-mono">
              {up(i).toLowerCase()}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="text-sm text-stone-300">
        Test register <span className="font-mono text-stone-100">{p.testLetter}</span>:{' '}
        <span className="font-semibold text-stone-100">{liveWires.length}</span> of {n} wires live
      </figcaption>
    </figure>
  )
}
