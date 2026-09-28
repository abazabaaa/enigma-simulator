/**
 * Chapter ii7-catalogue's facts: PLAN §4.3 F5 (Rejewski) and F8 (the cyclometer, the catalogue, the reflector change),
 * with the details from the research notes (technical_and_historical_ground_truth.md: Christensen, quoting Rejewski,
 * and Wikipedia).
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  {
    id: 'cyclometer',
    kind: 'date',
    text: 'Rejewski invented the cyclometer in 1934 or 1935.',
    value: '1934',
    source: CRYPTANALYSIS,
  },
  {
    id: 'two-sets',
    kind: 'event',
    text:
      'The cyclometer held two sets of rotors in the same order, the second set three positions beyond the first, "as ' +
      'if they were permutations A and D". Current from one key ran round until it returned, lighting the letters of a ' +
      'cycle and of its partner.',
    source: CHRISTENSEN,
  },
  {
    id: 'settings',
    kind: 'number',
    text: '6 rotor orders × 17,576 ground settings = 105,456 settings.',
    value: 105456,
    source: CHRISTENSEN,
  },
  {
    id: 'over-a-year',
    kind: 'quote',
    text: 'Rejewski on building the card catalogue: "This job took a long time, over a year".',
    source: CHRISTENSEN,
  },
  {
    id: 'minutes',
    kind: 'quote',
    text: 'Rejewski: once the catalogues were ready, "obtaining a daily key was usually a matter of ten to twenty minutes".',
    source: CHRISTENSEN,
  },
  {
    id: 'reflector-b',
    kind: 'date',
    text:
      'On 2 November 1937 (1 November in some sources) the Germans exchanged reflector A for reflector B, and the ' +
      'catalogue had to be made again.',
    value: '1937-11-02',
    source: CHRISTENSEN,
  },
]
