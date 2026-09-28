/**
 * Chapter II.5 · Indicators → AD, BE, CF (PLAN §4.4 "ii5-indicators"): the Act I recall, the Warsaw story with the
 * act clock, a message key typed twice on the day's machine, the 65 indicators filling AD's table, and gate
 * `indicators`.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { DAY, GATES, HALVES_OPTIONS, KEYS_ONLY, READ_ONLY } from './gates'
import { ITEM_UI } from './items'
import { AdFrom65View, DoubleKeyView } from './scenes'

const STORY =
  'On 1 September 1932 three young mathematicians were hired in Warsaw: Marian Rejewski, Henryk Zygalski and Jerzy ' +
  'Różycki. On 9 December 1932 Gustave Bertrand passed on key tables that the French had bought from Hans-Thilo ' +
  "Schmidt. Rejewski's way into the machine was a habit of its operators. Every message began with its own " +
  "three-letter key, typed twice from the day's start position, the Grundstellung. A day's traffic brought dozens of " +
  'these six-letter indicators, and a list of 65 from one day survives. This chapter turns such a list into three ' +
  'permutations: AD, BE and CF.'

const scenes: readonly SceneDef[] = [
  { id: 'recall', kind: 'recall', title: 'Recall: the machine', stage: null, recall: { count: 3 } },
  {
    id: 'warsaw',
    kind: 'story',
    title: 'Warsaw',
    stage: null,
    story: {
      text: STORY,
      people: ['rejewski', 'zygalski', 'rozycki', 'schmidt', 'bertrand'],
      date: 'tables',
      facts: ['hired', 'bought', 'doubled', 'sixty-five'],
      clock: {
        date: 'tables',
        caption:
          'The tables covered September and October 1932: keys already expired. What they could reveal was the wiring.',
      },
    },
  },
  {
    id: 'double-key',
    kind: 'explore',
    title: 'A key typed twice',
    stage: 'wire',
    worked: true,
    setup: { machine: DAY, locks: KEYS_ONLY },
    panels: { keyboard: true, lamps: true, rotors: true, trace: true },
    introduces: ['indicator'],
    bets: [
      {
        id: 'halves',
        prompt: 'You will type one three-letter key twice from the Grundstellung. What will the six lamps show?',
        kind: 'choice',
        options: HALVES_OPTIONS,
      },
    ],
    reveals: [{ bet: 'halves', trigger: 'press' }],
    tasks: [{ id: 'type-key-twice', label: 'Type one message key twice from the Grundstellung' }],
    View: DoubleKeyView,
  },
  {
    id: 'ad-from-65',
    kind: 'explore',
    title: 'Sixty-five indicators',
    stage: null,
    worked: true,
    setup: { machine: DAY, locks: READ_ONLY },
    introduces: ['AD'],
    bets: [
      {
        id: 'ad-fixed',
        prompt: 'Can AD send a letter to itself?',
        kind: 'choice',
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
      },
    ],
    reveals: [{ bet: 'ad-fixed', trigger: 'play', label: 'Play the 65 indicators' }],
    tasks: [
      { id: 'fill5', label: 'Fill five cells of AD from the indicators' },
      { id: 'fill-all', label: 'Let all 65 indicators fill AD, BE and CF' },
    ],
    View: AdFrom65View,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'From indicators to AD',
    stage: null,
    setup: { machine: DAY, locks: READ_ONLY },
    gate: 'indicators',
  },
]

const chapter = {
  id: 'ii5-indicators',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
