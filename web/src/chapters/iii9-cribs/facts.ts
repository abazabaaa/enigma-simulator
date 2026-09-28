/**
 * Chapter iii9-cribs's facts: PLAN §4.3 F5, F10, F11, F13, F17 and F21, and from the research notes
 * (technical_and_historical_ground_truth.md) the Herivel tip's February insight, the cillies and the typical cribs.
 * Every date and number the chapter shows is here, each with its https source.
 */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
const REJEWSKI = 'https://en.wikipedia.org/wiki/Marian_Rejewski'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'
const HERIVEL = 'https://en.wikipedia.org/wiki/Herivel_tip'
const ENIGMA = 'https://en.wikipedia.org/wiki/Enigma_machine'
const BOMBE = 'https://en.wikipedia.org/wiki/Bombe'

export const FACTS: readonly Fact[] = [
  { id: 'rejewski', kind: 'person', text: 'Marian Rejewski', source: REJEWSKI },
  { id: 'knox', kind: 'person', text: 'Dilly Knox', source: CHRISTENSEN },
  { id: 'herivel', kind: 'person', text: 'John Herivel', source: HERIVEL },
  {
    id: 'pyry',
    kind: 'date',
    text: '26–27 July 1939: at a conference at Pyry, near Warsaw, the Poles showed the British and French that they had broken Enigma.',
    value: '1939-07-26',
    source: CRYPTANALYSIS,
  },
  {
    id: 'knox-etw',
    kind: 'event',
    text: "Dilly Knox's first question at Pyry was the wiring of the entry drum.",
    source: CHRISTENSEN,
  },
  {
    id: 'doubling-ends',
    kind: 'date',
    text: '1 May 1940: the Germans stop enciphering the message key twice.',
    value: '1940-05-01',
    source: CRYPTANALYSIS,
  },
  {
    id: 'herivel-insight',
    kind: 'event',
    text:
      'February 1940: John Herivel guesses that some operators set the day’s rings and then sent their first message from ' +
      'whatever rotor setting was showing.',
    source: HERIVEL,
  },
  {
    id: 'herivel-break',
    kind: 'date',
    text: '22 May 1940: the first break with the Herivel tip.',
    value: '1940-05-22',
    source: CRYPTANALYSIS,
  },
  {
    id: 'cillies',
    kind: 'event',
    text: 'Cillies: easily guessed message keys such as AAA or BBB, or keys that followed the layout of the keyboard.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'cribs',
    kind: 'event',
    text: 'Typical cribs: “Keine besonderen Ereignisse” (nothing to report), “An die Gruppe”, and the fixed wording of weather reports.',
    source: CRYPTANALYSIS,
  },
  {
    id: 'no-self',
    kind: 'quote',
    text: 'No letter is ever enciphered to itself: “a severe cryptological flaw”.',
    source: ENIGMA,
  },
  {
    id: 'vector-14',
    kind: 'event',
    text:
      'The Bombe article’s worked example: the cipher text WSNPNLKLSTCS under the crib ATTACKATDAWN has no crash; its menu has ' +
      'the loops ATLK, TNS and TAWCN.',
    source: BOMBE,
  },
]
