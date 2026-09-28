/**
 * ad-from-65 (worked): the 65 indicators of one day and an editable AD table. After the `ad-fixed` bet the learner
 * fills cells by hand (task fill5); the Play reveal then lets the indicators arrive one by one while the two-row
 * tables of AD, BE and CF fill (task fill-all), flags the one contradictory indicator, and writes AD as cycles.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { REJEWSKI_65, products } from '../../../crypto'
import { cycleSignature, formatCycles } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { PermTable } from '../../../machine-ui'
import { AD65, AD_FIXED_TRUTH, BE65, CF65, CONFLICT_AT, L, idx, spaced } from '../gates'
import { IndicatorChips, IndicatorPair, Wide } from './parts'

const TOTAL = REJEWSKI_65.length
const STEP_MS = 90
/** Once fired, the Play button would do nothing more: it hides and focus moves on to what it revealed. */
const HIDE_FIRED = '[data-scene="ad-from-65"] [data-testid="reveal-ad-fixed"][data-fired="true"]{display:none}'

export function AdFrom65View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('ad-fixed')
  const committed = p.bet('ad-fixed').committed
  const [own, setOwn] = useState<(number | null)[]>(() => Array.from({ length: 26 }, () => null))
  const [arrived, setArrived] = useState(0)
  const resolved = useRef(false)
  const arrivals = useRef<HTMLElement>(null)
  const { completeTask, bet, reducedMotion } = p

  const right = own.filter((v, x) => v !== null && v === AD65[x]).length
  const wrong = own.flatMap((v, x) => (v !== null && v !== AD65[x] ? [x] : []))
  useEffect(() => {
    if (right >= 5) completeTask('fill5')
  }, [right, completeTask])

  // The reveal: resolve the bet from the 65 indicators' own AD, then let the indicators arrive.
  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('ad-fixed').resolve(AD_FIXED_TRUTH)
    if (reducedMotion) setArrived(TOTAL)
    queueMicrotask(() => arrivals.current?.focus())
  }, [fired, bet, reducedMotion])
  useEffect(() => {
    if (!fired || arrived >= TOTAL) return
    const t = setTimeout(() => setArrived((k) => Math.min(TOTAL, k + 1)), STEP_MS)
    return () => clearTimeout(t)
  }, [fired, arrived])
  useEffect(() => {
    if (arrived >= TOTAL) completeTask('fill-all')
  }, [arrived, completeTask])

  const sofar = useMemo(() => products(REJEWSKI_65.slice(0, arrived)), [arrived])
  const latest = arrived > 0 ? REJEWSKI_65[arrived - 1]! : null
  const latestCells = latest ? [0, 1, 2].map((k) => latest.charCodeAt(k) - 65) : []
  const conflicted = arrived > CONFLICT_AT && CONFLICT_AT >= 0
  const bad = conflicted ? REJEWSKI_65[CONFLICT_AT]! : null
  // The letter the majority sends to the same place as the contradictory indicator.
  const owner = bad ? sofar.CF.indexOf(idx(bad[5]!)) : -1

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="ad-view">
      <style>{HIDE_FIRED}</style>
      <p>
        Here are 65 indicators from one day, in the order they were written down. Every one of them was typed from the same
        Grundstellung, so letter 1 and letter 4 of each came from one key letter: each indicator fills one cell of AD.
      </p>
      <IndicatorChips
        indicators={REJEWSKI_65}
        current={fired && arrived > 0 && arrived < TOTAL ? arrived - 1 : undefined}
        label="The 65 indicators"
        testId="ad-indicators"
      />
      <Wide label="Your AD">
        <PermTable
          perm={own}
          editable={committed}
          highlight={wrong}
          label={committed ? 'Your AD: under each letter, the letter AD sends it to' : 'Your AD (make your bet first)'}
          testId="ad-own"
          onEdit={(x, v) => setOwn((all) => all.map((y, j) => (j === x ? v : y)))}
        />
      </Wide>
      <p data-testid="ad-own-count" aria-live="polite">
        {right} {right === 1 ? 'cell agrees' : 'cells agree'} with the indicators
        {wrong.length ? `; ${wrong.length} outlined ${wrong.length === 1 ? 'cell does' : 'cells do'} not` : ''}.
      </p>
      {fired ? (
        <section
          ref={arrivals}
          tabIndex={-1}
          aria-labelledby="ad-arrivals-title"
          data-testid="ad-arrivals"
          data-arrived={arrived}
          className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3 focus:outline-none"
        >
          <h3 id="ad-arrivals-title" className="font-semibold text-stone-100">
            The tables fill as the indicators arrive
          </h3>
          <div className="flex flex-wrap items-center gap-3" aria-live="polite">
            <span>
              Indicator {arrived} of {TOTAL}
              {latest ? (
                <>
                  : <IndicatorPair indicator={latest} pos={0} />
                </>
              ) : null}
            </span>
            {arrived < TOTAL ? (
              <button type="button" className={QUIET_BUTTON} data-testid="ad-skip" onClick={() => setArrived(TOTAL)}>
                Show all 65
              </button>
            ) : null}
          </div>
          <Wide label="AD, BE and CF">
            <PermTable perm={sofar.AD} highlight={latestCells.slice(0, 1)} label="AD (letters 1 → 4)" testId="ad-table" />
            <PermTable perm={sofar.BE} highlight={latestCells.slice(1, 2)} label="BE (letters 2 → 5)" testId="be-table" />
            <PermTable perm={sofar.CF} highlight={latestCells.slice(2, 3)} label="CF (letters 3 → 6)" testId="cf-table" />
          </Wide>
          {bad ? (
            <p data-testid="ad-conflict" className="text-amber-200">
              Indicator {CONFLICT_AT + 1}, <Mono>{spaced(bad)}</Mono>, says CF sends {bad[2]} to {bad[5]}, but other
              indicators send {owner >= 0 ? L(owner) : '?'} to {bad[5]}. Two letters cannot go to the same place: one of
              them was copied wrongly, and the majority stands.
            </p>
          ) : null}
          <div aria-live="polite">
          {arrived >= TOTAL ? (
            <div className="flex flex-col gap-1" data-testid="ad-cycles">
              <p>
                Every letter now has its image. Follow AD from a to its image, and on until you are back at a; then start
                again at the first letter not yet used. That writes AD as cycles:
              </p>
              <p className="font-mono">
                AD = {formatCycles(AD65)} <span className="text-stone-400">· lengths {cycleSignature(AD65).join(' ')}</span>
              </p>
              <p className="font-mono">
                BE = {formatCycles(BE65)} <span className="text-stone-400">· lengths {cycleSignature(BE65).join(' ')}</span>
              </p>
              <p className="font-mono">
                CF = {formatCycles(CF65)} <span className="text-stone-400">· lengths {cycleSignature(CF65).join(' ')}</span>
              </p>
              <p>
                {fixedSentence(AD65)} No single press of an Enigma ever lights the key&apos;s own letter, but AD is the
                product of two presses, 1 and 4, and a product may bring a letter back.
              </p>
            </div>
          ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** What AD does with its fixed points: 'AD sends A and S to themselves.' */
function fixedSentence(p: readonly number[]): string {
  const f = p.flatMap((v, x) => (v === x ? [L(x)] : []))
  if (!f.length) return 'AD sends no letter to itself.'
  if (f.length === 1) return `AD sends ${f[0]} to itself.`
  return `AD sends ${f.slice(0, -1).join(', ')} and ${f.at(-1)} to themselves.`
}
