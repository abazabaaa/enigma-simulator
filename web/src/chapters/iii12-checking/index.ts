/**
 * Chapter III.12 · Stop → checking machine → key (PLAN §4.4 "iii12-checking"; closes Act III). The Wrens and Hut 6
 * (story); one bombe run's stops (bet: how many are the key); the checking machine, an Enigma without its plugboard,
 * on those stops; gate `checking`: a stop's verdict on the checking machine, then the day's key set on the machine so
 * the whole message decrypts. Rings stay at 01 01 01 (finding them came afterwards).
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { CHECKING_LOCKS, GATES, PARKED, READ_ONLY, STOP_LIST, checkingMachine, sceneCheckData } from './gates'
import { ITEM_UI } from './items'
import { CheckingView, StopsView } from './scenes'

const STORY =
  'Bletchley Park, March 1941: the first Wrens arrive to operate the bombes, and by 1945 some 2,000 of them keep the drums ' +
  'turning. But a stop is not yet a key. Stops had to be checked, because no letter can be steckered to more than one other ' +
  'letter: a checking machine, its drums set like the bombe’s, follows the crib from the stop’s hypothesis, and a letter ' +
  'forced to take two partners kills the stop. In Gordon Welchman’s Hut 6 the remaining cables and the ring settings were then ' +
  'worked out, and the settings were tried on Typex machines adapted to act as Enigmas. This chapter keeps the rings at 01 01 ' +
  '01; finding them came afterwards.'

const scenes: readonly SceneDef[] = [
  {
    id: 'wrens',
    kind: 'story',
    title: 'The Wrens and Hut 6',
    stage: null,
    story: {
      text: STORY,
      people: ['welchman'],
      date: 'wrens',
      facts: ['wrens-1945', 'two-partners', 'checking-machine', 'typex', 'typex-bombe'],
    },
  },
  {
    id: 'stops',
    kind: 'explore',
    title: 'A bombe run’s stops',
    stage: null,
    setup: { machine: PARKED, locks: READ_ONLY },
    introduces: ['checking'],
    bets: [
      {
        id: 'true-stops',
        prompt: 'The bombe runs through every position of the day’s wheel order and stops several times. How many of its stops are the day’s key?',
        kind: 'choice',
        options: [
          { id: 'all', label: 'All of them: a stop is the key', misconception: true },
          { id: 'most-false', label: 'One of them; the rest are false stops' },
          { id: 'none', label: 'None: the key never makes the bombe stop', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'true-stops', trigger: 'run', label: 'Run the wheel order' }],
    tasks: [{ id: 'see-stops', label: 'Let the run finish' }],
    View: StopsView,
  },
  {
    id: 'checking-machine',
    kind: 'explore',
    title: 'The checking machine',
    stage: 'checking',
    setup: { machine: checkingMachine(sceneCheckData(STOP_LIST[0]![0])), locks: CHECKING_LOCKS },
    shows: ['checking'],
    freePress: true,
    tasks: [{ id: 'check2', label: 'Check two stops to the end' }],
    View: CheckingView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'From stop to key',
    stage: 'checking',
    setup: { machine: PARKED, locks: READ_ONLY },
    gate: 'checking',
  },
]

const chapter = {
  id: 'iii12-checking',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
