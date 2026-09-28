/**
 * Prologue · the hook (PLAN §4.4 "prologue"): a story with the act clock, the whole machine to type on (a bet on
 * the first press, five letters, the paper tape's round trip) and the brute-force question answered with the key
 * space. No gate: completing every task and committing every bet completes the chapter and unlocks I.1.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { GATES, START, TYPE_ONLY } from './gates'
import { ITEM_UI } from './items'
import { BruteForceView, TypeAWordView } from './scenes'

const STORY =
  'On 23 February 1918 Arthur Scherbius filed a patent for a cipher machine. Press a key and a lamp lights: always a ' +
  'different letter. Wired wheels inside turn at every key press, so the same key pressed again lights another lamp. ' +
  'Approximately 40,000 Enigma machines were built. Their operators set them to a new key every day, and without that ' +
  "day's key a message was letter salad. This course takes the machine apart, then follows the people who broke it " +
  'anyway. First, the machine itself: type a word.'

const scenes: readonly SceneDef[] = [
  {
    id: 'scherbius',
    kind: 'story',
    title: 'A machine for secrets',
    stage: null,
    story: {
      text: STORY,
      people: ['scherbius'],
      date: 'patent',
      facts: ['machines', 'keyspace'],
      clock: { date: 'patent', caption: 'Each day brought a new key.' },
    },
  },
  {
    id: 'type-a-word',
    kind: 'explore',
    title: 'Type a word',
    stage: 'type-a-word',
    setup: { machine: START, locks: TYPE_ONLY },
    panels: { keyboard: true, lamps: true, tape: true },
    introduces: ['typing'],
    bets: [
      {
        id: 'own-letter',
        prompt: 'Press any key. What lights up?',
        kind: 'choice',
        options: [
          { id: 'own', label: 'The lamp of the same letter', misconception: true },
          { id: 'other', label: 'The lamp of another letter' },
          { id: 'none', label: 'No lamp at all', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'own-letter', trigger: 'press' }],
    tasks: [
      { id: 'type5', label: 'Type at least five letters' },
      { id: 'roundtrip', label: 'Clear and rewind the tape, type the ciphertext, and get your word back' },
    ],
    View: TypeAWordView,
  },
  {
    id: 'brute-force',
    kind: 'explore',
    title: 'Can brute force work?',
    stage: 'overview',
    setup: { machine: START, locks: TYPE_ONLY },
    bets: [
      {
        id: 'brute',
        prompt: 'Could someone with a captured machine, but not the key, simply try every key?',
        kind: 'choice',
        options: [
          { id: 'year', label: 'Yes, within a year', misconception: true },
          { id: 'thousands', label: 'Only with thousands of machines', misconception: true },
          { id: 'no', label: 'No, not in the lifetime of the universe' },
        ],
      },
    ],
    reveals: [{ bet: 'brute', trigger: 'play', label: 'Count the keys' }],
    tasks: [{ id: 'seen', label: 'See how many keys there are' }],
    View: BruteForceView,
  },
]

const chapter = {
  id: 'prologue',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
