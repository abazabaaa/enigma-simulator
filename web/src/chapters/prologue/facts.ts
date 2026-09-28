/**
 * The Prologue's facts: PLAN §4.3 F1 (Scherbius's patent), F2 (about 40,000 machines) and F-KS (the key space,
 * computed by lib/keyspace, never typed).
 */

import type { Fact } from '../../contracts/lesson'
import { formatSci, keyspace } from '../../lib/keyspace'

const ENIGMA = 'https://en.wikipedia.org/wiki/Enigma_machine'
const CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'

export const FACTS: readonly Fact[] = [
  { id: 'scherbius', kind: 'person', text: 'Arthur Scherbius', source: ENIGMA },
  {
    id: 'patent',
    kind: 'date',
    text: 'Arthur Scherbius filed his cipher-machine patent on 23 February 1918.',
    value: '1918-02-23',
    source: ENIGMA,
  },
  {
    id: 'machines',
    kind: 'number',
    text: 'Approximately 40,000 Enigma machines were constructed.',
    value: 40000,
    source: ENIGMA,
  },
  {
    id: 'keyspace',
    kind: 'number',
    text:
      `Rotor orders × start positions × plugboard settings with 10 cables ≈ ${formatSci(keyspace())}; ` +
      `with the ring settings of the right and middle rotors ≈ ${formatSci(keyspace({ rings: true }))}.`,
    value: formatSci(keyspace()),
    source: CHRISTENSEN,
  },
]
