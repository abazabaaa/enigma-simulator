/**
 * Chapter i3-reflector-plugboard's ITEM_UI: Prompts that make every instance solvable from the screen (the unplugged
 * scrambler E₀ as a table; the prediction's p and q as tables) and Worked examples (L2 on a different instance, L3 on
 * the current one). A Worked example never shows the reference code.
 */

import type { JSX } from 'react'
import type { Choice, Letter } from '../../contracts/core'
import type { HintLevel, ItemUiMap } from '../../contracts/lesson'
import { LETTERS } from '../../engine'
import { Mono } from '../../lesson'
import { PermTable } from '../../machine-ui'
import { Sym } from '../../lib/Sym'
import { PROBE_LETTER, composeProbe, oneCable, scrambler, type ComposeInstance, type PlugInstance } from './gates'

const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')
const idx = (l: string) => LETTERS.indexOf(l as Letter)
const D = LETTERS[PROBE_LETTER]!

function PlugPrompt({ instance, hintLevel }: { instance: PlugInstance; hintLevel: HintLevel }): JSX.Element {
  const c = instance.setup.machine
  const e0 = scrambler(c)
  return (
    <div className="flex flex-col gap-2">
      <p>
        Rotors <Mono>{c.rotors.join(' ')}</Mono>, rings <Mono>{c.rings.map(ring).join(' ')}</Mono>, windows{' '}
        <Mono>{c.positions.join('')}</Mono>, no cables yet. Make key <Mono>{instance.k}</Mono> light lamp <Mono>{instance.t}</Mono> on
        the next press, with at most {instance.maxPlugs} cable{instance.maxPlugs === 1 ? '' : 's'}.
      </p>
      <p className="text-stone-300">
        Without cables, the next press (the rotors step first) sends each letter to the one below it. This is E₀, the scrambler
        between the two passes through the plugboard <Sym s="S" />:
      </p>
      <PermTable perm={e0} label="E₀: key → lamp, no cables" testId="plug-e0" />
      {hintLevel >= 1 ? (
        <p className="text-sky-200" data-testid="plug-hint">
          A cable on <Mono>{instance.k}</Mono> changes the letter that enters E₀. Which letter must enter E₀ for{' '}
          <Mono>{instance.t}</Mono> to come out?
        </p>
      ) : null}
      <p className="text-stone-400">The keyboard is locked and the lamps are hidden: plug the cables, then submit.</p>
    </div>
  )
}

function PlugWorked({ instance, solution }: { instance: PlugInstance; solution: { plugboard: readonly string[] } }): JSX.Element {
  const e0 = scrambler(instance.setup.machine)
  const via = LETTERS[e0[idx(instance.t)]!]!
  const cable = solution.plugboard[0] ?? oneCable(instance)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Key <Mono>{instance.k}</Mono> must light <Mono>{instance.t}</Mono>. In E₀, <Mono>{instance.t}</Mono> and <Mono>{via}</Mono>{' '}
        are a pair: whatever enters as <Mono>{via}</Mono> comes out as <Mono>{instance.t}</Mono>.
      </p>
      <p>
        So join <Mono>{instance.k}</Mono> to <Mono>{via}</Mono>: the key enters E₀ as <Mono>{via}</Mono>, leaves as{' '}
        <Mono>{instance.t}</Mono>, and <Mono>{instance.t}</Mono> has no cable on the way out. One cable: <Mono>{cable}</Mono>.
      </p>
    </div>
  )
}

const plug = { Prompt: PlugPrompt, Worked: PlugWorked }

const whyNoSelf = {
  Prompt: () => (
    <p>
      Your search tried every rotor position and no letter ever lit itself, whatever the rings and cables. Why can an Enigma never
      encipher a letter as itself?
    </p>
  ),
  Worked: ({ instance, solution }: { instance: { options: readonly Choice[] }; solution: string }) => (
    <p className="text-sm">
      {instance.options.find((o) => o.id === solution)?.label}. The reflector <Sym s="U" /> is 13 wires, each joining two different
      contacts, so the current always turns back on a different wire; the rotors and cables on the way back cannot bring it to the
      letter it started from.
    </p>
  ),
}

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

export const ITEM_UI: ItemUiMap = {
  'plug-to-hit': plug,
  'plug-one': plug,
  'why-no-self': whyNoSelf,
  'compose-inverse': composeInverse,
}
