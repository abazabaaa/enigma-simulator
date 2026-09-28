/**
 * Chapter ii7-catalogue's ITEM_UI. Every prompt stands alone (it names the machine, the rule and the data), no widget
 * shows an answer before the learner has made it (a card appears only for the learner's own key), and the set-machine
 * items keep the keyboard locked and the lamps hidden: only the decrypt preview reacts to the settings.
 */

import { useMemo, useState, type JSX } from 'react'
import type { Choice, MachineConfig } from '../../contracts/core'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { createMachine, cycles, encipher, positionsToString } from '../../engine'
import { Mono, SubmitButton } from '../../lesson'
import { MachinePanel, PermTable, PlugboardEditor } from '../../machine-ui'
import { useMachine, useMachineApi } from '../../state/activeMachine'
import { CycleDiagram } from '../../viz'
import {
  MAX_PLUGS,
  PRODUCTS,
  cycleText,
  characteristicOf,
  dayProducts,
  decryptWith,
  notation,
  parseKey,
  settingText,
  type LookupInstance,
  type PlugsInstance,
  type Products3,
  type SignatureInstance,
} from './gates'
import { CatalogueQuery, KeyBuilder, fieldsFilled, keyFromFields } from './scenes/KeyBuilder'
import { toggleClass } from './scenes/Cyclometer'
import { useCatalogue } from './scenes/useCatalogue'

const RULE =
  'The catalogue files a day under its characteristic: for AD, BE and CF in turn, the lengths of all the cycles, ' +
  'longest first, a fixed letter counting as a cycle of length 1.'

