/**
 * Chapter II.8 · Zygalski sheets (PLAN §4.4 "ii8-sheets"; OPTIONAL: the registry marks it optional, so it never
 * blocks III.9). A story (the procedure change of 15 September 1938), the females (the bet on the share of holes
 * gates the first sheet), the light table (stack the day's sheets until the light converges; the bet on how many
 * females isolate one of 105,456 settings gates the scale-up), and gate `sheets`: two estimates, with a light table to
 * stack as the hands-on fallback.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { ALL_SETTINGS, GATES, QUIET_MACHINE, READ_ONLY, SURVIVE_OPTIONS } from './gates'
import { ITEM_UI } from './items'
import { FemalesView, LightTableView } from './scenes'

const STORY =
  'On 15 September 1938 the Germans changed the procedure: each operator now chose his own starting position, sent it ' +
  'in clear, and typed his doubled message key from there. Rejewski’s card catalogue, which needed one ground setting ' +
  'for the whole day, became useless. But the key was still typed twice, and about one message in eight showed a ' +
  'female: the same letter at places 1 and 4, 2 and 5, or 3 and 6. About October, Henryk Zygalski answered with ' +
  'perforated sheets, a hole wherever a female can occur. By mid-November six bombas were at work too. Then, on ' +
  '15 December 1938, rotors IV and V arrived: 60 wheel orders instead of 6.'

const scenes: readonly SceneDef[] = [
  {
    id: 'zygalski',
    kind: 'story',
    title: 'A new procedure, a new method',
    stage: null,
    story: {
      text: STORY,
      people: ['zygalski', 'rejewski'],
      date: 'procedure',
      facts: ['catalogue-useless', 'females', 'sheets', 'bomba', 'rotors-iv-v', 'forty-percent'],
    },
  },
  {
    id: 'females',
    kind: 'explore',
    title: 'Females',
    stage: null,
    setup: { machine: QUIET_MACHINE, locks: READ_ONLY },
    introduces: ['female'],
    bets: [
      {
        id: 'survive',
        prompt:
          'A sheet has a hole at every middle and right position where a female at places 1 and 4 can occur. About what ' +
          'share of its 676 positions are holes?',
        kind: 'choice',
        options: SURVIVE_OPTIONS,
      },
    ],
    reveals: [{ bet: 'survive', trigger: 'play', label: 'Lay out a sheet' }],
    View: FemalesView,
  },
  {
    id: 'light-table',
    kind: 'explore',
    title: 'The light table',
    stage: null,
    setup: { machine: QUIET_MACHINE, locks: READ_ONLY },
    shows: ['female'],
    bets: [
      {
        id: 'isolate',
        prompt:
          `Without the wheel order or the left ring, every one of the ${ALL_SETTINGS.toLocaleString('en-US')} settings is ` +
          'possible. How many females until no more than two are left?',
        kind: 'number',
      },
    ],
    reveals: [{ bet: 'isolate', trigger: 'play', label: 'Scale up' }],
    tasks: [{ id: 'converge', label: 'Stack sheets until at most two settings are lit' }],
    View: LightTableView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Sheets',
    stage: null,
    setup: { machine: QUIET_MACHINE, locks: READ_ONLY },
    gate: 'sheets',
  },
]

const chapter = {
  id: 'ii8-sheets',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
