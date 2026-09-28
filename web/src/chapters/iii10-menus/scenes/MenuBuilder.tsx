/**
 * menu-builder: vector 14's twelve links as a graph. After the bet on the number of closures the learner adds links
 * one at a time and watches the closure counter; the toggle reveal adds whatever links are left. The explanation
 * (E − V + C, the three loops, Wilcox's rule, the turnover warning) appears once the menu is complete.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { closures, menuFromEdges } from '../../../crypto/menu'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { CribStrip, MenuGraph } from '../../../viz'
import { MAX_LINKS, V14, V14_CLOSURES, V14_MENU, V14_NAMED_LOOPS, pieces } from '../gates'

const ALL = V14_MENU.edges
const menuOf = (positions: readonly number[]) => menuFromEdges(ALL.filter((e) => positions.includes(e.pos)))

export function MenuBuilderView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('closures')
  const committed = p.bet('closures').committed
  const [added, setAdded] = useState<readonly number[]>([])
  const [log, setLog] = useState<readonly string[]>([])
  const [shown, setShown] = useState<number | null>(null)
  const filled = useRef(false)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  const add = (pos: number) => {
    if (added.includes(pos)) return
    const next = [...added, pos]
    const before = closures(menuOf(added))
    const after = closures(menuOf(next))
    const e = ALL.find((x) => x.pos === pos)!
    setAdded(next)
    if (after > before) setLog((l) => [...l, `Link ${pos} (${e.a}–${e.b}) joined two letters already connected: closure ${after}.`])
  }
  const remove = (pos: number) => setAdded((a) => a.filter((x) => x !== pos))

  // The reveal: the links still missing go in.
  useEffect(() => {
    if (!fired || filled.current) return
    filled.current = true
    setAdded(ALL.map((e) => e.pos))
  }, [fired])

  const complete = added.length === ALL.length
  useEffect(() => {
    if (!complete) return
    if (!resolved.current) {
      resolved.current = true
      bet('closures').resolve(String(V14_CLOSURES))
    }
    completeTask('add-all')
  }, [complete, bet, completeTask])

  const menu = menuOf(added)
  const E = ALL.length
  const V = V14_MENU.letters.length
  const C = pieces(ALL).length
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="menu-builder-view">
      <p>
        The crib <Mono>{V14.crib}</Mono> sits under <Mono>{V14.cipher}</Mono> without a crash. Every column is a <strong>link</strong>:
        at that key press the machine joined the plaintext letter and the cipher letter. The links are numbered by crib position.
      </p>
      <CribStrip cipher={V14.cipher} crib={V14.crib} offset={0} readOnly testId="menu-builder-strip" />
      <p>
        Drawn as a graph, letters are points and links are lines. Most links reach a new letter. A link that joins two letters
        already connected closes a loop: a <strong>closure</strong>. The counter below counts them.
      </p>
      <MenuGraph
        menu={menu}
        available={ALL}
        onAddEdge={committed ? add : undefined}
        onRemoveEdge={committed ? remove : undefined}
        highlightLoop={shown !== null ? V14_NAMED_LOOPS[shown] : undefined}
        testId="menu-builder-graph"
      />
      {!committed ? <p className="text-stone-400">Bet first; then add the links one at a time.</p> : null}
      <ul className="flex flex-col gap-1" aria-live="polite" data-testid="menu-builder-log">
        {log.map((l, k) => (
          <li key={k}>{l}</li>
        ))}
      </ul>
      {complete ? (
        <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="menu-builder-result" aria-live="polite">
          <p>
            All {E} links: {V} letters in {C} piece{C === 1 ? '' : 's'}, so {E} − {V} + {C} = <strong>{V14_CLOSURES}</strong> closures.
            Every link beyond the {V - C} needed to connect the letters closes one more loop. The Bombe article names the three loops
            of this menu:
          </p>
          <div className="flex flex-wrap gap-2">
            {V14_NAMED_LOOPS.map((l, k) => (
              <button
                key={l.join('')}
                type="button"
                className={QUIET_BUTTON}
                aria-pressed={shown === k}
                data-testid={`menu-loop-${l.join('')}`}
                onClick={() => setShown(shown === k ? null : k)}
              >
                {l.join('')}
              </button>
            ))}
          </div>
          <p>
            Loops are what make a menu work: round a loop, a wrong guess about the plugboard comes back contradicting itself. Wilcox’s
            rule of thumb asked for two closures and 13 to 14 links; this short crib has {V14_CLOSURES} closures in {E} links.
          </p>
          <p>
            One more rule. The crib is typed over {E} key presses, and if the middle rotor steps somewhere inside it, the links after
            that press were made with a different middle rotor: the bombe cannot use them in the same menu (at most {MAX_LINKS} links
            in the gate, and none past the turnover).
          </p>
        </section>
      ) : null}
    </div>
  )
}
