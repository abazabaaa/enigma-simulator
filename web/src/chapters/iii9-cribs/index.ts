/**
 * Chapter III.9 · Cribs and placement (PLAN §4.4 "iii9-cribs"). The act recall, the Pyry story with the act clock
 * (1 May 1940), the crashes scene (a bet before the crash reveal, then sliding the crib to no crash) and gate `cribs`.
 * Every scene is 2D-only (no stage); the gate scene keeps the machine locked with the lamps hidden.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { BET_OFFSET, DEMO_MACHINE, GATES, READ_ONLY } from './gates'
import { ITEM_UI } from './items'
import { CrashesView } from './scenes'

const STORY =
  'Pyry, near Warsaw, July 1939: the Poles, Marian Rejewski among them, showed the British and French how they read Enigma. ' +
  'Dilly Knox’s first question was the wiring of the entry drum. The Polish methods fed on one habit: every message key ' +
  'was enciphered twice. On 1 May 1940 the Germans stopped, and those methods went dark overnight. Bletchley Park needed ' +
  'other ways in. John Herivel had guessed in February that some operators set the day’s rings, then began their first ' +
  'message from whatever the rotors showed; his tip gave the first break on 22 May. Lazy keys such as AAA, the cillies, ' +
  'helped too. The lasting way in was the crib: a guess at part of the plaintext.'

const scenes: readonly SceneDef[] = [
  { id: 'recall', kind: 'recall', title: 'Before Act III: recall', stage: null, recall: { count: 3 } },
  {
    id: 'pyry',
    kind: 'story',
    title: 'The doubled key disappears',
    stage: null,
    story: {
      text: STORY,
      people: ['rejewski', 'knox', 'herivel'],
      date: 'pyry',
      facts: ['knox-etw', 'doubling-ends', 'herivel-insight', 'herivel-break', 'cillies', 'cribs', 'no-self', 'vector-14'],
      clock: {
        date: 'doubling-ends',
        caption: 'Overnight the doubled indicator disappeared, and the Polish methods stopped working.',
      },
    },
  },
  {
    id: 'crashes',
    kind: 'explore',
    title: 'Where can the crib sit?',
    stage: null,
    setup: { machine: DEMO_MACHINE, locks: READ_ONLY },
    introduces: ['crash'],
    bets: [
      {
        id: 'fits',
        prompt: `Can the crib sit at offset ${BET_OFFSET}, where it is written above?`,
        kind: 'choice',
        options: [
          { id: 'yes', label: 'Yes, it could sit there' },
          { id: 'no', label: 'No, it cannot sit there' },
        ],
      },
    ],
    reveals: [{ bet: 'fits', trigger: 'toggle', label: 'Check the columns' }],
    tasks: [{ id: 'slide', label: 'Slide the crib to an offset where it can sit' }],
    View: CrashesView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Placing cribs',
    stage: null,
    setup: { machine: DEMO_MACHINE, locks: READ_ONLY },
    gate: 'cribs',
  },
]

const chapter = {
  id: 'iii9-cribs',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
