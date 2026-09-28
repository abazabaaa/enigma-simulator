/**
 * Chapter iii11-bombe's facts: PLAN §4.3 F12 (Turing's bombe design), F13 (Victory, 18 March 1940; Agnus Dei with the
 * diagonal board, 8 August 1940), F14 (the diagonal board was Welchman's), and from the research notes
 * (technical_and_historical_ground_truth.md, codebreaking_simulators_and_explainers.md): Keen and the British
 * Tabulating Machine Company, the 36 Enigma equivalents, the 20-minute run, the 1 / 25 / 26 test register and
 * Ellsbury's eight-letter bombe.
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const BOMBE = 'https://en.wikipedia.org/wiki/Bombe'
const WELCHMAN = 'https://en.wikipedia.org/wiki/Gordon_Welchman'
const SALE = 'https://www.codesandciphers.org.uk/virtualbp/tbombe/tbombe.htm'
const VIRTUAL_BOMBE = 'https://bombe.virtualcolossus.co.uk/technical.html'

export const FACTS: readonly Fact[] = [
  { id: 'turing', kind: 'person', text: 'Alan Turing', source: CRYPTANALYSIS },
  { id: 'welchman', kind: 'person', text: 'Gordon Welchman', source: WELCHMAN },
  { id: 'keen', kind: 'person', text: 'Harold “Doc” Keen, British Tabulating Machine Company', source: CRYPTANALYSIS },
  {
    id: 'victory',
    kind: 'date',
    text: '18 March 1940: the first bombe, Victory, is delivered to Bletchley Park.',
    value: '1940-03-18',
    source: CRYPTANALYSIS,
  },
  {
    id: 'agnus-dei',
    kind: 'date',
    text: '8 August 1940: Agnus Dei, the first bombe with a diagonal board, is delivered.',
    value: '1940-08-08',
    source: CRYPTANALYSIS,
  },
  {
    id: 'bombe-design',
    kind: 'event',
    text: 'Alan Turing designed the bombe in 1939; Harold Keen of the British Tabulating Machine Company turned it into a working machine.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'board-welchman',
    kind: 'event',
    text:
      'The diagonal board was Gordon Welchman’s idea, shown early in 1940. It uses the plugboard’s reciprocity: if B is ' +
      'steckered to G, then G is steckered to B.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'drums',
    kind: 'number',
    text: 'A bombe held 36 Enigma equivalents, each with three drums, in three groups of 12.',
    value: 36,
    source: BOMBE,
  },
  {
    id: 'run-time',
    kind: 'number',
    text: 'A run through the 26 × 26 × 26 = 17,576 positions of one wheel order took about 20 minutes.',
    value: 20,
    source: BOMBE,
  },
  {
    id: 'register',
    kind: 'event',
    text:
      'The test for a stop: if all 26 lamps of the test register light, the position is rejected; one or 25 live wires ' +
      'mean a possible stop.',
    source: SALE,
  },
  {
    id: 'ellsbury',
    kind: 'event',
    text: 'Graham Ellsbury drew a simplified bombe with wires for only the letters A–H, because the full 26-wire circuit is too complex to diagram.',
    source: VIRTUAL_BOMBE,
  },
]
