/**
 * The two workbenches: the Polish route and the British route, each composed of the tools in polish.tsx and
 * british.tsx around a machine (a store: the active machine inside a gate item, a private one in the tool scenes).
 * A workbench never reads the day's key: it only runs the learner's choices through the kit.
 */

import { useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { MachineStoreHook } from '../../../contracts/machine'
import type { CatalogueEntry } from '../../../crypto/catalogue'
import { checkStop, type Stop } from '../../../crypto'
import { menuFromEdges } from '../../../crypto/menu'
import type { RotorName } from '../../../engine'
import { Mono, QUIET_BUTTON } from '../../../lesson'
import { MachinePanel, PlugboardEditor } from '../../../machine-ui'
import { cribLinks, decryptWith, windowsAfter } from '../gates'
import { BombeBench, CribPlacer, InterceptReader, MenuBuilder, Vocabulary } from './british'
import {
  BodyPreview,
  CardTable,
  CatalogueQuery,
  DoubledPanel,
  EMPTY_KEY,
  IndicatorList,
  KeyFields,
  NO_PAIRING,
  PairingTool,
  keyFromLists,
  useRotorsAndCables,
  type KeyLists,
  type Pairing,
} from './polish'

/** Put a rotor order on the machine through its own (lock-guarded) setters. */
export function setRotors(store: MachineStoreHook, rotors: readonly RotorName[]): void {
  rotors.forEach((r, slot) => store.getState().setRotor(slot, r))
}

function tryIt(fn: () => void): void {
  try {
    fn()
  } catch {
    // A control the item keeps locked: nothing changes.
  }
}

function Step({ n, title, children, testId }: { n: number; title: string; children: JSX.Element | JSX.Element[]; testId?: string }): JSX.Element {
  return (
    <details open className="rounded-lg border border-stone-800 p-2" data-testid={testId}>
      <summary className="cursor-pointer text-sm font-semibold text-stone-200">
        {n}. {title}
      </summary>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </details>
  )
}

/** The machine's setting in one line, all of it live (rings as 01–26). */
function MachineState({ store }: { store: MachineStoreHook }): JSX.Element {
  const config = useStore(store, (s) => s.machine.config)
  const windows = useWindows(store)
  const rings = config.rings.map((r) => String(r.charCodeAt(0) - 64).padStart(2, '0')).join(' ')
  return (
    <p className="font-mono text-xs text-stone-400" data-testid="set-machine-state">
      Rotors {config.rotors.join('-')} · windows {windows} · rings {rings} · cables {config.plugboard.join(' ') || 'none'}
    </p>
  )
}

/** The machine's windows as a string, live. */
function useWindows(store: MachineStoreHook): string {
  return useStore(store, (s) => s.machine.positions.map((x) => String.fromCharCode(65 + x)).join(''))
}

// ---------------------------------------------------------------------------
// The Polish route
// ---------------------------------------------------------------------------

export function PolishWorkbench(p: {
  store: MachineStoreHook
  indicators: readonly string[]
  message: string
  known: string
  maxCables: number
  /** polish-plugs: the rotor order and ground setting are given; only the cables are the learner's. */
  given?: { readonly ground: string }
  /** The keyboard and lamps of the panel (set-machine items show them, locked). */
  keys?: boolean
  onCard?(card: readonly CatalogueEntry[]): void
}): JSX.Element {
  const { store } = p
  const [pairing, setPairing] = useState<Pairing>(NO_PAIRING)
  const [fields, setFields] = useState<KeyLists>(EMPTY_KEY)
  const [card, setCard] = useState<readonly CatalogueEntry[] | null>(null)
  const { rotors, cables, windows } = useRotorsAndCables(store)
  const [chosen, setChosen] = useState<{ rotors: readonly RotorName[]; positions: string } | null>(null)
  const ground = p.given ? p.given.ground : (chosen?.positions ?? null)
  const config = useStore(store, (s) => s.machine.config)
  let read = ''
  try {
    read = decryptWith({ ...config, positions: [...windows] as never }, p.message)
  } catch {
    read = ''
  }
  const addCable = (cable: string) => tryIt(() => store.getState().setPlugs([...store.getState().machine.config.plugboard, cable]))
  const n0 = p.given ? 0 : 3
  return (
    <div className="flex flex-col gap-3" data-testid="polish-workbench">
      <IndicatorList indicators={p.indicators} />
      {p.given ? null : (
        <>
          <Step n={1} title="Read AD, BE and CF off the indicators" testId="step-products">
            <PairingTool indicators={p.indicators} pairing={pairing} onPairing={setPairing} view="cycles" />
          </Step>
          <Step n={2} title="Look the characteristic up in the catalogue" testId="step-catalogue">
            <KeyFields value={fields} onChange={setFields} />
            <CatalogueQuery
              query={keyFromLists(fields)}
              onCard={(c) => {
                setCard(c)
                if (c) p.onCard?.(c)
              }}
            />
          </Step>
          <Step n={3} title="Test the settings on the card" testId="step-card">
            {card && card.length ? (
              <CardTable
                card={card}
                indicators={p.indicators}
                cables={cables}
                ground={chosen}
                onSet={(e) => {
                  setChosen({ rotors: e.rotors, positions: e.positions })
                  tryIt(() => setRotors(store, e.rotors))
                  tryIt(() => store.getState().setPositions(e.positions))
                }}
              />
            ) : (
              <p className="text-sm text-stone-400">Look a characteristic up first: its card appears here.</p>
            )}
          </Step>
        </>
      )}
      <Step n={n0 + 1} title="Find the cables, then the message key" testId="step-cables">
        {ground ? (
          <DoubledPanel
            indicators={p.indicators}
            rotors={rotors}
            cables={cables}
            ground={ground}
            maxCables={p.maxCables}
            onAddCable={addCable}
          />
        ) : (
          <p className="text-sm text-stone-400">Use a setting from the card first: the indicators are read at its ground setting.</p>
        )}
        <p className="text-sm text-stone-300">
          The body was typed from the message key, not the ground setting: when the first indicator reads as a key typed twice,
          turn the windows to that key.
        </p>
      </Step>
      <Step n={n0 + 2} title="The machine" testId="step-machine">
        <MachinePanel store={store} show={{ keyboard: !!p.keys, lamps: !!p.keys, rotors: !p.given }} />
        <div className="rounded-xl border border-stone-800 bg-stone-900/40 p-3">
          <PlugboardEditor store={store} maxPairs={p.maxCables} />
        </div>
        <MachineState store={store} />
        <BodyPreview message={p.message} read={read} known={p.known} />
      </Step>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The British route
// ---------------------------------------------------------------------------

export function BritishWorkbench(p: {
  store: MachineStoreHook
  crib: string
  message: string
  window: readonly [number, number]
  orders: readonly (readonly RotorName[])[]
  start: string
  encKey: string
  maxCables: number
  /** british-plugs: where the crib stands and the bombe's stop are given; only the cables are the learner's. */
  given?: { readonly offset: number; readonly stop: { positions: string; testLetter: string; stecker: string } }
  keys?: boolean
  onRun?(): void
  onChecked?(): void
}): JSX.Element {
  const { store } = p
  const [offset, setOffset] = useState(p.given?.offset ?? p.window[0])
  const [chosen, setChosen] = useState<readonly number[]>([])
  const config = useStore(store, (s) => s.machine.config)
  const windows = useWindows(store)
  const menu = menuFromEdges(cribLinks(p.message, p.crib, offset).filter((e) => chosen.includes(e.pos)))
  const use = (stop: Pick<Stop, 'rotors'>, steckers: readonly string[]) => {
    tryIt(() => setRotors(store, stop.rotors))
    tryIt(() => store.getState().setPlugs([...steckers]))
  }
  return (
    <div className="flex flex-col gap-3" data-testid="british-workbench">
      <p className="text-sm text-stone-300">
        Intercept: start position <Mono>{p.start}</Mono> in clear, enciphered key <Mono>{p.encKey}</Mono>, body of {p.message.length}{' '}
        letters.
      </p>
      {p.given ? (
        <GivenStop
          crib={p.crib}
          message={p.message}
          offset={p.given.offset}
          stop={{ ...p.given.stop, rotors: config.rotors }}
          onPlug={(steckers) => tryIt(() => store.getState().setPlugs([...steckers]))}
        />
      ) : (
        <>
          <Step n={1} title="Place the crib" testId="step-crib">
            <CribPlacer cipher={p.message} crib={p.crib} window={p.window} offset={offset} onOffset={setOffset} intro />
          </Step>
          <Step n={2} title="Build the menu" testId="step-menu">
            <MenuBuilder cipher={p.message} crib={p.crib} offset={offset} chosen={chosen} onChosen={setChosen} />
          </Step>
          <Step n={3} title="Run the bombe and check its stops" testId="step-bombe">
            <p className="text-sm text-stone-300">
              Intelligence names three wheel orders: {p.orders.map((o) => o.join('-')).join(', ')}. The checking machine tries each
              stop along the whole crib: a true stop gives consistent cables, a false one needs a letter plugged twice.
            </p>
            <BombeBench
              menu={menu}
              orders={p.orders}
              cipher={p.message}
              crib={p.crib}
              offset={offset}
              onUse={use}
              onRun={p.onRun}
              onChecked={p.onChecked}
            />
          </Step>
        </>
      )}
      <Step n={p.given ? 1 : 4} title="Read the message key, then find the remaining cables" testId="step-read">
        <p className="text-sm text-stone-300">
          With a checked stop&apos;s rotors and cables in, the enciphered key read at the start position gives the message key: turn
          the windows to it. Where a word of the body almost reads, a cable joins the letter shown and the letter the word needs.
        </p>
        <InterceptReader store={store} config={config} windows={windows} start={p.start} encKey={p.encKey} message={p.message} />
        <Vocabulary />
        <MachinePanel store={store} show={{ keyboard: !!p.keys, lamps: !!p.keys, rotors: !p.given }} />
        <div className="rounded-xl border border-stone-800 bg-stone-900/40 p-3">
          <PlugboardEditor store={store} maxPairs={p.maxCables} />
        </div>
        <MachineState store={store} />
      </Step>
    </div>
  )
}

/** british-plugs: the stop the bombe gave, and the checking machine on it. */
function GivenStop(p: {
  crib: string
  message: string
  offset: number
  stop: { positions: string; testLetter: string; stecker: string; rotors: readonly RotorName[] }
  onPlug(steckers: readonly string[]): void
}): JSX.Element {
  const [steckers, setSteckers] = useState<readonly string[] | null>(null)
  return (
    <div className="flex flex-col gap-2 text-sm text-stone-300" data-testid="given-stop">
      <p>
        The crib <Mono>{p.crib}</Mono> stands at offset {p.offset} of the body. The bombe stopped on {p.stop.rotors.join('-')} with
        the drums at <Mono>{p.stop.positions}</Mono>: test letter {p.stop.testLetter} steckered to {p.stop.stecker.toLowerCase()}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={QUIET_BUTTON}
          data-testid="given-stop-check"
          onClick={() =>
            setSteckers(
              checkStop(
                { rotors: p.stop.rotors, positions: p.stop.positions, testLetter: p.stop.testLetter as never, stecker: p.stop.stecker as never, live: 1, reflector: 'B' },
                p.message,
                p.crib,
                p.offset,
              ).steckers,
            )
          }
        >
          Check the stop along the crib
        </button>
        {steckers ? (
          <>
            <span className="text-emerald-300" data-testid="given-stop-steckers">
              {steckers.length} cables: {steckers.map((x) => `${x[0]}–${x[1]}`).join(' ')}
            </span>
            <button type="button" className={QUIET_BUTTON} onClick={() => p.onPlug(steckers)} data-testid="given-stop-plug">
              Plug them in
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Windows `k` presses after `start` (re-exported for the worked examples). */
export { windowsAfter }
