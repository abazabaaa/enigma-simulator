/**
 * Contracts v1 · stage (PLAN §3.3): what the 2D (04) and 3D (06, 11) views render and report.
 * PURE: no React, no DOM, no import.meta. Playwright imports this file in Node, so the e2e
 * specs compare `__stage.info().dimmed` against the very same `dimmedParts()`.
 */

import type { Letter, ModelName, RotorSlot, TraceStage } from './core'

/** One hop of the signal path. Every engine TraceStep is assignable; lib/toy emits it too. */
export interface PathHop {
  readonly kind: 'plugboard' | 'etw' | 'rotor' | 'reflector'
  readonly stage: TraceStage
  readonly input: Letter
  readonly output: Letter
  readonly inputIndex: number
  readonly outputIndex: number
  readonly slotIndex?: number
  readonly offset?: number
  readonly entryContact?: number
  readonly exitContact?: number
}

export type PartId =
  | 'battery'
  | 'keyboard'
  | 'lampboard'
  | 'plugboard'
  | 'etw'
  | 'reflector'
  | 'lid'
  | `rotor-${RotorSlot}`
  | `ring-${RotorSlot}`
  | `core-${RotorSlot}`
  | `notch-${RotorSlot}`
  | `pawl-${RotorSlot}`
export type PartGroup = 'wire' | 'rotor-stack' | 'pawls' | 'overview'
export type Focus = PartId | PartGroup
export type CameraShot = 'overview' | 'front' | 'rotors' | 'rotor-layers' | 'reflector' | 'plugboard' | 'lampboard' | 'toy'

export interface StageDirective {
  readonly source: 'machine' | 'toy'
  readonly shot: CameraShot
  /** ONE part or group; 'overview' dims nothing. */
  readonly focus: Focus
  readonly lid: 'closed' | 'open' | 'cutaway'
  readonly trace: 'animate' | 'static' | 'off'
  readonly labels: 'names' | 'symbols' | 'off'
  /** Exploded ring/core layers. */
  readonly ringLayer: boolean
  /** Plugboard visible. */
  readonly plugboard: boolean
  /** Canvas keys clickable. */
  readonly interactive: boolean
}

export interface Highlight {
  readonly part: PartId
  readonly tone: 'hint' | 'error' | 'ok'
}

/** The learner's path (hops) against the reference path; `divergeAt` is the first differing hop. */
export interface Ghost {
  readonly hops: readonly PathHop[]
  readonly divergeAt: number
}

export type StagePresetId =
  | 'overview'
  | 'type-a-word'
  | 'toy'
  | 'wire'
  | 'wire-noplug'
  | 'rotors'
  | 'rotor-layers'
  | 'pawls'
  | 'reflector'
  | 'plugboard'
  | 'symbols'
  | 'checking'

const preset = (
  source: StageDirective['source'],
  shot: CameraShot,
  focus: Focus,
  lid: StageDirective['lid'],
  trace: StageDirective['trace'],
  labels: StageDirective['labels'],
  ringLayer: boolean,
  plugboard: boolean,
  interactive: boolean,
): StageDirective => Object.freeze({ source, shot, focus, lid, trace, labels, ringLayer, plugboard, interactive })

/** The PLAN §3.3 preset table, verbatim. */
export const STAGE_PRESETS: Readonly<Record<StagePresetId, StageDirective>> = Object.freeze({
  // source, shot, focus, lid, trace, labels, ringLayer, plugboard, interactive
  overview: preset('machine', 'overview', 'overview', 'closed', 'animate', 'off', false, true, true),
  'type-a-word': preset('machine', 'front', 'overview', 'closed', 'off', 'off', false, true, true),
  toy: preset('toy', 'toy', 'wire', 'open', 'animate', 'names', false, false, true),
  wire: preset('machine', 'overview', 'wire', 'cutaway', 'animate', 'names', false, true, true),
  'wire-noplug': preset('machine', 'overview', 'wire', 'cutaway', 'animate', 'names', false, false, true),
  rotors: preset('machine', 'rotors', 'rotor-stack', 'cutaway', 'static', 'names', false, false, true),
  'rotor-layers': preset('machine', 'rotor-layers', 'ring-right', 'cutaway', 'off', 'names', true, false, false),
  pawls: preset('machine', 'rotors', 'pawls', 'cutaway', 'off', 'names', false, false, true),
  reflector: preset('machine', 'reflector', 'reflector', 'cutaway', 'animate', 'names', false, false, true),
  plugboard: preset('machine', 'plugboard', 'plugboard', 'open', 'animate', 'names', false, true, true),
  symbols: preset('machine', 'overview', 'wire', 'cutaway', 'animate', 'symbols', false, true, true),
  checking: preset('machine', 'overview', 'wire', 'cutaway', 'animate', 'names', false, false, true),
})

export const STAGE_PRESET_IDS = Object.keys(STAGE_PRESETS) as StagePresetId[]

export function isStagePresetId(id: unknown): id is StagePresetId {
  return typeof id === 'string' && Object.hasOwn(STAGE_PRESETS, id)
}

