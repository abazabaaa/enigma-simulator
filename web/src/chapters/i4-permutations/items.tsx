/**
 * Chapter i4-permutations' ITEM_UI. Every Prompt makes its instance solvable from the screen: the tables each part
 * applies (Rejewski's symbols in their parts' colours), the machine setting, the key. which-wrong and hop-chain-full
 * bring their own Answers: which-wrong draws nothing on the stage while the question is open (the ghost appears only in
 * the rollback), and hop-chain-full shows the rotor tables for the windows the learner typed, then moves the machine
 * to the true windows for the rollback, so the engine's path is drawn against the learner's letters.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { Letter } from '../../contracts/core'
import type { AnswerProps, HintLevel, ItemUiMap } from '../../contracts/lesson'
import type { PartId } from '../../contracts/stage'
import { LETTERS, ROTORS, createMachine, withPositions, type MachineConfig } from '../../engine'
import { INPUT, LetterTable, Mono, QUIET_BUTTON, SubmitButton, partName } from '../../lesson'
import { Sym } from '../../lib/Sym'
import { symForStage } from '../../lib/symbols'
import { useMachineApi } from '../../state/activeMachine'
import {
  COMPONENTS,
  COMPONENT_NAME,
  FACTORS,
  PROBE_HOP,
  STAGES,
  componentPerm,
  faultyHop,
  hopTables,
  keypressHops,
  keypressProbe,
  referenceHops,
  stateOf,
  steppedConfig,
  windowsAfterStep,
  type ChainFullInstance,
  type KeypressInstance,
  type WhichWrongInstance,
} from './gates'

const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')
const perm = (p: readonly number[]) => p.map((x) => LETTERS[x]).join('')

function Setting({ c, windows = true }: { c: Pick<MachineConfig, 'rotors' | 'rings' | 'positions' | 'plugboard'>; windows?: boolean }): JSX.Element {
  return (
    <span>
      rotors <Mono>{c.rotors.join(' ')}</Mono> (left to right), rings <Mono>{c.rings.map(ring).join(' ')}</Mono>
      {windows ? (
        <>
          , windows <Mono>{c.positions.join('')}</Mono>
        </>
      ) : null}
      , cables <Mono>{c.plugboard.join(' ') || 'none'}</Mono>
    </span>
  )
}

/** The six components as tables at the machine's windows (on the way back each table is read upwards). */
function ComponentTables({ config, windows }: { config: MachineConfig; windows: string }): JSX.Element {
  const state = withPositions(createMachine(config), windows)
  return (
    <div className="flex flex-col gap-1" data-testid="prompt-tables">
      {COMPONENTS.map((s) => (
        <LetterTable
          key={s}
          images={perm(componentPerm(state, s))}
          label={
            <span>
              <Sym s={s} /> {COMPONENT_NAME[s]}
            </span>
          }
        />
      ))}
      <p className="text-xs text-stone-400">On the way back, read a rotor&apos;s table from the bottom row up (its inverse).</p>
    </div>
  )
}

