/**
 * Contracts v1 · lesson content (PLAN §3.4) and scoring types (PLAN §3.5).
 * 02 owns the types; 05 implements the runtime (lesson/**), the item builders (lesson/kinds) and the
 * pure scoring reducer (lesson/rules.ts). Instances and answers must survive a JSON round trip.
 */

import type { ComponentType } from 'react'
import type {
  ActId,
  AnyChapterId,
  ChapterId,
  Choice,
  GateKey,
  ItemKey,
  Letter,
  MachineConfig,
  MachineConfigInput,
  Rng,
} from './core'
import type { LockKey, MachineLocks, MachineStoreHook, ToySpec } from './machine'
import type { Ghost, Highlight, PartId, StageRef } from './stage'

// ---------------------------------------------------------------------------
// Items and gates
// ---------------------------------------------------------------------------

export type ItemKind =
  | 'letter'
  | 'letters'
  | 'numbers'
  | 'choice'
  | 'order'
  | 'chain'
  | 'set-machine'
  | 'ghost-pick'
  | 'code'
  | 'custom'

/** window = 2 correct among the last 3 outcomes (sticky); once = the first correct outcome. */
export type PassRule = { readonly kind: 'window' } | { readonly kind: 'once' }
export type HintLevel = 0 | 1 | 2 | 3

export interface GenCtx {
  readonly key: ItemKey
  readonly attempt: number
  readonly purpose: 'instance' | 'worked' | 'fallback'
  /** The last ≤ 3 instances of this item. */
  readonly previous: readonly unknown[]
}

export interface ItemSetup {
  readonly machine?: MachineConfigInput
  readonly toy?: ToySpec
  readonly locks?: MachineLocks
  readonly stage?: StageRef | null
}

export type Rollback =
  /** lamp, chain, code keypress, ghost-pick */
  | { readonly kind: 'path'; readonly ghost: Ghost }
  | {
      readonly kind: 'windows'
      readonly from: MachineConfig
      readonly expected: readonly string[]
      readonly got: readonly string[]
      readonly firstWrong: number
    }
  | {
      readonly kind: 'cycles'
      readonly perm: readonly number[]
      readonly cycle: readonly number[]
      readonly expected: readonly number[]
      readonly got: readonly number[]
    }
  | { readonly kind: 'perm'; readonly wrongCells: readonly number[] }
  | { readonly kind: 'crib'; readonly offset: number; readonly crashes: readonly number[] }
  | { readonly kind: 'menu'; readonly loop: readonly Letter[]; readonly breakAt: number }
  | { readonly kind: 'wires'; readonly scrambler: number; readonly expected: readonly Letter[]; readonly got: readonly Letter[] }
  | { readonly kind: 'machine'; readonly field: LockKey; readonly message: string; readonly highlight: readonly PartId[] }
  | { readonly kind: 'order'; readonly firstWrong: number }
  | { readonly kind: 'none' }

export interface CheckResult {
  readonly correct: boolean
  readonly feedback?: string
  readonly rollback: Rollback
}

/** PURE item logic; lives in a chapter's gates.ts. */
export interface ItemLogic<I = unknown, A = unknown> {
  readonly id: string
  readonly kind: ItemKind
  readonly rule: PassRule
  /** Counts for "every act ends on a compute or set-machine item". */
  readonly compute: boolean
  /** The answer requires manipulating page state (set-machine, ghost-pick, constructive custom). */
  readonly inPage: boolean
  /** Requires rule once. */
  readonly transfer?: true
  /** Same answer on every instance; requires rule once. */
  readonly constantAnswer?: true
  /** Default 300, minimum 50 (heavy generators). */
  readonly lintSeeds?: number
  generate(r: Rng, ctx: GenCtx): I
  same(a: I, b: I): boolean
  check(i: I, a: A): CheckResult
  /** Reveal, worked example and Node-side e2e only. */
  solve(i: I): A
  /** A uniformly random well-formed answer (guess bot). */
  sampleAnswer(i: I, r: Rng): A
  /** A wrong answer near a (lint). */
  mutate(i: I, a: A, r: Rng): A
  /** Applied while the instance is shown, restored after. */
  setup?(i: I): ItemSetup
  /** Hint L1. */
  highlight(i: I, lastWrong: A | null): readonly Highlight[]
}

