/**
 * PLACEHOLDER (02 → the chapter PR). One story scene reading "Being written". The chapter PR
 * replaces this folder: index.ts, gates.ts, items.tsx, facts.ts, scenes/ (PLAN §2.4).
 */

import type { ChapterDef, Fact } from '../../contracts/lesson'

/** Marks a placeholder chapter (lesson/validate can skip it); the real chapter drops this export. */
export const PLACEHOLDER = true

const FACTS: readonly Fact[] = [
  { id: 'scherbius', kind: 'person', text: 'Arthur Scherbius', source: 'https://en.wikipedia.org/wiki/Enigma_machine' },
  {
    id: 'patent',
    kind: 'date',
    text: 'Arthur Scherbius filed his cipher-machine patent on 23 February 1918.',
    value: '1918-02-23',
    source: 'https://en.wikipedia.org/wiki/Enigma_machine',
  },
]

const chapter = {
  id: 'i3-reflector-plugboard',
  scenes: [
    {
      id: 'being-written',
      kind: 'story',
      title: 'Being written',
      stage: null,
      story: { text: 'Being written', people: ['scherbius'], date: 'patent' },
    },
  ],
  gates: {},
  facts: FACTS,
} satisfies ChapterDef

export default chapter
