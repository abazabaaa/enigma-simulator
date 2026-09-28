/**
 * Chapter I.2 · Stepping, notches, the double step, ring versus position (PLAN §4.4 "i2-stepping"; the contract
 * pilot, PR 07). A story, three explore scenes (each bet gates its reveal) and gate `stepping`.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import { DOUBLE_START, GATES, READ_ONLY, START } from './gates'
// The e2e typecheck (tsconfig.node.json, no `jsx`) reaches this file through content/registry.ts: it must not
// follow the .tsx imports (TS6142). The app and unit-test configs type them normally. Proposed fix: "jsx" in
// tsconfig.node.json (owned by 02); then these two directives go.
// @ts-ignore TS6142 under tsconfig.node.json only
import { ITEM_UI } from './items'
// @ts-ignore TS6142 under tsconfig.node.json only
import { DoubleStepView, RingVsCoreView, StepFirstView } from './scenes'

/** The machine is fixed; only the keyboard (and in ring-vs-core, after its reveal, the rings) is the learner's. */
const FIXED: MachineLocks = { model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true }

const WHICH_ROTORS = [
  { id: 'right', label: 'Only the right rotor' },
  { id: 'right-middle', label: 'The right and the middle rotor' },
  { id: 'all', label: 'All three rotors' },
] as const

const STORY =
  'Warsaw, late 1932. Marian Rejewski, one of three young mathematicians hired in Warsaw that September, wrote the Enigma down ' +
  'as permutations: S for the plugboard, H for the entry wheel, N, M and L for the right, middle and left rotors, R for the ' +
  'reflector (this course writes U). The right rotor turns one place before every letter, so he gave that motion its own ' +
  'letter: P, the shift of the whole alphabet by one place. The first letter of a message meets P once, the second P twice. ' +
  'By the end of the year he had recovered the rotor wirings. This chapter is about P, and about the rarer moments when the ' +
  'other rotors move too.'

const scenes: readonly SceneDef[] = [
  {
    id: 'rejewski-p',
    kind: 'story',
    title: 'One letter for a turning rotor',
    stage: null,
    story: { text: STORY, people: ['rejewski'], date: 'wirings', facts: ['hired', 'notation', 'powers'] },
  },
  {
    id: 'step-first',
    kind: 'explore',
    title: 'The rotors step before the current flows',
    stage: 'pawls',
    worked: true,
    setup: { machine: START, locks: FIXED },
    panels: { keyboard: true, rotors: true, trace: true, playback: true },
    introduces: ['stepping'],
    bets: [
      {
        id: 'first-press',
        prompt: 'The windows show AAA. You press A. What happens to the rotors?',
        kind: 'choice',
        options: [
          { id: 'none', label: 'No rotor moves', misconception: true },
          { id: 'right', label: 'The right rotor moves first, before the current flows' },
          { id: 'all', label: 'All three rotors move', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'first-press', trigger: 'press', key: 'A' }],
    tasks: [{ id: 'press1', label: 'Press one more key and watch the right rotor step again' }],
    View: StepFirstView,
  },
  {
    id: 'double-step',
    kind: 'explore',
    title: 'The double step',
    stage: 'pawls',
    setup: { machine: DOUBLE_START, locks: READ_ONLY },
    panels: { rotors: true, trace: true },
    introduces: ['double-step'],
    bets: [
      { id: 'adu', prompt: 'First step, from ADU: which rotors move?', kind: 'choice', options: WHICH_ROTORS },
      { id: 'adv', prompt: 'Second step: which rotors move?', kind: 'choice', options: WHICH_ROTORS },
      { id: 'aew', prompt: 'Third step: which rotors move?', kind: 'choice', options: WHICH_ROTORS },
    ],
    reveals: [
      { bet: 'adu', trigger: 'step', key: 'A', label: 'First step' },
      { bet: 'adv', trigger: 'step', key: 'A', label: 'Second step' },
      { bet: 'aew', trigger: 'step', key: 'A', label: 'Third step' },
    ],
    tasks: [{ id: 'reach-bfx', label: 'Step the machine from ADU to BFX' }],
    View: DoubleStepView,
  },
  {
    id: 'ring-vs-core',
    kind: 'explore',
    title: 'Ring setting versus rotor position',
    stage: 'rotor-layers',
    setup: { machine: START, locks: { ...FIXED, hold: true } },
    panels: { rotors: true, rings: true, keyboard: true },
    introduces: ['ring'],
    bets: [
      {
        id: 'ring-window',
        prompt: "The right rotor's ring setting goes from 01 to 05; nobody touches the rotor. What happens?",
        kind: 'choice',
        options: [
          { id: 'window', label: 'The window letter changes', misconception: true },
          { id: 'wiring', label: 'The window letter stays, and the wiring turns under it' },
          { id: 'notch', label: 'The notch moves to another turnover letter', misconception: true },
        ],
      },
    ],
    reveals: [{ bet: 'ring-window', trigger: 'toggle', label: 'Turn the right ring to 05' }],
    tasks: [
      { id: 'change-ring', label: 'Change a ring setting yourself' },
      { id: 'compare-lamps', label: 'Press the same key at the same windows under two ring settings' },
    ],
    View: RingVsCoreView,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Stepping and rings',
    stage: 'pawls',
    setup: { machine: START, locks: READ_ONLY },
    gate: 'stepping',
  },
]

const chapter = {
  id: 'i2-stepping',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
