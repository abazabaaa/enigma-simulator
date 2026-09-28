/**
 * hexagon: X = (ab)(cd)(ef) and Y = (bc)(de)(fa) drawn as cycles. After the `pairs` bet, Play traces XY letter by
 * letter (X first, then Y) until it closes into (ace)(bfd); then the same pattern in the 65 indicators' AD, BE, CF.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { cycleSignature, formatCycles } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { CycleDiagram } from '../../../viz'
import { AD65, BE65, CF65, HEX_P, HEX_STEPS, HEX_X, HEX_Y, L, PAIRS_TRUTH } from '../gates'

const STEP_MS = 600
const low = (x: number) => L(x).toLowerCase()

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
    const t = setTimeout(() => setShown((k) => Math.min(total, k + 1)), STEP_MS)
    return () => clearTimeout(t)
  }, [fired, shown, total])

  const done = shown >= total
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="hexagon-view">
      <p>
        X swaps a–b, c–d and e–f; Y swaps b–c, d–e and f–a. Both are made only of swaps, like a reflector or the machine at
        one position. What does their product XY look like, X first and then Y?
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-stone-400">
            X = <Mono>{formatCycles(HEX_X)}</Mono>
          </p>
          <CycleDiagram perm={HEX_X} testId="hex-x" />
        </div>
        <div>
          <p className="text-xs text-stone-400">
            Y = <Mono>{formatCycles(HEX_Y)}</Mono>
          </p>
          <CycleDiagram perm={HEX_Y} testId="hex-y" />
        </div>
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
                XY = <Mono>{formatCycles(HEX_P)}</Mono>: two cycles of length {cycleSignature(HEX_P)[0]}. Rejewski proved
                that this always happens. When two permutations consist only of swaps, their product has its cycles in
                pairs of equal length (his theorem 1).
              </p>
              <CycleDiagram perm={HEX_P} testId="hex-product" />
              <p>
                AD, BE and CF are exactly such products: each of the six presses is made of swaps. Here they are from the
                65 indicators of one day. Every length comes twice.
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                <CycleDiagram perm={AD65} testId="vector-ad" />
                <CycleDiagram perm={BE65} testId="vector-be" />
                <CycleDiagram perm={CF65} testId="vector-cf" />
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