function ProductsTable({ products }: { products: Products3 }): JSX.Element {
  return (
    <dl className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1" data-testid="day-products">
      {PRODUCTS.map((n) => (
        <div key={n} className="contents">
          <dt className="font-mono text-stone-100">{n}</dt>
          <dd className="m-0 min-w-0 font-mono break-all text-stone-200">{notation(products[n])}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------
// signature
// ---------------------------------------------------------------------------

function SignatureAnswer({ disabled, submit }: AnswerProps<SignatureInstance, string>): JSX.Element {
  const [fields, setFields] = useState<string[]>(['', '', ''])
  return (
    <div className="flex flex-col gap-3" data-testid="signature-answer">
      <KeyBuilder fields={fields} onChange={setFields} disabled={disabled} testId="signature-key" />
      <div>
        <SubmitButton disabled={disabled || !fieldsFilled(fields)} onClick={() => submit(keyFromFields(fields))} />
      </div>
    </div>
  )
}

/** Each product's cycles with their lengths, then the lengths longest first. */
function LengthsWorked({ products, solution }: { products: Products3; solution: string }): JSX.Element {
  const lists = parseKey(solution) ?? []
  return (
    <div className="flex flex-col gap-1 text-sm">
      {PRODUCTS.map((n, k) => (
        <p key={n} className="break-words">
          <Mono>{n}</Mono>:{' '}
          {cycles(products[n]).map((c, j) => (
            <span key={j}>
              {j ? ' ' : ''}
              <Mono>{cycleText(c)}</Mono> {c.length}
            </span>
          ))}
          ; longest first <Mono>{(lists[k] ?? []).join(' ')}</Mono>.
        </p>
      ))}
      <p>
        Key <Mono>{solution}</Mono>.
      </p>
    </div>
  )
}

const signature = {
  Prompt: ({ instance, hintLevel }: { instance: SignatureInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>One day&apos;s products, read off its indicators (reflector A, rotors I–III, rings 01), in cycle notation:</p>
      <ProductsTable products={instance.products} />
      <p>{RULE} Build the day&apos;s key.</p>
      {hintLevel >= 1 ? (
        <p className="text-sky-200">
          Count the letters of every cycle, the one-letter cycles too: a product&apos;s lengths add up to 26 and come in equal
          pairs. Then write them from longest to shortest, whatever order the cycles are listed in.
        </p>
      ) : null}
    </div>
  ),
  Answer: SignatureAnswer,
  Worked: ({ instance, solution }: { instance: SignatureInstance; solution: string }) => (
    <LengthsWorked products={instance.products} solution={solution} />
  ),
  Feedback: ({ instance, result }: { instance: SignatureInstance; answer: string; result: CheckResult }) => {
    const rb = result.rollback
    if (rb.kind !== 'cycles') return null
    const name = PRODUCTS.find((n) => JSON.stringify(instance.products[n]) === JSON.stringify(rb.perm)) ?? 'AD'
    return (
      <div className="flex flex-col gap-2" data-testid="cycles-feedback" data-product={name}>
        <p className="text-stone-300">
          Your lengths for <Mono>{name}</Mono>: <Mono>{rb.got.join(' ') || 'none'}</Mono>.{' '}
          {[...rb.got].sort((a, b) => b - a).join('.') === rb.expected.join('.')
            ? 'Its cycles, as they are written:'
            : 'Its cycles, the one to recount marked:'}
        </p>
        <p className="text-xs text-stone-400 sm:hidden">Scroll sideways to see every cycle.</p>
        <div className="max-w-full overflow-x-auto" data-testid="signature-cycles-scroll">
          <div className="min-w-[34rem]">
            <CycleDiagram perm={rb.perm} highlightCycle={rb.cycle} testId="signature-cycles" />
          </div>
        </div>
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// lookup and lookup-transfer
// ---------------------------------------------------------------------------

/** The live decrypt of the test message with the machine's settings (keyboard locked: nothing is pressed). */
function Preview({ message, crib }: { message: string; crib: string }): JSX.Element {
  const config = useMachine((s) => s.machine.config)
  const windows = useMachine((s) => positionsToString(s.machine))
  let out = ''
  try {
    out = encipher(createMachine({ ...config, positions: windows }), message).output
  } catch {
    out = ''
  }
  const reads = out.startsWith(crib)
  return (
    <div className="flex flex-col gap-1 rounded-md border border-stone-700 p-2 text-sm" data-testid="trial-preview" data-reads={String(reads)}>
      <div className="text-xs text-stone-400">
        Test message decrypted at {config.rotors.join('-')} · {windows}
      </div>
      <div className="flex gap-2">
        <span className="w-14 shrink-0 text-xs text-stone-400">cipher</span>
        <span className="min-w-0 font-mono break-all text-stone-400">{message}</span>
      </div>
      <div className="flex gap-2">
        <span className="w-14 shrink-0 text-xs text-stone-400">decrypt</span>
        <span className="min-w-0 font-mono break-all text-stone-100" aria-live="polite">
          {out}
        </span>
      </div>
      <div className="text-xs text-stone-400">
        It must begin <Mono>{crib}</Mono>.
      </div>
    </div>
  )
}

function LookupPrompt({ instance, hintLevel }: { instance: LookupInstance; hintLevel: HintLevel }): JSX.Element {
  const transfer = instance.products === null
  return (
    <div className="flex flex-col gap-2">
      {transfer ? (
        <p>
          A new day, and this time only the raw traffic: the first six letters of {instance.indicators.length} messages.
          Read AD, BE and CF off them, count their cycles, look the key up, and find the day&apos;s rotor order and ground
          setting.
        </p>
      ) : (
        <>
          <p>A day of reflector A, rotors I–III in some order, rings 01 and six unknown cables. Its products, read off its indicators:</p>
          <ProductsTable products={instance.products!} />
        </>
      )}
      <p>
        {RULE} Look the key up: the card names every rotor order and ground setting with that characteristic. The day&apos;s
        test message was typed at the ground setting, and its plaintext begins <Mono>{instance.crib}</Mono>. Set the rotor
        order and the windows; the preview decrypts the test message with the day&apos;s own cables. Submit the setting whose
        decrypt begins <Mono>{instance.crib}</Mono>.
      </p>
      {transfer ? null : (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-300">The day&apos;s {instance.indicators.length} indicators</summary>
          <ol className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 font-mono text-stone-400">
            {instance.indicators.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ol>
        </details>
      )}
      {hintLevel >= 1 ? (
        <p className="text-sky-200">
          The highlighted rotors are what you set: the order with the three selectors, the windows with the spinbuttons. A
          card usually lists several settings with the same characteristic; set them one by one and watch the preview: only
          the day&apos;s own setting turns the test message into German.
        </p>
      ) : null}
    </div>
  )
}

type SortBy = 'none' | 0 | 1 | 2

/** The transfer's workbench: the indicators, sortable by the letter a product starts from, and scratch tables. */
function IndicatorWorkbench({ indicators }: { indicators: readonly string[] }): JSX.Element {
  const [sortBy, setSortBy] = useState<SortBy>('none')
  const [tables, setTables] = useState<(number | null)[][]>(() => PRODUCTS.map(() => Array<number | null>(26).fill(null)))
  const shown = useMemo(
    () => (sortBy === 'none' ? [...indicators] : [...indicators].sort((a, b) => a[sortBy]!.localeCompare(b[sortBy]!))),
    [indicators, sortBy],
  )
  return (
    <div className="flex flex-col gap-2" data-testid="transfer-workbench">
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Sort the indicators">
        <span>Sort the indicators by</span>
        {(['none', 0, 1, 2] as const).map((k) => (
          <button
            key={String(k)}
            type="button"
            className={toggleClass(sortBy === k)}
            aria-pressed={sortBy === k}
            data-testid={`transfer-sort-${k}`}
            onClick={() => setSortBy(k)}
          >
            {k === 'none' ? 'arrival' : `letter ${k + 1} (${PRODUCTS[k]})`}
          </button>
        ))}
      </div>
      <ol
        className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 font-mono text-sm text-stone-200"
        data-testid="transfer-indicators"
        aria-label="The day's indicators"
      >
        {shown.map((s, j) => (
          <li key={j}>
            {sortBy === 'none'
              ? s
              : [...s].map((c, k) =>
                  k === sortBy || k === sortBy + 3 ? (
                    <strong key={k} className="text-amber-200">
                      {c}
                    </strong>
                  ) : (
                    <span key={k}>{c}</span>
                  ),
                )}
          </li>
        ))}
      </ol>
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-300">Scratch tables for AD, BE and CF</summary>
        <p className="mt-1 text-xs text-stone-400 sm:hidden">Each table has 26 columns: scroll it sideways.</p>
        <div className="mt-2 flex flex-col gap-3">
          {PRODUCTS.map((n, k) => {
            const t = tables[k]!
            const complete = t.every((v) => v !== null) && new Set(t).size === 26
            return (
              <div key={n} className="flex flex-col gap-1">
                <PermTable
                  perm={t}
                  label={`${n}: the letter in place ${k + 1} → the letter in place ${k + 4}`}
                  editable
                  testId={`scratch-${n}`}
                  onEdit={(i, v) => setTables((all) => all.map((row, j) => (j === k ? row.map((x, c) => (c === i ? v : x)) : row)))}
                />
                <p className="font-mono text-xs break-all text-stone-400">
                  {complete ? notation(t as number[]) : `${t.filter((v) => v !== null).length} of 26 filled`}
                </p>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}

function LookupAnswer({ instance, disabled, submit }: AnswerProps<LookupInstance, MachineConfig>): JSX.Element {
  const api = useMachineApi()
  const [fields, setFields] = useState<string[]>(['', '', ''])
  const transfer = instance.products === null
  return (
    <div className="flex flex-col gap-3" data-testid="lookup-answer">
      {transfer ? <IndicatorWorkbench indicators={instance.indicators} /> : null}
      <KeyBuilder fields={fields} onChange={setFields} disabled={disabled} testId="lookup-key" />
      <CatalogueQuery keyText={keyFromFields(fields)} />
      <p className="text-sm text-stone-400">
        Set the rotor order (the three selectors) and the windows. The keyboard is locked and the lamps are hidden.
      </p>
      <MachinePanel store={api} show={{ rotors: true, keyboard: true, lamps: true }} />
      <Preview message={instance.message} crib={instance.crib} />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}

/** The method on an instance: its key, its card, and the test decrypt of each setting on it. */
function LookupWorked({ instance, solution }: { instance: LookupInstance; solution: MachineConfig }): JSX.Element {
  const key = characteristicOf(dayProducts(instance))
  const cat = useCatalogue(true)
  const card = cat.catalogue?.get(key) ?? null
  const tryIt = (rotors: readonly string[], positions: string) => {
    try {
      return encipher(createMachine({ ...solution, rotors: [...rotors] as MachineConfig['rotors'], positions }), instance.message).output.slice(0, 5)
    } catch {
      return '?????'
    }
  }
  const readers = (card ?? [])
    .filter((e) => tryIt(e.rotors, e.positions) === instance.crib)
    .map((e) => `${e.rotors.join('-')} at ${e.positions}`)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        The day&apos;s key is <Mono>{key}</Mono>.
      </p>
      {card ? (
        <ul className="flex flex-col gap-0.5 font-mono">
          {card.map((e, k) => (
            <li key={k}>
              {e.rotors.join('-')} · {e.positions}: the test message begins {tryIt(e.rotors, e.positions)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-stone-400">Building the catalogue…</p>
      )}
      {readers.length > 1 ? (
        <p>
          <Mono>{readers.join(' and ')}</Mono> make it begin <Mono>{instance.crib}</Mono>: they are the same machine, since a
          middle rotor on its turnover letter steps again, with the left rotor, at the first key press.
        </p>
      ) : (
        <p>
          Only <Mono>{settingText(solution)}</Mono> makes it begin <Mono>{instance.crib}</Mono>.
        </p>
      )}
    </div>
  )
}

const lookup = { Prompt: LookupPrompt, Answer: LookupAnswer, Worked: LookupWorked }

// ---------------------------------------------------------------------------
// set-plugs
// ---------------------------------------------------------------------------

const BLOCK = 12

/** Cipher, the decrypt with the machine's cables, and the known plaintext, in columns; wrong letters marked. */
function PlugsPreview({ instance }: { instance: PlugsInstance }): JSX.Element {
  const plugs = useMachine((s) => s.machine.config.plugboard)
  const out = decryptWith(instance, plugs)
  const right = [...out].filter((c, k) => c === instance.plain[k]).length
  const blocks = Array.from({ length: Math.ceil(out.length / BLOCK) }, (_, b) => b * BLOCK)
  return (
    <div className="flex flex-col gap-1 rounded-md border border-stone-700 p-2 text-sm" data-testid="trial-preview" data-right={right}>
      <div className="text-xs text-stone-400" aria-live="polite">
        Decrypt preview with your cables: {right} of {out.length} letters match the plaintext.
      </div>
      <div className="flex flex-wrap gap-3">
        {blocks.map((b) => (
          <table key={b} className="font-mono text-sm leading-tight">
            <tbody>
              <tr className="text-stone-400">
                <th scope="row" className="pr-1 text-left text-[10px] font-normal">
                  cipher
                </th>
                {[...instance.message.slice(b, b + BLOCK)].map((c, k) => (
                  <td key={k} className="px-px text-center">
                    {c}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-1 text-left text-[10px] font-normal text-stone-400">
                  preview
                </th>
                {[...out.slice(b, b + BLOCK)].map((c, k) => {
                  const wrong = c !== instance.plain[b + k]
                  return (
                    <td key={k} data-wrong={wrong ? 'true' : undefined} className={`px-px text-center ${wrong ? 'text-red-300' : 'text-emerald-200'}`}>
                      {c}
                    </td>
                  )
                })}
              </tr>
              <tr className="text-stone-300">
                <th scope="row" className="pr-1 text-left text-[10px] font-normal text-stone-400">
                  plain
                </th>
                {[...instance.plain.slice(b, b + BLOCK)].map((c, k) => (
                  <td key={k} className="px-px text-center">
                    {c}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}

function PlugsAnswer({ instance, disabled, submit }: AnswerProps<PlugsInstance, MachineConfig>): JSX.Element {
  const api = useMachineApi()
  return (
    <div className="flex flex-col gap-3" data-testid="plugs-answer">
      <MachinePanel store={api} show={{ rotors: true, keyboard: true, lamps: true }} />
      <div className="rounded-xl border border-stone-800 bg-stone-900/40 p-3">
        <PlugboardEditor store={api} maxPairs={instance.maxPlugs} />
      </div>
      <PlugsPreview instance={instance} />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}

const setPlugs = {
  Prompt: ({ instance, hintLevel }: { instance: PlugsInstance; hintLevel: HintLevel }) => {
    const m = instance.setup.machine
    return (
      <div className="flex flex-col gap-2">
        <p>
          The catalogue and a test decrypt have given the day&apos;s rotor order <Mono>{m.rotors.join('-')}</Mono> and ground
          setting <Mono>{m.positions.join('')}</Mono> (reflector A, rings 01): they are set, and locked. The cables are still
          unknown. The test message was typed at that ground setting, and its plaintext is known:
        </p>
        <p className="font-mono break-all text-stone-100">{instance.plain}</p>
        <p>
          Add cables, at most {MAX_PLUGS}, until the preview reads the plaintext. Where the preview shows X but the plaintext
          has p, the cable X–p is a good guess: it is right whenever the cipher letter in that column has no cable. Keep a cable
          if more letters come right; take it out if not.
        </p>
        {hintLevel >= 1 ? (
          <p className="text-sky-200">
            The highlighted plugboard is the only control that is yours. Start with letters that are wrong in several columns:
            a right cable fixes at once every column where its letters meet an unplugged cipher letter.
          </p>
        ) : null}
      </div>
    )
  },
  Answer: PlugsAnswer,
  Worked: ({ instance, solution }: { instance: PlugsInstance; solution: MachineConfig }) => (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Cables <Mono>{solution.plugboard.map((p) => `${p[0]}–${p[1]}`).join(', ')}</Mono>: with them the test message reads{' '}
        <Mono>{decryptWith(instance, solution.plugboard)}</Mono>.
      </p>
      <p>Each came from a column where the preview showed one letter of the cable and the plaintext the other.</p>
    </div>
  ),
}

// ---------------------------------------------------------------------------
// rejewski-parsons
// ---------------------------------------------------------------------------

const parsons = {
  Prompt: () => (
    <p>
      Put Rejewski&apos;s daily routine in order, from the intercepted traffic to a message that reads (drag the blocks, or
      use Alt with the arrow keys).
    </p>
  ),
  Worked: ({ instance, solution }: { instance: { blocks: readonly Choice[] }; solution: string[] }) => (
    <ol className="list-decimal pl-5 text-sm">
      {solution.map((id) => (
        <li key={id}>{instance.blocks.find((b) => b.id === id)?.label}</li>
      ))}
    </ol>
  ),
}

export const ITEM_UI: ItemUiMap = {
  signature,
  lookup,
  'set-plugs': setPlugs,
  'lookup-transfer': lookup,
  'rejewski-parsons': parsons,
}
