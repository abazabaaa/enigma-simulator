/**
 * Chapter i3-reflector-plugboard's ITEM_UI: Prompts that make every instance solvable from the screen (the unplugged
 * scrambler E₀ as a table; p and q as tables; the toy's rotor and reflector as tables) and Worked examples (L2 on a
 * different instance, L3 on the current one). A Worked example never shows the reference code, and why-no-self's
 * never quotes an option. hands-on (the fallback) brings its own Answer for each of its three variants.
 */

import { useEffect, useState, type JSX } from 'react'
import type { Letter, MachineConfig } from '../../contracts/core'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { LETTERS } from '../../engine'
import { LetterTable, Mono, QUIET_BUTTON, SubmitButton } from '../../lesson'
import { MachinePanel, PermTable, PlugboardEditor } from '../../machine-ui'
import { Sym } from '../../lib/Sym'
import { useMachine, useMachineApi } from '../../state/activeMachine'
import { useToyStore } from '../../state/toyStore'
import {
  PROBE_LETTER,
  SEARCH_START,
  composeProbe,
  scrambler,
  selfWired,
  toyLamp,
  wayOutCable,
  type ComposeBuildInstance,
  type ComposeInstance,
  type HandsOnAnswer,
  type HandsOnInstance,
  type PlugInstance,
  type SelfInstance,
  type SelfToyInstance,
} from './gates'

const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')
const idx = (l: string) => LETTERS.indexOf(l as Letter)
const L = (i: number): Letter => LETTERS[i]!
const D = LETTERS[PROBE_LETTER]!

// ---------------------------------------------------------------------------
// plug-to-hit (and the hands-on plug variant)
// ---------------------------------------------------------------------------

function PlugPrompt({ instance, hintLevel }: { instance: PlugInstance; hintLevel: HintLevel }): JSX.Element {
  const c = instance.setup.machine
  const e0 = scrambler(c)
  return (
    <div className="flex flex-col gap-2">
      <p>
        Rotors <Mono>{c.rotors.join(' ')}</Mono>, rings <Mono>{c.rings.map(ring).join(' ')}</Mono>, windows{' '}
        <Mono>{c.positions.join('')}</Mono>, no cables yet. Make key <Mono>{instance.k}</Mono> light lamp <Mono>{instance.t}</Mono> on
        the next press, with at most {instance.maxPlugs} cable{instance.maxPlugs === 1 ? '' : 's'}.{' '}
        <strong>
          Key <Mono>{instance.k}</Mono> keeps its socket empty
        </strong>
        : no cable may use it.
      </p>
      <p className="text-stone-300">
        Without cables, the next press (the rotors step first) sends each letter to the one below it. This is E₀, everything
        between the plugboard <Sym s="S" /> and the plugboard again:
      </p>
      <PermTable perm={e0} label="E₀: key → lamp, no cables" testId="plug-e0" />
      {hintLevel >= 1 ? (
        <p className="text-sky-200" data-testid="plug-hint">
          The current crosses the plugboard twice. With no cable on <Mono>{instance.k}</Mono>, which of the two crossings can still
          change the letter?
        </p>
      ) : null}
    </div>
  )
}

/** Another instance (L2) or this one (L3), with its own E₀: the table on screen above belongs to the question. */
function PlugWorked({ instance }: { instance: PlugInstance }): JSX.Element {
  const c = instance.setup.machine
  const e0 = scrambler(c)
  const out = L(e0[idx(instance.k)]!)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Rotors <Mono>{c.rotors.join(' ')}</Mono>, rings <Mono>{c.rings.map(ring).join(' ')}</Mono>, windows{' '}
        <Mono>{c.positions.join('')}</Mono>: key <Mono>{instance.k}</Mono> must light <Mono>{instance.t}</Mono>. Its E₀:
      </p>
      <PermTable perm={e0} label="E₀ of this example" testId="plug-worked-e0" />
      <p>
        Key <Mono>{instance.k}</Mono> has no cable, so it enters E₀ as <Mono>{instance.k}</Mono> and leaves as{' '}
        <Mono>{out}</Mono> (the letter below <Mono>{instance.k}</Mono>).
      </p>
      <p>
        On its way back to the lamps the current crosses the plugboard again, so a cable from <Mono>{out}</Mono> to{' '}
        <Mono>{instance.t}</Mono> turns <Mono>{out}</Mono> into <Mono>{instance.t}</Mono>. One cable:{' '}
        <Mono>{wayOutCable(instance)}</Mono>.
      </p>
    </div>
  )
}

