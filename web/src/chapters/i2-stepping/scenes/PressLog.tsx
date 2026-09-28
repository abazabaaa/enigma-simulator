/** The presses made in this visit of a scene: before → after, what moved, and (when shown) the lamp. */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { MachineStoreHook } from '../../../contracts/machine'
import { LETTERS } from '../../../engine'
import { Mono } from '../../../lesson'
import { ringNumber } from '../gates'

export interface PressEntry {
  readonly key: string
  readonly before: string
  readonly after: string
  readonly moved: readonly ('left' | 'middle' | 'right')[]
  readonly doubleStep: boolean
  /** Ring settings at the press, as 01–26. */
  readonly rings: string
  /** null while the lamps are hidden. */
  readonly lamp: string | null
}

const letters = (xs: readonly number[]) => xs.map((x) => LETTERS[x]).join('')

/** Every press of `store` from now on (a press is a new `seq` with a `last`). */
export function usePressLog(store: MachineStoreHook): readonly PressEntry[] {
  const [log, setLog] = useState<readonly PressEntry[]>([])
  const seen = useRef(store.getState().seq)
  useEffect(
    () =>
      store.subscribe((s) => {
        if (s.seq === seen.current || !s.last) return
        seen.current = s.seq
        const { stepping, output } = s.last
        const entry: PressEntry = {
          key: s.input.at(-1) ?? '?',
          before: letters(stepping.before),
          after: letters(stepping.after),
          moved: (['left', 'middle', 'right'] as const).filter((k) => stepping.stepped[k]),
          doubleStep: stepping.doubleStep,
          rings: s.machine.config.rings.map(ringNumber).join(' '),
          lamp: s.locks.lampsHidden ? null : output,
        }
        setLog((l) => [...l, entry])
      }),
    [store],
  )
  return log
}

export function PressLog({ entries, rings = false }: { entries: readonly PressEntry[]; rings?: boolean }): JSX.Element | null {
  if (!entries.length) return null
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="text-left font-mono text-xs" data-testid="press-log">
        <caption className="text-left font-sans text-xs text-stone-400">Your presses in this scene</caption>
        <thead>
          <tr className="text-stone-400">
            <th className="pr-3 font-normal">Key</th>
            <th className="pr-3 font-normal">Windows</th>
            {rings ? <th className="pr-3 font-normal">Rings</th> : null}
            <th className="pr-3 font-normal">Moved</th>
            {entries.some((e) => e.lamp) ? <th className="font-normal">Lamp</th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, k) => (
            <tr key={k} data-testid={`press-${k}`}>
              <td className="pr-3">{e.key}</td>
              <td className="pr-3">
                <Mono>{e.before === e.after ? e.before : `${e.before} → ${e.after}`}</Mono>
              </td>
              {rings ? <td className="pr-3">{e.rings}</td> : null}
              <td className="pr-3 font-sans">
                {e.moved.length ? e.moved.join(' + ') : 'held'}
                {e.doubleStep ? ' (double step)' : ''}
              </td>
              {e.lamp ? <td>{e.lamp}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
