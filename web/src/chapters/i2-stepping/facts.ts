/**
 * Chapter i2-stepping's facts: PLAN §4.3 F5 (Rejewski, late 1932) and F6 (Rejewski's notation), with the
 * detail of P taken from the research notes (Christensen, quoting Rejewski's equations).
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  {
    id: 'hired',
    kind: 'date',
    text: '1 September 1932: Marian Rejewski, Henryk Zygalski and Jerzy Różycki are hired in Warsaw.',
    value: '1932-09-01',
    source: CRYPTANALYSIS,
  },
  {
    id: 'wirings',
    kind: 'date',
    text: 'By the end of 1932 Rejewski had recovered the rotor wirings.',
    value: '1932',
    source: REJEWSKI,
  },
  {
    id: 'notation',
    kind: 'event',
    text:
      "Rejewski's notation: S the plugboard, H the entry wheel, N, M and L the right, middle and left rotors, R the reflector " +
      '(this course writes U), and P the cyclic shift of the alphabet that models the right rotor turning one place.',
    source: CHRISTENSEN,
  },
  {
    id: 'powers',
    kind: 'event',
    text: "In Rejewski's equations the first letter of a message sees the shift P once, the second letter P twice, and so on.",
    source: CHRISTENSEN,
  },
]
