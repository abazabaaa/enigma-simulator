/**
 * Chapter I.1 · Anatomy of a key press (PLAN §4.4 "i1-anatomy"). Disclosure (G14): the rotors are held (no stepping),
 * rings 01, no plugboard cables. A story, the circuit built up on a six-letter toy (one rotor, then two, with the
 * trace), the full machine hop by hop, a bet on a 26-letter lamp, and gate `anatomy`.
 */

import type { ChapterDef, SceneDef } from '../../contracts/lesson'
import { bindGates } from '../../lesson/bind'
import { FACTS } from './facts'
import {
  GATES,
  GATE_MACHINE,
  HELD,
  MACHINE,
  PATH_KEY,
  READ_ONLY,
  TOY_ONE,
  TOY_TRACE_KEY,
  TOY_TWO,
  TOY_WIRE_KEY,
} from './gates'
import { ITEM_UI } from './items'
import { Path26View, ToyTraceView, ToyWireView, WorkedChainView } from './scenes'

const STORY =
  'In 1927 the British bought a commercial Enigma. Ten years later, in April 1937, Dilly Knox read his first ' +
  'Enigma messages: Spanish Civil War traffic, enciphered on machines without a plugboard. He attacked them with ' +
  "methods known as 'buttoning up' and 'rodding'. A machine without a plugboard is where this chapter starts: a " +
  'battery, keys, wired rotors, a reflector and lamps. Follow one key press through it, wire by wire, and every lamp ' +
  'becomes predictable.'

const scenes: readonly SceneDef[] = [
  {
    id: 'knox',
    kind: 'story',
    title: 'A machine without a plugboard',
    stage: null,
    story: { text: STORY, people: ['knox'], date: 'first-decrypt', facts: ['bought'] },
  },
  {
    id: 'toy-wire',
    kind: 'explore',
    title: 'From a bulb to a rotor',
    stage: 'toy',
    worked: true,
    setup: { machine: MACHINE, locks: HELD, toy: TOY_ONE },
    introduces: ['lamp'],
    bets: [{ id: 'toy-lamp', prompt: `You will press ${TOY_WIRE_KEY} on the toy. Which lamp lights?`, kind: 'letter' }],
    reveals: [{ bet: 'toy-lamp', trigger: 'press', key: TOY_WIRE_KEY }],
    tasks: [{ id: 'press3', label: 'Press three keys and follow each one on the stage' }],
    View: ToyWireView,
  },
  {
    id: 'toy-trace',
    kind: 'explore',
    title: 'Follow the trace',
    stage: 'toy',
    setup: { machine: MACHINE, locks: HELD, toy: TOY_TWO },
    introduces: ['path'],
    bets: [
      {
        id: 'toy-path',
        prompt: `You will press ${TOY_TRACE_KEY}. After the right and the middle rotor, which letter enters the reflector?`,
        kind: 'letter',
      },
    ],
    reveals: [{ bet: 'toy-path', trigger: 'press', key: TOY_TRACE_KEY }],
    tasks: [
      { id: 'press3', label: 'Press three keys' },
      { id: 'scrub-reflector', label: "Drag the playback bar back into the reflector's hop" },
    ],
    View: ToyTraceView,
  },
  {
    id: 'worked-chain',
    kind: 'explore',
    title: 'Eleven hops on the real machine',
    stage: 'wire-noplug',
    worked: true,
    setup: { machine: MACHINE, locks: HELD },
    shows: ['path'],
    freePress: true,
    tasks: [{ id: 'all-hops', label: 'Follow K through all eleven hops' }],
    View: WorkedChainView,
  },
  {
    id: 'path-26',
    kind: 'explore',
    title: 'Twenty-six letters',
    stage: 'wire-noplug',
    setup: { machine: MACHINE, locks: HELD },
    // The keyboard is the View's: only Q until Q has been pressed (the reveal is bound to that key), then all 26.
    panels: { lamps: true, trace: true, playback: true },
    introduces: ['machine-path'],
    bets: [{ id: 'q-lamp', prompt: `You will press ${PATH_KEY}. Which lamp lights?`, kind: 'letter' }],
    reveals: [{ bet: 'q-lamp', trigger: 'press', key: PATH_KEY }],
    tasks: [
      { id: 'speed', label: 'Change the playback speed' },
      { id: 'scrub', label: 'Stop a key press part-way with the playback bar' },
    ],
    View: Path26View,
  },
  {
    id: 'gate',
    kind: 'gate',
    title: 'Anatomy of a key press',
    stage: 'wire-noplug',
    setup: { machine: GATE_MACHINE, locks: READ_ONLY, toy: TOY_TWO },
    gate: 'anatomy',
  },
]

const chapter = {
  id: 'i1-anatomy',
  scenes,
  gates: bindGates(GATES, ITEM_UI),
  facts: FACTS,
} satisfies ChapterDef

export default chapter
