/**
 * ring-vs-core: the ring and the core as two layers. The toggle reveal turns the right ring from 01 to 05 while the
 * window letter stays; then the learner changes a ring and compares the lamps of one key at the same windows.
 * The rotors are held still (lock `hold`) so that only the ring changes between presses.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { positionsToString } from '../../../engine'
import { Mono, useRevealFired } from '../../../lesson'
import { START, ringNumber, turnoversOf } from '../gates'
import { PressLog, usePressLog, type PressEntry } from './PressLog'

/** The ring the reveal sets on the right rotor: 05 (E). */
export const REVEAL_RING = 'E'

/** Two presses of the same key at the same windows under different ring settings. */
export function comparedPair(log: readonly PressEntry[]): [PressEntry, PressEntry] | null {
  for (let a = 0; a < log.length; a++) {
    for (let b = a + 1; b < log.length; b++) {
      const x = log[a]!
      const y = log[b]!
      if (x.key === y.key && x.before === y.before && x.rings !== y.rings) return [x, y]
    }
  }
  return null
}

export function RingVsCoreView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('ring-window')
  const rings = useStore(p.store, (s) => s.machine.config.rings.join(''))
  const windows = useStore(p.store, (s) => positionsToString(s.machine))
  const log = usePressLog(p.store)
  const [toggled, setToggled] = useState<string | null>(null)
  const done = useRef(false)
  const { completeTask, bet, store } = p

  // The reveal: the bet resolves, the rings unlock, and the right ring turns to 05. The window does not move.
  useEffect(() => {
    if (!fired || done.current) return
    done.current = true
    bet('ring-window').resolve('wiring')
    const m = store.getState()
    m.setLocks({ ...m.locks, rings: false })
    store.getState().setRing(2, REVEAL_RING)
    setToggled(store.getState().machine.config.rings.join(''))
  }, [fired, bet, store])

  const changed = toggled !== null && rings !== toggled
  useEffect(() => {
    if (changed) completeTask('change-ring')
  }, [changed, completeTask])

  const pair = comparedPair(log)
  useEffect(() => {
    if (pair) completeTask('compare-lamps')
  }, [pair, completeTask])

  const right = START.rotors[2]!
  const ringR = ringNumber(rings[2] ?? 'A')
  const offset = (((windows.charCodeAt(2) - rings.charCodeAt(2)) % 26) + 26) % 26
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="ring-view">
      <p>
        Each rotor has two layers. The <strong>alphabet ring</strong> carries the letters you read in the window, and the notch. The{' '}
        <strong>wiring core</strong> sits inside it. The ring setting, <Mono>01</Mono> to <Mono>26</Mono>, says how far the core is turned
        against the ring. The rotors are held still in this scene, so a key press never steps them: only the ring changes.
      </p>
      <p data-testid="ring-now">
        Right rotor {right}: window <Mono>{windows[2]}</Mono>, ring <Mono>{ringR}</Mono>, core offset (window − ring){' '}
        <Mono>{offset}</Mono>.
      </p>
      {fired ? (
        <section data-testid="ring-result" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <p>
            The right ring went from <Mono>01</Mono> to <Mono>05</Mono> and the window still shows <Mono>{windows[2]}</Mono>. The core
            turned four places against the letters, so the current meets different wires at the same window: the same key lights a
            different lamp.
          </p>
          <p>
            The notch rides on the ring, so rotor {right} still carries the middle rotor from <Mono>{turnoversOf(right)}</Mono>. Positions
            are letters in the window; rings are numbers on the ring.
          </p>
          <p>Now change a ring with its spinbutton, and press the same key at the same windows under two ring settings.</p>
        </section>
      ) : null}
      {pair ? (
        <p data-testid="ring-compare">
          Key <Mono>{pair[0].key}</Mono> at <Mono>{pair[0].before}</Mono>: rings <Mono>{pair[0].rings}</Mono> light{' '}
          <Mono>{pair[0].lamp ?? '?'}</Mono>, rings <Mono>{pair[1].rings}</Mono> light <Mono>{pair[1].lamp ?? '?'}</Mono>.
        </p>
      ) : null}
      <PressLog entries={log} rings />
    </div>
  )
}