export interface GateLogic {
  readonly items: readonly ItemLogic[]
  readonly fallback: ItemLogic
  readonly puzzle?: true
}

/** gates.ts: export const GATES */
export type ChapterGates = Readonly<Record<string, GateLogic>>

export interface AnswerProps<I, A> {
  readonly instance: I
  readonly disabled: boolean
  readonly hintLevel: HintLevel
  submit(a: A): void
}

export interface ItemUi<I = unknown, A = unknown> {
  readonly Prompt: ComponentType<{ instance: I; hintLevel: HintLevel }>
  /** Required for 'custom'; generic widgets otherwise. */
  readonly Answer?: ComponentType<AnswerProps<I, A>>
  /** L2 gets a DIFFERENT instance; L3 gets the current one. */
  readonly Worked: ComponentType<{ instance: I; solution: A }>
  /** Required for rollback kinds cycles | perm | crib | menu | wires. */
  readonly Feedback?: ComponentType<{ instance: I; answer: A; result: CheckResult }>
}

/** items.tsx: export const ITEM_UI (including fallbacks). */
export type ItemUiMap = Readonly<Record<string, ItemUi<any, any>>>

export interface GateBinding {
  readonly logic: GateLogic
  readonly ui: ItemUiMap
}

// ---------------------------------------------------------------------------
// Scenes and chapters
// ---------------------------------------------------------------------------

export type SceneKind = 'story' | 'explore' | 'gate' | 'recall'

export type MechanismTag =
  | 'typing'
  | 'lamp'
  | 'path'
  | 'machine-path'
  | 'stepping'
  | 'double-step'
  | 'ring'
  | 'reflector'
  | 'plugboard'
  | 'no-self'
  | 'notation'
  | 'indicator'
  | 'AD'
  | 'paired-cycles'
  | 'invariance'
  | 'cyclometer'
  | 'catalogue'
  | 'female'
  | 'crash'
  | 'closure'
  | 'loop'
  | 'wires'
  | 'diagonal'
  | 'checking'

export interface BetSpec {
  readonly id: string
  readonly prompt: string
  readonly kind: 'letter' | 'choice' | 'number'
  readonly options?: readonly Choice[]
}

export interface RevealSpec {
  readonly bet: string
  readonly trigger: 'press' | 'step' | 'run' | 'toggle' | 'play'
  readonly key?: Letter
}

export interface TaskDef {
  readonly id: string
  readonly label: string
}

export interface Fact {
  readonly id: string
  readonly kind: 'person' | 'date' | 'number' | 'event' | 'quote'
  readonly text: string
  readonly value?: string | number
  readonly source: `https://${string}`
}

/** A STATIC clock and calendar; never counts down; allowed only in story scenes. */
export interface ClockSpec {
  /** A fact id of kind 'date'. */
  readonly date: string
  /** 'HH:MM' */
  readonly time?: string
  readonly caption: string
}

export interface StorySpec {
  /** ≤ 120 words. */
  readonly text: string
  /** ≥ 1 fact id of kind 'person'. */
  readonly people: readonly string[]
  /** A fact id of kind 'date'. */
  readonly date: string
  readonly facts?: readonly string[]
  readonly clock?: ClockSpec
  readonly figure?: 'keyspace'
}

