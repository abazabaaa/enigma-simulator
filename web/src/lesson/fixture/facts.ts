/** The fixture chapter's facts (PLAN §4.3 F1, F2). */

import type { Fact } from '../../contracts/lesson'

export const FACTS: readonly Fact[] = [
  { id: 'scherbius', kind: 'person', text: 'Arthur Scherbius', source: 'https://en.wikipedia.org/wiki/Enigma_machine' },
  {
    id: 'patent',
    kind: 'date',
    text: 'Arthur Scherbius filed his cipher-machine patent on 23 February 1918.',
    value: '1918-02-23',
    source: 'https://en.wikipedia.org/wiki/Enigma_machine',
  },
  {
    id: 'machines',
    kind: 'number',
    text: 'Approximately 40,000 Enigma machines were constructed.',
    value: 40000,
    source: 'https://en.wikipedia.org/wiki/Enigma_machine',
  },
]
