/**
 * The recall pool's ITEM_UI (PLAN §4.2): prompts that carry everything needed to solve each instance from the
 * screen, worked examples, and the Feedback for the perm, cycles, crib and menu rollbacks.
 */

import type { JSX } from 'react'
import type { CheckResult, ItemUiMap } from '../../contracts/lesson'
import { LETTERS, ROTORS, createMachine, positionsToString, pressKey } from '../../engine'
import { LetterTable, Mono } from '../ui/controls'
import {
  crashIndices,
  type ComposeInstance,
  type CrashesInstance,
  type HopTrioInstance,
  type LengthsInstance,
  type LoopInstance,
  type PlugInstance,
  type WindowsInstance,
} from './pool'

const L = (i: number) => LETTERS[i]!
const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')
const perm = (p: readonly number[]) => p.map(L).join('')

/** Everything the windows item needs on screen (review m5: prompts inside the return check stand alone). */
function MachineLine({ c }: { c: WindowsInstance['config'] }): JSX.Element {
  return (
    <p>
      Rotors <Mono>{c.rotors.join(' ')}</Mono> (left to right), rings <Mono>{c.rings.map(ring).join(' ')}</Mono>,
      windows <Mono>{c.positions.join('')}</Mono>. Turnover letters:{' '}
      {c.rotors.map((r) => `${r} ${ROTORS[r].turnovers}`).join(', ')} (a rotor carries its left neighbour when it steps
      on from that letter).
    </p>
  )
}

function windowsAfter(c: WindowsInstance['config']): string[] {
  let s = createMachine(c)
  return [0, 1, 2].map(() => {
    s = pressKey(s, 'A').state
    return positionsToString(s)
  })
}

const Windows = {
  Prompt: ({ instance }: { instance: WindowsInstance }) => (
    <div className="flex flex-col gap-1">
      <MachineLine c={instance.config} />
      <p>The keyboard is locked. Type the three windows after each of the next three key presses (9 letters).</p>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: WindowsInstance; solution: string }) => (
    <div className="flex flex-col gap-1 text-sm">
      <MachineLine c={instance.config} />
      <p>
        The right rotor steps on every press; when it leaves its turnover letter it carries the middle one. Presses:{' '}
        <Mono>{windowsAfter(instance.config).join(' → ')}</Mono>, so the answer is <Mono>{solution}</Mono>.
      </p>
    </div>
  ),
}

const Plug = {
  Prompt: ({ instance }: { instance: PlugInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        Without cables, the next key press sends each key to this lamp (the scrambler for that press). Plug at most{' '}
        {instance.maxPlugs} cable{instance.maxPlugs === 1 ? '' : 's'} so that <Mono>{instance.k}</Mono> lights{' '}
        <Mono>{instance.t}</Mono>.
      </p>
      <LetterTable images={instance.table} label="key → lamp, no cables" />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: PlugInstance; solution: { plugboard: readonly string[] } }) => (
    <p className="text-sm">
      Without cables {instance.k} lights {instance.table[LETTERS.indexOf(instance.k)]}. The scrambler sends{' '}
      {instance.table[LETTERS.indexOf(instance.t)]} to {instance.t}, so a cable{' '}
      <Mono>{solution.plugboard.join(' ')}</Mono> makes {instance.k} enter as{' '}
      {instance.table[LETTERS.indexOf(instance.t)]} and come out as {instance.t}.
    </p>
  ),
}

