/**
 * Chapter iii10-menus's facts: PLAN §4.3 F12 (Turing, Welchman, the bombe), F18 (Turing's stop table), F19 (Wilcox's
 * rule of thumb) and F21 (vector 14), and from the research notes (technical_and_historical_ground_truth.md) the
 * contradiction logic of a stop and the middle-rotor turnover risk of long cribs. The loop scene reads the stop
 * table's values from here.
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const BOMBE = 'https://en.wikipedia.org/wiki/Bombe'
const WELCHMAN = 'https://en.wikipedia.org/wiki/Gordon_Welchman'
const CHRISTENSEN_BOMBE = 'https://websites.nku.edu/~christensen/Bombe.pdf'

export const FACTS: readonly Fact[] = [
  { id: 'turing', kind: 'person', text: 'Alan Turing', source: CRYPTANALYSIS },
  { id: 'welchman', kind: 'person', text: 'Gordon Welchman', source: WELCHMAN },
  {
    id: 'bletchley',
    kind: 'date',
    text: '4 September 1939: Alan Turing and Gordon Welchman report to Bletchley Park, the day after Britain declared war.',
    value: '1939-09-04',
    source: CRYPTANALYSIS,
  },
  { id: 'bombe-design', kind: 'event', text: 'Turing designs the bombe in 1939.', source: CRYPTANALYSIS },
  {
    id: 'contradiction',
    kind: 'event',
    text:
      'The bombe assumes one plugboard pair; when the chain of implications comes back with a different partner for the same ' +
      'letter, the setting is eliminated. Stops occur when no contradiction arises.',
    source: BOMBE,
  },
  { id: 'wilcox', kind: 'event', text: 'Wilcox’s rule of thumb: a menu wants two closures and 13–14 links.', source: CHRISTENSEN_BOMBE },
  {
    id: 'stops-3',
    kind: 'number',
    text: 'Turing’s table: about 2.2 stops per wheel order for an 8-letter menu with 3 closures.',
    value: 2.2,
    source: BOMBE,
  },
  {
    id: 'stops-1',
    kind: 'number',
    text: 'Turing’s table: about 1,500 stops per wheel order for an 8-letter menu with 1 closure.',
    value: 1500,
    source: BOMBE,
  },
  {
    id: 'stops-0',
    kind: 'number',
    text: 'Turing’s table: about 40,000 stops per wheel order for an 8-letter menu with no closure.',
    value: 40000,
    source: BOMBE,
  },
  {
    id: 'turnover-risk',
    kind: 'quote',
    text: 'Longer cribs have a catch: “the more likely it was that turn-over of the middle rotor would have occurred.”',
    source: CRYPTANALYSIS,
  },
  {
    id: 'vector-14',
    kind: 'event',
    text:
      'The Bombe article’s worked example: WSNPNLKLSTCS under ATTACKATDAWN; the graph of its links has the loops ATLK, TNS and ' +
      'TAWCN.',
    source: BOMBE,
  },
]
