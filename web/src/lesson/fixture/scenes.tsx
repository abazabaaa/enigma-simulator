/**
 * The fixture's scene Views. They react to fired reveals (useRevealFired), resolve the bets against what the
 * machine actually did, and complete tasks through real actions.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../contracts/lesson'
import { createMachine, encipher, pressKey } from '../../engine'
import { useStore } from 'zustand'
import { useRevealFired } from '../ui/bets'

/** Bets on a press (lamp), a step (which rotors move) and a play (how many hops). */
export function BetsPressView(p: SceneProps): JSX.Element {
  const lampFired = useRevealFired('first-lamp')
  const stepFired = useRevealFired('steps')
  const countFired = useRevealFired('count')
  const last = useStore(p.store, (s) => s.last)
  const seq = useStore(p.store, (s) => s.seq)
  const [base, setBase] = useState<number | null>(null)
  const resolved = useRef(new Set<string>())
  const resolve = (id: string, truth: string) => {
    if (resolved.current.has(id)) return
    resolved.current.add(id)
    p.bet(id).resolve(truth)
  }
  useEffect(() => {
    if (lampFired && last) resolve('first-lamp', last.output)
  })
  useEffect(() => {
    if (!stepFired || !last) return
    const s = last.stepping.stepped
    resolve('steps', s.left ? 'all' : s.middle ? 'two' : 'right')
  })
  useEffect(() => {
    if (countFired) resolve('count', String(last?.trace.length ?? 11))
  })
  const all = lampFired && stepFired && countFired
  const pressed = all && base !== null && seq - base >= 2
  useEffect(() => {
    if (all && base === null) setBase(seq)
  }, [all, base, seq])
  const { completeTask } = p
  useEffect(() => {
    if (pressed) completeTask('press2')
  }, [pressed, completeTask])
  return (
    <div className="flex flex-col gap-2 text-sm text-stone-300" data-testid="bets-press-view">
      <p>Bet before each reveal. Your first key press must be A.</p>
      {lampFired && last ? <p data-testid="lamp-result">That press lit {last.output}.</p> : null}
      {stepFired && last ? (
        <p>
          On that press the {(['right', 'middle', 'left'] as const).filter((k) => last.stepping.stepped[k]).join(' and ')} rotor moved.
        </p>
      ) : null}
      {countFired ? <p data-testid="hop-count">One key press sends the current through {last?.trace.length ?? 11} stages.</p> : null}
      {all ? <p>Now press two more keys of your choice.</p> : null}
    </div>
  )
}

/** Bets revealed by a run (a search) and a toggle (the reflector). */
export function BetsToggleView(p: SceneProps): JSX.Element {
  const searched = useRevealFired('search')
  const toggled = useRevealFired('flip')
  const [hits, setHits] = useState<number | null>(null)
  const [lamps, setLamps] = useState<{ b: string; c: string } | null>(null)
  useEffect(() => {
    if (!searched || hits !== null) return
    const out = encipher(createMachine({ model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA' }), 'A'.repeat(26)).output
    const n = [...out].filter((c) => c === 'A').length
    setHits(n)
    p.bet('search').resolve(n === 0 ? 'never' : 'sometimes')
  })
  useEffect(() => {
    if (!toggled || lamps) return
    const lamp = (reflector: 'B' | 'C') =>
      pressKey(createMachine({ model: 'I', reflector, rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA' }), 'A').output
    const next = { b: lamp('B'), c: lamp('C') }
    setLamps(next)
    p.bet('flip').resolve(next.b === next.c ? 'same' : 'changes')
  })
  const seen = searched && toggled
  const { completeTask } = p
  useEffect(() => {
    if (seen) completeTask('seen')
  }, [seen, completeTask])
  return (
    <div className="flex flex-col gap-2 text-sm text-stone-300" data-testid="bets-toggle-view">
      {hits !== null ? <p data-testid="search-result">26 presses of A from AAA: A lit itself {hits} times.</p> : null}
      {lamps ? (
        <p data-testid="flip-result">
          From AAA, A lights {lamps.b} with reflector B and {lamps.c} with reflector C.
        </p>
      ) : null}
    </div>
  )
}
