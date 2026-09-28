/**
 * Symbol colours (PLAN §2.6, §3.1). Colours belong to SLOTS, not to rotor types, and are defined
 * once here: S plugboard, H entry wheel (ETW), N right rotor, M middle, L left, G Greek, U reflector
 * (Rejewski's notation, F6; the app writes U for his R), plus signal, ghost, reference and dim.
 * main.tsx writes them as CSS variables --sym-* once; 3D materials read symbolColor().
 */

import type { RotorSlot, TraceStage } from '../engine'
import type { PartId } from '../contracts/stage'

export type Sym = 'S' | 'H' | 'N' | 'M' | 'L' | 'G' | 'U'
export type Swatch = Sym | 'signal' | 'ghost' | 'reference' | 'dim'

export const SYMS: readonly Sym[] = ['S', 'H', 'N', 'M', 'L', 'G', 'U']
export const SWATCHES: readonly Swatch[] = [...SYMS, 'signal', 'ghost', 'reference', 'dim']

const SYM_FOR_SLOT: Readonly<Record<RotorSlot, Sym>> = { right: 'N', middle: 'M', left: 'L', greek: 'G' }

function buildSymForPart(): Partial<Record<PartId, Sym>> {
  const map: Partial<Record<PartId, Sym>> = { plugboard: 'S', etw: 'H', reflector: 'U' }
  for (const [slot, sym] of Object.entries(SYM_FOR_SLOT) as [RotorSlot, Sym][]) {
    for (const sub of ['rotor', 'ring', 'core', 'notch', 'pawl'] as const) map[`${sub}-${slot}`] = sym
  }
  return map
}

/** plugboard S, etw H, *-right N, *-middle M, *-left L, *-greek G, reflector U. */
export const SYM_FOR_PART: Readonly<Partial<Record<PartId, Sym>>> = Object.freeze(buildSymForPart())

/** The symbol of the component a trace stage passes through (all 13 stages). */
export function symForStage(stage: TraceStage): Sym {
  if (stage === 'plugboard-in' || stage === 'plugboard-out') return 'S'
  if (stage === 'etw-in' || stage === 'etw-out') return 'H'
  if (stage === 'reflector') return 'U'
  const slot = stage.split('-')[1] as RotorSlot
  return SYM_FOR_SLOT[slot]
}

/** Light and dark variants; each dark value has ≥ 4.5:1 contrast on the stone-950 background. */
export const SYMBOL_COLORS: Readonly<Record<Swatch, { readonly light: string; readonly dark: string }>> = Object.freeze({
  S: { light: '#047857', dark: '#34d399' }, // emerald: plugboard
  H: { light: '#475569', dark: '#94a3b8' }, // slate: entry wheel
  N: { light: '#1d4ed8', dark: '#60a5fa' }, // blue: right (fast) rotor
  M: { light: '#6d28d9', dark: '#a78bfa' }, // violet: middle rotor
  L: { light: '#c2410c', dark: '#fb923c' }, // orange: left rotor
  G: { light: '#4d7c0f', dark: '#a3e635' }, // lime: Greek rotor (M4)
  U: { light: '#0e7490', dark: '#22d3ee' }, // cyan: reflector
  signal: { light: '#b45309', dark: '#fbbf24' }, // amber: the live current
  ghost: { light: '#dc2626', dark: '#f87171' }, // red: the learner's divergent path
  reference: { light: '#a16207', dark: '#facc15' }, // gold: the reference path
  dim: { light: '#a8a29e', dark: '#57534e' }, // stone: dimmed parts
})

/** The colour for 3D materials. */
export function symbolColor(s: Swatch, scheme: 'light' | 'dark'): string {
  return SYMBOL_COLORS[s][scheme]
}

/** Writes --sym-S … --sym-dim (as light-dark() pairs) plus --sym-*-light / --sym-*-dark on `root`. */
export function applySymbolTokens(root?: HTMLElement): void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!el) return
  for (const s of SWATCHES) {
    const { light, dark } = SYMBOL_COLORS[s]
    el.style.setProperty(`--sym-${s}-light`, light)
    el.style.setProperty(`--sym-${s}-dark`, dark)
    el.style.setProperty(`--sym-${s}`, `light-dark(${light}, ${dark})`)
  }
}
