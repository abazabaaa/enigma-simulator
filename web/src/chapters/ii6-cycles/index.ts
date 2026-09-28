/**
 * Chapter II.6 · Cycles and the theorem (PLAN §4.4 "ii6-cycles"; problem-first, no worked scenes): Rejewski's story,
 * the hexagon (products of swaps have paired cycles), one more cable on the day's plugboard (the lengths of AD do not
 * change), two cycles of CF lined up, and gate `cycles`.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { DAY, DEMO_CABLE, GATES, LENGTHS_OPTIONS, PAIRS_OPTIONS, READ_ONLY, dash } from './gates'
import { ITEM_UI } from './items'
import { AlignView, HexagonView, SteckerToggleView } from './scenes'

const STORY =
  'Warsaw, late 1932. Marian Rejewski had AD, BE and CF for a day, but each of them hid the plugboard and its six ' +
  'unknown cables. Then he saw that the cables could not touch the lengths of their cycles. Two facts about ' +
  'permutations do the work. A product of two permutations made only of swaps has its cycles in pairs of equal length. ' +
  'And a permutation with its letters renamed, a conjugate, keeps its cycle lengths: the theorem the cryptologist ' +
  'Deavours later called "the theorem that won World War II". A cable only renames letters in AD. This chapter lets ' +
  'you check both facts by hand.'

const SETUP = { machine: DAY, locks: READ_ONLY } as const

const scenes: readonly SceneDef[] = [
  {
    id: 'theorem',
    kind: 'story',
    title: 'The theorem',
    stage: null,
    story: { text: STORY, people: ['rejewski'], date: 'late-1932', facts: ['theorem', 'nullified', 'pairs', 'adjacent'] },
  },
  {
    id: 'hexagon',
    kind: 'explore',
    title: 'Two sets of swaps',
    stage: null,
    setup: SETUP,
    introduces: ['paired-cycles'],
    bets: [
      {
        id: 'pairs',
        prompt: 'Multiply X and Y, X first and then Y. What will the cycles of XY look like?',
        kind: 'choice',
        options: PAIRS_OPTIONS,
      },
    ],
    reveals: [{ bet: 'pairs', trigger: 'play', label: 'Play XY' }],
    View: HexagonView,
  },
  {
    id: 'stecker-toggle',
    kind: 'explore',
    title: 'One more cable',
    stage: 'plugboard',
    setup: SETUP,
    panels: { plugboard: true },
    introduces: ['invariance'],
    bets: [
      {
        id: 'lengths',
        prompt: "Add one cable to the day's plugboard. What happens to the cycle lengths of AD?",
        kind: 'choice',
        options: LENGTHS_OPTIONS,
      },
    ],
    reveals: [{ bet: 'lengths', trigger: 'toggle', label: `Add the cable ${dash(DEMO_CABLE)}` }],
    tasks: [{ id: 'toggle3', label: 'Change the cables three times and read the lengths' }],
    View: SteckerToggleView,
  },
  {
    id: 'align',
    kind: 'explore',
    title: 'Two cycles, one under the other',
    stage: null,
    setup: SETUP,
    shows: ['paired-cycles'],
    tasks: [{ id: 'try3', label: 'Find three ways to split CF' }],
    View: AlignView,
  },
  { id: 'gate', kind: 'gate', title: 'Cycles and the plugboard', stage: null, setup: SETUP, gate: 'cycles' },
]

const chapter = {
  id: 'ii6-cycles',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
