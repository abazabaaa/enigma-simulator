/**
 * Chapter ii8-sheets' facts: PLAN §4.3 F5 (Zygalski, Rejewski) and F9 (15 Sept 1938, the sheets and the bomba,
 * rotors IV and V), with the details from the research notes (Wikipedia on the Zygalski sheets, the bomba and the
 * cyclometer; Casselman's AMS Feature Column on the share of settings with a female and the dozen females needed).
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const SHEETS = 'https://en.wikipedia.org/wiki/Zygalski_sheets'
const BOMBA = 'https://en.wikipedia.org/wiki/Bomba_(cryptography)'
const CYCLOMETER = 'https://en.wikipedia.org/wiki/Cyclometer'
const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CASSELMAN = 'https://www.ams.org/publicoutreach/feature-column/fc-2013-12'

export const FACTS: readonly Fact[] = [
  { id: 'zygalski', kind: 'person', text: 'Henryk Zygalski', source: SHEETS },
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  {
    id: 'procedure',
    kind: 'date',
    text:
      '15 September 1938: each operator chose his own starting position for the message key and sent it in clear, ' +
      'followed by the doubled message key enciphered from it.',
    value: '1938-09-15',
    source: CRYPTANALYSIS,
  },
  {
    id: 'catalogue-useless',
    kind: 'event',
    text: 'The change of 15 September 1938 made the card catalogue "completely useless".',
    source: CYCLOMETER,
  },
  {
    id: 'females',
    kind: 'event',
    text:
      'About one message in eight had a "female": a letter of the doubled key enciphered to the same letter both times, ' +
      'at places 1 and 4, 2 and 5, or 3 and 6.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'sheets',
    kind: 'date',
    text:
      'About October 1938: Zygalski’s perforated sheets, 26 for each wheel order, each a 26 × 26 grid of middle and ' +
      'right rotor positions repeated a–z, a–y into 51 × 51, with a hole wherever a female can occur.',
    value: '1938-10',
    source: SHEETS,
  },
  {
    id: 'bomba',
    kind: 'event',
    text: 'By mid-November 1938 six bombas, each an aggregate of six Enigmas, were at work.',
    source: BOMBA,
  },
  {
    id: 'rotors-iv-v',
    kind: 'date',
    text: '15 December 1938: rotors IV and V raised the number of wheel orders from 6 to 60.',
    value: '1938-12-15',
    source: BOMBA,
  },
  {
    id: 'forty-percent',
    kind: 'number',
    text: 'About 40% of rotor positions can give a female; with about 12 females the candidates drop to one or two.',
    value: 12,
    source: CASSELMAN,
  },
]