export type StageRef = StagePresetId | { readonly preset: StagePresetId; readonly with: Partial<StageDirective> }

/** A preset, or a preset with fields overridden. Throws on an unknown preset id. */
export function resolveStage(ref: StageRef): StageDirective {
  const id = typeof ref === 'string' ? ref : ref.preset
  if (!isStagePresetId(id)) throw new Error(`Unknown stage preset ${JSON.stringify(id)}`)
  if (typeof ref === 'string') return STAGE_PRESETS[id]
  return Object.freeze({ ...STAGE_PRESETS[id], ...ref.with })
}

const SUB_PARTS = ['rotor', 'ring', 'core', 'notch', 'pawl'] as const

function slotsFor(model: ModelName): readonly RotorSlot[] {
  return model === 'M4' ? ['greek', 'left', 'middle', 'right'] : ['left', 'middle', 'right']
}

function buildParts(model: ModelName): readonly PartId[] {
  const parts: PartId[] = ['battery', 'keyboard', 'lampboard', 'plugboard', 'etw']
  for (const slot of slotsFor(model)) {
    // The M4's Greek rotor never steps: it has no notch and no pawl.
    for (const sub of SUB_PARTS) if (slot !== 'greek' || (sub !== 'notch' && sub !== 'pawl')) parts.push(`${sub}-${slot}`)
  }
  parts.push('reflector', 'lid')
  return Object.freeze(parts)
}

const PARTS_BY_MODEL: Readonly<Record<ModelName, readonly PartId[]>> = {
  I: buildParts('I'),
  M3: buildParts('M3'),
  M4: buildParts('M4'),
}

/**
 * Every part of the machine, in a fixed order: battery, keyboard, lampboard, plugboard, etw, then per
 * slot LEFT → RIGHT (Greek first on the M4) rotor, ring, core, notch, pawl, then reflector and lid.
 * The M4's Greek slot has rotor, ring and core only.
 */
export const ALL_PARTS = (model: ModelName): readonly PartId[] => PARTS_BY_MODEL[model]

const prefixOf = (p: PartId): string => p.split('-')[0]!

function keeps(focus: Focus, p: PartId): boolean {
  switch (focus) {
    case 'overview':
      return true
    case 'wire': // everything on the signal path
      return p !== 'battery' && p !== 'lid' && !p.startsWith('notch-') && !p.startsWith('pawl-')
    case 'rotor-stack':
      return (SUB_PARTS as readonly string[]).includes(prefixOf(p))
    case 'pawls':
      return p.startsWith('pawl-') || p.startsWith('notch-') || p.startsWith('ring-')
    default: {
      if (p === focus) return true
      // rotor-x includes its sub-parts ring-x, core-x, notch-x and pawl-x.
      if (focus.startsWith('rotor-')) {
        const slot = focus.slice('rotor-'.length)
        return p.endsWith(`-${slot}`) && (SUB_PARTS as readonly string[]).includes(prefixOf(p))
      }
      return false
    }
  }
}

/**
 * The parts to dim for a focus, in ALL_PARTS order. PURE, and the ONLY definition of dimming: the 2D
 * and 3D views must report exactly this list.
 *   'overview' → []
 *   'wire' → the parts not on the path (battery, lid, notch-*, pawl-*)
 *   'rotor-stack' → all but rotor-*, ring-*, core-*, notch-*, pawl-*
 *   'pawls' → all but pawl-*, notch-*, ring-*
 *   a PartId p → all but p and its sub-parts (rotor-x includes ring-x, core-x, notch-x, pawl-x)
 */
export function dimmedParts(focus: Focus, model: ModelName): PartId[] {
  return ALL_PARTS(model).filter((p) => !keeps(focus, p))
}

export interface StageViewProps {
  readonly directive: StageDirective
  readonly reducedMotion: boolean
  /** Call after every render that changes what is shown. */
  readonly onReport: (r: StageReport) => void
  /** StageHost falls back to 2D for the rest of the session. */
  readonly onError: (e: unknown) => void
}

export interface StageReport {
  readonly renderer: 'webgl2' | 'svg' | 'placeholder'
  readonly gpu?: string
  readonly focus: Focus
  readonly dimmed: readonly PartId[]
  readonly highlighted: readonly PartId[]
  readonly litLamp: Letter | null
  /** Window letters LEFT → RIGHT as shown (stepping.before while t < 1). */
  readonly windows: string
  /** hopAt(t, hops): −1 during the stepping phase. */
  readonly hop: number
  /** Points of the drawn signal path: 2 + 2·(hops drawn). */
  readonly pathPoints: number
  readonly ghost: boolean
}

export interface StageStats {
  readonly calls: number
  readonly triangles: number
  readonly geometries: number
  readonly textures: number
  readonly framesWhileIdle: number
}

/** state/stageStore.ts */
export interface StageStore {
  readonly directive: StageDirective | null
  readonly highlight: readonly Highlight[]
  readonly ghost: Ghost | null
  readonly setDirective: (d: StageDirective | null) => void
  readonly setHighlight: (h: readonly Highlight[]) => void
  readonly setGhost: (g: Ghost | null) => void
}
