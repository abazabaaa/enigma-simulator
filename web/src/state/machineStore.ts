/**
 * The only writer of machine state (PLAN §2.2). The engine is pure; a store holds the current
 * `MachineState`, the typed tape, the last press, a press counter (`seq`) and the locks. The UI,
 * the 2D and 3D stages and `window.__enigma` all read and drive `useMachineStore`; a chapter that
 * needs a second machine builds one with `createMachineStore()` and passes it down through
 * <MachineProvider> (state/activeMachine.tsx).
 *
 * Setters enforce their lock and throw MachineLockedError; setConfig and setLocks are the setup
 * path and ignore locks. Config setters keep the current windows and the tape and clear `last`.
 */

import { create } from 'zustand'
import {
  DEFAULT_CONFIG,
  EnigmaConfigError,
  MODELS,
  createMachine,
  encodeLetter,
  letterToIndex,
  pressKey as enginePressKey,
  withPositions,
  type Letter,
  type MachineConfig,
  type MachineConfigInput,
  type MachineState,
  type PressResult,
  type RotorName,
} from '../engine'
import type { LockKey, MachineLocks, MachineStore, MachineStoreHook } from '../contracts/machine'

export type { LockKey, MachineLocks, MachineStore, MachineStoreHook } from '../contracts/machine'

export class MachineLockedError extends Error {
  readonly lock: LockKey
  constructor(lock: LockKey) {
    super(`The machine's ${lock} is locked`)
    this.name = 'MachineLockedError'
    this.lock = lock
  }
}

/** Rebuild the machine from a config input, keeping `windows` (letters or indices) as the current positions. */
function rebuild(config: MachineConfigInput, windows: readonly (Letter | number)[]): MachineState {
  return withPositions(createMachine(config), windows)
}

function windowLetters(state: MachineState): Letter[] {
  return state.positions.map((p) => String.fromCharCode(65 + p) as Letter)
}

export function createMachineStore(init: { config?: MachineConfigInput; locks?: MachineLocks } = {}): MachineStoreHook {
  return create<MachineStore>()((set, get) => {
    const guard = (lock: LockKey) => {
      if (get().locks[lock]) throw new MachineLockedError(lock)
    }
    /** Apply a config change: keep the current windows and the tape, clear `last`. */
    const reconfigure = (config: MachineConfigInput, windows: readonly (Letter | number)[] = get().machine.positions) => {
      set({ machine: rebuild(config, windows), last: null })
    }

    return {
      machine: createMachine(init.config ?? DEFAULT_CONFIG),
      input: '',
      output: '',
      last: null,
      seq: 0,
      locks: { ...init.locks },

      pressKey: (letter) => {
        const { machine, input, output, locks, seq } = get()
        if (locks.keyboard) throw new MachineLockedError('keyboard')
        let result: PressResult
        if (locks.hold) {
          const { output: lamp, trace } = encodeLetter(machine, letter)
          const none = { left: false, middle: false, right: false }
          result = {
            state: machine,
            output: lamp,
            trace,
            stepping: { stepped: none, doubleStep: false, before: machine.positions, after: machine.positions },
          }
        } else {
          result = enginePressKey(machine, letter)
        }
        set({
          machine: result.state,
          input: input + letter.toUpperCase(),
          output: output + result.output,
          last: result,
          seq: seq + 1,
        })
        return result
      },

      setConfig: (config) => {
        set({ machine: createMachine(config), input: '', output: '', last: null })
      },

      reset: () => {
        set({ machine: createMachine(get().machine.config), input: '', output: '', last: null })
      },

      setLocks: (locks) => {
        set({ locks: { ...locks } })
      },

      setPositions: (windows) => {
        guard('positions')
        set({ machine: withPositions(get().machine, windows.toUpperCase()), last: null })
      },

      setRing: (slotIndex, ring) => {
        guard('rings')
        const { config } = get().machine
        checkSlot(config, slotIndex)
        letterToIndex(ring)
        const rings = config.rings.map((r, i) => (i === slotIndex ? ring.toUpperCase() : r))
        reconfigure({ ...config, rings })
      },

      setRotor: (slotIndex, rotor) => {
        guard('rotors')
        const { config } = get().machine
        checkSlot(config, slotIndex)
        const rotors: RotorName[] = [...config.rotors]
        const other = rotors.indexOf(rotor)
        if (other !== -1 && other !== slotIndex) rotors[other] = rotors[slotIndex]!
        rotors[slotIndex] = rotor
        reconfigure({ ...config, rotors })
      },

      setReflector: (reflector) => {
        guard('reflector')
        reconfigure({ ...get().machine.config, reflector })
      },

      setModel: (model) => {
        guard('model')
        const { machine } = get()
        const { config } = machine
        if (config.model === model) return
        // The three stepping rotors are the rightmost three in every model.
        const three = config.rotors.slice(-3)
        const rings = config.rings.slice(-3)
        const start = config.positions.slice(-3)
        const windows = windowLetters(machine).slice(-3)
        let rotors: RotorName[]
        let next: MachineConfigInput
        if (model === 'M4') {
          rotors = ['Beta', ...three]
          next = { ...config, model, reflector: 'B-thin', rotors, rings: ['A', ...rings], positions: ['A', ...start] }
          reconfigure(next, ['A', ...windows])
          return
        }
        const allowed = MODELS[model].rotors
        rotors = three.every((r) => allowed.includes(r)) ? three : ['I', 'II', 'III']
        next = { ...config, model, reflector: 'B', rotors, rings, positions: start }
        reconfigure(next, windows)
      },

      setPlugs: (pairs) => {
        guard('plugboard')
        reconfigure({ ...get().machine.config, plugboard: pairs.map((p) => p.toUpperCase()) })
      },

      togglePlug: (a, b) => {
        guard('plugboard')
        const { config } = get().machine
        const A = a.toUpperCase()
        const B = b.toUpperCase()
        const existing = config.plugboard.find((p) => p.includes(A))
        const plugboard = existing ? config.plugboard.filter((p) => p !== existing) : [...config.plugboard, A + B]
        reconfigure({ ...config, plugboard })
      },

      snapshot: () => {
        const { machine } = get()
        return { ...machine.config, positions: windowLetters(machine) }
      },
    }
  })
}

function checkSlot(config: MachineConfig, slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= config.rotors.length) {
    throw new EnigmaConfigError([`Slot ${slotIndex} does not exist (the ${config.model} has ${config.rotors.length})`])
  }
}

/** The default instance: `window.__enigma`, the sandbox and state/sync.ts drive it. */
export const useMachineStore: MachineStoreHook = createMachineStore()
