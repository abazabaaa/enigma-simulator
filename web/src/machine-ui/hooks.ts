/**
 * One reading of "the last key press at time t" shared by every DOM view and the 2D stage (PLAN §2.5).
 * Views never keep their own animation state: they render from (last press, playback t).
 *  - The playback clock plays the DEFAULT machine store's presses (source 'machine') and the toy
 *    store's presses (source 'toy'). A view follows the clock only while the clock is playing that
 *    very press (same source and seq); any other press is shown finished (t = 1 + hops).
 *  - Window displays show stepping.before while t < 1, and the current windows after.
 *  - The lamp is lit when isLit(t); lampsHidden conceals it.
 */

import { useLayoutEffect, useState, type RefObject } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { hopAt, isLit, type MachineStoreHook } from '../contracts/machine'
import type { PathHop } from '../contracts/stage'
import { positionsToString, type Letter, type StepInfo } from '../engine'
import { toyWindows } from '../lib/toy'
import { useMachineApi } from '../state/activeMachine'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useToyStore } from '../state/toyStore'

export type Source = 'machine' | 'toy'

/**
 * 'discrete' re-renders only when the phase changes (stepping → hop k → lit); 'continuous' re-renders
 * on every clock tick (the 2D stage draws the live hop partially).
 */
export type ClockMode = 'discrete' | 'continuous'

/** The `store` prop, else the provider's store, else the default store. */
export function useApi(store?: MachineStoreHook): MachineStoreHook {
  const fallback = useMachineApi()
  return store ?? fallback
}

/** −1 during the stepping phase, k while hop k is live, `hops` once the lamp is lit. */
export function phaseOf(t: number, hops: number): number {
  if (t < 1) return -1
  return Math.min(hops, Math.floor(t - 1))
}

export interface PressView {
  readonly source: Source
  /** Letters on the machine: 26, or 6/8 for a toy. */
  readonly n: number
  readonly hasPress: boolean
  /** The key of the last press, or null. */
  readonly key: Letter | null
  /** The lamp of the last press (whether or not it is lit yet), or null. */
  readonly lamp: Letter | null
  readonly hops: readonly PathHop[]
  readonly stepping: StepInfo | null
  /** The press's playback time in [0, 1 + hops] (quantised to phase starts in 'discrete' mode). */
  readonly t: number
  /** hopAt(t, hops): −1 during stepping (and with no press). */
  readonly hop: number
  /** The lamp is lit (isLit), regardless of lampsHidden. */
  readonly lit: boolean
  /** The stepping phase of the last press is live (t < 1). */
  readonly stepPhase: boolean
  /** Window letters LEFT → RIGHT as shown: stepping.before while t < 1, else the current windows. */
  readonly windows: string
  /** Window letters after the last press (the current windows). */
  readonly after: string
  readonly lampsHidden: boolean
}

interface Pressed {
  readonly source: Source
  readonly seq: number
  readonly hops: number
  /** Whether the playback clock plays this store's presses at all. */
  readonly tracked: boolean
}

function useClock(p: Pressed | null, mode: ClockMode): number {
  return usePlaybackStore((s) => {
    if (!p) return 0
    const end = 1 + p.hops
    const t = p.tracked && s.source === p.source && s.seq === p.seq ? Math.min(Math.max(s.t, 0), end) : end
    // Quantised: 0 while stepping, 1 + k while hop k is live, 1 + hops once lit.
    return mode === 'continuous' ? t : phaseOf(t, p.hops) + 1
  })
}

function view(
  source: Source,
  n: number,
  press: { key: Letter; lamp: Letter; hops: readonly PathHop[]; stepping: StepInfo } | null,
  current: string,
  t: number,
  lampsHidden: boolean,
): PressView {
  const hops = press?.hops ?? []
  const stepPhase = press !== null && t < 1
  return {
    source,
    n,
    hasPress: press !== null,
    key: press?.key ?? null,
    lamp: press?.lamp ?? null,
    hops,
    stepping: press?.stepping ?? null,
    t,
    hop: hopAt(t, hops.length),
    lit: press !== null && isLit(t, hops.length),
    stepPhase,
    windows: stepPhase && press ? positionsToString(press.stepping.before) : current,
    after: press ? positionsToString(press.stepping.after) : current,
    lampsHidden,
  }
}

/** The last press of a machine store against the playback clock. */
export function useMachinePress(api: MachineStoreHook, mode: ClockMode = 'discrete'): PressView {
  const { machine, last, seq, lampsHidden } = useStore(
    api,
    useShallow((s) => ({ machine: s.machine, last: s.last, seq: s.seq, lampsHidden: !!s.locks.lampsHidden })),
  )
  const pressed: Pressed | null = last
    ? { source: 'machine', seq, hops: last.trace.length, tracked: api === useMachineStore }
    : null
  const t = useClock(pressed, mode)
  const press = last
    ? { key: last.trace[0]!.input, lamp: last.output, hops: last.trace, stepping: last.stepping }
    : null
  return view('machine', 26, press, positionsToString(machine), t, lampsHidden)
}

/** The toy store's last press against the playback clock (lampsHidden comes from the default store). */
export function useToyPress(mode: ClockMode = 'discrete'): PressView {
  const { spec, last, seq } = useToyStore(useShallow((s) => ({ spec: s.spec, last: s.last, seq: s.seq })))
  const lampsHidden = useMachineStore((s) => !!s.locks.lampsHidden)
  const pressed: Pressed | null = last ? { source: 'toy', seq, hops: last.hops.length, tracked: true } : null
  const t = useClock(pressed, mode)
  const press = last ? { key: last.hops[0]!.input, lamp: last.lamp, hops: last.hops, stepping: last.stepping } : null
  return view('toy', spec.n, press, toyWindows(spec), t, lampsHidden)
}

/** The press view of `source` (both hooks always run, so the hook order never changes). */
export function usePressView(source: Source, api: MachineStoreHook, mode: ClockMode = 'discrete'): PressView {
  const machine = useMachinePress(api, mode)
  const toy = useToyPress(mode)
  return source === 'toy' ? toy : machine
}

/** Letters in 5-letter groups, as on a message form: 'HELLOWORLD' → 'HELLO WORLD'. */
export function groups5(text: string): string {
  return text.match(/.{1,5}/g)?.join(' ') ?? ''
}

/**
 * Whether a sideways scroller actually scrolls (its content is wider than its box). The 2D stage
 * and PermTable become a focusable, labelled region only then, so a keyboard can scroll them and
 * nothing adds a useless tab stop when it fits. Watches the box and its content.
 */
export function useScrollable(ref: RefObject<HTMLElement | null>): boolean {
  const [scrollable, setScrollable] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return scrollable
}

/** Human names of the rotor slots. */
export const SLOT_LABEL = { greek: 'Greek', left: 'Left', middle: 'Middle', right: 'Right' } as const
