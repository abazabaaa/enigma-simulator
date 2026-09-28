/**
 * Chapter iv-capstone's facts, from PLAN §4.3 only: F5 (Rejewski), F9 (the 15 September 1938 indicator change),
 * F12 (Turing and the bombe), F13 (1 May 1940: the doubled indicator ends) and F16 (1974: the ban lifted).
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: 'https://en.wikipedia.org/wiki/Marian_Rejewski' },
  { id: 'turing', kind: 'person', text: 'Alan Turing', source: CRYPTANALYSIS },
  {
    id: 'indicator-change',
    kind: 'date',
    text: '15 September 1938: the Germans change the indicator procedure; operators choose their own ground setting.',
    value: '1938-09-15',
    source: 'https://en.wikipedia.org/wiki/Zygalski_sheets',
  },
  {
    id: 'bombe-design',
    kind: 'event',
    text: '4 September 1939: Alan Turing and Gordon Welchman report to Bletchley Park; Turing designs the bombe in 1939.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'doubling-ends',
    kind: 'date',
    text: '1 May 1940: the doubled indicator ends; the message key is enciphered once.',
    value: '1940-05-01',
    source: CRYPTANALYSIS,
  },
  {
    id: 'secret-lifted',
    kind: 'date',
    text: "1974: the British ban is lifted, and F. W. Winterbotham's The Ultra Secret appears.",
    value: '1974',
    source: 'https://en.wikipedia.org/wiki/Ultra_(cryptography)',
  },
]
