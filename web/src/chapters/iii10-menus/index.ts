/**
 * Chapter III.10 · Menus and loops (PLAN §4.4 "iii10-menus"). Turing's story, the menu-builder (a bet on vector 14's
 * closures before the last links go in), the loop scene (a bet on which assumption contradicts itself round A–T–L–K,
 * then a bet on Turing's stop table) and gate `menus`. Every scene is 2D-only (no stage).
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { GATES, LOOP_TOY, PARKED, READ_ONLY, V14_MENU } from './gates'
import { ITEM_UI } from './items'
import { LoopView, MenuBuilderView, STOP_TABLE, formatStops } from './scenes'

const STORY =
  'Bletchley Park, 4 September 1939, the day after Britain declared war: Alan Turing and Gordon Welchman report for work. ' +
  'Before the year is out Turing has designed the bombe, a machine that hunts for the day’s rotor positions with a crib. ' +
  'Every crib letter over its cipher letter is a link between two letters, made by the machine at that key press. Where ' +
  'links close into loops, a wrong guess about the plugboard comes back round contradicting itself, and the bombe throws ' +
  'it out. So the drawing of the links, the menu, decides how well a run goes. Wilcox’s rule of thumb asks for two ' +
  'closures and 13 to 14 links.'

const LINKS = V14_MENU.edges.length

const scenes: readonly SceneDef[] = [
  {
    id: 'turing',
    kind: 'story',
    title: 'A machine for cribs',
    stage: null,
    story: {
      text: STORY,
      people: ['turing', 'welchman'],
      date: 'bletchley',
      facts: ['bombe-design', 'contradiction', 'wilcox', 'stops-3', 'stops-1', 'stops-0', 'turnover-risk', 'vector-14'],
    },
  },
  {
    id: 'menu-builder',
    kind: 'explore',
    title: 'Links and loops',
    stage: null,
    setup: { machine: PARKED, locks: READ_ONLY },
    introduces: ['closure'],
    bets: [
      {
        id: 'closures',
        prompt: `When all ${LINKS} links are in the menu, how many closures will it have?`,
        kind: 'number',
      },
    ],
    reveals: [{ bet: 'closures', trigger: 'toggle', label: 'Add the remaining links' }],
    tasks: [{ id: 'add-all', label: `Build the whole menu: all ${LINKS} links` }],
    View: MenuBuilderView,
  },
  {
    id: 'loop',
    kind: 'explore',
    title: 'Round the loop',
    stage: null,
    setup: { machine: PARKED, locks: READ_ONLY },
    introduces: ['loop'],
    bets: [
      {
        id: 'contradicts',
        prompt: 'Three assumptions for A’s partner. Followed round the loop A–T–L–K, which one contradicts itself?',
        kind: 'choice',
        options: LOOP_TOY.options.map((x) => ({ id: x, label: `A ↔ ${x}` })),
      },
      {
        id: 'stops',
        prompt:
          'Turing estimated how many stops a bombe run gives per wheel order. For a menu of 8 letters with 3 closures, about how many?',
        kind: 'choice',
        options: [...STOP_TABLE]
          .sort((a, b) => a.stops - b.stops)
          .map((r) => ({ id: String(r.stops), label: formatStops(r.stops) })),
      },
    ],
    reveals: [
      { bet: 'contradicts', trigger: 'run', label: 'Follow all three round the loop' },
      { bet: 'stops', trigger: 'play', label: 'Show Turing’s table' },
    ],
    tasks: [{ id: 'follow-loop', label: 'Follow an assumption of your own round the loop' }],
    View: LoopView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Menus for the bombe',
    stage: null,
    setup: { machine: PARKED, locks: READ_ONLY },
    gate: 'menus',
  },
]

const chapter = {
  id: 'iii10-menus',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
