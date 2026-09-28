/**
 * Chapter iv-capstone · Act IV · "the day key" (PLAN §4.4 iv-capstone, brief 16): the course's closing exercise, the
 * original notebook's scenario (midnight at Bletchley, a new day key, intercepts piling up) framed openly as training.
 * Recall across the three acts, the story, then each route twice: a tool scene on a practice day, and a puzzle gate
 * (first hint at attempt 3, a fresh day on every answer). The course is complete when the british gate passes.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { BRITISH_START, GATES, POLISH_START, READ_ONLY } from './gates'
import { ITEM_UI } from './items'
import { BritishToolsView, PolishToolsView } from './scenes'

const STORY =
  'Midnight at Bletchley Park. A new day key came into force a minute ago, yesterday’s settings are useless, and intercepts ' +
  'are piling up. This is a training exercise, framed openly: the traffic is generated, and the clock marks the story, not ' +
  'you. It also bends history. Marian Rejewski’s catalogue needed every operator to encipher his doubled message key at one ' +
  'ground setting for the whole day; that ended on 15 September 1938, and the doubling itself on 1 May 1940. So tonight you ' +
  'break two days: a 1936-style day the Warsaw way, from its indicators, and a 1940-style day the way Alan Turing’s bombe ' +
  'did, from a crib. Bletchley’s part stayed secret until 1974.'

const scenes: readonly SceneDef[] = [
  { id: 'recall', kind: 'recall', title: 'Recall: one question from each act', stage: null, recall: { count: 3 } },
  {
    id: 'midnight',
    kind: 'story',
    title: 'Midnight at Bletchley',
    stage: null,
    story: {
      text: STORY,
      people: ['rejewski', 'turing'],
      date: 'secret-lifted',
      facts: ['indicator-change', 'bombe-design', 'doubling-ends'],
      clock: {
        date: 'doubling-ends',
        time: '00:00',
        caption: 'A training exercise, framed openly. The clock marks the story, not you: nothing here is timed.',
      },
    },
  },
  {
    id: 'polish-tools',
    kind: 'explore',
    title: 'The Warsaw tools, on a practice day',
    stage: null,
    shows: ['AD', 'catalogue'],
    tasks: [{ id: 'open-tools', label: 'Look the practice day’s characteristic up in the catalogue' }],
    View: PolishToolsView,
  },
  {
    id: 'polish',
    kind: 'gate',
    title: 'Break a day of the doubled indicator',
    stage: null,
    setup: { machine: POLISH_START, locks: READ_ONLY },
    gate: 'polish',
  },
  {
    id: 'british-tools',
    kind: 'explore',
    title: 'The Bletchley tools, on a practice day',
    stage: null,
    shows: ['crash', 'closure', 'wires'],
    tasks: [{ id: 'open-tools', label: 'Run the bombe on the practice intercept and check a stop' }],
    View: BritishToolsView,
  },
  {
    id: 'british',
    kind: 'gate',
    title: 'Break a wartime day',
    stage: null,
    setup: { machine: BRITISH_START, locks: READ_ONLY },
    gate: 'british',
  },
]

const chapter = {
  id: 'iv-capstone',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
