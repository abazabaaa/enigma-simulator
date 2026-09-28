/**
 * Chapter i2-stepping's ITEM_UI: a Prompt that makes every instance solvable from the screen (rotors, rings as
 * 01–26, windows, turnover letters) and a Worked example (L2 on a different instance, L3 on the current one).
 */

import type { JSX } from 'react'
import type { Choice } from '../../contracts/core'
import type { ItemUiMap } from '../../contracts/lesson'
import { Mono } from '../../lesson'
import { ringNumber, stepsFrom, turnoversOf, type StepsInstance, type WindowsInstance } from './gates'

type Config = WindowsInstance['config']

/** Rotors, rings (01–26) and windows, left to right. */
function MachineLine({ c }: { c: Config }): JSX.Element {
  return (
    <p>
      {c.model === 'M3' ? 'An M3' : 'An Enigma I'} with rotors <Mono>{c.rotors.join(' ')}</Mono> (left to right), rings{' '}
      <Mono>{c.rings.map(ringNumber).join(' ')}</Mono>, windows <Mono>{c.positions.join('')}</Mono>.
    </p>
  )
}

/** The turnover letters (window letter before the carry) of the rotors in this machine. */
function Turnovers({ c }: { c: Config }): JSX.Element {
  return (
    <p className="text-stone-300">
      Turnover letters (the window letter from which a rotor carries its left neighbour):{' '}
      {c.rotors.map((r, k) => (
        <span key={r}>
          {k ? ', ' : ''}
          {r} <Mono>{turnoversOf(r).split('').join(' and ')}</Mono>
        </span>
      ))}
      .
    </p>
  )
}

/** Press by press: before → after and what moved. */
function StepList({ c }: { c: Config }): JSX.Element {
  return (
    <ol className="list-decimal pl-5">
      {stepsFrom(c, 3).map((s, k) => (
        <li key={k}>
          <Mono>{s.before}</Mono> → <Mono>{s.after}</Mono>: {s.moved.join(' + ')} moved
          {s.doubleStep ? ' (double step: the middle rotor was on its own turnover letter)' : ''}
        </li>
      ))}
    </ol>
  )
}

const windows = {
  Prompt: ({ instance }: { instance: WindowsInstance }) => (
    <div className="flex flex-col gap-1">
      <MachineLine c={instance.config} />
      <Turnovers c={instance.config} />
      <p>
        The keyboard is locked. Type the three windows the machine shows after each of the next three key presses (9 letters, left
        to right).
      </p>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: WindowsInstance; solution: string }) => (
    <div className="flex flex-col gap-1 text-sm">
      <MachineLine c={instance.config} />
      <p>
        The right rotor always moves. It carries the middle rotor when it leaves its turnover letter; the middle rotor carries the left
        one, and moves again itself, when it leaves its own.
      </p>
      <StepList c={instance.config} />
      <p>
        Answer <Mono>{solution}</Mono>.
      </p>
    </div>
  ),
}

const windowsM3 = {
  Prompt: ({ instance }: { instance: WindowsInstance }) => (
    <div className="flex flex-col gap-1">
      <p>
        The navy&apos;s M3 takes rotors I–VIII. Rotors VI, VII and VIII have two notches: they carry their neighbour from Z and from M.
      </p>
      <MachineLine c={instance.config} />
      <Turnovers c={instance.config} />
      <p>The keyboard is locked. Type the windows after each of the next three key presses (9 letters).</p>
    </div>
  ),
  Worked: windows.Worked,
}

function StepsPrompt({ instance }: { instance: StepsInstance }): JSX.Element {
  const c = instance.setup.machine
  return (
    <div className="flex flex-col gap-1">
      <MachineLine c={c} />
      <Turnovers c={c} />
      <p>
        Turn the rotors so that the <strong>{instance.target}</strong> rotor steps on the next key press. The keyboard is locked and the
        lamps are hidden: set the windows, then submit.
      </p>
    </div>
  )
}

const steps = {
  Prompt: StepsPrompt,
  Worked: ({ instance, solution }: { instance: StepsInstance; solution: { positions: readonly string[] } }) => {
    const c = instance.setup.machine
    const carrier = instance.target === 'middle' ? c.rotors[2]! : c.rotors[1]!
    return (
      <p className="text-sm">
        Rotors <Mono>{c.rotors.join(' ')}</Mono>, rings <Mono>{c.rings.map(ringNumber).join(' ')}</Mono>: the {instance.target} rotor
        steps when the {instance.target === 'middle' ? 'right' : 'middle'} rotor ({carrier}) shows its turnover letter{' '}
        <Mono>{turnoversOf(carrier)[0]}</Mono> in the window. The ring settings do not change that letter. For example windows{' '}
        <Mono>{solution.positions.join('')}</Mono>.
      </p>
    )
  },
}

const ringProbe = {
  Prompt: () => (
    <p>
      The right rotor shows <Mono>A</Mono> in its window. An operator turns its ring setting from <Mono>01</Mono> to <Mono>05</Mono>{' '}
      and does not touch the rotor itself. What changes?
    </p>
  ),
  Worked: ({ instance, solution }: { instance: { options: readonly Choice[] }; solution: string }) => (
    <p className="text-sm">
      {instance.options.find((o) => o.id === solution)?.label}. The letters and the notch are on the alphabet ring; the ring setting
      turns the wiring core against them. The window letter and the turnover letter stay put.
    </p>
  ),
}

export const ITEM_UI: ItemUiMap = {
  windows,
  'middle-steps': steps,
  'ring-probe': ringProbe,
  'windows-m3': windowsM3,
  'left-steps': steps,
}
