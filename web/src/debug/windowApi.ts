/**
 * `window.__enigma`: a stable, state-based handle for end-to-end tests and debugging.
 * Available in dev and production builds. Tests must assert on this state, never on pixels.
 *
 * Contract (bump ENIGMA_API_VERSION on any breaking change):
 *   version            number, currently 1
 *   getState()         EnigmaSnapshot (plain JSON)
 *   pressKey(letter)   press one key A–Z (case-insensitive); returns the lamp letter. Throws
 *                      MachineLockedError (the message names the lock) while locks.keyboard is set
 *   setConfig(cfg)     merge `cfg` into the current config, validate, reset; returns the snapshot
 *                      (the setup path: it ignores locks)
 *   reset()            back to the configured start positions, clear the tape; returns the snapshot
 */

import {
  positionsToString,
  type Letter,
  type MachineConfig,
  type MachineConfigInput,
  type Stepped,
  type TraceStep,
} from '../engine'
import { useMachineStore } from '../state/machineStore'

export const ENIGMA_API_VERSION = 1

export interface EnigmaSnapshot {
  readonly config: MachineConfig
  /** Current window letters LEFT → RIGHT, e.g. "ADU". */
  readonly positions: string
  /** Letters pressed since the last reset/setConfig. */
  readonly input: string
  /** Lamps lit since the last reset/setConfig (same length as input). */
  readonly output: string
  /** The lamp lit by the most recent key press, or null. */
  readonly lamp: Letter | null
  /** Stepping of the most recent key press (window letters before/after), or null. */
  readonly lastStepping: {
    readonly stepped: Stepped
    readonly doubleStep: boolean
    readonly before: string
    readonly after: string
  } | null
  /** Signal-path trace of the most recent key press, or null. */
  readonly lastTrace: readonly TraceStep[] | null
}

export interface EnigmaWindowApi {
  readonly version: number
  getState(): EnigmaSnapshot
  pressKey(letter: string): Letter
  setConfig(config: Partial<MachineConfigInput>): EnigmaSnapshot
  reset(): EnigmaSnapshot
}

declare global {
  interface Window {
    __enigma?: EnigmaWindowApi
  }
}

function snapshot(): EnigmaSnapshot {
  const { machine, input, output, last } = useMachineStore.getState()
  // Round-trip through JSON so callers get plain, detached data.
  return JSON.parse(
    JSON.stringify({
      config: machine.config,
      positions: positionsToString(machine),
      input,
      output,
      lamp: last?.output ?? null,
      lastStepping: last
        ? {
            stepped: last.stepping.stepped,
            doubleStep: last.stepping.doubleStep,
            before: positionsToString(last.stepping.before),
            after: positionsToString(last.stepping.after),
          }
        : null,
      lastTrace: last?.trace ?? null,
    }),
  ) as EnigmaSnapshot
}

export const enigmaApi: EnigmaWindowApi = {
  version: ENIGMA_API_VERSION,
  getState: snapshot,
  pressKey: (letter) => useMachineStore.getState().pressKey(letter).output,
  setConfig: (config) => {
    const store = useMachineStore.getState()
    store.setConfig({ ...store.machine.config, ...config })
    return snapshot()
  },
  reset: () => {
    useMachineStore.getState().reset()
    return snapshot()
  },
}

export function installWindowApi(target: Window = window): void {
  target.__enigma = enigmaApi
}
