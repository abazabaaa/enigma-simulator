/**
 * loop: vector 14's loop A–T–L–K (links 10, 8, 6, 7) on an eight-letter toy with its scrambler tables. Bet 1 (run):
 * which of three assumptions "A ↔ x" contradicts itself round the loop, resolved at the reveal by propagating each
 * assumption through the bombe kit. Then the learner follows an assumption of their own (task follow-loop). Bet 2
 * (play): Turing's expected stops for an 8-letter menu with 3 closures; the reveal shows his table from the facts.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { Letter } from '../../../contracts/core'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { menuFromEdges } from '../../../crypto/menu'
import { MenuGraph } from '../../../viz'
import { FACTS } from '../facts'
import {
  LOOP_TOY,
  TOY_ALPHABET,
  TOY_BANKS,
  TOY_BANKS2,
  TOY_LINKS,
  TOY_LINKS2,
  V14_MENU,
  contradicts,
  loopWalk,
  loopWalk2,
} from '../gates'
import { ToyTable } from './Parts'

/** Turing's table (F18): expected stops per wheel order for an 8-letter menu, by closures. */
export const STOP_TABLE = (['stops-3', 'stops-1', 'stops-0'] as const).map((id, k) => ({
  id,
  closures: [3, 1, 0][k]!,
  stops: Number(FACTS.find((f) => f.id === id)!.value),
}))

export const formatStops = (n: number): string => n.toLocaleString('en-GB')

/** The loop's four links alone, drawn solid over the rest of the menu (dashed). */
const LOOP_MENU = menuFromEdges(V14_MENU.edges.filter((e) => TOY_LINKS.includes(e.pos)))

const linkLabel = (j: number) => `Link ${TOY_LINKS[j]}, ${TOY_BANKS[j]}–${TOY_BANKS[(j + 1) % TOY_BANKS.length]}`

/** A → T → L → K → A with the partner of each letter. */
function Walk({ x, upTo = 4 }: { x: Letter; upTo?: number }): JSX.Element {
  const w = loopWalk(x)
  return (
    <span className="font-mono">
      {w.slice(0, upTo + 1).map((p, j) => (
        <span key={j}>
          {j ? ' → ' : ''}
          {TOY_BANKS[j % TOY_BANKS.length]}↔{p}
        </span>
      ))}
    </span>
  )
}

