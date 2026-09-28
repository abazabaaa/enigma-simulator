/**
 * The signal trace (PLAN §2.5, §3.10), synced to the playback clock:
 *  - trace-step: the windows before → after of the last press, with the double step flagged; live
 *    (data-live) while t < 1.
 *  - trace-row-{i}: one row per hop (11 on a 3-rotor machine, 13 on the M4; a toy has its own count)
 *    with a Sym chip, input → output and, with showOffsets, the rotor's offset and core contacts.
 *    data-stage, data-input, data-output and data-lit (hopAt(t) ≥ i).
 * Before any press the rows show the stages of the current machine with empty letters. Under
 * locks.lampsHidden every letter that would give the lamp away (all outputs, and every input after
 * the key) is masked as '?'.
 */

import type { JSX } from 'react'
import { useStore } from 'zustand'
import type { MachineStoreHook } from '../contracts/machine'
import type { PathHop } from '../contracts/stage'
import { LETTERS, ROTORS, slotNames, type MachineConfig, type RotorSlot, type TraceStage } from '../engine'
import { Sym } from '../lib/Sym'
import { symForStage } from '../lib/symbols'
import { toySlots } from '../lib/toy'
import { useToyStore } from '../state/toyStore'
import { SLOT_LABEL, useApi, usePressView, type PressView } from './hooks'

/** The stages of a machine with these rotor slots, in signal order. */
export function stagesFor(slots: readonly RotorSlot[], o: { etw: boolean }): TraceStage[] {
  const fwd = [...slots].reverse().map((s) => `rotor-${s}-fwd` as TraceStage)
  const bwd = slots.map((s) => `rotor-${s}-bwd` as TraceStage)
  return [
    'plugboard-in',
    ...(o.etw ? (['etw-in'] as const) : []),
    ...fwd,
    'reflector',
    ...bwd,
    ...(o.etw ? (['etw-out'] as const) : []),
    'plugboard-out',
  ]
}

const RETURN = /-bwd$|^etw-out$|^plugboard-out$/

/** A readable name for a stage, e.g. 'Middle rotor II', 'Reflector UKW-B', 'Plugboard (back)'. */
export function stageName(stage: TraceStage, config: MachineConfig | null): string {
  const back = RETURN.test(stage) ? ' (back)' : ''
  if (stage.startsWith('plugboard')) return `Plugboard${back}`
  if (stage.startsWith('etw')) return `Entry wheel${back}`
  if (stage === 'reflector') return config ? `Reflector UKW-${config.reflector}` : 'Reflector'
  const slot = stage.split('-')[1] as RotorSlot
  const index = config ? slotNames(config.rotors.length).indexOf(slot) : -1
  const rotor = index >= 0 ? ` ${config!.rotors[index]}` : ''
  return `${SLOT_LABEL[slot]} rotor${rotor}${back}`
}

function Row({
  index,
  stage,
  hop,
  view,
  config,
  compact,
  showOffsets,
}: {
  index: number
  stage: TraceStage
  hop: PathHop | null
  view: PressView
  config: MachineConfig | null
  compact: boolean
  showOffsets: boolean
}): JSX.Element {
  const lit = hop !== null && view.hop >= index
  const live = hop !== null && view.hop === index && !view.lit
  const hidden = view.lampsHidden
  const input = hop ? (hidden && index > 0 ? '?' : hop.input) : ''
  const output = hop ? (hidden ? '?' : hop.output) : ''
  const sym = symForStage(stage)
  const inv = RETURN.test(stage)
  const rotorHop = hop && hop.offset !== undefined && hop.entryContact !== undefined && hop.exitContact !== undefined
  const showIn = hop !== null && (lit || index === 0)

  return (
    <li
      data-testid={`trace-row-${index}`}
      data-stage={stage}
      data-input={input}
      data-output={output}
      data-lit={lit ? 'true' : 'false'}
      data-live={live ? 'true' : 'false'}
      className={`flex items-center gap-2 rounded px-1.5 py-0.5 font-mono text-sm ${
        live ? 'bg-amber-300/15 ring-1 ring-amber-300/60' : ''
      } ${lit ? 'text-stone-100' : 'text-stone-400'}`}
    >
      <span className="w-8 shrink-0 text-center" title={stage}>
        <Sym s={sym} inv={inv} />
      </span>
      {compact ? null : <span className="min-w-0 flex-1 truncate font-sans text-stone-300">{stageName(stage, config)}</span>}
      <span className="shrink-0 tabular-nums">
        {showIn ? input : '·'}
        <span className="text-stone-400"> → </span>
        <span className={lit && !hidden ? 'text-amber-200' : ''}>{lit ? output : '·'}</span>
      </span>
      {showOffsets && !compact ? (
        <span className="hidden w-36 shrink-0 text-xs text-stone-300 sm:inline">
          {rotorHop && !hidden ? `offset ${hop.offset}, core ${LETTERS[hop.entryContact!]}→${LETTERS[hop.exitContact!]}` : ''}
        </span>
      ) : null}
    </li>
  )
}

