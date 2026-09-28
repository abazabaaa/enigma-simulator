/**
 * The fixture chapter's ITEM_UI: a Prompt that makes every instance solvable from the screen, a Worked
 * example, the custom item's Answer, and the Feedback its cycles rollback needs. Chapter builders copy this.
 */

import { useEffect, useState, type JSX } from 'react'
import type { Letter } from '../../contracts/core'
import type { AnswerProps, CheckResult, ItemUiMap } from '../../contracts/lesson'
import type { PartId } from '../../contracts/stage'
import { LETTERS, ROTORS, createMachine, positionsToString, pressKey } from '../../engine'
import { useToyStore } from '../../state/toyStore'
import { partName } from '../kinds/widgets'
import { LetterTable, Mono, QUIET_BUTTON, SubmitButton } from '../ui/controls'
import {
  permString,
  toyLampAt,
  toyStagePerms,
  toySlots,
  type ChainInstance,
  type GhostInstance,
  type LampsInstance,
  type LengthsInstance,
  type StepsInstance,
  type ToyLampInstance,
  type ToySetInstance,
  type WindowsInstance,
} from './gates'
import type { ToySpec } from '../../contracts/machine'
import { RECALL_UI } from '../recall/items'

const L = (i: number): Letter => LETTERS[i]!
const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')
const TURNOVERS = (['I', 'II', 'III', 'IV', 'V'] as const).map((r) => `${r} ${ROTORS[r].turnovers}`).join(', ')

/** The toy's tables: each rotor forward at its offset, and the reflector (read a table upwards to go back). */
function ToyTables({ spec }: { spec: ToySpec }): JSX.Element {
  const perms = toyStagePerms(spec)
  const slots = toySlots(spec.rotors.length)
  const k = spec.rotors.length
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: k }, (_, j) => {
        const slot = slots[k - 1 - j]!
        return (
          <LetterTable
            key={slot}
            images={permString(perms[1 + j]!)}
            label={`${slot} rotor, towards the reflector`}
            n={spec.n}
          />
        )
      })}
      <LetterTable images={permString(perms[1 + k]!)} label="reflector" n={spec.n} />
      <p className="text-xs text-stone-400">
        On the way back, read each rotor table from the bottom row to the top row.
      </p>
    </div>
  )
}

function MachineLine({ c }: { c: WindowsInstance['config'] }): JSX.Element {
  return (
    <p>
      Rotors <Mono>{c.rotors.join(' ')}</Mono> (left to right), rings <Mono>{c.rings.map(ring).join(' ')}</Mono>,
      windows <Mono>{c.positions.join('')}</Mono>. Turnover letters: {TURNOVERS}.
    </p>
  )
}

// ---------------------------------------------------------------------------

const toyLamp = {
  Prompt: ({ instance }: { instance: ToyLampInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        A toy machine on the letters A–F with two rotors that do not turn. Press <Mono>{instance.key}</Mono>: which lamp
        lights?
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ToyLampInstance; solution: Letter }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Key {instance.key} on this toy: <Mono>{toyLampPath(instance)}</Mono>, so lamp <Mono>{solution}</Mono> lights.
        Follow each hop in its table:
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
}

function toyLampPath(i: { spec: ToySpec; key: Letter }): string {
  const perms = toyStagePerms(i.spec)
  let x = LETTERS.indexOf(i.key)
  const out = [L(x)]
  for (const p of perms.slice(1, -1)) {
    x = p[x]!
    out.push(L(x))
  }
  return out.join(' → ')
}

const windows = {
  Prompt: ({ instance }: { instance: WindowsInstance }) => (
    <div className="flex flex-col gap-1">
      <MachineLine c={instance.config} />
      <p>The keyboard is locked. Type the windows after each of the next three key presses (9 letters).</p>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: WindowsInstance; solution: string }) => {
    let s = createMachine(instance.config)
    const seq = [0, 1, 2].map(() => positionsToString((s = pressKey(s, 'A').state)))
    return (
      <div className="text-sm">
        <MachineLine c={instance.config} />
        <p>
          Press by press: <Mono>{seq.join(' → ')}</Mono>. Answer <Mono>{solution}</Mono>.
        </p>
      </div>
    )
  },
}

