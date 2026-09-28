/**
 * The Polish workbench (the polish-tools scene on a practice day, and the polish gate's items on the day they ask
 * about): the day's indicators, a pairing tool that reads AD, BE and CF off them, the catalogue query, the
 * doubled-key test at a card's settings, the cable finder, and the preview of the first message.
 * Every tool works only on what the learner feeds it; nothing here shows the day's key before the learner finds it.
 */

import { useEffect, useMemo, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { MachineStoreHook } from '../../../contracts/machine'
import type { CatalogueEntry } from '../../../crypto/catalogue'
import { getCatalogue } from '../../../crypto/catalogueClient'
import { cycleSignature, type RotorName } from '../../../engine'
import { BUTTON, INPUT, Mono, QUIET_BUTTON } from '../../../lesson'
import { CycleDiagram } from '../../../viz'
import {
  PRODUCTS,
  doubledTest,
  keyOf,
  normalizeKey,
  polishKey,
  rankCables,
  type ProductName,
} from '../gates'

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

/** The day's indicators, six letters each, the first one (the message's) marked. */
export function IndicatorList({ indicators, testId = 'indicator-list' }: { indicators: readonly string[]; testId?: string }): JSX.Element {
  return (
    <details className="rounded-md border border-stone-800 p-2" open data-testid={testId}>
      <summary className="cursor-pointer text-sm text-stone-300">
        The day&apos;s {indicators.length} indicators (the first six letters of each message)
      </summary>
      <ol className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-0.5 font-mono text-sm text-stone-200">
        {indicators.map((s, k) => (
          <li key={k} className={k === 0 ? 'text-amber-200' : ''} title={k === 0 ? 'The first message' : undefined}>
            {s.slice(0, 3)}&nbsp;{s.slice(3)}
            {k === 0 ? <span className="sr-only"> (the first message)</span> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Pairing: which letters of an indicator make a product
// ---------------------------------------------------------------------------

export type Pairing = Readonly<Record<ProductName, number | null>>
const FROM: Readonly<Record<ProductName, number>> = { AD: 0, BE: 1, CF: 2 }
export const NO_PAIRING: Pairing = { AD: null, BE: null, CF: null }

/** The map from letter `from` to letter `to` of every indicator: a permutation, or the first letter sent two ways. */
export function pairMap(indicators: readonly string[], from: number, to: number):
  { perm: number[] } | { conflict: string } | { missing: string } {
  const out = new Array<number>(26).fill(-1)
  for (const s of indicators) {
    const a = s.charCodeAt(from) - 65
    const b = s.charCodeAt(to) - 65
    if (out[a] !== -1 && out[a] !== b) {
      return { conflict: `${s[from]} goes to ${String.fromCharCode(65 + out[a]!)} in one indicator and to ${s[to]} in another` }
    }
    out[a] = b
  }
  const gap = out.findIndex((x) => x === -1)
  if (gap !== -1) return { missing: `no indicator shows ${String.fromCharCode(65 + gap)} there` }
  if (new Set(out).size !== 26) return { conflict: 'two letters go to the same letter' }
  return { perm: out }
}

/**
 * Choose, for each product, the letter of the indicator its first letter pairs with. A consistent choice reads a
 * permutation off the indicators; `view` shows it as a table of images (polish-card: the learner walks the cycles)
 * or as a cycle diagram (the workbench).
 */
export function PairingTool(p: {
  indicators: readonly string[]
  pairing: Pairing
  onPairing(p: Pairing): void
  view: 'table' | 'cycles'
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3" data-testid="pairing-tool">
      {PRODUCTS.map((name) => {
        const from = FROM[name]
        const to = p.pairing[name]
        const read = to === null ? null : pairMap(p.indicators, from, to)
        return (
          <div key={name} className="flex flex-col gap-1 rounded-md border border-stone-800 p-2" data-testid={`product-${name}`}>
            <label className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
              <span>
                <strong className="font-mono text-stone-100">{name}</strong>: letter {from + 1} of each indicator goes to letter
              </span>
              <select
                data-testid={`pairing-${name}`}
                className={INPUT}
                value={to === null ? '' : String(to)}
                disabled={p.disabled}
                onChange={(e) => p.onPairing({ ...p.pairing, [name]: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">choose</option>
                {[0, 1, 2, 3, 4, 5]
                  .filter((k) => k !== from)
                  .map((k) => (
                    <option key={k} value={k}>
                      {k + 1}
                    </option>
                  ))}
              </select>
            </label>
            {read === null ? null : 'perm' in read ? (
              p.view === 'table' ? (
                <div className="max-w-full overflow-x-auto" role="region" tabIndex={0} aria-label={`${name} as a table`} data-testid={`product-table-${name}`}>
                  <pre className="font-mono text-sm leading-tight text-stone-200">
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}
                    {'\n'}
                    {read.perm.map((x) => String.fromCharCode(65 + x)).join('')}
                  </pre>
                </div>
              ) : (
                <CycleDiagram perm={read.perm} testId={`cycles-${name}`} />
              )
            ) : (
              <p className="text-sm text-red-300" data-testid={`product-problem-${name}`}>
                Not a permutation: {'conflict' in read ? read.conflict : read.missing}.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The catalogue key
// ---------------------------------------------------------------------------

export type KeyLists = Readonly<Record<ProductName, string>>
export const EMPTY_KEY: KeyLists = { AD: '', BE: '', CF: '' }

/** Typed lengths ("10 10 2 2 1 1") as the catalogue's key 'AD:10.10.2.2.1.1 BE:… CF:…'. */
export function keyFromLists(k: KeyLists): string {
  return keyOf(PRODUCTS.map((n) => k[n].split(/[^0-9]+/).filter(Boolean).map(Number)))
}

/** Three fields: each product's cycle lengths, longest first, as the catalogue files them. */
export function KeyFields(p: { value: KeyLists; onChange(k: KeyLists): void; disabled?: boolean }): JSX.Element {
  return (
    <fieldset className="flex flex-col gap-2" disabled={p.disabled} data-testid="key-fields">
      <legend className="text-sm text-stone-300">The characteristic: each product&apos;s cycle lengths, longest first</legend>
      {PRODUCTS.map((n) => (
        <label key={n} className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
          <span className="w-8 font-mono text-stone-100">{n}</span>
          <input
            data-testid={`key-${n}`}
            className={`${INPUT} w-56`}
            value={p.value[n]}
            placeholder="e.g. 10 10 2 2 1 1"
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => p.onChange({ ...p.value, [n]: e.target.value })}
          />
        </label>
      ))}
      <p className="font-mono text-xs text-stone-400" data-testid="key-preview">
        {keyFromLists(p.value)}
      </p>
    </fieldset>
  )
}

/** Look a key up in the UKW-A catalogue (built once in a worker): the settings on that card, or none. */
export function CatalogueQuery(p: { query: string; onCard(card: readonly CatalogueEntry[] | null): void }): JSX.Element {
  const [state, setState] = useState<'idle' | 'building' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [card, setCard] = useState<readonly CatalogueEntry[] | null>(null)
  const [asked, setAsked] = useState('')
  const lookUp = () => {
    const key = normalizeKey(p.query)
    setState('building')
    void getCatalogue('A', (d, t) => setProgress(d / t)).then((c) => {
      const found = c.get(key) ?? []
      setCard(found)
      setAsked(key)
      setState('done')
      p.onCard(found)
    })
  }
  return (
    <div className="flex flex-col gap-2" data-testid="catalogue-query" data-state={state} data-count={card?.length ?? ''}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} onClick={lookUp} disabled={state === 'building'} data-testid="catalogue-look-up">
          Look the characteristic up in the catalogue
        </button>
        {state === 'building' ? (
          <progress max={1} value={progress} aria-label="Building the catalogue" className="w-40 accent-amber-400" />
        ) : null}
      </div>
      <p className="text-sm text-stone-300" aria-live="polite" data-testid="catalogue-result">
        {state === 'done'
          ? card && card.length
            ? `The card for ${asked} lists ${card.length} setting${card.length === 1 ? '' : 's'} (rotor order and ground setting, rings 01).`
            : `No card: no setting of rotors I, II and III with reflector A has the characteristic ${asked}.`
          : state === 'building'
            ? `Building the catalogue: ${Math.round(progress * 100)} % of 105,456 settings.`
            : 'The catalogue files all 105,456 settings (6 rotor orders × 17,576 ground settings, rings 01) by characteristic.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The doubled-key test and the cable finder
// ---------------------------------------------------------------------------

/** The machine's rotors and cables, live. */
export function useRotorsAndCables(store: MachineStoreHook): { rotors: readonly RotorName[]; cables: readonly string[]; windows: string } {
  const rotors = useStore(store, (s) => s.machine.config.rotors)
  const cables = useStore(store, (s) => s.machine.config.plugboard)
  const windows = useStore(store, (s) => s.machine.positions.map((x) => String.fromCharCode(65 + x)).join(''))
  return { rotors, cables, windows }
}

/**
 * The card's settings, each with the doubled-key test at the machine's cables: how many letter pairs of the
 * indicators agree when they are deciphered there. "Set" puts the rotor order on the machine and takes the ground
 * setting as the one the indicator panel reads at.
 */
export function CardTable(p: {
  card: readonly CatalogueEntry[]
  indicators: readonly string[]
  cables: readonly string[]
  ground: { rotors: readonly RotorName[]; positions: string } | null
  onSet(entry: CatalogueEntry): void
}): JSX.Element {
  const total = p.indicators.length * 3
  return (
    <table className="text-sm" data-testid="card-table">
      <caption className="text-left text-xs text-stone-400">
        The card, with the doubled-key test at your cables: letter pairs (1st and 4th, 2nd and 5th, 3rd and 6th) that agree
        when the {p.indicators.length} indicators are deciphered at each setting, out of {total}.
      </caption>
      <thead>
        <tr className="text-left text-xs text-stone-400">
          <th className="pr-3 font-normal">Setting</th>
          <th className="pr-3 font-normal">Pairs that agree</th>
          <th className="font-normal">
            <span className="sr-only">Use</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {p.card.map((e, k) => {
          const pairs = doubledTest(p.indicators, polishKey(e.rotors, p.cables), e.positions).pairs
          const chosen = !!p.ground && p.ground.positions === e.positions && p.ground.rotors.join('-') === e.rotors.join('-')
          return (
            <tr key={k} data-testid={`card-row-${k}`} data-pairs={pairs} className={chosen ? 'text-amber-200' : 'text-stone-200'}>
              <td className="pr-3 font-mono">
                {e.rotors.join('-')} at {e.positions}
              </td>
              <td className="pr-3 font-mono">
                {pairs} of {total}
              </td>
              <td>
                <button type="button" className={QUIET_BUTTON} onClick={() => p.onSet(e)} data-testid={`card-set-${k}`}>
                  {chosen ? 'In use' : 'Use this setting'}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * The indicators deciphered at a ground setting with the machine's rotors and cables: how many read as a key typed
 * twice, the first indicator's reading (the first message's key), and the cable finder.
 */
export function DoubledPanel(p: {
  indicators: readonly string[]
  rotors: readonly RotorName[]
  cables: readonly string[]
  ground: string
  maxCables: number
  onAddCable?(cable: string): void
}): JSX.Element {
  const test = useMemo(() => doubledTest(p.indicators, polishKey(p.rotors, p.cables), p.ground), [p.indicators, p.rotors, p.cables, p.ground])
  const [ranking, setRanking] = useState<{ for: string; list: { cable: string; pairs: number }[] } | null>(null)
  const signature = `${p.rotors.join('-')}|${p.ground}|${[...p.cables].sort().join(' ')}`
  useEffect(() => setRanking((r) => (r && r.for === signature ? r : null)), [signature])
  const total = p.indicators.length * 3
  const first = test.decrypts[0]!
  const full = p.cables.length >= p.maxCables
  return (
    <div className="flex flex-col gap-2 rounded-md border border-stone-800 p-2" data-testid="doubled-panel" data-pairs={test.pairs}
      data-doubled={test.doubled}>
      <p className="text-sm text-stone-300" aria-live="polite">
        Rotors <Mono>{p.rotors.join('-')}</Mono> at ground setting <Mono>{p.ground}</Mono>, {p.cables.length} cable
        {p.cables.length === 1 ? '' : 's'}: <strong data-testid="doubled-count">{test.doubled}</strong> of {p.indicators.length}{' '}
        indicators read as a key typed twice; <strong data-testid="pairs-count">{test.pairs}</strong> of {total} letter pairs agree
        ({p.indicators.length} indicators × 3 pairs).
      </p>
      <p className="text-sm text-stone-300" data-testid="first-indicator">
        The first message&apos;s indicator <Mono>{p.indicators[0]!}</Mono> reads <Mono className="text-amber-200">{first}</Mono>
        {first.slice(0, 3) === first.slice(3) ? ': a key typed twice.' : ': not yet a key typed twice.'}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-300">Every indicator at this setting</summary>
        <ol className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 font-mono text-stone-300">
          {test.decrypts.map((d, k) => (
            <li key={k} className={d.slice(0, 3) === d.slice(3) ? 'text-emerald-300' : ''}>
              {d.slice(0, 3)}&nbsp;{d.slice(3)}
            </li>
          ))}
        </ol>
      </details>
      {p.onAddCable ? (
        <div className="flex flex-col gap-1" data-testid="cable-finder">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={full}
              onClick={() => setRanking({ for: signature, list: rankCables(p.indicators, polishKey(p.rotors, p.cables), p.ground).slice(0, 5) })}
              data-testid="cable-rank"
            >
              Try every single cable here
            </button>
            <span className="text-xs text-stone-400">
              {full ? `All ${p.maxCables} cables are in.` : 'The machine tries each of the free pairs of letters as one more cable.'}
            </span>
          </div>
          {ranking ? (
            <ol className="flex flex-col gap-1 text-sm" aria-label="The best single cables" data-testid="cable-ranking">
              {ranking.list.map((c) => (
                <li key={c.cable} className="flex flex-wrap items-center gap-2">
                  <Mono>
                    {c.cable[0]}–{c.cable[1]}
                  </Mono>
                  <span className="text-stone-400">
                    {c.pairs} of {total} pairs agree ({c.pairs - test.pairs >= 0 ? '+' : ''}
                    {c.pairs - test.pairs})
                  </span>
                  <button type="button" className={QUIET_BUTTON} onClick={() => p.onAddCable?.(c.cable)} data-testid={`cable-add-${c.cable}`}>
                    Plug it in
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** The first message's body deciphered from the machine's windows (the trial preview; no key is pressed). */
export function BodyPreview(p: { message: string; read: string; known?: string; label?: string }): JSX.Element {
  return (
    <div className="rounded-md border border-stone-700 p-2" data-testid="trial-preview">
      <div className="text-xs text-stone-400">{p.label ?? 'The message deciphered from the windows you set'}</div>
      <div className="font-mono break-all text-stone-200" data-testid="trial-preview-text">
        {p.read}
      </div>
      {p.known ? (
        <div className="text-xs text-stone-400">
          Known: the message begins <Mono>{p.known}</Mono>.
        </div>
      ) : null}
    </div>
  )
}

/** The lengths of a permutation's cycles, longest first (what the key fields expect for it). */
export const lengthsText = (perm: readonly number[]): string => cycleSignature(perm).join(' ')
