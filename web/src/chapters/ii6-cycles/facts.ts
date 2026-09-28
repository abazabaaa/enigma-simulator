/**
 * Chapter ii6-cycles' facts: PLAN §4.3 F5 (Rejewski, late 1932; Schmidt's tables), F7 (the theorem that won World War
 * II) and F8 (the cyclometer and the catalogue), with
 * Rejewski's theorems on products of transpositions and the plugboard's nullification quoted from Christensen (the
 * research notes). Every fact is referenced by the story scene `theorem`.
 */

import type { Fact } from '../../contracts/lesson'

const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  {
    id: 'late-1932',
    kind: 'date',
    text: 'By the end of 1932 Rejewski had recovered the rotor wirings.',
    value: '1932',
    source: REJEWSKI,
  },
  {
    id: 'tables',
    kind: 'event',
    text: "Hans-Thilo Schmidt's key tables, delivered on 9 December 1932, covered September and October 1932.",
    source: CRYPTANALYSIS,
  },
  {
    id: 'cyclometer',
    kind: 'event',
    text:
      'The cyclometer (1934/35) and the catalogue of cycle lengths built with it, which took "over a year"; the ' +
      'reflector change of 1/2 November 1937 forced it to be redone.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'theorem',
    kind: 'quote',
    text:
      'Two permutations are conjugate if and only if they have the same cycle structure: what the cryptologist ' +
      'Deavours called "the theorem that won World War II".',
    source: REJEWSKI,
  },
  {
    id: 'nullified',
    kind: 'quote',
    text:
      'The disjoint cycle structure of AD is the same as it would be if there were no plugboard; "the effect of the ' +
      'plugboard has been nullified!"',
    source: CHRISTENSEN,
  },
  {
    id: 'pairs',
    kind: 'quote',
    text:
      "Rejewski's theorem 1: \"If two permutations of the same degree consist solely of disjoint transpositions, then " +
      'their product will consist of disjoint cycles of the same length in even numbers."',
    source: CHRISTENSEN,
  },
  {
    id: 'adjacent',
    kind: 'quote',
    text:
      "Rejewski's theorem 4: \"If two letters found in two different cycles of the same length of the permutation XY " +
      'belong to the same transposition, then the letters adjacent to them (one to the right, the other to the left) ' +
      'also belong to the same transposition."',
    source: CHRISTENSEN,
  },
]