const lengths = {
  Prompt: ({ instance }: { instance: LengthsInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        a and b swap the first {instance.n} letters in pairs. List the cycle lengths of ab (a first, then b), longest
        first.
      </p>
      <LetterTable images={permString(instance.a)} label="a" />
      <LetterTable images={permString(instance.b)} label="b" />
    </div>
  ),
  Worked: ({ solution }: { instance: LengthsInstance; solution: number[] }) => (
    <p className="text-sm">
      Follow A through a then b until it comes back, then the first letter not yet visited, and so on. Lengths:{' '}
      <Mono>{solution.join(' ')}</Mono>. They come in equal pairs.
    </p>
  ),
  Feedback: ({ result }: { instance: LengthsInstance; answer: number[]; result: CheckResult }) =>
    result.rollback.kind === 'cycles' ? (
      <p className="text-sm" data-testid="cycles-feedback">
        Walk this cycle: <Mono>({result.rollback.cycle.map(L).join(' ')})</Mono>, {result.rollback.cycle.length}{' '}
        letters. You counted <Mono>{result.rollback.got.join(' ') || 'nothing'}</Mono>.
      </p>
    ) : null,
}

const self = {
  Prompt: () => <p>Can an Enigma I ever encipher a letter to itself?</p>,
  Worked: () => (
    <p className="text-sm">
      No. The reflector pairs every contact with a different one, so the current can never come back on the wire it went
      in on.
    </p>
  ),
}

const pressOrder = {
  Prompt: () => <p>Put the stages of a key press in order.</p>,
  Worked: ({ solution }: { instance: unknown; solution: string[] }) => (
    <p className="text-sm">In order: {solution.join(', ')}.</p>
  ),
}

const toyChain = {
  Prompt: ({ instance }: { instance: ChainInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        The same kind of toy (A–F, rotors held, no cables). Follow key <Mono>{instance.key}</Mono>: type the letter that
        leaves each stage.
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ChainInstance; solution: string[] }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {instance.key} → {solution.join(' → ')}, one table per stage:
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
}

function StepsPrompt({ instance }: { instance: StepsInstance }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <MachineLine c={instance.setup.machine} />
      <p>
        Turn the rotors so that the <strong>{instance.target}</strong> rotor steps on the next key press. The keyboard
        is locked: set the windows, then submit.
      </p>
    </div>
  )
}

const steps = {
  Prompt: StepsPrompt,
  Worked: ({ instance, solution }: { instance: StepsInstance; solution: { positions: readonly string[] } }) => (
    <p className="text-sm">
      {instance.target === 'middle'
        ? 'The middle rotor steps when the right rotor shows its turnover letter.'
        : 'The left rotor steps when the middle rotor shows its turnover letter.'}{' '}
      For example windows <Mono>{solution.positions.join('')}</Mono>.
    </p>
  ),
}

const whichWrong = {
  Prompt: ({ instance }: { instance: GhostInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        Key <Mono>{instance.key}</Mono> on rotors <Mono>{instance.config.rotors.join(' ')}</Mono>, windows{' '}
        <Mono>{instance.config.positions.join('')}</Mono>, cables{' '}
        <Mono>{instance.config.plugboard.join(' ') || 'none'}</Mono>. One part of the red path is faulty. Where does it
        first go wrong? Each hop's correct table is shown.
      </p>
      <ol className="flex flex-col gap-1 text-xs">
        {instance.ghost.hops.map((h, k) => (
          <li key={k} className="flex flex-col">
            <span>
              {k + 1}. {h.stage}: <Mono>{h.input}</Mono> → <Mono>{h.output}</Mono>
            </span>
            <LetterTable images={instance.tables[k]!} />
          </li>
        ))}
      </ol>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: GhostInstance; solution: PartId }) => (
    <p className="text-sm">
      Hop {instance.ghost.divergeAt + 1} ({instance.ghost.hops[instance.ghost.divergeAt]!.stage}) does not match its
      table: the fault is in the {partName(solution)}.
    </p>
  ),
}

const double = {
  Prompt: () => <p>Write a function and predict what it returns before you run it.</p>,
  // Never the reference source or this instance's probe: the method on other numbers only.
  Worked: () => <p className="text-sm">Multiply by two: double(5) returns 10, double(−3) returns −6.</p>,
}

/** The custom item's Answer: turn the toy rotor with the buttons (the stage follows), then submit. */
function ToySetAnswer({ instance, disabled, submit }: AnswerProps<ToySetInstance, number>): JSX.Element {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    useToyStore.getState().setSpec({ ...instance.spec, positions: [pos] })
  }, [instance, pos])
  const n = instance.spec.n
  return (
    <div className="flex flex-col gap-3" data-testid="toy-set">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={QUIET_BUTTON}
          data-testid="toy-set-dec"
          aria-label="Turn the rotor back"
          disabled={disabled}
          onClick={() => setPos((p) => (p + n - 1) % n)}
        >
          −
        </button>
        <span
          data-testid="toy-set-window"
          role="status"
          aria-label={`Window ${L(pos)}`}
          className="w-8 text-center font-mono text-lg"
        >
          {L(pos)}
        </span>
        <button
          type="button"
          className={QUIET_BUTTON}
          data-testid="toy-set-inc"
          aria-label="Turn the rotor on"
          disabled={disabled}
          onClick={() => setPos((p) => (p + 1) % n)}
        >
          +
        </button>
      </div>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(pos)} />
      </div>
    </div>
  )
}