function SteppingRow({ view, compact }: { view: PressView; compact: boolean }): JSX.Element {
  const s = view.stepping
  const before = beforeOf(view)
  const after = view.after
  const moved = s ? (['left', 'middle', 'right'] as const).filter((k) => s.stepped[k]) : []
  const held = s !== null && moved.length === 0
  return (
    <div
      data-testid="trace-step"
      data-live={view.stepPhase ? 'true' : 'false'}
      data-before={s ? before : ''}
      data-after={s ? after : ''}
      data-double-step={s?.doubleStep ? 'true' : 'false'}
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-1.5 py-1 font-mono text-sm ${
        view.stepPhase ? 'bg-amber-300/15 ring-1 ring-amber-300/60' : ''
      }`}
    >
      <span className="font-sans text-stone-300">Step</span>
      {s ? (
        <>
          <span className="tracking-widest text-stone-100">{before}</span>
          <span className="text-stone-400">→</span>
          <span className="tracking-widest text-stone-100">{after}</span>
          {compact ? null : (
            <span className="font-sans text-xs text-stone-300">
              {held ? 'held: no rotor moved' : `${moved.join(', ')} stepped`}
            </span>
          )}
          {s.doubleStep ? (
            <span className="rounded bg-violet-900/60 px-1.5 font-sans text-xs text-violet-100">double step</span>
          ) : null}
        </>
      ) : (
        <span className="font-sans text-xs text-stone-300">Press a key to see the rotors step and the current flow.</span>
      )}
    </div>
  )
}

/** The windows before the last press (the view only carries them as `windows` during stepping). */
function beforeOf(view: PressView): string {
  const s = view.stepping
  return s ? s.before.map((p) => LETTERS[p] ?? '?').join('') : ''
}

export function TracePanelFor({
  store,
  source = 'machine',
  compact = false,
  showOffsets = false,
}: {
  store?: MachineStoreHook
  source?: 'machine' | 'toy'
  compact?: boolean
  showOffsets?: boolean
}): JSX.Element {
  const api = useApi(store)
  const view = usePressView(source, api)
  const config = useStore(api, (s) => s.machine.config)
  const toyRotors = useToyStore((s) => s.spec.rotors.length)
  const isToy = source === 'toy'
  const stages = view.hasPress
    ? view.hops.map((h) => h.stage)
    : isToy
      ? stagesFor(toySlots(toyRotors), { etw: false })
      : stagesFor(slotNames(config.rotors.length), { etw: true })

  return (
    <section aria-label="Signal trace" data-testid="trace-panel" data-source={source} className="flex min-w-0 flex-col gap-1">
      <SteppingRow view={view} compact={compact} />
      <ol className={compact ? 'grid grid-cols-2 gap-x-2 sm:grid-cols-3' : 'flex flex-col'}>
        {stages.map((stage, i) => (
          <Row
            key={`${i}-${stage}`}
            index={i}
            stage={stage}
            hop={view.hops[i] ?? null}
            view={view}
            config={isToy ? null : config}
            compact={compact}
            showOffsets={showOffsets}
          />
        ))}
      </ol>
      {!isToy && view.hasPress && !view.lampsHidden ? <TurnoverNote config={config} /> : null}
    </section>
  )
}

/** A reminder of the stepping rotors' turnover letters (window letters before a carry). */
function TurnoverNote({ config }: { config: MachineConfig }): JSX.Element {
  const slots = slotNames(config.rotors.length)
  const parts = slots
    .map((slot, i) => ({ slot, rotor: config.rotors[i]! }))
    .filter(({ slot }) => slot !== 'greek')
    .map(({ slot, rotor }) => `${SLOT_LABEL[slot]} ${rotor} carries at ${ROTORS[rotor].turnovers.split('').join('/')}`)
  return <p className="px-1.5 text-xs text-stone-300">{parts.join(' · ')}</p>
}

export function TracePanel(p: { source?: 'machine' | 'toy'; compact?: boolean; showOffsets?: boolean }): JSX.Element {
  return <TracePanelFor {...p} />
}
