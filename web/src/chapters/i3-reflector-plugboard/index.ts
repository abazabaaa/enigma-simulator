/**
 * Chapter I.3 · Reflector, plugboard, reciprocity (PLAN §4.4 "i3-reflector-plugboard"). A story, four explore
 * scenes (the reflector's 13 wires; the plugboard crossed twice; reciprocity; the search for a letter that lights
 * itself) and gate `reflector`, whose code item compose/inverse is paired with the in-page plug-to-hit.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { DEMO_CABLES, DEMO_KEY, FIXED, GATES, PLUG_START, READ_ONLY, RECIPROCITY_START, SEARCH_START, START } from './gates'
import { ITEM_UI } from './items'
import { PlugboardTwiceView, ReciprocityView, ReflectorPairsView, SelfSearchView } from './scenes'

const STORY =
  'Bletchley Park, 4 September 1939, the day after Britain declared war. Alan Turing and Gordon Welchman report for work. The ' +
  'machine they face has two more parts than its rotors. A reflector at the far end sends the current back through the rotors on ' +
  'a different wire, and a plugboard at the front swaps letters in pairs. Together they make Enigma its own inverse: the setting ' +
  'that enciphers a message also deciphers it. They also guarantee that no letter is ever enciphered as itself, "a severe ' +
  'cryptological flaw". A guessed word, a crib, cannot sit where one of its letters meets the same ciphertext letter. Turing ' +
  'designed the bombe that year.'

const scenes: readonly SceneDef[] = [
  {
    id: 'bletchley',
    kind: 'story',
    title: 'Two parts that make a flaw',
    stage: null,
    story: { text: STORY, people: ['turing', 'welchman'], date: 'bletchley', facts: ['flaw', 'crashes', 'bombe'] },
  },
  {
    id: 'reflector-pairs',
    kind: 'explore',
    title: 'The reflector: 26 contacts',
    stage: 'reflector',
    worked: true,
    // G14: no cables in the reflector scene (the reflector preset hides the plugboard).
    setup: { machine: START, locks: { ...FIXED, keyboard: true } },
    introduces: ['reflector'],
    bets: [
      {
        id: 'pairs',
        prompt: 'The reflector has 26 contacts, joined by wires inside it. How many wires does it hold?',
        kind: 'number',
      },
    ],
    reveals: [{ bet: 'pairs', trigger: 'play', label: 'Play: light the wires' }],
    tasks: [{ id: 'seen', label: 'Watch every wire light' }],
    View: ReflectorPairsView,
  },
  {
    id: 'plugboard-twice',
    kind: 'explore',
    title: 'The plugboard, crossed twice',
    stage: 'plugboard',
    setup: { machine: PLUG_START, locks: { ...FIXED, plugboard: false } },
    panels: { plugboard: true, keyboard: true, trace: true },
    introduces: ['plugboard'],
    bets: [
      {
        id: 'twice',
        prompt: `Cables ${DEMO_CABLES.join(' and ')} are plugged. You press ${DEMO_KEY}. How many times does the current cross the plugboard?`,
        kind: 'choice',
        options: [
          { id: 'once', label: 'Once, on its way in', misconception: true },
          { id: 'twice', label: 'Twice: on its way in and on its way out' },
          { id: 'if-plugged', label: 'Only when the pressed key has a cable', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'twice', trigger: 'press', key: DEMO_KEY }],
    tasks: [
      { id: 'add2', label: 'Plug two cables of your own' },
      { id: 'press-plugged', label: 'Press a key on one of your cables and find both plugboard rows in the trace' },
    ],
    View: PlugboardTwiceView,
  },
  {
    id: 'reciprocity',
    kind: 'explore',
    title: 'The same setting deciphers',
    stage: 'wire',
    setup: { machine: RECIPROCITY_START, locks: FIXED },
    panels: { keyboard: true, lamps: true, tape: true },
    // 'path' (PLAN §4.4) is introduced by I.1, still a placeholder on this base: the scene shows the two parts
    // introduced in this chapter instead.
    shows: ['reflector', 'plugboard'],
    freePress: true,
    tasks: [{ id: 'roundtrip', label: 'Type a word, rewind the tape, type the ciphertext: read your word back' }],
    View: ReciprocityView,
  },
  {
    id: 'self-search',
    kind: 'explore',
    title: 'A letter that lights itself?',
    stage: 'wire',
    setup: { machine: SEARCH_START, locks: { ...FIXED, positions: false } },
    panels: { keyboard: true, lamps: true, rotors: true },
    introduces: ['no-self'],
    bets: [
      {
        id: 'self',
        prompt: 'Somewhere among all 17,576 rotor positions, will key A ever light lamp A?',
        kind: 'choice',
        options: [
          { id: 'yes', label: 'Yes, at some positions', misconception: true },
          { id: 'no', label: 'No, never' },
          { id: 'cables', label: 'Only when A has a cable', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'self', trigger: 'run', label: 'Run: try every position' }],
    tasks: [{ id: 'searched', label: 'Search all 17,576 positions' }],
    View: SelfSearchView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Reflector and plugboard',
    stage: 'plugboard',
    setup: { machine: START, locks: READ_ONLY },
    gate: 'reflector',
  },
]

const chapter = {
  id: 'i3-reflector-plugboard',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
