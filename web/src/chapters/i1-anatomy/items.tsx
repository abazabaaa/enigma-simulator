/**
 * Chapter i1-anatomy's ITEM_UI: Prompts that make every instance solvable from the screen (every table at its
 * offset, the path's order for the toy, the M4's layout for the transfer), Worked examples (L2 on another
 * instance, L3 on the current one) and the toy-set fallback's Answer: two rotor pickers that turn the toy on the
 * stage, with the keyboard locked and the lamps covered.
 */

import { useEffect, useState, type JSX } from 'react'
import type { Choice, Letter } from '../../contracts/core'
import type { AnswerProps, ItemUiMap } from '../../contracts/lesson'
import type { ToySpec } from '../../contracts/machine'
import type { PartId } from '../../contracts/stage'
import { LETTERS } from '../../engine'
import { Mono, QUIET_BUTTON, SubmitButton } from '../../lesson'
import { SYM_FOR_PART, type Sym } from '../../lib/symbols'
import { toyPress, toySlots } from '../../lib/toy'
import { PermTable } from '../../machine-ui'
import { useToyStore } from '../../state/toyStore'
import {
  STAGE_LABEL,
  strips,
  toyLampAt,
  toyTables,
  traceOf,
  type ChainInstance,
  type OrderInstance,
  type ToyLampInstance,
  type ToySetInstance,
} from './gates'

const L = (i: number): Letter => LETTERS[i]!
const SLOT_TEXT: Readonly<Record<string, string>> = { left: 'Left', middle: 'Middle', right: 'Right', reflector: 'Reflector' }
const symOf = (part: string): Sym | undefined => SYM_FOR_PART[part as PartId]

/** The toy's tables: each rotor's forward table at its window (right first), then the reflector. */
export function ToyTables({ spec, testId = 'toy-table' }: { spec: ToySpec; testId?: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4">
        {toyTables(spec).map((t) => {
          const part = t.slot === 'reflector' ? 'reflector' : `rotor-${t.slot}`
          const sym = symOf(part)
          return (
            <PermTable
              key={t.slot}
              perm={t.perm}
              n={spec.n}
              {...(sym ? { sym } : {})}
              label={t.slot === 'reflector' ? 'Reflector (swaps pairs)' : `${SLOT_TEXT[t.slot]} rotor at window ${L(spec.positions[toySlots(spec.rotors.length).indexOf(t.slot as never)]!)}`}
              testId={`${testId}-${t.slot}`}
            />
          )
        })}
      </div>
      <p className="text-xs text-stone-400">
        On the way in, find the letter in the upper row and read the letter below it. On the way back through a rotor, find the
        letter in the lower row and read the letter above it.
      </p>
    </div>
  )
}

