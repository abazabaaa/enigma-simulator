/**
 * self-search: the learner hunts for a letter that lights itself, turning the rotors and pressing keys. After the
 * bet, the Run reveal (or "give up", offered after 30 presses) lets the machine try key A at every one of the 17,576
 * rotor positions with the scene's rings and cables, counting A→A as it goes: the counter reaches 17,576 with 0 hits.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import type { MachineConfig } from '../../../engine'
import { BUTTON, Mono, useRevealFired } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { usePlaybackStore } from '../../../state/playbackStore'
import { POSITIONS_TOTAL, selfHits } from '../gates'

/** Manual presses before the "give up" button appears. */
export const GIVE_UP_AFTER = 30
const CHUNK = Math.ceil(POSITIONS_TOTAL / 32)

interface Search {
  readonly done: number
  readonly hits: number
}

/** Search every position for key A lighting A: all at once, or a chunk per animation frame. */
function useSearch(run: boolean, config: MachineConfig, animate: boolean): Search | null {
  const [state, setState] = useState<Search | null>(null)
  // The search uses the setting at the moment Run fired; turning a rotor meanwhile does not restart it.
  const setting = useRef({ config, animate })
  if (!run) setting.current = { config, animate }
  useEffect(() => {
    if (!run) return
    const { config: cfg, animate: slow } = setting.current
    if (!slow) {
      setState({ done: POSITIONS_TOTAL, hits: selfHits(cfg, 0, POSITIONS_TOTAL) })
      return
    }
    let done = 0
    let hits = 0
    let frame = 0
    const tick = () => {
      const to = Math.min(POSITIONS_TOTAL, done + CHUNK)
      hits += selfHits(cfg, done, to)
      done = to
      setState({ done, hits })
      if (done < POSITIONS_TOTAL) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run])
  return state
}

export function SelfSearchView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('self')
  const instant = usePlaybackStore((s) => s.speed === 'instant')
  const config = useStore(p.store, (s) => s.machine.config)
  const last = useStore(p.store, (s) => s.last)
  const seq = useStore(p.store, (s) => s.seq)
  const [base] = useState(() => p.store.getState().seq)
  const [selfLit, setSelfLit] = useState(0)
  const counted = useRef(seq)
  const search = useSearch(fired, config, !(p.reducedMotion || instant))
  const resolved = useRef(false)
  const { completeTask, bet, reveal } = p

  // Manual presses: count them, and any letter that lit itself (there are none).
  useEffect(() => {
    if (seq === counted.current || !last) return
    counted.current = seq
    if (last.trace[0]!.input === last.output) setSelfLit((n) => n + 1)
  }, [seq, last])
  const presses = seq - base

  const finished = search !== null && search.done >= POSITIONS_TOTAL
  useEffect(() => {
    if (!finished) return
    if (!resolved.current) {
      resolved.current = true
      bet('self').resolve(search.hits === 0 ? 'no' : 'yes')
    }
    completeTask('searched')
  }, [finished, search, bet, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="self-search-view">
      <p>
        Rings <Mono>{config.rings.map((r) => String(r.charCodeAt(0) - 64).padStart(2, '0')).join(' ')}</Mono>, cables{' '}
        <Mono>{config.plugboard.join(' ')}</Mono>. The windows are yours to turn. Hunt for a key that lights its own lamp: turn the
        rotors, press keys, and watch the lamps.
      </p>
      <p data-testid="self-manual" data-presses={presses} data-self={selfLit}>
        Your presses: {presses}. Letters that lit themselves: {selfLit}.
      </p>
      {presses >= GIVE_UP_AFTER && !fired ? (
        <div>
          <button
            type="button"
            className={BUTTON}
            data-testid="self-give-up"
            disabled={!reveal('self').allowed}
            onClick={() => reveal('self').fire()}
          >
            Give up: let the machine search every position
          </button>
        </div>
      ) : null}
      <div aria-live="polite">
      {search ? (
        <section data-testid="self-result" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <p className="font-mono text-base text-stone-100">
            Positions tried: <span data-testid="self-counter" data-count={search.done}>{search.done.toLocaleString('en')}</span> of{' '}
            {POSITIONS_TOTAL.toLocaleString('en')} · A lit A: <span data-testid="self-hits" data-hits={search.hits}>{search.hits}</span>
          </p>
          {finished ? (
            <p>
              Key <Mono>A</Mono> at every rotor position, with these rings and cables: it never lit <Mono>A</Mono>. Nor does any other
              letter light itself. The current reaches the reflector <Sym s="U" /> on one contact and always leaves on another, so it
              comes back to the lamps on a different letter, whatever the rotors and cables do on the way. Codebreakers leaned on this
              guarantee.
            </p>
          ) : null}
        </section>
      ) : null}
      </div>
    </div>
  )
}
