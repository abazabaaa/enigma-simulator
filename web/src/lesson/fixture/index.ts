/**
 * The fixture chapter 'lab-fixture' (#/lab/fixture): one scene of each kind, one bet per reveal trigger
 * (press, step, play, run, toggle), a recall scene, gate `main` with one item of every generic kind and a
 * custom item, and a puzzle gate. It is not in the course registry; it is the model for chapter PRs.
 */

import type { ChapterDef } from '../../contracts/lesson'
import { bindGates } from '../bind'
import { FACTS } from './facts'
import { GATES, TOY_STAGE } from './gates'
import { ITEM_UI } from './items'
import { BetsPressView, BetsToggleView } from './scenes'

const chapter = {
  id: 'lab-fixture',
  scenes: [
    {
      id: 'story',
      kind: 'story',
      title: 'A machine for secrets',
      stage: null,
      story: {
        text:
          'Arthur Scherbius patented a cipher machine whose rotors turned with every key press. This hidden fixture chapter walks ' +
          'through every kind of scene and question the course uses: stories, bets before each reveal, recall, gates with hints, ' +
          'and a puzzle gate.',
        people: ['scherbius'],
        date: 'patent',
        facts: ['machines'],
        clock: { date: 'patent', caption: 'A static clock: it marks the story, never you.' },
      },
    },
    {
      id: 'bets-press',
      kind: 'explore',
      title: 'Bet, then press',
      stage: 'wire',
      worked: true,
      setup: {
        machine: { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA', plugboard: [] },
        locks: { model: true, rotors: true, reflector: true, rings: true, plugboard: true },
      },
      panels: { keyboard: true, lamps: true, rotors: true },
      introduces: ['typing', 'lamp', 'stepping'],
      bets: [
        { id: 'first-lamp', prompt: 'Press A. Which lamp will light?', kind: 'letter' },
        {
          id: 'steps',
          prompt: 'Press A again with the Step button. Which rotors move?',
          kind: 'choice',
          options: [
            { id: 'right', label: 'Only the right rotor' },
            { id: 'two', label: 'The right and the middle rotor' },
            { id: 'all', label: 'All three rotors', misconception: true },
          ],
        },
        { id: 'count', prompt: 'How many stages does the current pass for one key press?', kind: 'number' },
      ],
      reveals: [
        { bet: 'first-lamp', trigger: 'press', key: 'A' },
        { bet: 'steps', trigger: 'step', key: 'A' },
        { bet: 'count', trigger: 'play' },
      ],
      tasks: [{ id: 'press2', label: 'Press two more keys' }],
      View: BetsPressView,
    },
    {
      id: 'bets-toggle',
      kind: 'explore',
      title: 'Run and toggle',
      stage: 'rotors',
      introduces: ['no-self', 'reflector'],
      bets: [
        {
          id: 'search',
          prompt: 'Press A 26 times from AAA. Does A ever light A?',
          kind: 'choice',
          options: [
            { id: 'never', label: 'Never' },
            { id: 'sometimes', label: 'About once', misconception: true },
          ],
        },
        {
          id: 'flip',
          prompt: 'Swap reflector B for C. Does the lamp for A at AAA change?',
          kind: 'choice',
          options: [
            { id: 'changes', label: 'It changes' },
            { id: 'same', label: 'It stays the same' },
          ],
        },
      ],
      reveals: [
        { bet: 'search', trigger: 'run' },
        { bet: 'flip', trigger: 'toggle' },
      ],
      tasks: [{ id: 'seen', label: 'See both results' }],
      View: BetsToggleView,
    },
    { id: 'recall', kind: 'recall', title: 'Recall', stage: null, recall: { count: 3 } },
    { id: 'gate', kind: 'gate', title: 'Every kind of item', stage: 'wire', gate: 'main' },
    { id: 'puzzle', kind: 'gate', title: 'A puzzle gate', stage: TOY_STAGE, gate: 'puzzle' },
  ],
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
