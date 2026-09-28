/**
 * Chapter i3-reflector-plugboard's facts: PLAN §4.3 F12 (Turing and Welchman at Bletchley Park; Turing designs the
 * bombe) and F17 (no letter enciphers to itself, "a severe cryptological flaw").
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const ENIGMA = 'https://en.wikipedia.org/wiki/Enigma_machine'

export const FACTS: readonly Fact[] = [
  { id: 'turing', kind: 'person', text: 'Alan Turing', source: CRYPTANALYSIS },
  { id: 'welchman', kind: 'person', text: 'Gordon Welchman', source: CRYPTANALYSIS },
  {
    id: 'bletchley',
    kind: 'date',
    text: '4 September 1939: Alan Turing and Gordon Welchman report to Bletchley Park, the day after Britain declared war.',
    value: '1939-09-04',
    source: CRYPTANALYSIS,
  },
  {
    id: 'bombe',
    kind: 'event',
    text: 'Turing designed the bombe in 1939.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'flaw',
    kind: 'quote',
    text: 'No letter ever encrypted to itself. This was "a severe cryptological flaw" that was subsequently exploited by codebreakers.',
    source: ENIGMA,
  },
]
