/**
 * cyclometer: Rejewski's machine for measuring cycle lengths. Two rotor sets (two createMachineStore() stacks, each in
 * its own MachineProvider) stand at the day's windows after the 1st and the 4th key press, three steps apart, so
 * together they are AD. A key sends current round both sets until it returns, and every lamp on the way lights: the
 * key's cycle of AD and its partner. The bet asks how many lamps key A lights; the key presses go to the scene's
 * machine (the default store, held so it never steps) so the bet gates them. Then AD, BE and CF can be measured.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { KEYBOARD_ROWS, positionsToString, type Letter } from '../../../engine'
import { Mono, QUIET_BUTTON, useRevealFired } from '../../../lesson'
import { MachineProvider, useMachine } from '../../../state/activeMachine'
import { createMachineStore } from '../../../state/machineStore'
import {
  CYCLO_DAY,
  CYCLO_KEY,
  LAMPS_TRUTH,
  L,
  PRODUCTS,
  READ_ONLY,
  cycleText,
  cyclometerWindows,
  idx,
  litLamps,
  permAt,
} from '../gates'

type Product = 0 | 1 | 2

/** One rotor set: its rotors and windows, read from the provider's store. */
function RotorSet({ label, testId }: { label: string; testId: string }): JSX.Element {
  const windows = useMachine((s) => positionsToString(s.machine))
  const rotors = useMachine((s) => s.machine.config.rotors.join(' '))
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-stone-700 bg-stone-900/60 p-2" data-testid={testId} data-windows={windows}>
      <span className="text-xs text-stone-400">{label}</span>
      <span className="text-sm text-stone-300">
        Rotors <Mono>{rotors}</Mono>
      </span>
      <span className="flex gap-1" aria-label={`Windows ${windows.split('').join(' ')}`}>
        {windows.split('').map((w, k) => (
          <span key={k} className="rounded border border-stone-600 bg-stone-950 px-2 py-0.5 font-mono text-lg text-stone-100">
            {w}
          </span>
        ))}
      </span>
    </div>
  )
}

/** The cycles (as sorted letter strings) found so far per product, and the lengths they give. */
type Found = Readonly<Record<Product, readonly string[]>>
const NOTHING: Found = { 0: [], 1: [], 2: [] }

const lengthsOf = (cycles: readonly string[]): number[] => cycles.map((c) => c.length).sort((a, b) => b - a)
const lettersOf = (cycles: readonly string[]): number => cycles.reduce((s, c) => s + c.length, 0)