/**
 * The plug items' Answer: the set-machine widget's parts with the plugboard first. The keyboard stays on screen,
 * locked (G8), after the plugboard, so the first control of the item (where the gate puts the focus after Continue)
 * is the cable input, not a locked key. The answer is the machine's snapshot, as with the generic widget.
 */
function PlugAnswer({ instance, disabled, submit }: AnswerProps<PlugInstance, MachineConfig>): JSX.Element {
  const api = useMachineApi()
  const plugs = useMachine((s) => s.machine.config.plugboard)
  return (
    <div className="flex flex-col gap-3" data-testid="set-machine">
      <p className="text-sm text-stone-400">
        The keyboard is locked and the lamps are hidden: plug at most {instance.maxPlugs} cable{instance.maxPlugs === 1 ? '' : 's'},
        then submit.
      </p>
      <PlugboardEditor store={api} />
      <MachinePanel store={api} show={{ keyboard: true, lamps: true }} />
      <p className="font-mono text-xs text-stone-400" data-testid="set-machine-state">
        plugs {plugs.join(' ') || 'none'}
      </p>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}

const plug = { Prompt: PlugPrompt, Answer: PlugAnswer, Worked: PlugWorked }

// ---------------------------------------------------------------------------
// why-no-self
// ---------------------------------------------------------------------------

const whyNoSelf = {
  Prompt: ({ instance }: { instance: SelfInstance }) => (
    <p>
      The search machine (rings <Mono>{SEARCH_START.rings.map(ring).join(' ')}</Mono>, cables{' '}
      <Mono>{SEARCH_START.plugboard.join(' ')}</Mono>): at windows <Mono>{instance.windows}</Mono> key <Mono>{instance.key}</Mono>{' '}
      lights <Mono>{instance.lamp}</Mono>. Your search tried key A at all 17,576 positions and it never lit A, and no other key ever
      lights its own lamp. Why can an Enigma never encipher a letter as itself?
    </p>
  ),
  // The mechanism, never an option's wording (the answer is the same on every instance).
  Worked: () => (
    <p className="text-sm">
      Follow any key: through the plugboard <Sym s="S" /> and the rotors it reaches the reflector <Sym s="U" /> on some contact, and
      the reflector&apos;s wire from that contact ends on another one. The way back retraces the same rotors and cables from that
      other contact, so it cannot end on the letter it started from.
    </p>
  ),
}

// ---------------------------------------------------------------------------
// compose-inverse
// ---------------------------------------------------------------------------

/** p and q on A–F as two tables. */
function PQ({ i }: { i: Pick<ComposeInstance, 'p' | 'q'> }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-4">
      <PermTable perm={[...i.p].map(idx)} n={6} label="p" testId="compose-p" />
      <PermTable perm={[...i.q].map(idx)} n={6} label="q" testId="compose-q" />
    </div>
  )
}

