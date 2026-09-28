/**
 * Contracts v1 · core (PLAN §3.1). Frozen at the [contracts-v1] commit: after it, only additive,
 * optional changes land, batched in PR 07's single [contracts-v2] commit.
 */

export type {
  Letter,
  Perm,
  RotorSlot,
  RotorName,
  ReflectorName,
  ModelName,
  MachineConfig,
  MachineConfigInput,
  MachineState,
  PressResult,
  TraceStep,
  TraceStage,
  StepInfo,
} from '../engine'

/** A seeded random source in [0, 1). A bare function, so modules built on 01 need no import from 02. */
export type { Rng } from '../lib/rng'

/** The 14 chapters in course order (see content/registry.ts for acts, titles and dates). */
export const CHAPTER_IDS = [
  'prologue',
  'i1-anatomy',
  'i2-stepping',
  'i3-reflector-plugboard',
  'i4-permutations',
  'ii5-indicators',
  'ii6-cycles',
  'ii7-catalogue',
  'ii8-sheets',
  'iii9-cribs',
  'iii10-menus',
  'iii11-bombe',
  'iii12-checking',
  'iv-capstone',
] as const
export type ChapterId = (typeof CHAPTER_IDS)[number]

/** The hidden fixture chapter (#/lab/fixture) that exercises every generic item kind. */
export const LAB_CHAPTER_ID = 'lab-fixture'
export type AnyChapterId = ChapterId | typeof LAB_CHAPTER_ID

export type ActId = 'P' | 'I' | 'II' | 'III' | 'IV'

/** chapter/gateId */
export type GateKey = `${AnyChapterId}/${string}`
/** chapter/gateId/itemId */
export type ItemKey = `${AnyChapterId}/${string}/${string}`
/** chapter/betId */
export type BetKey = `${AnyChapterId}/${string}`

export interface Choice {
  readonly id: string
  readonly label: string
  /** The option embodies a known misconception (feedback explains why it is wrong). */
  readonly misconception?: true
}