export interface SceneDef {
  readonly id: string
  readonly kind: SceneKind
  readonly title: string
  readonly stage: StageRef | null
  readonly setup?: ItemSetup
  readonly panels?: {
    readonly keyboard?: boolean
    readonly lamps?: boolean
    readonly rotors?: boolean
    readonly rings?: boolean
    readonly plugboard?: boolean
    readonly model?: boolean
    readonly trace?: boolean
    readonly playback?: boolean
    readonly tape?: boolean
  }
  /** First-time reveals: need reveals + bets. */
  readonly introduces?: readonly MechanismTag[]
  /** Already introduced (in this or an earlier chapter). */
  readonly shows?: readonly MechanismTag[]
  /** Key presses need no bet (requires `shows`). */
  readonly freePress?: true
  readonly bets?: readonly BetSpec[]
  readonly reveals?: readonly RevealSpec[]
  readonly tasks?: readonly TaskDef[]
  /** Worked-example scene (fading policy). */
  readonly worked?: true
  /** kind 'gate' */
  readonly gate?: string
  /** kind 'recall' */
  readonly recall?: { readonly count: 3 }
  /** kind 'story' only */
  readonly story?: StorySpec
  /** explore/gate body; story and recall have none. */
  readonly View?: ComponentType<SceneProps>
}

export interface BetHandle {
  readonly committed: boolean
  readonly value: string | null
  commit(v: string): void
  resolve(truth: string): void
}

export interface ItemRuntimeView {
  readonly key: ItemKey
  readonly itemId: string
  readonly kind: ItemKind
  readonly rule: PassRule
  readonly attempt: number
  readonly seed: number
  readonly hintLevel: HintLevel
  readonly fallback: boolean
  readonly passed: boolean
  readonly window: readonly OutcomeResult[]
  readonly instance: unknown
}

export interface GateHandle {
  readonly key: GateKey
  readonly passed: boolean
  readonly current: ItemRuntimeView | null
  readonly items: readonly ItemRuntimeView[]
  readonly last: { readonly itemId: string; readonly result: CheckResult } | null
  submit(itemId: string, answer: unknown): CheckResult
  continue(): void
}

export interface SceneProps {
  readonly chapter: AnyChapterId
  readonly scene: string
  readonly reducedMotion: boolean
  readonly store: MachineStoreHook
  completeTask(id: string): void
  bet(id: string): BetHandle
  /** RevealButton / press gating; fire() emits 'reveal'. */
  reveal(id: string): { readonly allowed: boolean; fire(): void }
  readonly gate: GateHandle | null
}

export interface ChapterDef {
  readonly id: AnyChapterId
  readonly scenes: readonly SceneDef[]
  readonly gates: Readonly<Record<string, GateBinding>>
  readonly facts: readonly Fact[]
}

export interface ChapterMeta {
  readonly id: ChapterId
  readonly act: ActId
  readonly order: number
  readonly title: string
  readonly dates: string
  readonly optional?: true
  load(): Promise<{ default: ChapterDef }>
}

// ---------------------------------------------------------------------------
// Scoring (PLAN §3.5): types here, pure functions in lesson/rules.ts (05)
// ---------------------------------------------------------------------------

export type OutcomeResult = 'correct' | 'wrong' | 'revealed'

export interface Outcome {
  readonly result: OutcomeResult
  readonly ms: number
  readonly seed: number
  readonly fallback: boolean
  readonly hintLevel: HintLevel
  readonly at: number
}

export interface ItemRecord {
  readonly attempt: number
  readonly seed: number
  readonly redraw: number
  readonly shownAt: number
  /** Capped at 20. */
  readonly outcomes: readonly Outcome[]
  /** Consecutive wrong answers since the last correct answer or reveal. */
  readonly wrong: number
  readonly fallbackNext: boolean
  /** Sticky. */
  readonly passed: boolean
}

export interface GateRecord {
  readonly items: Readonly<Record<string, ItemRecord>>
  readonly passed: boolean
}

/** Defaults 2000, 5000. */
export interface RuleConfig {
  readonly minLatencyMs: number
  readonly burstMs: number
}

export type ItemAction =
  | { readonly type: 'answer'; readonly correct: boolean; readonly now: number }
  | { readonly type: 'reveal'; readonly now: number }