const composeInverse = {
  Prompt: ({ instance, hintLevel }: { instance: ComposeInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        Two permutations of the letters A–F, each as a table (each letter on top goes to the letter below it). In code a permutation is
        the array of the lower row as numbers: p = [{[...instance.p].map(idx).join(', ')}].
      </p>
      <PQ i={instance} />
      <p>
        Before you run your code, predict <Mono>compose(p, q)(D)</Mono>: the letter compose(p, q) sends <Mono>{D}</Mono> to. Type one
        letter (A–F) in the prediction box; it locks when you run.
      </p>
      {hintLevel >= 1 ? (
        <p className="text-sky-200" data-testid="compose-hint">
          Left to right: first look <Mono>{D}</Mono> up in p, then look that letter up in q. The inverse reads a table from the bottom row
          to the top row.
        </p>
      ) : null}
    </div>
  ),
  // The method on another instance's p and q; never the reference code.
  Worked: ({ instance }: { instance: ComposeInstance }) => {
    const pD = instance.p[PROBE_LETTER]!
    const answer = composeProbe(instance)
    return (
      <div className="flex flex-col gap-1 text-sm">
        <PQ i={instance} />
        <p>
          compose(p, q) applies p first: p sends <Mono>{D}</Mono> to <Mono>{pD}</Mono>, then q sends <Mono>{pD}</Mono> to{' '}
          <Mono>{answer}</Mono>. So compose(p, q)(D) = <Mono>{answer}</Mono>, and in code the entry at index i is q&apos;s entry at the
          index p gives for i.
        </p>
        <p>
          inverse(p) undoes p: p sends <Mono>{D}</Mono> to <Mono>{pD}</Mono>, so inverse(p) sends <Mono>{pD}</Mono> back to{' '}
          <Mono>{D}</Mono>. Fill each entry of the inverse from p&apos;s table read upwards. A reflector is its own inverse.
        </p>
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// hands-on (the fallback): plug-one, compose built cell by cell, or the self-wired toy reflector
// ---------------------------------------------------------------------------

function ComposePrompt({ instance }: { instance: ComposeBuildInstance }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        Build compose(p, q), the permutation that applies p first and then q: under each letter A–F type the letter it goes to.
      </p>
      <PQ i={instance} />
    </div>
  )
}

/** Six editable cells (compose-build-cell-0…5), one letter each; Submit sends the six letters. */
function ComposeAnswer({ disabled, submit }: AnswerProps<ComposeBuildInstance, string>): JSX.Element {
  const [cells, setCells] = useState<(number | null)[]>(() => [null, null, null, null, null, null])
  const full = cells.every((c) => c !== null)
  return (
    <div className="flex flex-col gap-3" data-testid="compose-build-answer">
      <PermTable
        perm={cells}
        n={6}
        label="compose(p, q)"
        editable={!disabled}
        testId="compose-build"
        onEdit={(i, v) => setCells((c) => c.map((x, j) => (j === i ? v : x)))}
      />
      <div>
        <SubmitButton disabled={disabled || !full} onClick={() => full && submit(cells.map((c) => L(c!)).join(''))} />
      </div>
    </div>
  )
}

function ComposeFeedback({ answer, result }: { answer: string; result: CheckResult }): JSX.Element | null {
  if (result.rollback.kind !== 'perm') return null
  return (
    <div className="flex flex-col gap-1" data-testid="compose-build-feedback">
      <PermTable perm={[...String(answer)].map(idx)} n={6} label="Your table (wrong cells outlined)" highlight={result.rollback.wrongCells} testId="compose-build-yours" />
      <p>
        {result.rollback.wrongCells.length} of 6 cells are wrong: for each, look the top letter up in p, then look that letter up in q.
      </p>
    </div>
  )
}

function SelfPrompt({ instance }: { instance: SelfToyInstance }): JSX.Element {
  const faulty = selfWired(instance.spec)
  return (
    <div className="flex flex-col gap-2">
      <p>
        A toy on the letters A–F with one rotor (held) and a faulty reflector: contacts <Mono>{faulty.map(L).join(' and ')}</Mono>{' '}
        are each wired to themselves, and the other four are joined in pairs. Turn the rotor so that key <Mono>{instance.key}</Mono>{' '}
        lights its own lamp, <Mono>{instance.key}</Mono>. The keyboard is locked.
      </p>
      <LetterTable images={instance.spec.rotors[0]!.map(L).join('')} label="rotor wiring at window A (at window W it is turned W places)" n={6} />
      <LetterTable images={instance.spec.reflector.map(L).join('')} label="the faulty reflector" n={6} />
    </div>
  )
}

function SelfAnswer({ instance, disabled, submit }: AnswerProps<SelfToyInstance, number>): JSX.Element {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    useToyStore.getState().setSpec({ ...instance.spec, positions: [pos] })
  }, [instance, pos])
  return (
    <div className="flex flex-col gap-3" data-testid="self-toy">
      <div className="flex items-center gap-2">
        <button type="button" className={QUIET_BUTTON} data-testid="self-toy-dec" aria-label="Turn the rotor back" disabled={disabled} onClick={() => setPos((p) => (p + 5) % 6)}>
          −
        </button>
        <span data-testid="self-toy-window" role="status" aria-label={`Window ${L(pos)}`} className="w-8 text-center font-mono text-lg">
          {L(pos)}
        </span>
        <button type="button" className={QUIET_BUTTON} data-testid="self-toy-inc" aria-label="Turn the rotor on" disabled={disabled} onClick={() => setPos((p) => (p + 1) % 6)}>
          +
        </button>
      </div>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(pos)} />
      </div>
    </div>
  )
}

