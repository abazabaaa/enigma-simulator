/**
 * reflector-pairs (worked): the reflector's 26 contacts on a circle. The bet asks how many wires join them; the Play
 * reveal lights the 13 wires of UKW-B in turn (all at once under reduced motion or instant playback), then a worked
 * example reads the pairs: whatever enters at one end of a wire leaves at the other, so the reflector undoes itself
 * and never returns a letter on its own contact.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { LETTERS } from '../../../engine'
import { Mono, useRevealFired } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { usePlaybackStore } from '../../../state/playbackStore'
import { reflectorPairs } from '../gates'

/** UKW-B's 13 wires, from the engine. */
export const PAIRS = reflectorPairs('B')
const LIGHT_MS = 260
const SIZE = 300
const C = SIZE / 2
const R_CONTACT = 112
const R_LABEL = 132

function at(i: number, r: number): { x: number; y: number } {
  const a = (i / 26) * 2 * Math.PI - Math.PI / 2
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
}

/** The 26 contacts on a circle and the first `lit` wires as chords through the middle. */
function ReflectorCircle({ lit }: { lit: number }): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block h-auto w-full max-w-xs"
      role="img"
      aria-label={lit ? `The reflector's 26 contacts with ${lit} of its 13 wires lit` : "The reflector's 26 contacts"}
      data-testid="reflector-circle"
      data-lit={lit}
    >
      <circle cx={C} cy={C} r={R_CONTACT} fill="none" stroke="currentColor" className="text-stone-700" />
      {PAIRS.slice(0, lit).map((pair, k) => {
        const a = at(LETTERS.indexOf(pair[0] as never), R_CONTACT)
        const b = at(LETTERS.indexOf(pair[1] as never), R_CONTACT)
        return (
          <path
            key={pair}
            data-pair={pair}
            d={`M ${a.x} ${a.y} Q ${C} ${C} ${b.x} ${b.y}`}
            fill="none"
            stroke="var(--sym-U)"
            strokeWidth={k === lit - 1 && lit < PAIRS.length ? 3.5 : 2}
            strokeLinecap="round"
          />
        )
      })}
      {LETTERS.map((l, i) => {
        const p = at(i, R_CONTACT)
        const t = at(i, R_LABEL)
        return (
          <g key={l}>
            <circle cx={p.x} cy={p.y} r={4} fill="var(--sym-U)" />
            <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" className="fill-stone-200 font-mono text-[13px]">
              {l}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ReflectorPairsView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('pairs')
  const instant = usePlaybackStore((s) => s.speed === 'instant')
  const [lit, setLit] = useState(0)
  const resolved = useRef(false)
  const { completeTask, bet, reducedMotion } = p

  // The Play reveal: the wires light one by one.
  useEffect(() => {
    if (!fired) return
    if (reducedMotion || instant) {
      setLit(PAIRS.length)
      return
    }
    const timer = setInterval(() => setLit((n) => Math.min(PAIRS.length, n + 1)), LIGHT_MS)
    return () => clearInterval(timer)
  }, [fired, reducedMotion, instant])

  const done = lit >= PAIRS.length
  useEffect(() => {
    if (!done) return
    if (!resolved.current) {
      resolved.current = true
      bet('pairs').resolve(String(PAIRS.length))
    }
    completeTask('seen')
  }, [done, bet, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="reflector-view">
      <p>
        The reflector <Sym s="U" /> sits at the far end of the rotors. It has 26 contacts, one for each letter, and wires inside it
        join the contacts to one another. The current arrives on one contact and leaves on another, back into the rotors.
      </p>
      <ReflectorCircle lit={lit} />
      {fired ? (
        <p data-testid="reflector-count">
          {lit} of {PAIRS.length} wires lit.
        </p>
      ) : null}
      {done ? (
        <section data-testid="reflector-worked" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <h3 className="font-semibold text-stone-100">Worked example: reading the reflector</h3>
          <p>
            Every wire joins exactly two contacts, so 26 contacts take <strong>13 wires</strong>, and no contact is left over or wired
            to itself:
          </p>
          <p className="flex flex-wrap gap-x-2 gap-y-1" data-testid="reflector-pairs-list">
            {PAIRS.map((pair) => (
              <Mono key={pair}>({pair.toLowerCase()})</Mono>
            ))}
          </p>
          <ol className="list-decimal pl-5">
            <li>
              A current arriving at <Mono>{PAIRS[0]![0]}</Mono> leaves at <Mono>{PAIRS[0]![1]}</Mono>, and one arriving at{' '}
              <Mono>{PAIRS[0]![1]}</Mono> leaves at <Mono>{PAIRS[0]![0]}</Mono>: the same wire, used in either direction.
            </li>
            <li>
              So applying <Sym s="U" /> twice gives every letter back: the reflector is its own inverse.
            </li>
            <li>No wire starts and ends on the same contact, so the reflector never returns a letter on its own contact.</li>
          </ol>
        </section>
      ) : null}
    </div>
  )
}
