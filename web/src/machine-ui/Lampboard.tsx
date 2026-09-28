/**
 * The lampboard (PLAN §3.10): lamp-A…Z in the QWERTZ rows, lit from the playback clock (isLit), so it
 * lights at the same moment as the trace, the stage and the announcer. locks.lampsHidden covers it.
 * The grid is visual only: the Announcer speaks the lit lamp.
 */

import type { JSX } from 'react'
import type { MachineStoreHook } from '../contracts/machine'
import { KEYBOARD_ROWS } from '../engine'
import { useApi, useMachinePress } from './hooks'

/** lamp-A…Z; lit via playback. */
export function Lampboard({ store }: { store?: MachineStoreHook }): JSX.Element {
  const view = useMachinePress(useApi(store))
  const hidden = view.lampsHidden
  const on = view.lit && !hidden ? view.lamp : null

  return (
    <div data-testid="lampboard" data-hidden={hidden ? 'true' : 'false'} className="relative flex flex-col items-center">
      <div aria-hidden="true" className={`flex flex-col items-center gap-1 ${hidden ? 'invisible' : ''}`}>
        {KEYBOARD_ROWS.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((letter) => {
              const lit = on === letter
              return (
                <span
                  key={letter}
                  data-testid={`lamp-${letter}`}
                  data-lit={lit ? 'true' : 'false'}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-sm sm:h-9 sm:w-9 ${
                    lit
                      ? 'border-amber-200 bg-amber-300 text-stone-950 shadow-[0_0_14px_var(--color-amber-300)]'
                      : 'border-stone-700 bg-stone-900 text-stone-400'
                  }`}
                >
                  {letter}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {hidden ? (
        <p className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-stone-600 bg-stone-900/90 text-sm text-stone-300">
          Lampboard covered
        </p>
      ) : null}
    </div>
  )
}
