/**
 * Chapter iii12-checking's facts: PLAN §4.3 F15 (March 1941, the first Wrens as bombe operators) and F22 (Welchman
 * headed Hut 6), and from the research notes (technical_and_historical_ground_truth.md,
 * codebreaking_simulators_and_explainers.md): some 2,000 Wrens by 1945; stops checked because no letter can have two
 * partners; the checking machine; the remaining cables and ring settings worked out, then Typex machines adapted to
 * act as Enigmas.
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const WELCHMAN = 'https://en.wikipedia.org/wiki/Gordon_Welchman'
const BOMBE = 'https://en.wikipedia.org/wiki/Bombe'
const TNMOC = 'https://www.tnmoc.org/bh-16-menus-and-cribs'
const VIRTUAL_BOMBE = 'https://bombe.virtualcolossus.co.uk/simulation.html'

export const FACTS: readonly Fact[] = [
  { id: 'welchman', kind: 'person', text: 'Gordon Welchman, head of Hut 6 (Army and Air Force Enigma)', source: WELCHMAN },
  {
    id: 'wrens',
    kind: 'date',
    text: 'March 1941: the first Wrens arrive at Bletchley Park as bombe operators.',
    value: '1941-03',
    source: CRYPTANALYSIS,
  },
  {
    id: 'wrens-1945',
    kind: 'number',
    text: 'By 1945 there were some 2,000 Wrens operating the bombes.',
    value: 2000,
    source: CRYPTANALYSIS,
  },
  {
    id: 'two-partners',
    kind: 'event',
    text: 'Stops had to be checked, because no letter can be steckered to more than one other letter.',
    source: TNMOC,
  },
  {
    id: 'checking-machine',
    kind: 'event',
    text: 'A checking machine with drums like the bombe’s was used to trace the menu at a stop and reject contradictions.',
    source: VIRTUAL_BOMBE,
  },
  {
    id: 'typex',
    kind: 'event',
    text:
      'The other plugboard connections and the ring settings were worked out, then the settings at a possible true stop were ' +
      'tried out on Typex machines adapted to mimic Enigmas.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'typex-bombe',
    kind: 'event',
    text: 'A stop was tested on a Typex machine modified to replicate an Enigma.',
    source: BOMBE,
  },
]