const HopTrio = {
  Prompt: ({ instance }: { instance: HopTrioInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        Rotors <Mono>{instance.rotors.join(' ')}</Mono> at windows <Mono>{instance.positions}</Mono> (rings 01). Each
        strip is a rotor's substitution at its offset, towards the reflector. The letter <Mono>{instance.input}</Mono>{' '}
        enters the right rotor: which letters leave the right, the middle and the left rotor?
      </p>
      {(['Right (N)', 'Middle (M)', 'Left (L)'] as const).map((label, k) => (
        <LetterTable key={label} images={instance.strips[k]!} label={label} />
      ))}
    </div>
  ),
  Worked: ({ instance, solution }: { instance: HopTrioInstance; solution: string }) => (
    <p className="text-sm">
      {instance.input} → {solution[0]} (right) → {solution[1]} (middle) → {solution[2]} (left): <Mono>{solution}</Mono>.
    </p>
  ),
}

const Compose = {
  Prompt: ({ instance }: { instance: ComposeInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        pq applies p first, then q. Where does pq send <Mono>{instance.xs.join(', ')}</Mono>? (four letters, in that
        order)
      </p>
      <LetterTable images={perm(instance.p)} label="p" />
      <LetterTable images={perm(instance.q)} label="q" />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ComposeInstance; solution: string }) => (
    <p className="text-sm">
      {instance.xs.map((x, k) => `${x} →p ${L(instance.p[LETTERS.indexOf(x)]!)} →q ${solution[k]}`).join('; ')}.
    </p>
  ),
  Feedback: ({ instance, result }: { instance: ComposeInstance; answer: string; result: CheckResult }) => {
    const wrong = result.rollback.kind === 'perm' ? result.rollback.wrongCells : []
    return (
      <p className="text-sm">
        Check {wrong.map(L).join(', ')} again: follow p first, then q from where p left off.
        {wrong.map((c) => ` ${L(c)} →p ${L(instance.p[c]!)}.`).join('')}
      </p>
    )
  },
}

const Lengths = {
  Prompt: ({ instance }: { instance: LengthsInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        a and b swap letters in pairs on {instance.n} letters. List the cycle lengths of ab (a first, then b), every
        cycle, longest first.
      </p>
      <LetterTable images={perm(instance.a)} label="a" />
      <LetterTable images={perm(instance.b)} label="b" />
    </div>
  ),
  Worked: ({ instance, solution }: { instance: LengthsInstance; solution: number[] }) => (
    <p className="text-sm">
      Follow each letter through a then b until it returns. The cycles pair up; lengths{' '}
      <Mono>{solution.join(' ')}</Mono> ({instance.n} letters in all).
    </p>
  ),
  Feedback: ({ result }: { instance: LengthsInstance; answer: number[]; result: CheckResult }) => {
    if (result.rollback.kind !== 'cycles') return null
    const { cycle, expected } = result.rollback
    return (
      <p className="text-sm">
        Walk this cycle letter by letter: <Mono>({cycle.map(L).join(' ')})</Mono> has {cycle.length} letters. All
        lengths add up to {expected.reduce((a, b) => a + b, 0)}.
      </p>
    )
  },
}

const Crashes = {
  Prompt: ({ instance }: { instance: CrashesInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        The crib sits under the cipher at offset {instance.offset}. A crash is a crib letter under the same cipher
        letter. List the crib positions (counting from 0) that crash.
      </p>
      <div className="max-w-full overflow-x-auto">
        <pre className="font-mono text-sm leading-tight">
          {instance.cipher}
          {'\n'}
          {' '.repeat(instance.offset)}
          {instance.crib}
          {'\n'}
          {' '.repeat(instance.offset)}
          {[...instance.crib].map((_, k) => String(k % 10)).join('')}
        </pre>
      </div>
    </div>
  ),
  Worked: ({ solution }: { instance: CrashesInstance; solution: number[] }) => (
    <p className="text-sm">Compare each column; the crashes are at {solution.join(', ') || 'none'}.</p>
  ),
  Feedback: ({ instance, result }: { instance: CrashesInstance; answer: number[]; result: CheckResult }) => (
    <p className="text-sm">
      The crash columns:{' '}
      {(result.rollback.kind === 'crib'
        ? result.rollback.crashes
        : crashIndices(instance.cipher, instance.crib, instance.offset)
      ).join(', ')}
      .
    </p>
  ),
}

const Loop = {
  Prompt: ({ instance }: { instance: LoopInstance }) => (
    <div className="flex flex-col gap-2">
      <p>
        Three scramblers on A–H, applied in order around a loop. For each hypothesis{' '}
        <Mono>{instance.hypotheses.join(', ')}</Mono>, which letter comes back after the third scrambler?
      </p>
      {instance.scramblers.map((s, k) => (
        <LetterTable key={k} images={perm(s)} label={`scrambler ${k + 1}`} n={8} />
      ))}
    </div>
  ),
  Worked: ({ solution, instance }: { instance: LoopInstance; solution: string }) => (
    <p className="text-sm">{instance.hypotheses.map((h, k) => `${h} → ${solution[k]}`).join('; ')}.</p>
  ),
  Feedback: ({ result }: { instance: LoopInstance; answer: string; result: CheckResult }) =>
    result.rollback.kind === 'menu' ? (
      <p className="text-sm">
        Follow it through: <Mono>{result.rollback.loop.join(' → ')}</Mono>.
      </p>
    ) : null,
}

export const RECALL_UI: ItemUiMap = {
  'r-windows': Windows,
  'r-plug-to-hit': Plug,
  'r-plug-one': Plug,
  'r-hop-trio': HopTrio,
  'r-compose': Compose,
  'r-lengths': Lengths,
  'r-crashes': Crashes,
  'r-loop': Loop,
}
