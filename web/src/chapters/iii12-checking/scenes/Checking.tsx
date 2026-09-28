/**
 * checking-machine: the stops of the last scene on the checking machine, an Enigma without its plugboard with its drums
 * held at each crib column in turn. The learner checks stops (the machine's own next move is on offer) until two have
 * been checked to the end.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, QUIET_BUTTON } from '../../../lesson'
import { STOPS_CRIB, STOPS_DAY, STOP_LIST, checkingMachine, sceneCheckData } from '../gates'
import { CheckingDesk } from './Desk'

export function CheckingView(p: SceneProps): JSX.Element {
  const [positions, setPositions] = useState(STOP_LIST[0]![0])
  const data = useMemo(() => sceneCheckData(positions), [positions])
  const [finished, setFinished] = useState<Readonly<Record<string, 'consistent' | 'contradiction'>>>({})
  const { completeTask, store } = p

  const choose = (pos: string) => {
    setPositions(pos)
    store.getState().setConfig(checkingMachine(sceneCheckData(pos)))
  }

  const onFinished = useCallback(
    (result: 'consistent' | 'contradiction') => setFinished((f) => (f[positions] ? f : { ...f, [positions]: result })),
    [positions],
  )
  const checked = Object.keys(finished).length
  useEffect(() => {
    if (checked >= 2) completeTask('check2')
  }, [checked, completeTask])

  return (
    <div className="flex flex-col gap-4 text-sm text-stone-300" data-testid="checking-view" data-checked={Object.keys(finished).sort().join(' ')}>
      <p>
        The checking machine is an Enigma with its plugboard taken away, its drums set like the bombe&apos;s at the stop. At crib
        column k the right drum stands k places on, and the drums do not move when you press a key. The crib is{' '}
        <Mono>{STOPS_CRIB}</Mono>, with the cipher letters it lies under.
      </p>
      <p>
        Why it works: a crib letter over its cipher letter means the plugboard, then the scrambler, then the plugboard again turn one
        into the other. So if a letter&apos;s partner is known, press that partner at its column: the lamp is the partner of the other
        letter. A letter can have only one partner.
      </p>
      <div role="radiogroup" aria-label="Which stop to check" className="flex flex-wrap gap-2">
        {STOP_LIST.map(([pos, stecker]) => (
          <button
            key={pos}
            type="button"
            role="radio"
            aria-checked={positions === pos}
            data-testid={`check-stop-${pos}`}
            onClick={() => choose(pos)}
            className={`${QUIET_BUTTON} font-mono ${positions === pos ? 'border-amber-400 text-amber-100' : ''}`}
          >
            {pos} ({STOPS_DAY.test}↔{stecker}){finished[pos] ? (finished[pos] === 'consistent' ? ' ✓' : ' ✗') : ''}
          </button>
        ))}
      </div>
      <CheckingDesk key={positions} data={data} mode="explore" onFinished={onFinished} />
    </div>
  )
}
