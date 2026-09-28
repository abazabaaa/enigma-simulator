/**
 * Chapter i4-permutations' facts: PLAN §4.3 F5 (Rejewski hired in Warsaw; the wirings recovered by the end of 1932)
 * and F6 (Rejewski's notation), with Christensen's reading of Rejewski's equations and the entry-wheel guess from the
 * research notes.
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
      "Rejewski's notation, composed left to right: S the plugboard, H the entry wheel, N, M and L the right, middle and left " +
      'rotors, R the reflector (this course writes U), and P the cyclic shift that models the right rotor turning.',
    source: CHRISTENSEN,
  },
  {
    id: 'conjugate',
    kind: 'quote',
    text: 'The permutation of the first letter is A = S P N M L R L⁻¹ M⁻¹ N⁻¹ P⁻¹ S⁻¹: "an Enigma permutation is always a conjugate of the reflector".',
    source: CHRISTENSEN,
  },
  {
    id: 'entry',
    kind: 'event',
    text:
      "Rejewski's guess that the military machine's entry wheel H was the identity, the letters wired in alphabetical order, " +
      'turned out to be correct and unlocked his equations.',
    source: CHRISTENSEN,
  },
]
