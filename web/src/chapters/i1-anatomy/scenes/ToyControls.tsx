/**
 * The toy machine's DOM controls: its keys (toy-key-A…F) and lamps (toy-lamp-A…F). They drive the toy store (the
 * one write path for toys) and render from the same (last press, playback t) as the stage and the trace. The toy
 * has no locks of its own: the keys respect the default machine store's keyboard lock, which a pending bet sets
 * (G10). Physical keys A–F press the toy too, except in text fields.
 */

import { useEffect, type JSX } from 'react'
import { LETTERS, type Letter } from '../../../engine'
import { useToyPress } from '../../../machine-ui/hooks'
import { isTextEntry, letterOf } from '../../../machine-ui/Keyboard'
import { useMachineStore } from '../../../state/machineStore'
import { useToyStore } from '../../../state/toyStore'

/** Press a toy key unless the keyboard is locked (a pending bet, a gate). */
export function pressToy(letter: Letter): void {
  if (useMachineStore.getState().locks.keyboard) return
  const { spec, press } = useToyStore.getState()
  if (LETTERS.indexOf(letter) < spec.n) press(letter)
}

export function ToyKeyboard(): JSX.Element {
  const n = useToyStore((s) => s.spec.n)
  const locked = useMachineStore((s) => !!s.locks.keyboard)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTextEntry(e.target)) return
      const letter = letterOf(e)
      if (!letter || LETTERS.indexOf(letter) >= useToyStore.getState().spec.n) return
      e.preventDefault()
      pressToy(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      role="group"
      aria-label={locked ? 'Toy keyboard (locked: bet first)' : 'Toy keyboard'}
      data-testid="toy-keyboard"
      data-locked={String(locked)}
      className="flex flex-wrap justify-center gap-1"
    >
      {LETTERS.slice(0, n).map((letter) => (
        <button
          key={letter}
          type="button"
          data-testid={`toy-key-${letter}`}
          disabled={locked}
          onClick={() => pressToy(letter)}
          className="h-9 w-9 rounded-md border border-stone-600 bg-stone-800 font-mono text-sm text-stone-100 shadow-sm hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {letter}
        </button>
      ))}
    </div>
  )
}

export function ToyLampboard(): JSX.Element {
  const view = useToyPress()
  const hidden = view.lampsHidden
  const on = view.lit && !hidden ? view.lamp : null
  return (
    <div data-testid="toy-lampboard" data-hidden={String(hidden)} aria-hidden="true" className="flex flex-wrap justify-center gap-1">
      {LETTERS.slice(0, view.n).map((letter) => {
        const lit = on === letter
        return (
          <span
            key={letter}
            data-testid={`toy-lamp-${letter}`}
            data-lit={String(lit)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border font-mono text-sm ${
              lit ? 'border-amber-200 bg-amber-300 text-stone-950 shadow-[0_0_14px_var(--color-amber-300)]' : 'border-stone-700 bg-stone-900 text-stone-400'
            }`}
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}

/** Lamps above keys, as on the machine, with the announcer's reading below. */
export function ToyMachine({ children }: { children?: JSX.Element | null }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-stone-800 bg-stone-900/40 p-3" data-testid="toy-machine">
      <ToyLampboard />
      <ToyKeyboard />
      {children}
    </div>
  )
}
