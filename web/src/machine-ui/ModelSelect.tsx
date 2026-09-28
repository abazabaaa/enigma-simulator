/** model-select (PLAN §3.10): Enigma I, M3 or M4 through the store's setModel (disabled under locks.model). */

import { useId, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../contracts/machine'
import { MODELS, MODEL_NAMES, type ModelName } from '../engine'
import { useApi } from './hooks'

export function ModelSelect({ store }: { store?: MachineStoreHook }): JSX.Element {
  const api = useApi(store)
  const { model, locked } = useStore(api, useShallow((s) => ({ model: s.machine.config.model, locked: !!s.locks.model })))
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-stone-300">
        Model
      </label>
      <select
        id={id}
        data-testid="model-select"
        value={model}
        disabled={locked}
        onChange={(e) => {
          const s = api.getState()
          if (!s.locks.model) s.setModel(e.target.value as ModelName)
        }}
        className="rounded border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100 disabled:opacity-50"
      >
        {MODEL_NAMES.map((m) => (
          <option key={m} value={m}>
            {MODELS[m].label}
          </option>
        ))}
      </select>
    </div>
  )
}
