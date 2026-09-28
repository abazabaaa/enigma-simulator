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
  "Warsaw, late 1932. Schmidt's tables covered only September and October. For any other day Marian Rejewski could " +
  "still build AD, BE and CF from the indicators, but every letter had passed through that day's plugboard, and its " +
  'six cables were unknown. Could the three permutations still say anything about the rotors? The answer is a theorem ' +
  'about permutations that the cryptologist Deavours later called "the theorem that won World War II". With the ' +
  "cyclometer of 1934–35 it let the Poles build a catalogue that finds a day's rotor settings without its cables. " +
  "Here you work it out yourself: multiply two sets of swaps, add a cable to a real day's machine, and line up two " +
  'cycles.'

const SETUP = { machine: DAY, locks: READ_ONLY } as const

const scenes: readonly SceneDef[] = [
  {
    id: 'theorem',
    kind: 'story',
    title: 'The theorem',
    stage: null,
    story: {
      text: STORY,
      people: ['rejewski'],
      date: 'late-1932',
      facts: ['tables', 'theorem', 'nullified', 'pairs', 'adjacent', 'cyclometer'],
    },
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
