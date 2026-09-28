/**
 * Chapter i2-stepping's ITEM_UI: a Prompt that makes every instance solvable from the screen (rotors, rings as
 * 01–26, windows, turnover letters) and a Worked example (L2 on a different instance, L3 on the current one).
 */

import type { JSX } from 'react'
import type { ItemUiMap } from '../../contracts/lesson'
import { Mono } from '../../lesson'
import {
  ringNumber,
  stepsFrom,
  turnoversOf,
  type FirstLetterInstance,
  type RingProbeInstance,
  type StepsInstance,
  type WindowsInstance,
} from './gates'

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
        Turn the rotors so that the <strong>{instance.target}</strong> rotor steps on the next key press
        {instance.target === 'left' ? (
          <>
            , and leave the right rotor at <Mono>{c.positions[2]}</Mono>
          </>
        ) : null}
        . The keyboard is locked and the lamps are hidden: set the windows, then submit.
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
        <Mono>{turnoversOf(carrier)[0]}</Mono> in the window
        {instance.target === 'left'
          ? ', even when the right rotor does not carry it: the pawl pushes the middle rotor again (the double step)'
          : ''}
        . The ring settings do not change that letter. For example windows <Mono>{solution.positions.join('')}</Mono>.
      </p>
    )
  },
}

function RingProbePrompt({ instance: i }: { instance: RingProbeInstance }): JSX.Element {
  const t = turnoversOf(i.rotor)[0]
  const to = ringNumber(String.fromCharCode(((i.ring.charCodeAt(0) - 65 + i.by) % 26) + 65))
  return (
    <div className="flex flex-col gap-1">
      <p>
        The right rotor ({i.rotor}) shows <Mono>{i.window}</Mono> in its window with ring setting <Mono>{ringNumber(i.ring)}</Mono>. It
        carries the middle rotor from <Mono>{t}</Mono>.
      </p>
      <p>
        {i.change === 'ring' ? (
          <>
            The operator turns its ring setting on by {i.by} to <Mono>{to}</Mono> and does not touch the rotor itself.
          </>
        ) : (
          <>
            The operator turns the rotor itself forward by {i.by} places, by hand; the ring setting stays{' '}
            <Mono>{ringNumber(i.ring)}</Mono>.
          </>
        )}{' '}
        Afterwards, what does the window show, and from which window letter does the rotor carry the middle rotor?
      </p>
    </div>
  )
}

const ringProbe = {
  Prompt: RingProbePrompt,
  Worked: ({ instance, solution }: { instance: RingProbeInstance; solution: string }) => (
    <p className="text-sm">
      {instance.change === 'ring'
        ? `Rotor ${instance.rotor} at ${instance.window}, ring on by ${instance.by}: the letters on the ring and the rotor did not move, so the window still shows ${instance.window}; only the wiring core turned against them, so a key can light a different lamp.`
        : `Rotor ${instance.rotor} turned ${instance.by} places from ${instance.window}: the window moves on ${instance.by} letters.`}{' '}
      The notch rides on the ring, so it still carries from {turnoversOf(instance.rotor)[0]}. Answer: window{' '}
      <Mono>{solution[0]}</Mono>, carry from <Mono>{solution[1]}</Mono>.
    </p>
  ),
}

const firstLetter = {
  Prompt: ({ instance }: { instance: FirstLetterInstance }) => (
    <div className="flex flex-col gap-1">
      <MachineLine c={instance.config} />
      <Turnovers c={instance.config} />
      <p>You press one key. At which windows does the current for that letter pass through the rotors?</p>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: FirstLetterInstance; solution: string }) => (
    <p className="text-sm">
      Windows <Mono>{instance.config.positions.join('')}</Mono>: the key first steps the rotors (
      {stepsFrom(instance.config, 1)[0]!.moved.join(' + ')} moved), and only then does the current flow, at{' '}
      <Mono>{solution}</Mono>. That holds for the very first letter of a message too.
    </p>
  ),
}

export const ITEM_UI: ItemUiMap = {
  windows,
  'middle-steps': steps,
  'first-letter': firstLetter,
  'ring-probe': ringProbe,
  'windows-m3': windowsM3,
  'left-steps': steps,
}