export function CyclometerView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('lamps')
  const [product, setProduct] = useState<Product>(0)
  const [pressed, setPressed] = useState<{ key: Letter; product: Product } | null>(null)
  const [found, setFound] = useState<Found>(NOTHING)
  const locked = useStore(p.store, (s) => !!s.locks.keyboard)
  const resolved = useRef(false)
  const { completeTask, bet, store } = p

  // The two rotor sets: the machine after the 1st and the 4th press (AD), 2nd and 5th (BE), 3rd and 6th (CF).
  const sets = useMemo(() => {
    const [a, d] = cyclometerWindows(CYCLO_DAY, 0)
    return [
      createMachineStore({ config: { ...CYCLO_DAY, positions: a }, locks: READ_ONLY }),
      createMachineStore({ config: { ...CYCLO_DAY, positions: d }, locks: READ_ONLY }),
    ] as const
  }, [])
  useEffect(() => {
    const [a, d] = cyclometerWindows(CYCLO_DAY, product)
    sets[0].getState().setConfig({ ...CYCLO_DAY, positions: a })
    sets[1].getState().setConfig({ ...CYCLO_DAY, positions: d })
  }, [product, sets])

  // Every key press on the scene's machine lights the cyclometer for the product on show.
  // Before the reveal only the bet's key counts (the other keys are disabled until then).
  const productRef = useRef(product)
  productRef.current = product
  const firedRef = useRef(fired)
  firedRef.current = fired
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.seq === prev.seq || !s.input) return
        const key = s.input.at(-1) as Letter
        if (!firedRef.current && key !== CYCLO_KEY) return
        setPressed({ key, product: productRef.current })
      }),
    [store],
  )

  const lit = useMemo(() => {
    if (!pressed) return null
    const [a, d] = cyclometerWindows(CYCLO_DAY, pressed.product)
    return litLamps(permAt(CYCLO_DAY, a), permAt(CYCLO_DAY, d), idx(pressed.key))
  }, [pressed])

  useEffect(() => {
    if (!lit || !pressed) return
    const pair = [lit.cycle, lit.partner].map((c) => c.map(L).sort().join(''))
    setFound((f) => {
      const have = f[pressed.product]
      const add = pair.filter((c) => !have.includes(c))
      return add.length ? { ...f, [pressed.product]: [...have, ...add] } : f
    })
  }, [lit, pressed])

  // The bet's truth: the number of lamps key A lights at the scene's fixed setting (8), from the engine.
  useEffect(() => {
    if (fired && !resolved.current) {
      resolved.current = true
      bet('lamps').resolve(LAMPS_TRUTH)
    }
  }, [fired, bet])

  const pairsFound = found[0].length / 2 + found[1].length / 2 + found[2].length / 2
  useEffect(() => {
    if (pairsFound >= 3) completeTask('press3')
  }, [pairsFound, completeTask])

  const litSet = new Set([...(lit?.cycle ?? []), ...(lit?.partner ?? [])].map(L))
  const cycleSet = new Set((lit?.cycle ?? []).map(L))
  const complete = ([0, 1, 2] as const).filter((k) => lettersOf(found[k]) === 26)
  const characteristic =
    complete.length === 3 ? PRODUCTS.map((n, k) => `${n}:${lengthsOf(found[k as Product]).join('.')}`).join(' ') : null
  const [w1, w4] = cyclometerWindows(CYCLO_DAY, product)

  return (
    <div className="flex flex-col gap-4 text-sm text-stone-300" data-testid="cyclometer-view">
      <p>
        Two sets of rotors <Mono>{CYCLO_DAY.rotors.join(' ')}</Mono> with reflector A, rings <Mono>01 01 01</Mono>, ground setting{' '}
        <Mono>{CYCLO_DAY.positions.join('')}</Mono>. The first set stands where the machine is after one key press, the second
        three presses further on: together they are the two permutations of a product. A key sends current through the first
        set, then the second, and round again until it comes back; every letter on the way lights a lamp.
      </p>
      <div className="flex flex-wrap gap-3">
        <MachineProvider store={sets[0]}>
          <RotorSet label={`First set (${PRODUCTS[product][0]})`} testId="cyclometer-set-1" />
        </MachineProvider>
        <MachineProvider store={sets[1]}>
          <RotorSet label={`Second set, three steps on (${PRODUCTS[product][1]})`} testId="cyclometer-set-2" />
        </MachineProvider>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Which product">
        <span>Measure:</span>
        {PRODUCTS.map((name, k) => (
          <button
            key={name}
            type="button"
            className={`${QUIET_BUTTON} font-mono ${product === k ? 'border-amber-400 text-amber-200' : ''}`}
            aria-pressed={product === k}
            data-testid={`cyclometer-product-${name}`}
            disabled={!fired}
            onClick={() => setProduct(k as Product)}
          >
            {name}
          </button>
        ))}
        <span className="text-xs text-stone-400">
          ({w1} and {w4}; each product moves both sets on by one)
        </span>
      </div>
      <div className="flex flex-col items-center gap-1" data-testid="cyclometer-lamps" data-lit={[...litSet].sort().join('')}>
        {KEYBOARD_ROWS.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((l) => (
              <span
                key={l}
                data-testid={`cyclo-lamp-${l}`}
                data-lit={String(litSet.has(l))}
                className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs ${
                  litSet.has(l)
                    ? cycleSet.has(l)
                      ? 'border-amber-300 bg-amber-300 text-stone-950'
                      : 'border-sky-300 bg-sky-300 text-stone-950'
                    : 'border-stone-700 text-stone-500'
                }`}
              >
                {l}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1" role="group" aria-label="Cyclometer keys">
        {KEYBOARD_ROWS.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((l) => (
              <button
                key={l}
                type="button"
                data-testid={`key-${l}`}
                aria-label={`Key ${l}`}
                disabled={locked || (!fired && l !== CYCLO_KEY)}
                onClick={() => store.getState().pressKey(l)}
                className="h-8 w-8 rounded-md border border-stone-600 bg-stone-800 font-mono text-sm text-stone-100 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {l}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p aria-live="polite" data-testid="cyclometer-result" className="text-stone-200">
        {lit && pressed
          ? `Key ${pressed.key} lit ${litSet.size} lamps: the cycle ${cycleText(lit.cycle)} of ${PRODUCTS[pressed.product]} ` +
            `and its partner ${cycleText(lit.partner)}, ${lit.cycle.length} letters each.`
          : fired
            ? ''
            : `Bet first, then press ${CYCLO_KEY}.`}
      </p>
      {fired ? (
        <div className="flex flex-col gap-1" data-testid="cyclometer-found" aria-live="polite">
          <p>
            Cycles of the same length always come in pairs, so each key shows two. Press keys until every lamp of a product has
            lit once, and you have its cycle lengths.
          </p>
          {PRODUCTS.map((name, k) => (
            <p key={name} data-testid={`cyclometer-found-${name}`} data-letters={lettersOf(found[k as Product])}>
              <Mono>{name}</Mono>: {found[k as Product].length ? lengthsOf(found[k as Product]).join(' ') : 'nothing yet'}
              {lettersOf(found[k as Product]) === 26 ? ' (all 26 letters)' : ` (${lettersOf(found[k as Product])} of 26 letters)`}
            </p>
          ))}
          {characteristic ? (
            <p data-testid="cyclometer-characteristic">
              The day&apos;s characteristic: <Mono>{characteristic}</Mono>. The next scene files it.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
