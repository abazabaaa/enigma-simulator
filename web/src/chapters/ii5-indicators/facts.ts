/**
 * Chapter ii5-indicators' facts: PLAN §4.3 F5 (the three mathematicians, Schmidt's tables via Bertrand) and F20 (the
 * 65 indicators and their AD), with the doubled-key procedure and the purchase from Schmidt taken from the research
 * notes (Rijmenants; Christensen). Every fact is referenced by the story scene `warsaw`.
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'
const RIJMENANTS = 'https://www.ciphermachinesandcryptology.com/en/enigmaproc.htm'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  { id: 'zygalski', kind: 'person', text: 'Henryk Zygalski', source: CRYPTANALYSIS },
  { id: 'rozycki', kind: 'person', text: 'Jerzy Różycki', source: CRYPTANALYSIS },
  { id: 'schmidt', kind: 'person', text: 'Hans-Thilo Schmidt', source: CRYPTANALYSIS },
  { id: 'bertrand', kind: 'person', text: 'Gustave Bertrand', source: CRYPTANALYSIS },
  {
    id: 'hired',
    kind: 'date',
    text: '1 September 1932: Marian Rejewski, Henryk Zygalski and Jerzy Różycki are hired in Warsaw.',
    value: '1932-09-01',
    source: CRYPTANALYSIS,
  },
  {
    id: 'tables',
    kind: 'date',
    text: "9 December 1932: Hans-Thilo Schmidt's key tables for September and October 1932 reach Warsaw through Gustave Bertrand.",
    value: '1932-12-09',
    source: CRYPTANALYSIS,
  },
  {
    id: 'bought',
    kind: 'event',
    text: 'The French had bought the information from Hans-Thilo Schmidt.',
    source: CHRISTENSEN,
  },
  {
    id: 'doubled',
    kind: 'event',
    text:
      'The operator chose a random message key and, with the rotors at the daily start position (the Grundstellung), ' +
      'enciphered it twice: letters 1 and 4, 2 and 5, 3 and 6 of the result belong together.',
    source: RIJMENANTS,
  },
  {
    id: 'sixty-five',
    kind: 'number',
    text:
      "65 indicators of one day (Bauer, via Christensen) give Rejewski's AD = (a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s), " +
      'BE = (axt)(blfqveoum)(cgy)(d)(hjpswizrn)(k) and CF = (abviktjgfcqny)(duzrehlxwpsmo).',
    value: 65,
    source: CHRISTENSEN,
  },
]
