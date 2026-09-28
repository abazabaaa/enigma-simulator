/**
 * double-key (worked): the day's machine at its Grundstellung; the learner types a message key twice. The first
 * press fires the `halves` reveal; the six presses are then laid out in pairs 1 & 4, 2 & 5, 3 & 6, and the worked
 * example explains why each pair came from one key letter, which is what makes AD, BE and CF observable.
 */

import { useEffect, useRef, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { positionsToString } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { DAY, HALVES_TRUTH, pathAtPress, spaced } from '../gates'
import { PAIR_TONE } from './parts'

const PRESS_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

const STAGES = ['key', 'S', 'H', 'N', 'M', 'L', 'U', 'L⁻¹', 'M⁻¹', 'N⁻¹', 'H⁻¹', 'S⁻¹'] as const

/** The same key letter on the wires at press 1 and at press 4: one start, two different paths, two lamps. */
function KeyPaths({ keyLetter }: { keyLetter: string }): JSX.Element {
  const rows = [1, 4].map((press) => ({ press, path: pathAtPress(DAY, press, keyLetter) }))
  return (
    <div className="max-w-full overflow-x-auto" data-testid="double-key-paths">
      <table className="font-mono text-xs">
        <caption className="text-left font-sans text-xs text-stone-400">
          Key letter {keyLetter} through the machine at press 1 (A) and at press 4 (D), stage by stage
        </caption>
        <thead>
          <tr className="text-stone-400">
            <th scope="col" className="pr-2 text-left font-sans font-normal">
              Press
            </th>
            {STAGES.map((st) => (
              <th key={st} scope="col" className="px-1 font-normal">
                {st}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ press, path }) => (
            <tr key={press} data-testid={`double-key-path-${press}`} data-path={path.join('')}>
              <th scope="row" className="pr-2 text-left font-sans font-normal text-stone-400">
                {press}
              </th>
              {path.map((c, k) => (
                <td
                  key={k}
                  className={`px-1 text-center ${k === 0 ? 'text-amber-200' : k === path.length - 1 ? 'font-semibold text-amber-100' : ''}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DoubleKeyView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('halves')
  const input = useStore(p.store, (s) => s.input)
  const output = useStore(p.store, (s) => s.output)
  const windows = useStore(p.store, (s) => positionsToString(s.machine))
  const resolved = useRef(false)
  const { completeTask, bet, store } = p

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('halves').resolve(HALVES_TRUTH)
  }, [fired, bet])

  const key = input.slice(0, 3)
  const done = input.length >= 6 && input.slice(3, 6) === key
  const offTrack = input.length > 0 && (input.length > 6 || [...input].some((c, k) => k >= 3 && c !== input[k - 3]))
  useEffect(() => {
    if (done) completeTask('type-key-twice')
  }, [done, completeTask])

  const indicator = output.slice(0, 6)
  const grund = DAY.positions.join('')
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="double-key-view">
      <p>
        The day&apos;s key sheet sets the machine: rotors <Mono>{DAY.rotors.join(' ')}</Mono>, reflector A, six cables,
        and the Grundstellung <Mono>{grund}</Mono> for every message of the day. Choose any three letters as your message
        key and type them twice, as the operators did, then watch which letters come out.
      </p>
      <p data-testid="double-key-now">
        Windows <Mono>{windows}</Mono> · typed <Mono>{input || '—'}</Mono> · lamps <Mono>{output || '—'}</Mono>
      </p>
      {offTrack ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>That is not one key typed twice.</span>
          <button
            type="button"
            className={QUIET_BUTTON}
            data-testid="double-key-restart"
            onClick={() => store.getState().reset()}
          >
            Back to {grund}
          </button>
        </div>
      ) : null}
      {input.length ? (
        <div className="max-w-full overflow-x-auto">
          <table className="font-mono text-sm" data-testid="double-key-presses">
            <caption className="text-left font-sans text-xs text-stone-400">Your presses from the Grundstellung</caption>
            <thead>
              <tr className="text-xs text-stone-400">
                <th scope="row" className="pr-3 text-left font-normal">
                  Press
                </th>
                {PRESS_NAMES.map((n, k) => (
                  <th key={n} scope="col" className={`w-10 font-normal ${PAIR_TONE[k % 3]}`}>
                    {k + 1} ({n})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="pr-3 text-left font-sans font-normal text-stone-400">
                  Key
                </th>
                {PRESS_NAMES.map((n, k) => (
                  <td key={n} className="text-center">
                    {input[k] ?? ''}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-3 text-left font-sans font-normal text-stone-400">
                  Lamp
                </th>
                {PRESS_NAMES.map((n, k) => (
                  <td key={n} className={`text-center ${PAIR_TONE[k % 3]}`} data-testid={`double-key-lamp-${k + 1}`}>
                    {output[k] ?? ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      <div aria-live="polite">
        {fired && done ? (
          <section
            data-testid="double-key-worked"
            className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3"
          >
            <h3 className="font-semibold text-stone-100">Worked example: one indicator</h3>
            <p>
              Your key <Mono>{key}</Mono> typed twice gave the indicator <Mono>{spaced(indicator)}</Mono>. The two halves
              differ, because the right rotor turned before every press.
            </p>
            <ol className="list-decimal pl-5">
              {[0, 1, 2].map((k) => (
                <li key={k} className={PAIR_TONE[k]}>
                  Letters {k + 1} and {k + 4}, <Mono>{indicator[k]}</Mono> and <Mono>{indicator[k + 3]}</Mono>, both
                  came from key letter <Mono>{key[k]}</Mono>: press {k + 1} ({PRESS_NAMES[k]}) sent it to{' '}
                  <Mono>{indicator[k]}</Mono>, press {k + 4} ({PRESS_NAMES[k + 3]}) to <Mono>{indicator[k + 3]}</Mono>.
                </li>
              ))}
            </ol>
            <KeyPaths keyLetter={key[0]!} />
            <p>
              Rejewski named the machine at the six presses A to F. Each is its own inverse, so A takes{' '}
              <Mono>{indicator[0]}</Mono> back to <Mono>{key[0]}</Mono>, and D takes that on to{' '}
              <Mono>{indicator[3]}</Mono>. The product AD (A first, then D) sends letter 1 of every indicator of the day
              to its letter 4, whatever the key. BE and CF do the same for letters 2 and 5, 3 and 6.
            </p>
          </section>
        ) : fired ? (
          <p>Keep typing: the same three letters again.</p>
        ) : null}
      </div>
    </div>
  )
}
