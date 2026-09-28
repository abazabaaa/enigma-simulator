/**
 * The plugboard (PLAN §3.10): the list of cables (plug-pair-{i}, each with a remove button), and
 * plug-input + plug-add to add one or more pairs ("AV" or "AV BS"). No letter may be plugged twice
 * and there are at most `maxPairs` cables (default: the model's 13). Problems are reported in a
 * role=alert region. Everything is disabled under locks.plugboard.
 */

import { useId, useState, type FormEvent, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../contracts/machine'
import { MODELS } from '../engine'
import { useApi } from './hooks'

/** Parse typed pairs against the current cables; returns the pairs to add or a problem. */
export function parsePairs(text: string, existing: readonly string[], maxPairs: number): { pairs: string[] } | { error: string } {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '')
  if (letters.length === 0) return { error: 'Type two letters to join with a cable, for example AV.' }
  if (letters.length % 2 !== 0) return { error: `Cables join letters in pairs; "${letters}" has an odd number of letters.` }
  const pairs = letters.match(/../g)!
  const used = new Map<string, string>()
  for (const p of existing) for (const l of p) used.set(l, p)
  for (const p of pairs) {
    if (p[0] === p[1]) return { error: `A cable joins two different letters; ${p[0]}–${p[1]} would join ${p[0]} to itself.` }
    for (const l of p) {
      const other = used.get(l)
      if (other) return { error: `${l} is already plugged (${other[0]}–${other[1]}). Each letter takes one cable.` }
      used.set(l, p)
    }
  }
  if (existing.length + pairs.length > maxPairs) {
    return { error: `At most ${maxPairs} cables fit; there ${existing.length === 1 ? 'is' : 'are'} already ${existing.length}.` }
  }
  return { pairs }
}

export function PlugboardEditor({ store, maxPairs }: { store?: MachineStoreHook; maxPairs?: number }): JSX.Element {
  const api = useApi(store)
  const { plugs, model, locked } = useStore(
    api,
    useShallow((s) => ({ plugs: s.machine.config.plugboard, model: s.machine.config.model, locked: !!s.locks.plugboard })),
  )
  const max = Math.min(maxPairs ?? MODELS[model].maxPlugPairs, MODELS[model].maxPlugPairs)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const inputId = useId()
  const headingId = useId()

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (locked) return
    const result = parsePairs(text, plugs, max)
    if ('error' in result) {
      setError(result.error)
      return
    }
    try {
      api.getState().setPlugs([...plugs, ...result.pairs])
      setText('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = (pair: string) => {
    const s = api.getState()
    if (s.locks.plugboard) return
    s.setPlugs(s.machine.config.plugboard.filter((p) => p !== pair))
    setError('')
  }

  return (
    <section aria-labelledby={headingId} data-testid="plugboard-editor" className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-medium text-stone-200">
        Plugboard{' '}
        <span className="font-normal text-stone-300">
          ({plugs.length} of {max} cables)
        </span>
      </h3>
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Letters to join with a cable
        </label>
        <input
          id={inputId}
          data-testid="plug-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={locked}
          placeholder="e.g. AV"
          autoComplete="off"
          spellCheck={false}
          className="w-28 rounded border border-stone-600 bg-stone-900 px-2 py-1 font-mono text-sm text-stone-100 placeholder:text-stone-400 disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="plug-add"
          disabled={locked}
          className="rounded border border-stone-600 px-3 py-1 text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
        >
          Add cable
        </button>
      </form>
      <div role="alert" data-testid="plug-error" className="text-sm text-red-300">
        {error}
      </div>
      {plugs.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Cables">
          {plugs.map((pair, i) => (
            <li
              key={pair}
              data-testid={`plug-pair-${i}`}
              data-pair={pair}
              className="flex items-center gap-1 rounded-full border border-emerald-700/70 bg-stone-900 py-0.5 pr-1 pl-2 font-mono text-sm text-stone-100"
            >
              {pair[0]}–{pair[1]}
              <button
                type="button"
                data-testid={`plug-remove-${i}`}
                aria-label={`Remove the cable ${pair[0]}–${pair[1]}`}
                disabled={locked}
                onClick={() => remove(pair)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-stone-300 hover:bg-stone-700 disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-300">No cables: every letter passes straight through.</p>
      )}
    </section>
  )
}
