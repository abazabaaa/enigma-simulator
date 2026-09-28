/** Chapter I.1's facts: PLAN §4.3 F4 (the commercial Enigma bought in 1927; Dilly Knox's first decrypt, April 1937). */

import type { Fact } from '../../contracts/lesson'

const CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'

export const FACTS: readonly Fact[] = [
  { id: 'knox', kind: 'person', text: 'Dilly Knox', source: CRYPTANALYSIS },
  {
    id: 'bought',
    kind: 'date',
    text: '1927: the United Kingdom bought a commercial Enigma.',
    value: '1927',
    source: CRYPTANALYSIS,
  },
  {
    id: 'first-decrypt',
    kind: 'date',
    text: "April 1937: Dilly Knox's first Enigma decrypt, of unsteckered Spanish Civil War traffic.",
    value: '1937-04',
    source: CRYPTANALYSIS,
  },
]
