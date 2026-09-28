/**
 * Rotor settings (PLAN §3.10), one column per slot LEFT → RIGHT (Greek first on the M4):
 *  - rotor-pos-{slot}: spinbutton over the window letter (aria-valuetext 'A'…'Z'); ArrowUp/Down turn
 *    the rotor by hand, typing a letter sets it. Shows stepping.before while t < 1 (PLAN §2.5).
 *  - ring-{slot}: spinbutton 1–26, aria-valuetext '01'…'26'. Rings are never shown as letters.
 *  - rotor-select-{slot} and reflector-select, filtered to what the model takes.
 * Each control is disabled while its lock (positions, rings, rotors, reflector) is set.
 */

import { useId, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../contracts/machine'
import {
  LETTERS,
  MODELS,
  isLetter,
  letterToIndex,
  positionsToString,
  slotNames,
  type ReflectorName,
  type RotorName,
  type RotorSlot,
} from '../engine'
import { SLOT_LABEL, useApi, useMachinePress } from './hooks'
import { Spinbutton } from './Spinbutton'

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Run a store setter; report a validation error instead of throwing into React. */
function attempt(fn: () => void, onError: (message: string) => void): void {
  try {
    fn()
    onError('')
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e))
  }
}

export function RotorControls({
  store,
  rings = false,
  rotorSelect = false,
}: {
  store?: MachineStoreHook
  rings?: boolean
  rotorSelect?: boolean
}): JSX.Element {
  const api = useApi(store)
  const { config, locks } = useStore(api, useShallow((s) => ({ config: s.machine.config, locks: s.locks })))
  const { windows } = useMachinePress(api)
  const [error, setError] = useState('')
  const slots = slotNames(config.rotors.length)
  const reflectorId = useId()

  const setWindow = (i: number, index: number) =>
    attempt(() => {
      const s = api.getState()
      const current = positionsToString(s.machine).split('')
      current[i] = LETTERS[index]!
      s.setPositions(current.join(''))
    }, setError)

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Rotors" data-testid="rotor-controls" className="flex flex-wrap items-start justify-center gap-2">
        {rotorSelect ? (
          <div className="flex flex-col items-center gap-1 self-stretch rounded-lg border border-stone-800 bg-stone-900/60 p-1.5">
            <label htmlFor={reflectorId} className="text-xs text-stone-300">
              Reflector
            </label>
            <select
              id={reflectorId}
              data-testid="reflector-select"
              value={config.reflector}
              disabled={!!locks.reflector}
              onChange={(e) => attempt(() => api.getState().setReflector(e.target.value as ReflectorName), setError)}
              className="w-[4.75rem] rounded border border-stone-600 bg-stone-900 px-0.5 py-0.5 font-mono text-sm text-stone-100 disabled:opacity-50"
            >
              {MODELS[config.model].reflectors.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="text-[10px] tracking-wide text-stone-300 uppercase">UKW</span>
          </div>
        ) : null}
        {slots.map((slot, i) => (
          <RotorColumn
            key={slot}
            slot={slot}
            index={i}
            model={config.model}
            rotor={config.rotors[i]!}
            window={windows[i] ?? 'A'}
            ring={letterToIndex(config.rings[i]!) + 1}
            showRing={rings}
            showSelect={rotorSelect}
            locks={locks}
            onWindow={(index) => setWindow(i, index)}
            onRing={(n) => attempt(() => api.getState().setRing(i, LETTERS[n - 1]!), setError)}
            onRotor={(r) => attempt(() => api.getState().setRotor(i, r), setError)}
          />
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-center text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function RotorColumn(p: {
  slot: RotorSlot
  index: number
  model: keyof typeof MODELS
  rotor: RotorName
  window: string
  ring: number
  showRing: boolean
  showSelect: boolean
  locks: { rotors?: boolean; positions?: boolean; rings?: boolean }
  onWindow: (index: number) => void
  onRing: (ring: number) => void
  onRotor: (rotor: RotorName) => void
}): JSX.Element {
  const selectId = useId()
  const name = SLOT_LABEL[p.slot]
  const choices = p.slot === 'greek' ? MODELS[p.model].greekRotors : MODELS[p.model].rotors
  // Two typed digits set the ring: '0' then '5' → 05.
  const digits = useRef('')

  const typeRing = (key: string): boolean => {
    if (!/^\d$/.test(key)) return false
    digits.current = (digits.current + key).slice(-2)
    const n = Number(digits.current)
    if (n >= 1 && n <= 26) p.onRing(n)
    return true
  }

  return (
    <div data-slot={p.slot} className="flex w-[4.75rem] flex-col items-center gap-1 rounded-lg border border-stone-800 bg-stone-900/60 p-1.5">
      <span className="text-xs text-stone-300">{name}</span>
      {p.showSelect ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            {name} rotor
          </label>
          <select
            id={selectId}
            data-testid={`rotor-select-${p.slot}`}
            value={p.rotor}
            disabled={!!p.locks.rotors}
            onChange={(e) => p.onRotor(e.target.value as RotorName)}
            className="w-16 rounded border border-stone-600 bg-stone-900 px-1 py-0.5 font-mono text-sm text-stone-100 disabled:opacity-50"
          >
            {choices.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="font-mono text-xs text-stone-300">{p.rotor}</span>
      )}
      <Spinbutton
        testId={`rotor-pos-${p.slot}`}
        label={`${name} rotor window`}
        value={letterToIndex(p.window)}
        min={0}
        max={25}
        text={p.window}
        disabled={!!p.locks.positions}
        onChange={p.onWindow}
        onType={(key) => {
          const up = key.toUpperCase()
          if (!isLetter(up)) return false
          p.onWindow(letterToIndex(up))
          return true
        }}
      />
      {p.showRing ? (
        <Spinbutton
          testId={`ring-${p.slot}`}
          label={`${name} ring setting`}
          value={p.ring}
          min={1}
          max={26}
          text={pad2(p.ring)}
          disabled={!!p.locks.rings}
          onChange={p.onRing}
          onType={typeRing}
          size="sm"
          caption={<span className="text-[10px] tracking-wide text-stone-300 uppercase">ring</span>}
        />
      ) : null}
    </div>
  )
}
