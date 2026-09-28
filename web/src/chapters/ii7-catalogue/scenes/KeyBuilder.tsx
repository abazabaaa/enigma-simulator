/**
 * The characteristic key, built from typed cycle lengths (the `signature` item, and the query tool of `lookup` and
 * `lookup-transfer`), and the catalogue query itself: the card filed under a key, from the worker-built catalogue.
 * Nothing here knows the day: the key is the learner's, and a card shows only after the learner asks for it.
 */

import { useState, type JSX } from 'react'
import { Mono, QUIET_BUTTON, INPUT } from '../../../lesson'
import { CATALOGUE_SETTINGS, PRODUCTS, keyOf, normalizeKey, parseKey } from '../gates'
import { useCatalogue } from './useCatalogue'

/** The numbers typed in a field ('9 9 4 4', '9,9,4,4' …). */
export const lengthsIn = (s: string): number[] => (s.match(/\d+/g) ?? []).map(Number)

/** The key the three fields spell, in the order typed. */
export const keyFromFields = (fields: readonly string[]): string => keyOf(fields.map(lengthsIn))

/** Every field holds at least one length. */
export const fieldsFilled = (fields: readonly string[]): boolean => fields.length === 3 && fields.every((f) => lengthsIn(f).length > 0)

export function KeyBuilder(p: {
  fields: readonly string[]
  onChange(fields: string[]): void
  disabled?: boolean
  testId?: string
}): JSX.Element {
  const testId = p.testId ?? 'key-builder'
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-stone-700 p-3" data-testid={testId}>
      <legend className="px-1 text-sm font-semibold text-stone-200">The characteristic key</legend>
      <p className="text-xs text-stone-400">
        For each product, type the lengths of its cycles, longest first, separated by spaces (a fixed letter is a cycle of
        length 1).
      </p>
      {PRODUCTS.map((name, k) => {
        const lengths = lengthsIn(p.fields[k] ?? '')
        const sum = lengths.reduce((s, x) => s + x, 0)
        return (
          <label key={name} className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
            <span className="w-8 font-mono text-stone-100">{name}</span>
            <input
              data-testid={`${testId}-${name}`}
              className={`${INPUT} w-48 max-w-full`}
              value={p.fields[k] ?? ''}
              disabled={p.disabled}
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Cycle lengths of ${name}, longest first`}
              onChange={(e) => p.onChange(PRODUCTS.map((_, j) => (j === k ? e.target.value : (p.fields[j] ?? ''))))}
            />
            <span className="text-xs text-stone-400">{lengths.length ? `${sum} of 26 letters` : ''}</span>
          </label>
        )
      })}
      <p className="text-sm text-stone-300">
        Key:{' '}
        <output data-testid={`${testId}-key`} aria-live="polite" className="font-mono break-all text-amber-200">
          {keyFromFields(p.fields)}
        </output>
      </p>
    </fieldset>
  )
}

const CARD_SHOWN = 40

/** Look a key up: the card filed under it (built on first use; the kit memoises the catalogue). */
export function CatalogueQuery({ keyText, testId = 'catalogue' }: { keyText: string; testId?: string }): JSX.Element {
  const cat = useCatalogue(true)
  const [asked, setAsked] = useState<string | null>(null)
  const valid = parseKey(keyText) !== null && (parseKey(keyText) ?? []).every((l) => l.length > 0)
  const card = asked !== null && cat.catalogue ? (cat.catalogue.get(asked) ?? []) : null
  return (
    <div className="flex flex-col gap-2" data-testid={`${testId}-query-tool`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          className={QUIET_BUTTON}
          data-testid={`${testId}-query`}
          disabled={!cat.catalogue || !valid}
          onClick={() => setAsked(normalizeKey(keyText))}
        >
          Look up the card
        </button>
        {cat.catalogue ? (
          <span className="text-xs text-stone-400">
            The catalogue: {CATALOGUE_SETTINGS.toLocaleString('en-US')} settings of rotors I, II and III, reflector A, rings 01.
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs text-stone-400">
            <progress max={cat.total} value={cat.done} aria-label="Building the catalogue" className="w-32 accent-amber-400" />
            {cat.failed ? 'The catalogue could not be built.' : 'Building the catalogue…'}
          </span>
        )}
      </div>
      <div aria-live="polite">
        {card === null ? null : card.length ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-stone-300">
              The card for <Mono>{asked}</Mono> lists {card.length} setting{card.length === 1 ? '' : 's'}:
            </p>
            <ol
              data-testid={`${testId}-card`}
              data-count={card.length}
              data-key={asked ?? undefined}
              className="flex max-h-48 flex-wrap gap-1 overflow-y-auto font-mono text-sm"
            >
              {card.slice(0, CARD_SHOWN).map((e, k) => (
                <li key={k} data-testid={`${testId}-candidate-${k}`} className="rounded border border-stone-700 px-1.5 text-stone-200">
                  {e.rotors.join('-')} · {e.positions}
                </li>
              ))}
              {card.length > CARD_SHOWN ? <li className="px-1.5 text-stone-400">and {card.length - CARD_SHOWN} more</li> : null}
            </ol>
          </div>
        ) : (
          <p data-testid={`${testId}-card`} data-count="0" className="text-sm text-stone-300">
            No setting of rotors I, II and III has the key <Mono>{asked}</Mono>. Recount the cycles.
          </p>
        )}
      </div>
    </div>
  )
}
