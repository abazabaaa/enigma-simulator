/** The toy machine's store (PLAN §3.2): same shape as the machine store, for lib/toy specs. */

import { create } from 'zustand'
import type { ToySpec, ToyStore } from '../contracts/machine'
import { createRng } from '../lib/rng'
import { randomToy, toyPress } from '../lib/toy'

export type { ToyStore } from '../contracts/machine'

/** A fixed default: a 6-letter toy with 2 held rotors (seed 1). */
export const DEFAULT_TOY: ToySpec = randomToy(createRng(1), 6, 2, { stepping: false })

export const useToyStore = create<ToyStore>()((set, get) => {
  // reset() returns to the spec given to setSpec (the start positions).
  let start = DEFAULT_TOY
  return {
    spec: DEFAULT_TOY,
    seq: 0,
    last: null,
    press: (key) => {
      const result = toyPress(get().spec, key)
      set({ spec: result.spec, last: result, seq: get().seq + 1 })
      return result
    },
    setSpec: (spec) => {
      start = spec
      set({ spec, last: null })
    },
    reset: () => set({ spec: start, last: null }),
  }
})
