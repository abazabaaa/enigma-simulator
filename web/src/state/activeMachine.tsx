/**
 * Which machine store a component talks to. Components take an optional `store` prop or call these
 * hooks: inside <MachineProvider store={s}> they get `s`, elsewhere the default useMachineStore.
 */

import { createContext, useContext, type JSX, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { MachineStore, MachineStoreHook } from '../contracts/machine'
import { useMachineStore } from './machineStore'

const MachineContext = createContext<MachineStoreHook | null>(null)

export function MachineProvider({ store, children }: { store: MachineStoreHook; children: ReactNode }): JSX.Element {
  return <MachineContext.Provider value={store}>{children}</MachineContext.Provider>
}

/** The provider's store, else the default store. */
export function useMachineApi(): MachineStoreHook {
  return useContext(MachineContext) ?? useMachineStore
}

/**
 * Select from the provider's store (else the default). Selectors must return stable values:
 * wrap object/array results in zustand's useShallow.
 */
export function useMachine<T>(selector: (s: MachineStore) => T): T {
  return useStore(useMachineApi(), selector)
}