/** key → right rotor → middle rotor → reflector → middle rotor, back → right rotor, back → lamp, letter by letter. */
function ToyPath({ spec, keyLetter }: { spec: ToySpec; keyLetter: Letter }): JSX.Element {
  const hops = toyPress(spec, keyLetter).hops.filter((h) => h.kind !== 'plugboard')
  const name = (stage: string) =>
    stage === 'reflector' ? 'reflector' : `${stage.split('-')[1]} rotor${stage.endsWith('-bwd') ? ', back' : ''}`
  return (
    <p className="font-mono text-sm" data-testid="toy-path">
      {keyLetter}
      {hops.map((h, k) => (
        <span key={k}>
          {' '}
          → <span className="font-sans text-xs text-stone-400">{name(h.stage)}</span> {h.output}
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------

const toyLamp = {
  Prompt: ({ instance }: { instance: ToyLampInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        A toy machine on the letters A–F: two rotors that do not turn, a reflector, no cables. The current goes from the key
        through the right rotor, the middle rotor, the reflector, back through the middle rotor and the right rotor, to a lamp.
      </p>
      <p>
        Press <Mono>{instance.key}</Mono>. Which lamp lights?
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ToyLampInstance; solution: Letter }) => (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Key <Mono>{instance.key}</Mono> on this toy, hop by hop:
      </p>
      <ToyTables spec={instance.spec} testId="worked-table" />
      <ToyPath spec={instance.spec} keyLetter={instance.key} />
      <p>
        So lamp <Mono>{solution}</Mono> lights.
      </p>
    </div>
  ),
}

// ---------------------------------------------------------------------------

const ringText = (rings: readonly string[]) => rings.map((r) => String(LETTERS.indexOf(r as Letter) + 1).padStart(2, '0')).join(' ')

/** The strips of a machine at its offsets: plugboard and entry wheel (straight through), R, M, L, reflector. */
export function Strips({ config, highlight = {}, testId = 'strip' }: { config: ChainInstance['config']; highlight?: Partial<Record<PartId, number>>; testId?: string }): JSX.Element {
  const shown = strips(config).filter((s) => s.part !== 'plugboard' && s.part !== 'etw')
  const name = (part: PartId) =>
    part === 'reflector'
      ? `Reflector UKW-${config.reflector}`
      : `${SLOT_TEXT[part.split('-')[1]!]} rotor ${config.rotors[['left', 'middle', 'right'].indexOf(part.split('-')[1]!)]} at window ${config.positions[['left', 'middle', 'right'].indexOf(part.split('-')[1]!)]}`
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-stone-400">
        The plugboard has no cables and the entry wheel is wired A to A, B to B…: both pass every letter straight through.
      </p>
      {shown.map((s) => {
        const sym = symOf(s.part)
        const h = highlight[s.part]
        return (
          <PermTable
            key={s.part}
            perm={s.perm}
            {...(sym ? { sym } : {})}
            label={name(s.part)}
            {...(h !== undefined ? { highlight: [h] } : {})}
            testId={`${testId}-${s.part}`}
          />
        )
      })}
      <p className="text-xs text-stone-400">
        Each rotor strip is read downwards on the way in (upper row → lower row) and upwards on the way back (find the letter in
        the lower row, read the one above it). The reflector swaps pairs.
      </p>
    </div>
  )
}

function MachineLine({ config }: { config: ChainInstance['config'] }): JSX.Element {
  return (
    <p>
      Enigma I, reflector UKW-{config.reflector}, rotors <Mono>{config.rotors.join(' ')}</Mono> (left to right), rings{' '}
      <Mono>{ringText(config.rings)}</Mono>, windows <Mono>{config.positions.join('')}</Mono>, no cables. The rotors are held:
      they do not step.
    </p>
  )
}

const hopChain = {
  Prompt: ({ instance }: { instance: ChainInstance }) => (
    <div className="flex flex-col gap-2">
      <MachineLine config={instance.config} />
      <p>
        Press <Mono>{instance.key}</Mono>. Type the letter that leaves each of the 11 stages.
      </p>
      <Strips config={instance.config} />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ChainInstance; solution: string[] }) => (
    <div className="flex flex-col gap-1 text-sm">
      <MachineLine config={instance.config} />
      <ol className="flex flex-col font-mono">
        {traceOf(instance.config, instance.key).map((h, k) => (
          <li key={k}>
            <span className="font-sans text-stone-400">{STAGE_LABEL[h.stage]}:</span> {h.input} → {solution[k]}
          </li>
        ))}
      </ol>
    </div>
  ),
}

// ---------------------------------------------------------------------------

const OrderWorked = ({ instance, solution }: { instance: OrderInstance; solution: string[] }) => {
  const label = (id: string) => instance.blocks.find((b: Choice) => b.id === id)?.label ?? id
  return (
    <ol className="list-decimal pl-5 text-sm">
      {solution.map((id) => (
        <li key={id}>{label(id)}</li>
      ))}
    </ol>
  )
}

const pathOrder = {
  Prompt: () => (
    <p>
      A key closes the circuit and the current sets off from the battery. Put the parts it crosses in order, from the key to the
      lamp. Some parts are crossed more than once: their blocks look the same.
    </p>
  ),
  Worked: OrderWorked,
}

const pathOrderM4 = {
  Prompt: () => (
    <div className="flex flex-col gap-1">
      <p>
        The navy&apos;s M4 has a fourth rotor. This Greek rotor sits between the left rotor and a thin reflector, and never steps.
        Everything else is as on the Enigma I.
      </p>
      <p>Put the parts one key press crosses on an M4 in order, from the key to the lamp.</p>
    </div>
  ),
  Worked: OrderWorked,
}

// ---------------------------------------------------------------------------

/** The toy-set fallback's prompt: the tables follow the rotors as the learner turns them. */
function ToySetPrompt({ instance }: { instance: ToySetInstance }): JSX.Element {
  const live = useToyStore((s) => s.spec)
  const spec = live.n === instance.spec.n && live.rotors.length === instance.spec.rotors.length ? { ...instance.spec, positions: live.positions } : instance.spec
  return (
    <div className="flex flex-col gap-2">
      <p>
        A toy on A–F with two rotors, held. The keyboard is locked and the lamps are covered. Turn the rotors so that key{' '}
        <Mono>{instance.key}</Mono> lights lamp <Mono>{instance.target}</Mono>, then submit. The tables and the stage follow the
        rotors as you turn them.
      </p>
      <ToyTables spec={spec} testId="toy-set-table" />
    </div>
  )
}

/** Two rotor pickers (middle, right) that set the toy's windows; the stage follows. */
function ToySetAnswer({ instance, disabled, submit }: AnswerProps<ToySetInstance, number[]>): JSX.Element {
  const [pos, setPos] = useState<number[]>(() => [...instance.spec.positions])
  const n = instance.spec.n
  const slots = toySlots(instance.spec.rotors.length)
  useEffect(() => {
    useToyStore.getState().setSpec({ ...instance.spec, positions: pos })
  }, [instance, pos])
  const turn = (k: number, d: number) => setPos((p) => p.map((x, j) => (j === k ? (x + d + n) % n : x)))
  return (
    <div className="flex flex-col gap-3" data-testid="toy-set">
      <div className="flex flex-wrap gap-4">
        {slots.map((slot, k) => (
          <div key={slot} className="flex items-center gap-2" role="group" aria-label={`${SLOT_TEXT[slot]} rotor`}>
            <span className="text-sm text-stone-300">{SLOT_TEXT[slot]} rotor</span>
            <button type="button" className={QUIET_BUTTON} data-testid={`toy-set-${slot}-dec`} aria-label={`Turn the ${slot} rotor back`} disabled={disabled} onClick={() => turn(k, -1)}>
              −
            </button>
            <span data-testid={`toy-set-${slot}-window`} className="w-8 text-center font-mono text-lg" aria-live="polite" aria-label={`${SLOT_TEXT[slot]} window ${L(pos[k]!)}`}>
              {L(pos[k]!)}
            </span>
            <button type="button" className={QUIET_BUTTON} data-testid={`toy-set-${slot}-inc`} aria-label={`Turn the ${slot} rotor on`} disabled={disabled} onClick={() => turn(k, 1)}>
              +
            </button>
          </div>
        ))}
      </div>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(pos)} />
      </div>
    </div>
  )
}

const toySet = {
  Prompt: ToySetPrompt,
  Answer: ToySetAnswer,
  Worked: ({ instance, solution }: { instance: ToySetInstance; solution: number[] }) => (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        At windows <Mono>{solution.map(L).join('')}</Mono>, key {instance.key} follows this path:
      </p>
      <ToyPath spec={{ ...instance.spec, positions: solution }} keyLetter={instance.key} />
      <p>
        It lights {toyLampAt(instance.spec, instance.key, solution)}.
      </p>
    </div>
  ),
}

export const ITEM_UI: ItemUiMap = {
  'toy-lamp': toyLamp,
  'hop-chain': hopChain,
  'path-order': pathOrder,
  'path-order-m4': pathOrderM4,
  'toy-set': toySet,
}