/** Follow an assumption of your own, one link at a time. */
function FollowLoop({ onDone }: { onDone(): void }): JSX.Element {
  const [x, setX] = useState<Letter | null>(null)
  const [step, setStep] = useState(0)
  const w = x ? loopWalk(x) : []
  const done = x !== null && step === TOY_BANKS.length
  useEffect(() => {
    if (done) onDone()
  }, [done, onDone])
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="follow-loop">
      <h3 className="font-semibold text-stone-100">Follow an assumption of your own</h3>
      <p>Pick A’s partner, then follow it link by link.</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="A’s partner">
        {TOY_ALPHABET.map((l) => (
          <button
            key={l}
            type="button"
            className={`${QUIET_BUTTON} w-10 px-0 font-mono ${x === l ? 'border-amber-400 text-amber-200' : ''}`}
            aria-pressed={x === l}
            data-testid={`follow-pick-${l}`}
            onClick={() => {
              setX(l)
              setStep(0)
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {x ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p data-testid="follow-walk" data-step={step}>
            <Walk x={x} upTo={step} />
          </p>
          {step < TOY_BANKS.length ? (
            <div>
              <button type="button" className={QUIET_BUTTON} data-testid="follow-next" onClick={() => setStep((s) => s + 1)}>
                Next link: {linkLabel(step)}
              </button>
            </div>
          ) : (
            <p data-testid="follow-verdict">
              A comes back with partner <Mono>{w[4]}</Mono>
              {w[4] === x ? `: no contradiction, A ↔ ${x} survives this loop.` : `, not ${x}: a contradiction, so A ↔ ${x} is wrong.`}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

const link2Label = (j: number) =>
  `Link ${TOY_LINKS2[j]}, ${TOY_BANKS2[j]}–${TOY_BANKS2[(j + 1) % TOY_BANKS2.length]}`

/** The second loop T–N–S (links 3, 12, 2) run on the survivors of the first: only the true pair comes back. */
function SecondLoop({ survivors }: { survivors: readonly Letter[] }): JSX.Element {
  const left = survivors.filter((x) => !contradicts(x, true))
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="second-loop" aria-live="polite">
      <h3 className="font-semibold text-stone-100">A second closure</h3>
      <p>
        The menu has another loop through T: T–N–S (links 3, 12 and 2). Each survivor above also fixed T’s partner, so take that
        partner round the second loop.
      </p>
      <div className="flex flex-col gap-2">
        {LOOP_TOY.tables2.map((t, j) => (
          <ToyTable key={j} alphabet={TOY_ALPHABET} images={t} label={link2Label(j)} testId={`loop2-table-${TOY_LINKS2[j]}`} />
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {survivors.map((x) => {
          const w = loopWalk2(x)
          const ok = !contradicts(x, true)
          return (
            <li key={x} data-testid={`loop2-option-${x}`} data-contradicts={String(!ok)}>
              A ↔ {x} gave T ↔ {w[0]}:{' '}
              <span className="font-mono">
                {w.map((q, j) => `${TOY_BANKS2[j % TOY_BANKS2.length]}↔${q}`).join(' → ')}
              </span>
              : {ok ? `T comes back with ${w[0]}: it survives.` : `T comes back with ${w[3]}, not ${w[0]}: a contradiction.`}
            </li>
          )
        })}
      </ul>
      <p data-testid="second-loop-result">
        {survivors.length} survivors of one loop, {left.length} of two
        {left.length === 1 ? `: only A ↔ ${left[0]} is left, the stop worth checking.` : '.'} That is what closures buy.
      </p>
    </section>
  )
}

export function LoopView(p: SceneProps): JSX.Element {
  const ran = useRevealFired('contradicts')
  const played = useRevealFired('stops')
  const resolved = useRef(new Set<string>())
  const [followed, setFollowed] = useState(false)
  const { completeTask, bet } = p
  const onFollowed = useCallback(() => {
    completeTask('follow-loop')
    setFollowed(true)
  }, [completeTask])
  // Computed from the kit once the run reveal has fired (never before the bet).
  const survivors = ran ? LOOP_TOY.options.filter((x) => !contradicts(x)) : []

  // The truths are computed when each reveal fires: bet 1 from the kit's propagation, bet 2 from Turing's table.
  useEffect(() => {
    if (ran && !resolved.current.has('contradicts')) {
      resolved.current.add('contradicts')
      const wrong = LOOP_TOY.options.filter((x) => contradicts(x))
      bet('contradicts').resolve(wrong.join(''))
    }
    if (played && !resolved.current.has('stops')) {
      resolved.current.add('stops')
      bet('stops').resolve(String(STOP_TABLE.find((r) => r.closures === 3)!.stops))
    }
  }, [ran, played, bet])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="loop-view">
      <p>
        In the menu of <Mono>ATTACKATDAWN</Mono>, links 10, 8, 6 and 7 form the loop A–T–L–K (solid below; the other links are
        dashed). The bombe tests an assumption about the plugboard by following such a loop.
      </p>
      <MenuGraph menu={LOOP_MENU} available={V14_MENU.edges} highlightLoop={TOY_BANKS} testId="loop-menu" />
      <p>
        To follow it by hand, shrink the machine to eight letters, <Mono>{TOY_ALPHABET.join(' ')}</Mono>. Each link’s scrambler pairs
        them; read a table downwards: a partner above becomes the partner below.
      </p>
      <div className="flex flex-col gap-2" data-testid="loop-tables">
        {LOOP_TOY.tables.map((t, j) => (
          <ToyTable key={j} alphabet={TOY_ALPHABET} images={t} label={linkLabel(j)} testId={`loop-table-${TOY_LINKS[j]}`} />
        ))}
      </div>
      <p>
        Assume A is steckered to some letter x. Link 10 joins A and T, so T’s partner is what table 10 makes of x. Link 8 then gives
        L’s partner, link 6 K’s, and link 7 brings you back to A. If A comes back with a partner other than x, A would need two
        partners: the assumption contradicts itself.
      </p>
      {ran ? (
        <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="loop-result" aria-live="polite">
          <ul className="flex flex-col gap-1">
            {LOOP_TOY.options.map((x) => {
              const back = loopWalk(x)[4]!
              return (
                <li key={x} data-testid={`loop-option-${x}`} data-contradicts={String(contradicts(x))}>
                  <Walk x={x} />:{' '}
                  {contradicts(x) ? `A comes back with ${back}, not ${x}: a contradiction.` : `A comes back with ${x}: it survives.`}
                </li>
              )
            })}
          </ul>
          <p>
            {survivors.length === 2 ? 'Two assumptions' : `${survivors.length} assumptions`} survive this one loop. At most one of them
            can be the true pair; the others are false stops, and one loop cannot tell them apart. Every further closure is one more
            test a wrong assumption has to pass.
          </p>
          <FollowLoop onDone={onFollowed} />
        </section>
      ) : null}
      {ran && followed ? <SecondLoop survivors={survivors} /> : null}
      {played ? (
        <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="stop-table" aria-live="polite">
          <h3 className="font-semibold text-stone-100">Turing’s table: expected stops per wheel order, 8-letter menu</h3>
          <table className="w-fit text-left">
            <thead>
              <tr className="text-xs text-stone-400">
                <th className="pr-6 font-normal">Closures</th>
                <th className="font-normal">Stops</th>
              </tr>
            </thead>
            <tbody>
              {STOP_TABLE.map((r) => (
                <tr key={r.id} data-testid={`stop-row-${r.closures}`}>
                  <td className="pr-6">{r.closures}</td>
                  <td className="font-mono">{formatStops(r.stops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Every stop has to be checked before anyone believes it, so a run with thousands of stops is useless. With three
            closures an 8-letter menu leaves about {formatStops(STOP_TABLE[0]!.stops)} per wheel order.
          </p>
        </section>
      ) : null}
    </div>
  )
}
