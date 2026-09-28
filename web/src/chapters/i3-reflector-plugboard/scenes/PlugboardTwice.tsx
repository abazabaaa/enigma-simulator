/**
 * plugboard-twice: two cables are plugged. The bet asks how often the current crosses the plugboard; the reveal is a
 * press of A, whose trace shows a cable on the way in (plugboard-in) and another on the way out (plugboard-out).
 * Then the learner plugs two cables of their own and presses one of those keys.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import type { TraceStep } from '../../../engine'
import { Mono, useRevealFired } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { DEMO_CABLES, DEMO_KEY } from '../gates'

const sorted = (pair: string) => [...pair].sort().join('')
const DEMO = new Set(DEMO_CABLES.map(sorted))

/** The learner's own cables: every cable that is not one of the scene's two. */
export const ownCables = (plugs: readonly string[]): string[] => plugs.filter((c) => !DEMO.has(sorted(c)))

function Hops({ trace }: { trace: readonly TraceStep[] }): JSX.Element {
  const inHop = trace[0]!
  const outHop = trace.at(-1)!
  return (
    <ul className="flex flex-col gap-1" data-testid="plugboard-hops">
      <li>
        On the way in (<Sym s="S" />, the first row of the trace): <Mono>{inHop.input}</Mono> → <Mono>{inHop.output}</Mono>
        {inHop.input === inHop.output ? ', no cable on this letter' : ', across a cable'}.
      </li>
      <li>
        On the way out (<Sym s="S" inv />, the last row): <Mono>{outHop.input}</Mono> → <Mono>{outHop.output}</Mono>
        {outHop.input === outHop.output ? ', no cable on this letter' : ', across a cable'}.
      </li>
    </ul>
  )
}

export function PlugboardTwiceView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('twice')
  const last = useStore(p.store, (s) => s.last)
  const seq = useStore(p.store, (s) => s.seq)
  const plugs = useStore(p.store, (s) => s.machine.config.plugboard)
  const own = ownCables(plugs)
  const [revealSeq, setRevealSeq] = useState<number | null>(null)
  const [mostOwn, setMostOwn] = useState(0)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  // The reveal press: every press crosses the plugboard twice (in and out), cable or no cable.
  useEffect(() => {
    if (!fired || !last) return
    if (revealSeq === null) setRevealSeq(seq)
    if (!resolved.current) {
      resolved.current = true
      bet('twice').resolve('twice')
    }
  }, [fired, last, seq, revealSeq, bet])

  useEffect(() => {
    if (own.length > mostOwn) setMostOwn(own.length)
  }, [own.length, mostOwn])
  useEffect(() => {
    if (mostOwn >= 2) completeTask('add2')
  }, [mostOwn, completeTask])

  // A press, after the reveal, of a key on one of the learner's own cables.
  const key = last?.trace[0]?.input
  const onOwn = !!key && own.some((c) => c.includes(key))
  const pressedOwn = fired && revealSeq !== null && seq > revealSeq && onOwn
  useEffect(() => {
    if (pressedOwn) completeTask('press-plugged')
  }, [pressedOwn, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="plugboard-view">
      <p>
        The plugboard <Sym s="S" /> sits between the keyboard and the entry wheel. A cable joins two letters and swaps them; a letter
        without a cable passes straight through. Two cables are plugged: <Mono>{DEMO_CABLES.join(' ')}</Mono>. Bet first, then press a
        key: <Mono>{DEMO_KEY}</Mono> has a cable.
      </p>
      <div aria-live="polite">
      {fired && last ? (
        <section data-testid="plugboard-worked" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <p>
            Key <Mono>{last.trace[0]!.input}</Mono> lit <Mono>{last.output}</Mono>. The current crossed the plugboard <strong>twice</strong>
            : once on its way to the rotors and once on its way back to the lamps.
          </p>
          <Hops trace={last.trace} />
          <p>
            A cable swaps in both directions, so <Sym s="S" inv /> is <Sym s="S" /> again. Every key press meets the plugboard twice,
            whether or not the key itself has a cable: an unplugged letter just passes straight through.
          </p>
          <p>Now plug two cables of your own with the plugboard controls, and press a key that has one of them.</p>
        </section>
      ) : null}
      </div>
      {own.length ? (
        <p data-testid="own-cables">
          Your cables: <Mono>{own.join(' ')}</Mono>.
        </p>
      ) : null}
    </div>
  )
}
