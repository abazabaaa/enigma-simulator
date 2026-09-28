/**
 * Chapter II.7 · The cyclometer and the catalogue (PLAN §4.4 "ii7-catalogue"; problem-first). A story, the cyclometer
 * (two rotor sets three steps apart light a whole cycle; the bet gates the first key), the catalogue built live in a
 * worker (the bet gates the build), and gate `catalogue`: build the key, look it up and pick the right card entry with a
 * test decrypt, recover the cables, a transfer to raw traffic and another wheel order, and the day's routine in order.
 * Rings stay at 01 throughout.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import {
  BUCKET_OPTIONS,
  CATALOGUE_SETTINGS,
  CYCLO_DAY,
  CYCLO_KEY,
  GATES,
  POSSIBLE_CHARACTERISTICS,
  READ_ONLY,
  cyclometerWindows,
} from './gates'
import { ITEM_UI } from './items'
import { CatalogueView, CyclometerView } from './scenes'

/** The cyclometer's machine: nothing to set, and a key press never steps it (hold); the bet gates the keys. */
const CYCLO_LOCKS: MachineLocks = { ...READ_ONLY, keyboard: false, hold: true }

const [W1, W4] = cyclometerWindows(CYCLO_DAY, 0)
const fmt = (n: number) => n.toLocaleString('en-US')

const STORY =
  'Warsaw, 1934 or 1935. Every day the doubled indicators gave Marian Rejewski three products, AD, BE and CF, whose ' +
  'cycle lengths no plugboard could change. To measure them he built the cyclometer: two sets of rotors, the second ' +
  'three positions beyond the first, wired so that one key lights every letter of a cycle and of its partner. With it ' +
  'a card was written for each of the 105,456 rotor orders and ground settings, filed under its cycle lengths. It took ' +
  'over a year. After that a day’s key was usually a matter of ten to twenty minutes. Then, on 2 November 1937, the ' +
  'Germans exchanged reflector A for reflector B, and every card had to be made again.'

const scenes: readonly SceneDef[] = [
  {
    id: 'cyclometer-story',
    kind: 'story',
    title: 'A machine that measures cycles',
    stage: null,
    story: {
      text: STORY,
      people: ['rejewski'],
      date: 'cyclometer',
      facts: ['two-sets', 'settings', 'over-a-year', 'minutes', 'reflector-b'],
    },
  },
  {
    id: 'cyclometer',
    kind: 'explore',
    title: 'The cyclometer',
    stage: null,
    setup: { machine: CYCLO_DAY, locks: CYCLO_LOCKS },
    introduces: ['cyclometer'],
    bets: [
      {
        id: 'lamps',
        prompt:
          `The first set stands at ${W1}, the second three steps on at ${W4}. An Enigma lights one lamp per key. ` +
          `You press ${CYCLO_KEY} on the cyclometer: how many lamps light?`,
        kind: 'number',
      },
    ],
    reveals: [{ bet: 'lamps', trigger: 'press', key: CYCLO_KEY }],
    tasks: [{ id: 'press3', label: 'Light three different pairs of cycles' }],
    View: CyclometerView,
  },
  {
    id: 'catalogue',
    kind: 'explore',
    title: 'A card for every setting',
    stage: null,
    setup: { machine: CYCLO_DAY, locks: READ_ONLY },
    introduces: ['catalogue'],
    bets: [
      {
        id: 'bucket',
        prompt:
          `The catalogue files ${fmt(CATALOGUE_SETTINGS)} settings under their characteristics, and ` +
          `${fmt(POSSIBLE_CHARACTERISTICS)} characteristics are possible. Look up a random day: about how many settings ` +
          'will its card list?',
        kind: 'choice',
        options: BUCKET_OPTIONS,
      },
    ],
    reveals: [{ bet: 'bucket', trigger: 'run', label: 'Build the catalogue' }],
    tasks: [{ id: 'built', label: 'Build the catalogue and read how its cards fill' }],
    View: CatalogueView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'The catalogue at work',
    stage: null,
    setup: { machine: CYCLO_DAY, locks: READ_ONLY },
    gate: 'catalogue',
  },
]

const chapter = {
  id: 'ii7-catalogue',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
