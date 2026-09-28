/**
 * Chapter ii8-sheets' ITEM_UI: two estimates (females needed, settings left) with the generic number field, and the
 * fallback stack-to-one, a light table the learner stacks until one setting is lit. Prompts stand alone: they name
 * the search, the share and the rule.
 */

import { useMemo, useState, type JSX } from 'react'
import type { AnswerProps, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { Mono, SubmitButton } from '../../lesson'
import { LightTable } from '../../viz'
import {
  SEARCH_SIZES,
  expected,
  litSettings,
  ringNumber,
  settingName,
  stackSheets,
  type NeededInstance,
  type StackAnswer,
  type StackInstance,
  type SurvivorsInstance,
} from './gates'
import { Indicator } from './scenes/Females'

const fmt = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1))
const what = (n: number) => SEARCH_SIZES.find((s) => s.n === n)?.what ?? `${n.toLocaleString('en-US')} settings`

const SHARE_RULE =
  'Every female adds a sheet, and a sheet lets light through at a share p of the settings still lit, whatever the ' +
  'sheets before it left.'

const femalesNeeded = {
  Prompt: ({ instance, hintLevel }: { instance: NeededInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        The search covers {what(instance.n)}. {SHARE_RULE} Here p = <Mono>{instance.p}</Mono>.
      </p>
      <p>How many females must be stacked, at least, until no more than two settings are expected to be left?</p>
      {hintLevel >= 1 ? (
        <p className="text-sky-200">
          After k sheets about N × pᵏ settings are left. Look for the smallest k with N × pᵏ ≤ 2; logarithms turn it into
          k ≥ log(N/2) ÷ log(1/p).
        </p>
      ) : null}
    </div>
  ),
  Worked: ({ instance, solution }: { instance: NeededInstance; solution: number[] }) => {
    const k = solution[0]!
    return (
      <p className="text-sm">
        log({instance.n.toLocaleString('en-US')} ÷ 2) ÷ log(1 ÷ {instance.p}) ={' '}
        {(Math.log(instance.n / 2) / Math.log(1 / instance.p)).toFixed(2)}, so <Mono>{k}</Mono> females: {fmt(expected(instance.n, instance.p, k - 1))}{' '}
        settings would still be left after {k - 1}, {fmt(expected(instance.n, instance.p, k))} after {k}.
      </p>
    )
  },
}

const survivors = {
  Prompt: ({ instance, hintLevel }: { instance: SurvivorsInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        The search covers {what(instance.n)}. {SHARE_RULE} Here p = <Mono>{instance.p}</Mono>.
      </p>
      <p>About how many settings are still lit after {instance.k} sheets?</p>
      {hintLevel >= 1 ? (
        <p className="text-sky-200">The shares multiply: the first sheet keeps N × p, the second keeps p of that, and so on.</p>
      ) : null}
    </div>
  ),
  Worked: ({ instance, solution }: { instance: SurvivorsInstance; solution: number[] }) => (
    <p className="text-sm">
      {instance.n.toLocaleString('en-US')} × {instance.p}
      <sup>{instance.k}</sup> ≈ <Mono>{fmt(solution[0]!)}</Mono> settings.
    </p>
  ),
}

function StackPrompt({ instance }: { instance: StackInstance }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        A day of wheel order <Mono>{instance.rotors.join('-')}</Mono>, left ring <Mono>{ringNumber(instance.leftRing)}</Mono>{' '}
        (these are its right sheets). Its females, each a starting position in clear and an indicator:
      </p>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {instance.females.map((m, k) => (
          <li key={k} className="flex gap-2">
            <span className="w-5 text-right text-xs text-stone-400">{k + 1}.</span>
            <Mono>{m.setting}</Mono>
            <Indicator m={m} />
          </li>
        ))}
      </ol>
      <p>
        Stack their sheets on the light table, one at a time, and stop at the first sheet that leaves exactly one setting
        lit. Then submit.
      </p>
    </div>
  )
}

function StackAnswerView({ instance, disabled, submit }: AnswerProps<StackInstance, StackAnswer>): JSX.Element {
  const sheets = useMemo(() => stackSheets(instance), [instance])
  const [shown, setShown] = useState(0)
  const lit = useMemo(() => litSettings(instance.females[0]!, sheets, shown), [instance, sheets, shown])
  return (
    <div className="flex flex-col gap-3" data-testid="stack-answer">
      <LightTable sheets={sheets} size={51} shown={shown} onShown={setShown} testId="stack-table" />
      <p className="text-sm text-stone-300" aria-live="polite" data-testid="stack-lit" data-count={lit.length}>
        {shown === 0
          ? 'No sheet stacked yet.'
          : `${shown} sheet${shown === 1 ? '' : 's'}: ${lit.length} setting${lit.length === 1 ? '' : 's'} lit${
              lit.length <= 4 ? ` (${lit.map(settingName).join('; ')})` : ''
            }.`}
      </p>
      <div>
        <SubmitButton disabled={disabled || shown === 0} onClick={() => submit([shown, lit.length === 1 ? lit[0]! : -1])} />
      </div>
    </div>
  )
}

const stackToOne = {
  Prompt: StackPrompt,
  Answer: StackAnswerView,
  Worked: ({ instance, solution }: { instance: StackInstance; solution: StackAnswer }) => (
    <p className="text-sm">
      After {solution[0]} of the {instance.females.length} sheets only one setting is lit: {settingName(solution[1])}. One sheet
      fewer left {litSettings(instance.females[0]!, stackSheets(instance), solution[0] - 1).length}.
    </p>
  ),
}

export const ITEM_UI: ItemUiMap = {
  'females-needed': femalesNeeded,
  survivors,
  'stack-to-one': stackToOne,
}
