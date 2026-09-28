/**
 * hexagon: X = (ab)(cd)(ef) and Y = (bc)(de)(fa) drawn as one hexagon a–b–c–d–e–f whose sides alternate X and Y (the
 * picture behind Rejewski's theorem 1). After the `pairs` bet, Play traces XY letter by letter, X first and then Y:
 * each step goes two corners on, clockwise for (ace) and counter-clockwise for (bfd). Then the 65 indicators' AD, BE
 * and CF show the same pairing.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { cycleSignature, formatCycles } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { AD65, BE65, CF65, HEX_P, HEX_STEPS, L, PAIRS_TRUTH } from '../gates'
import { Diagram } from './parts'

const STEP_MS = 700
const low = (x: number) => L(x).toLowerCase()

/** X and Y as written in the research (Christensen): Y's last swap is (fa). X and Y are not machine parts, so their
 * sides take neutral colours, not the rotor symbols'. */
export const X_TEXT = '(ab)(cd)(ef)'
export const Y_TEXT = '(bc)(de)(fa)'

const SIZE = 240
const R = 88
const corner = (k: number): [number, number] => {
  const a = -Math.PI / 2 + (k * Math.PI) / 3
  return [SIZE / 2 + R * Math.cos(a), SIZE / 2 + R * Math.sin(a)]
}
/** The sides a–b, b–c, …, f–a: even sides belong to X, odd ones to Y. */
const SIDES = [0, 1, 2, 3, 4, 5].map((k) => ({ u: k, v: (k + 1) % 6, of: k % 2 === 0 ? 'X' : 'Y' }))

/** The hexagon, with the product's chords drawn for the first `shown` steps; the step in progress lights its sides. */
function HexagonFigure({ shown }: { shown: number }): JSX.Element {
  const current = shown > 0 ? HEX_STEPS[shown - 1] : undefined
  const joins = (u: number, v: number, s: number, t: number) => (u === s && v === t) || (u === t && v === s)
  const lit = (u: number, v: number) => !!current && (joins(u, v, current.from, current.via) || joins(u, v, current.via, current.to))
  const chords = HEX_STEPS.slice(0, shown)
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-xs"
      role="img"
      data-testid="hexagon"
      data-step={shown}
      data-chords={chords.map((s) => low(s.from) + low(s.to)).join(' ')}
      aria-label={`A hexagon a b c d e f: the sides a–b, c–d, e–f are X, the sides b–c, d–e, f–a are Y.${
        chords.length ? ` XY so far: ${chords.map((s) => `${low(s.from)} to ${low(s.to)}`).join(', ')}.` : ''
      }`}
    >
      <defs>
        <marker id="hex-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--sym-signal)" />
        </marker>
      </defs>
      {SIDES.map(({ u, v, of }) => {
        const [x1, y1] = corner(u)
        const [x2, y2] = corner(v)
        return (
          <line
            key={`${u}${v}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={of === 'X' ? 'stroke-sky-300' : 'stroke-violet-300'}
            strokeWidth={lit(u, v) ? 5 : 2.5}
            strokeDasharray={of === 'Y' ? '7 5' : undefined}
            data-side={of}
          />
        )
      })}
      {chords.map((s) => {
        const [x1, y1] = corner(s.from)
        const [x2, y2] = corner(s.to)
        const t = 16 / Math.hypot(x2 - x1, y2 - y1)
        return (
          <line
            key={s.from}
            x1={x1 + (x2 - x1) * t}
            y1={y1 + (y2 - y1) * t}
            x2={x2 - (x2 - x1) * t}
            y2={y2 - (y2 - y1) * t}
            stroke="var(--sym-signal)"
            strokeWidth={2}
            markerEnd="url(#hex-arrow)"
          />
        )
      })}
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const [x, y] = corner(k)
        return (
          <g key={k} transform={`translate(${x} ${y})`}>
            <circle r={14} className="fill-stone-900" stroke="var(--sym-H)" strokeWidth={1.5} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="15" className="fill-stone-100 font-mono">
              {low(k)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function HexagonView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('pairs')
  const [shown, setShown] = useState(0)
  const resolved = useRef(false)
  const { bet, reducedMotion } = p
  const total = HEX_STEPS.length

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('pairs').resolve(PAIRS_TRUTH)
    if (reducedMotion) setShown(total)
  }, [fired, bet, reducedMotion, total])
  useEffect(() => {
    if (!fired || shown >= total) return
    const t = setTimeout(() => setShown((k) => Math.min(total, k + 1)), shown === 0 ? 200 : STEP_MS)
    return () => clearTimeout(t)
  }, [fired, shown, total])

  const done = shown >= total
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="hexagon-view">
      <p>
        X = <Mono>{X_TEXT}</Mono> swaps a–b, c–d and e–f; Y = <Mono>{Y_TEXT}</Mono> swaps b–c, d–e and f–a. Both are made
        only of swaps, like a reflector or the machine at one position. Drawn together they make a hexagon whose sides
        alternate: solid for X, dashed for Y. What does their product XY look like, X first and then Y?
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <HexagonFigure shown={fired ? shown : 0} />
        <ul className="flex flex-col gap-1 text-xs text-stone-300" aria-label="Legend">
          <li>
            <span className="font-semibold text-sky-300">——</span> X = {X_TEXT}
          </li>
          <li>
            <span className="font-semibold text-violet-300">- - -</span> Y = {Y_TEXT}
          </li>
          <li>
            <span className="font-semibold text-[var(--sym-signal)]">→</span> XY, one arrow per letter
          </li>
        </ul>
      </div>
      {fired ? (
        <section
          data-testid="hex-trace"
          data-step={shown}
          data-total={total}
          className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3"
        >
          <h3 className="font-semibold text-stone-100">XY, letter by letter</h3>
          <ol className="flex flex-col gap-0.5 font-mono" aria-live="polite">
            {HEX_STEPS.slice(0, shown).map((s) => (
              <li key={s.from}>
                {low(s.from)} →<sub>X</sub> {low(s.via)} →<sub>Y</sub> {low(s.to)}
              </li>
            ))}
          </ol>
          {!done ? (
            <div>
              <button type="button" className={QUIET_BUTTON} data-testid="hex-skip" onClick={() => setShown(total)}>
                Show the whole product
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2" aria-live="polite">
              <p>
                XY = <Mono>{formatCycles(HEX_P)}</Mono>: every step goes two corners on, clockwise from a (a, c, e) and
                counter-clockwise from b (b, f, d). Two cycles of length {cycleSignature(HEX_P)[0]}. Rejewski proved that
                this always happens: when two permutations consist only of swaps, their product has its cycles in pairs of
                equal length (his theorem 1).
              </p>
              <Diagram perm={HEX_P} testId="hex-product" label="XY as cycles" minWidth="20rem" />
              <p>
                AD, BE and CF are exactly such products: each of the six presses is made of swaps. Here they are from the
                65 indicators of one day. Every length comes twice.
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                <Diagram perm={AD65} testId="vector-ad" label="AD of the 65 indicators" />
                <Diagram perm={BE65} testId="vector-be" label="BE of the 65 indicators" />
                <Diagram perm={CF65} testId="vector-cf" label="CF of the 65 indicators" />
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