const toySet = {
  Prompt: ({ instance }: { instance: ToySetInstance }) => {
    const wiring = permString(instance.spec.rotors[0]!)
    return (
      <div className="flex flex-col gap-2">
        <p>
          A toy with one rotor on A–F. Turn the rotor so that key <Mono>{instance.key}</Mono> lights{' '}
          <Mono>{instance.target}</Mono>. The keyboard is locked: work it out from the tables. At window W the rotor's
          wiring is shifted by W places.
        </p>
        <LetterTable images={wiring} label="rotor wiring at window A" n={6} />
        <LetterTable images={permString(instance.spec.reflector)} label="reflector" n={6} />
      </div>
    )
  },
  Answer: ToySetAnswer,
  Worked: ({ instance, solution }: { instance: ToySetInstance; solution: number }) => (
    <p className="text-sm">
      At window <Mono>{L(solution)}</Mono>, {instance.key} lights {toyLampAt(instance, solution)}.
    </p>
  ),
}

const puzzleLamps = {
  Prompt: ({ instance }: { instance: LampsInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        A one-rotor toy on A–F, rotor held. Which lamps light for the keys <Mono>{instance.keys.join(', ')}</Mono>?
        (three letters, in that order)
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: LampsInstance; solution: string }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {instance.keys.map((k, j) => `${k} → ${solution[j]}`).join('; ')}. For example{' '}
        <Mono>{toyLampPath({ spec: instance.spec, key: instance.keys[0]! })}</Mono> through these tables:
      </p>
      <ToyTables spec={instance.spec} />
    </div>
  ),
}

export const ITEM_UI: ItemUiMap = {
  'toy-lamp': toyLamp,
  windows,
  lengths,
  self,
  'press-order': pressOrder,
  'toy-chain': toyChain,
  'middle-steps': steps,
  'left-steps': steps,
  'which-wrong': whichWrong,
  double,
  'toy-set': toySet,
  'puzzle-lamps': puzzleLamps,
  'puzzle-set': toySet,
  // Gate lab 'plugs': the recall pool's own item UIs.
  'r-plug-to-hit': RECALL_UI['r-plug-to-hit']!,
  'r-plug-one': RECALL_UI['r-plug-one']!,
  'r-windows': RECALL_UI['r-windows']!,
}
