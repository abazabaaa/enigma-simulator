/**
 * Chapter III.11 · The bombe circuit (PLAN §4.4 "iii11-bombe"; the novel artefact). Victory and Agnus Dei (story);
 * Ellsbury's eight-letter bombe stepped scrambler by scrambler (bet on the live wires of a wrong hypothesis); the same
 * circuit with 26 wires on a real crib (bet 1 / 25 / 26); Welchman's diagonal board over a whole wheel order in a
 * worker (bet on the stop count); gate `bombe`. Every scene is 2D only (no stage).
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { B26, GATES, PARKED, READ_ONLY, TOY8, TOY8_FIRST_WIRE, testOf } from './gates'
import { ITEM_UI } from './items'
import { DiagonalView, Wire26View, Wire8View } from './scenes'

const STORY =
  'Bletchley Park, 18 March 1940. The first bombe, Victory, is delivered: Alan Turing’s design, turned into a working ' +
  'machine by Harold Keen of the British Tabulating Machine Company. Its 36 Enigma equivalents test all 17,576 positions of ' +
  'a wheel order in about 20 minutes. Popular accounts give Turing’s bombe a diagonal board, but Victory had none. The board ' +
  'was Gordon Welchman’s idea, shown early in 1940: if B is steckered to G, then G is steckered to B, so one wire can light ' +
  'another. Agnus Dei, the next bombe, arrived on 8 August 1940 with the board fitted. This chapter wires the circuit, first ' +
  'with eight letters, the way Graham Ellsbury drew it.'

const SETUP = { machine: PARKED, locks: READ_ONLY }
const T8 = testOf(TOY8.toy)

const scenes: readonly SceneDef[] = [
  {
    id: 'victory',
    kind: 'story',
    title: 'Victory and Agnus Dei',
    stage: null,
    story: {
      text: STORY,
      people: ['turing', 'welchman', 'keen'],
      date: 'victory',
      facts: ['agnus-dei', 'bombe-design', 'board-welchman', 'drums', 'run-time', 'register', 'ellsbury'],
    },
  },
  {
    id: 'wire-8',
    kind: 'explore',
    title: 'Eight wires',
    stage: null,
    setup: SETUP,
    introduces: ['wires'],
    bets: [
      {
        id: 'live8',
        prompt: `The drums are at the day’s position, but ${T8} is not steckered to ${TOY8_FIRST_WIRE}. The voltage goes onto wire ${TOY8_FIRST_WIRE.toLowerCase()} of cable ${T8}. Once it has spread through all four scramblers, how many of the 8 register wires are live?`,
        kind: 'choice',
        options: [
          { id: '1', label: '1 wire: only the one the voltage went onto' },
          { id: '7', label: '7 wires' },
          { id: '8', label: 'All 8 wires', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'live8', trigger: 'run', label: 'Switch on the current' }],
    tasks: [
      { id: 'run-end', label: 'Step the current round the loop until it is back where it started' },
      { id: 'true-hyp', label: 'Find the hypothesis that lights a single register wire' },
      { id: 'wrong-pos', label: 'Move the drums to a wrong position and run the current again' },
    ],
    View: Wire8View,
  },
  {
    id: 'wire-26',
    kind: 'explore',
    title: 'Twenty-six wires',
    stage: null,
    setup: SETUP,
    shows: ['wires'],
    bets: [
      {
        id: 'live26',
        prompt: `The drums are at the day’s position, ${B26.truth}. The voltage goes onto wire ${B26.firstWire.toLowerCase()} of cable ${B26.test}, and ${B26.test} is not steckered to ${B26.firstWire}. How many of the 26 register wires will be live?`,
        kind: 'choice',
        options: [
          { id: '1', label: '1 wire' },
          { id: '25', label: '25 wires' },
          { id: '26', label: 'All 26 wires', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'live26', trigger: 'run', label: 'Switch on the 26-wire bombe' }],
    tasks: [
      { id: 'dead-wire', label: 'Put the voltage on the one register wire that stayed dead' },
      { id: 'wrong-pos', label: 'Move the drums to a wrong position' },
    ],
    View: Wire26View,
  },
  {
    id: 'diagonal',
    kind: 'explore',
    title: 'Welchman’s diagonal board',
    stage: null,
    setup: SETUP,
    introduces: ['diagonal'],
    bets: [
      {
        id: 'diag',
        prompt: 'Run the same menu through every position of the wheel order, with and without the diagonal board. With the board, the bombe stops…',
        kind: 'choice',
        options: [
          { id: 'fewer', label: 'less often' },
          { id: 'same', label: 'just as often' },
          { id: 'more', label: 'more often', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'diag', trigger: 'run', label: 'Run the wheel order, board off and on' }],
    tasks: [{ id: 'both-runs', label: 'Let both runs finish' }],
    View: DiagonalView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'The bombe circuit',
    stage: null,
    setup: SETUP,
    gate: 'bombe',
  },
]

const chapter = {
  id: 'iii11-bombe',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