/** One press, hop by hop: key → letter after each part. */
function HopLine({ hops, mark }: { hops: readonly { stage: string; input: string; output: string }[]; mark?: number }): JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-1 font-mono">
      <span>{hops[0]?.input}</span>
      {hops.map((h, k) => (
        <span key={k} className="flex items-center gap-1">
          <span className="text-stone-500">→</span>
          <Sym s={symForStage(h.stage as never)} inv={FACTORS[k]?.inv} />
          <span className={k === mark ? 'underline' : ''}>{h.output}</span>
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// keypress (code)
// ---------------------------------------------------------------------------

const configOfInstance = (i: KeypressInstance): MachineConfig => ({
  model: 'I',
  reflector: i.state.reflector,
  rotors: i.state.rotors,
  rings: [...i.state.rings] as Letter[],
  positions: [...i.state.positions] as Letter[],
  plugboard: i.state.plugboard,
})

const keypress = {
  Prompt: ({ instance, hintLevel }: { instance: KeypressInstance; hintLevel: HintLevel }) => {
    const c = configOfInstance(instance)
    const after = windowsAfterStep(c)
    return (
      <div className="flex flex-col gap-2">
        <p>
          The prediction&apos;s press: <Setting c={c} />, reflector {c.reflector}, key <Mono>{instance.key}</Mono>. The press turns the
          windows to <Mono>{after}</Mono> first; the stage shows the machine there, and these are its parts at those windows:
        </p>
        <ComponentTables config={c} windows={after} />
        <p>
          Before you run your code, predict the letter that leaves the middle rotor on the way back (<Sym s="M" inv />, hop{' '}
          {PROBE_HOP + 1} of 11) when this state presses <Mono>{instance.key}</Mono>. It locks when you run.
        </p>
        {hintLevel >= 1 ? (
          <p className="text-sky-200" data-testid="keypress-hint">
            The current meets <Sym s="S" />, <Sym s="H" />, <Sym s="N" />, <Sym s="M" />, <Sym s="L" />, <Sym s="U" />, then{' '}
            <Sym s="L" inv />, <Sym s="M" inv />: the prediction is the eighth letter along.
          </p>
        ) : null}
      </div>
    )
  },
  // Another press, hop by hop, and the order the parts are called in; never the reference code.
  Worked: ({ instance }: { instance: KeypressInstance }) => {
    const c = configOfInstance(instance)
    const hops = referenceHops(instance.state, instance.key)
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <Setting c={c} />, key <Mono>{instance.key}</Mono>. The press first turns the windows to <Mono>{windowsAfterStep(c)}</Mono>;
          then the letter passes every part in turn:
        </p>
        <HopLine hops={hops} mark={PROBE_HOP} />
        <p>
          The underlined letter leaves <Sym s="M" inv />: <Mono>{keypressProbe(instance)}</Mono>. A keypress function does the same:
          step first, then plugboard, entry wheel, the rotors right to left, the reflector, the rotors left to right, entry wheel,
          plugboard, and it returns the last letter with the stepped windows.
        </p>
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// which-wrong (ghost-pick)
// ---------------------------------------------------------------------------

/** Pick a part, then Submit. Nothing is drawn on the stage while the question is open. */
function WhichWrongAnswer({ instance, disabled, submit }: AnswerProps<WhichWrongInstance, PartId>): JSX.Element {
  const [pick, setPick] = useState<PartId | null>(null)
  return (
    <div className="flex flex-col gap-3" data-testid="which-wrong-answer">
      <div className="flex flex-wrap gap-2" role="group" aria-label="The part where the path first goes wrong">
        {instance.options.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`ghost-pick-${p}`}
            aria-pressed={pick === p}
            disabled={disabled}
            className={`${QUIET_BUTTON} ${pick === p ? 'border-amber-400 text-amber-200' : ''}`}
            onClick={() => setPick(p)}
          >
            {partName(p)}
          </button>
        ))}
      </div>
      <div>
        <SubmitButton disabled={disabled || !pick} onClick={() => pick && submit(pick)} />
      </div>
    </div>
  )
}

function WhichWrongPrompt({ instance }: { instance: WhichWrongInstance }): JSX.Element {
  const c = instance.config
  const tables = hopTables(c)
  return (
    <div className="flex flex-col gap-2">
      <p>
        A keypress function with one bug pressed <Mono>{instance.key}</Mono> on a machine with <Setting c={c} />. The rotors should
        step to <Mono>{windowsAfterStep(c)}</Mono> first. Below, hop by hop, is the path it recorded, and under each hop the table that
        part applies on a correct press. Where does the path first go wrong?
      </p>
      <ol className="flex flex-col gap-2 text-xs" data-testid="which-wrong-hops">
        {instance.ghost.hops.map((h, k) => (
          <li key={k} className="flex flex-col gap-0.5">
            <span className="text-sm">
              {k + 1}. <Sym s={symForStage(STAGES[k]!)} inv={FACTORS[k]!.inv} /> {STAGES[k]}: <Mono>{h.input}</Mono> →{' '}
              <Mono>{h.output}</Mono>
            </span>
            <LetterTable images={perm(tables[k]!)} />
          </li>
        ))}
      </ol>
    </div>
  )
}

const whichWrong = {
  Prompt: WhichWrongPrompt,
  Answer: WhichWrongAnswer,
  Worked: ({ instance, solution }: { instance: WhichWrongInstance; solution: PartId }) => {
    const k = faultyHop(instance)
    const ref = keypressHops(instance.config, instance.key, null)[k]!
    return (
      <p className="text-sm">
        Every hop up to hop {k} matches its table. Hop {k + 1} ({STAGES[k]}) should send <Mono>{ref.input}</Mono> to{' '}
        <Mono>{ref.output}</Mono>, but the path shows <Mono>{instance.ghost.hops[k]!.output}</Mono>: the fault is in the{' '}
        {partName(solution).toLowerCase()}.
      </p>
    )
  },
}

// ---------------------------------------------------------------------------
// hop-chain-full (chain, own Answer)
// ---------------------------------------------------------------------------

const TURNOVERS = (['I', 'II', 'III', 'IV', 'V'] as const).map((r) => `${r} ${ROTORS[r].turnovers}`).join(', ')

/** The rotor tables at windows the learner typed (and the fixed parts), for the letters after each stage. */
function TablesAt({ config, windows }: { config: MachineConfig; windows: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-stone-400">
        The parts at windows <Mono>{windows}</Mono> (the windows you typed):
      </p>
      <ComponentTables config={config} windows={windows} />
    </div>
  )
}

/**
 * Twelve boxes: the windows after the step (3 letters), then one letter per stage. Once the windows are typed the
 * tables for them appear. After a submit the machine moves to the true windows, so the rollback draws the engine's
 * path against the learner's letters.
 */
function ChainFullAnswer({ instance, disabled, submit }: AnswerProps<ChainFullInstance, string[]>): JSX.Element {
  const [tokens, setTokens] = useState<string[]>(() => instance.stages.map(() => ''))
  const api = useMachineApi()
  const submitted = useRef(false)
  const valid = /^[A-Z]{3}$/.test(tokens[0]!) && tokens.slice(1).every((t) => /^[A-Z]$/.test(t))

  useEffect(
    () => () => {
      if (!submitted.current) return
      // After the gate has re-applied the item's setup in this same flush.
      queueMicrotask(() => {
        try {
          api.getState().setConfig(steppedConfig(instance.config))
        } catch {
          // The machine keeps the item's start.
        }
      })
    },
    [api, instance],
  )

  const send = () => {
    if (!valid || disabled) return
    submitted.current = true
    submit(tokens)
  }
  const set = (k: number, v: string) => setTokens((t) => t.map((x, j) => (j === k ? v : x)))
  return (
    <form
      className="flex flex-col gap-3"
      data-testid="chain-full-answer"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <label className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
        <span>Windows after the step</span>
        <input
          data-testid="answer-chain-windows"
          className={`${INPUT} w-16 text-center uppercase`}
          value={tokens[0]}
          disabled={disabled}
          autoComplete="off"
          maxLength={3}
          onChange={(e) => set(0, e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
        />
      </label>
      {/^[A-Z]{3}$/.test(tokens[0]!) ? <TablesAt config={instance.config} windows={tokens[0]!} /> : null}
      <ol className="flex flex-wrap gap-2">
        {instance.stages.slice(1).map((s, j) => {
          const k = j + 1
          return (
            <li key={s.id} className="flex flex-col items-center gap-1 rounded-md border border-stone-700 p-2">
              <label className="flex flex-col items-center gap-1 text-xs text-stone-400">
                <span>
                  <Sym s={symForStage(s.id as never)} inv={FACTORS[j]!.inv} /> {s.label}
                </span>
                <input
                  data-testid={`answer-chain-${s.id}`}
                  className={`${INPUT} w-10 text-center uppercase`}
                  value={tokens[k]}
                  disabled={disabled}
                  autoComplete="off"
                  onChange={(e) => set(k, e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1))}
                />
              </label>
            </li>
          )
        })}
      </ol>
      <div>
        <SubmitButton disabled={disabled || !valid} onClick={send} />
      </div>
    </form>
  )
}

const hopChainFull = {
  Prompt: ({ instance }: { instance: ChainFullInstance }) => {
    const c = instance.config
    return (
      <div className="flex flex-col gap-2">
        <p>
          <Setting c={c} />, reflector {c.reflector}. Turnover letters: {TURNOVERS}. Press <Mono>{instance.key}</Mono>.
        </p>
        <p>
          Type the windows after the rotors step, then the letter that leaves each of the 11 stages. The keyboard is locked. The tables
          of the parts appear for the windows you type.
        </p>
      </div>
    )
  },
  Answer: ChainFullAnswer,
  Worked: ({ instance, solution }: { instance: ChainFullInstance; solution: string[] }) => (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <Setting c={instance.config} />, key <Mono>{instance.key}</Mono>. Step first: the right rotor always moves (and carries its
        neighbour from its turnover letter), so the windows become <Mono>{solution[0]}</Mono>. Then the letter crosses every part at
        those windows:
      </p>
      <HopLine hops={referenceHops(stateOf(instance.config), instance.key)} />
    </div>
  ),
}

export const ITEM_UI: ItemUiMap = {
  keypress,
  'which-wrong': whichWrong,
  'hop-chain-full': hopChainFull,
}