function SelfWorked({ instance, solution }: { instance: SelfToyInstance; solution: number }): JSX.Element {
  const faulty = selfWired(instance.spec)
  return (
    <p className="text-sm">
      A key lights itself only if the current comes back on the wire it went in on, which needs a reflector contact wired to itself (
      <Mono>{faulty.map(L).join(' or ')}</Mono>). At window <Mono>{L(solution)}</Mono> the rotor carries <Mono>{instance.key}</Mono> onto
      one of them, so <Mono>{instance.key}</Mono> lights <Mono>{toyLamp(instance, solution)}</Mono>. A real reflector has no such
      contact.
    </p>
  )
}

const handsOn = {
  Prompt: ({ instance, hintLevel }: { instance: HandsOnInstance; hintLevel: HintLevel }) =>
    instance.variant === 'plug' ? (
      <PlugPrompt instance={instance} hintLevel={hintLevel} />
    ) : instance.variant === 'compose' ? (
      <ComposePrompt instance={instance} />
    ) : (
      <SelfPrompt instance={instance} />
    ),
  Answer: (p: AnswerProps<HandsOnInstance, HandsOnAnswer>) => {
    const i = p.instance
    if (i.variant === 'plug') return <PlugAnswer {...(p as unknown as AnswerProps<PlugInstance, MachineConfig>)} instance={i} />
    if (i.variant === 'compose') return <ComposeAnswer {...(p as AnswerProps<ComposeBuildInstance, string>)} instance={i} />
    return <SelfAnswer {...(p as AnswerProps<SelfToyInstance, number>)} instance={i} />
  },
  Worked: ({ instance, solution }: { instance: HandsOnInstance; solution: HandsOnAnswer }) =>
    instance.variant === 'plug' ? (
      <PlugWorked instance={instance} />
    ) : instance.variant === 'compose' ? (
      <div className="flex flex-col gap-1 text-sm">
        <PQ i={instance} />
        <p>
          p first, then q: compose(p, q) = <Mono>{String(solution)}</Mono>. For example p sends <Mono>A</Mono> to{' '}
          <Mono>{instance.p[0]}</Mono> and q sends that to <Mono>{String(solution)[0]}</Mono>.
        </p>
      </div>
    ) : (
      <SelfWorked instance={instance} solution={Number(solution)} />
    ),
  Feedback: ({ answer, result }: { instance: HandsOnInstance; answer: HandsOnAnswer; result: CheckResult }) => (
    <ComposeFeedback answer={String(answer)} result={result} />
  ),
}

export const ITEM_UI: ItemUiMap = {
  'plug-to-hit': plug,
  'why-no-self': whyNoSelf,
  'compose-inverse': composeInverse,
  'hands-on': handsOn,
}
