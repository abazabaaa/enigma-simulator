/**
 * Chapter I.4 · Enigma as permutations (PLAN §4.4 "i4-permutations"; closes Act I). A story, Rejewski's notation
 * with each symbol in its part's colour, the component tables composed into E, and gate `keypress`: the learner's
 * own enigmaKeypress from instrumented parts (paired with the in-page which-wrong), the part a buggy press breaks,
 * and the full chain of one press. The delayed recall that opens Act II is the return-visit check (§4.2).
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { FIXED, GATES, NOTATION_START, READ_ONLY, START, SYMBOLS_KEY } from './gates'
// The e2e typecheck (tsconfig.node.json, no `jsx`) reaches this file through content/registry.ts: it must not
// follow the .tsx imports (TS6142). The app and unit-test configs type them normally. Remove these two directives
// once tsconfig.node.json enables "jsx" (05's fix, pending on chapters-base).
// @ts-ignore TS6142 under tsconfig.node.json only
import { ITEM_UI } from './items'
// @ts-ignore TS6142 under tsconfig.node.json only
import { SymbolsView, TablesView } from './scenes'

const STORY =
  'Warsaw, late 1932. Marian Rejewski, hired that September with Henryk Zygalski and Jerzy Różycki, wrote the whole machine ' +
  'as one product of permutations, read from left to right: S for the plugboard, H for the entry wheel, N, M and L for the ' +
  'right, middle and left rotors, and R for the reflector (this course writes U). The current meets those parts on its way in ' +
  'and the same parts, inverted, on its way out. His guess that the military entry wheel H simply kept the alphabet in order ' +
  'turned out to be right, and by the end of the year he had the rotor wirings.'

const scenes: readonly SceneDef[] = [
  {
    id: 'notation',
    kind: 'story',
    title: 'A key press as a product',
    stage: null,
    story: { text: STORY, people: ['rejewski'], date: 'wirings', facts: ['hired', 'notation', 'conjugate', 'entry'] },
  },
  {
    id: 'symbols',
    kind: 'explore',
    title: "Rejewski's symbols",
    stage: 'symbols',
    worked: true,
    // Held: a press does not step, so E stays one permutation from press to press.
    setup: { machine: NOTATION_START, locks: { ...FIXED, hold: true } },
    panels: { keyboard: true, lamps: true, trace: true },
    introduces: ['notation'],
    bets: [
      {
        id: 'inverse',
        prompt: `The rotors are held. Key ${SYMBOLS_KEY} lights some lamp, E(${SYMBOLS_KEY}). Then you press that lamp's key. What lights?`,
        kind: 'choice',
        options: [
          { id: 'returns', label: `${SYMBOLS_KEY} again: E applied twice gives the letter back` },
          { id: 'new', label: 'A new letter', misconception: true },
          { id: 'plugboard', label: 'It depends on the plugboard cables', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'inverse', trigger: 'play', label: `Play: press ${SYMBOLS_KEY}, then the lamp's key` }],
    tasks: [{ id: 'hover-all', label: 'Focus each coloured symbol and find its part on the stage' }],
    View: SymbolsView,
  },
  {
    id: 'tables',
    kind: 'explore',
    title: 'Seven tables, one product',
    stage: 'symbols',
    worked: true,
    setup: { machine: NOTATION_START, locks: { ...FIXED, positions: false, hold: true } },
    panels: { keyboard: true, lamps: true, rotors: true },
    shows: ['notation'],
    freePress: true,
    tasks: [{ id: 'compose-all', label: 'Compose all 11 factors into E' }],
    View: TablesView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Your own key press',
    stage: 'symbols',
    setup: { machine: START, locks: READ_ONLY },
    gate: 'keypress',
  },
]

const chapter = {
  id: 'i4-permutations',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
