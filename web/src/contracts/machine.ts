/**
 * Contracts v1 · machine, playback and toy (PLAN §3.2).
 * Implementations: state/machineStore.ts, state/activeMachine.tsx, state/playbackStore.ts,
 * state/sync.ts, lib/toy.ts and state/toyStore.ts. hopAt and isLit are pure and live here.
 */

import type { StoreApi, UseBoundStore } from 'zustand'
import type {
  Letter,
  MachineConfig,
  MachineConfigInput,
  MachineState,
  ModelName,
  PressResult,
  ReflectorName,
  RotorName,
  StepInfo,
} from './core'
import type { PathHop } from './stage'

// ---------------------------------------------------------------------------
// Machine store
// ---------------------------------------------------------------------------

export type LockKey = 'model' | 'rotors' | 'reflector' | 'rings' | 'positions' | 'plugboard' | 'keyboard'

export interface MachineLocks {
  readonly model?: boolean
  readonly rotors?: boolean
  readonly reflector?: boolean
  readonly rings?: boolean
  readonly positions?: boolean
  readonly plugboard?: boolean
  /** DOM keys disabled; physical keys ignored; pressKey throws MachineLockedError. */
  readonly keyboard?: boolean
  /** pressKey encodes WITHOUT stepping (I.1): state unchanged, stepping.before = after. */
  readonly hold?: boolean
  /** Lamps, trace outputs and the announcer's lamp text are concealed. */
  readonly lampsHidden?: boolean
}

/**
 * 01's interface (members kept verbatim) extended by 02. Setters enforce their lock and throw
 * MachineLockedError(lock); setConfig and setLocks are the setup path and ignore locks.
 * Config setters keep the current windows and the tape, and clear `last`.
 */
export interface MachineStore {
  /** Current machine (config + current window positions). */
  readonly machine: MachineState
  /** Letters typed since the last reset / config change. */
  readonly input: string
  /** Lamps lit since the last reset / config change. */
  readonly output: string
  /** The most recent key press (lamp, trace, stepping), or null. */
  readonly last: PressResult | null
  /** Press one key (A–Z). Throws MachineLockedError('keyboard') when locked, RangeError for a non-letter. */
  readonly pressKey: (letter: string) => PressResult
  /** Setup path: replace the configuration (validated; throws EnigmaConfigError), ignore locks, clear the tape; keeps seq. */
  readonly setConfig: (config: MachineConfigInput) => void
  /** Return the rotors to the configured start positions and clear the tape. */
  readonly reset: () => void

  // added by 02
  /** +1 on every successful pressKey. */
  readonly seq: number
  readonly locks: MachineLocks
  /** Replaces all locks (setup path). */
  readonly setLocks: (locks: MachineLocks) => void
  /** Lock 'positions'. Turns the rotors by hand to `windows` (e.g. 'ADU'); clears `last`, keeps the tape. */
  readonly setPositions: (windows: string) => void
  /** Lock 'rings'. */
  readonly setRing: (slotIndex: number, ring: Letter) => void
  /**
   * Lock 'rotors'. EnigmaConfigError if the rotor is invalid for the model. A rotor already in
   * another slot swaps places with the one it replaces.
   */
  readonly setRotor: (slotIndex: number, rotor: RotorName) => void
  /** Lock 'reflector'. EnigmaConfigError if invalid for the model. */
  readonly setReflector: (reflector: ReflectorName) => void
  /**
   * Lock 'model'.
   *   I  → the current three rotors if all are among I–V, else I II III; UKW-B.
   *   M3 → the current three rotors (VI–VIII allowed), UKW-B.
   *   M4 → Beta + the current three (VI–VIII allowed), UKW B-thin; the Greek ring and window are 'A'.
   * Rings, windows and plugs of the three stepping rotors are kept.
   */
  readonly setModel: (model: ModelName) => void
  /** Lock 'plugboard'. Pairs like ['AV', 'BS']; EnigmaConfigError if invalid. */
  readonly setPlugs: (pairs: readonly string[]) => void
  /** Lock 'plugboard'. Adds a–b, or removes the pair containing a. */
  readonly togglePlug: (a: Letter, b: Letter) => void
  /** The current config whose positions are the CURRENT windows. */
  readonly snapshot: () => MachineConfig
}

export type MachineStoreHook = UseBoundStore<StoreApi<MachineStore>>

// ---------------------------------------------------------------------------
// Playback: the only animation clock (state/playbackStore.ts)
// ---------------------------------------------------------------------------

export type Speed = 0.25 | 0.5 | 1 | 2 | 4 | 'instant'

export interface PlaybackStore {
  readonly source: 'machine' | 'toy'
  readonly seq: number
  readonly hops: number
  /** 0 … 1 + hops. [0,1) stepping; hop k live on [1+k, 2+k); lit at 1 + hops. */
  readonly t: number
  readonly playing: boolean
  readonly speed: Speed
  /** A pending bet: t pinned to 0, play() ignored. */
  readonly gated: boolean
  /** Starts a press animation. Instant speed or reduced motion jump to the end. */
  readonly play: (source: 'machine' | 'toy', seq: number, hops: number) => void
  readonly scrub: (t: number) => void
  readonly finish: () => void
  readonly setSpeed: (s: Speed) => void
  /** Only usePlaybackClock() in App calls this. */
  readonly tick: (dtMs: number) => void
  readonly setGated: (g: boolean) => void
}

/** Duration of the stepping phase and of each hop at speed 1; divided by the speed. */
export const STEP_MS = 400,
  HOP_MS = 150

/** The live hop: −1 on [0,1); else min(hops − 1, floor(t − 1)). */
export function hopAt(t: number, hops: number): number {
  if (t < 1) return -1
  return Math.min(hops - 1, Math.floor(t - 1))
}

/** The lamp is lit once the whole path has been drawn: t ≥ 1 + hops. */
export function isLit(t: number, hops: number): boolean {
  return t >= 1 + hops
}

// ---------------------------------------------------------------------------
// Toy machines on 6 or 8 letters (lib/toy.ts, state/toyStore.ts)
// ---------------------------------------------------------------------------

export interface ToySpec {
  /** Letters A…F or A…H. */
  readonly n: 6 | 8
  /** 1–3 rotors, LEFT → RIGHT, forward wirings on n letters. */
  readonly rotors: readonly (readonly number[])[]
  /** Turnover window index per rotor. */
  readonly notches: readonly number[]
  /** Fixed-point-free involution on n. */
  readonly reflector: readonly number[]
  /** Involution on n; identity = no cables. */
  readonly plugs: readonly number[]
  readonly positions: readonly number[]
  /** false = held (I.1): presses encode without stepping. */
  readonly stepping: boolean
}

/**
 * hops: plugboard-in, rotor fwd (right → left, using the slot names of the last k of left/middle/right),
 * reflector, rotor bwd, plugboard-out. No ETW. `spec` is the spec after the press.
 */
export interface ToyPress {
  readonly spec: ToySpec
  readonly lamp: Letter
  readonly hops: readonly PathHop[]
  readonly stepping: StepInfo
}

export interface ToyStore {
  readonly spec: ToySpec
  readonly seq: number
  readonly last: ToyPress | null
  readonly press: (key: Letter) => ToyPress
  readonly setSpec: (s: ToySpec) => void
  readonly reset: () => void
}
