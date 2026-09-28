/**
 * The app's single source of truth for the simulated machine. The engine is pure; this store
 * holds the current `MachineState` plus the typed tape, and is what the UI, the future 3D
 * machine and `window.__enigma` all read and drive.
 */

import { create } from 'zustand'
import {
  DEFAULT_CONFIG,
  createMachine,
  pressKey as enginePressKey,
  type MachineConfigInput,
  type MachineState,
  type PressResult,
} from '../engine'

export interface MachineStore {
  /** Current machine (config + current window positions). */
  readonly machine: MachineState
  /** Letters typed since the last reset / config change. */
  readonly input: string
  /** Lamps lit since the last reset / config change. */
  readonly output: string
  /** The most recent key press (lamp, trace, stepping), or null. */
  readonly last: PressResult | null
  /** Press one key (A–Z, case-insensitive). Throws RangeError for anything else. */
  pressKey: (letter: string) => PressResult
  /** Replace the configuration (validated; throws EnigmaConfigError) and clear the tape. */
  setConfig: (config: MachineConfigInput) => void
  /** Return the rotors to the configured start positions and clear the tape. */
  reset: () => void
}

export const useMachineStore = create<MachineStore>()((set, get) => ({
  machine: createMachine(DEFAULT_CONFIG),
  input: '',
  output: '',
  last: null,
  pressKey: (letter) => {
    const { machine, input, output } = get()
    const result = enginePressKey(machine, letter)
    set({ machine: result.state, input: input + letter.toUpperCase(), output: output + result.output, last: result })
    return result
  },
  setConfig: (config) => {
    set({ machine: createMachine(config), input: '', output: '', last: null })
  },
  reset: () => {
    set({ machine: createMachine(get().machine.config), input: '', output: '', last: null })
  },
}))
