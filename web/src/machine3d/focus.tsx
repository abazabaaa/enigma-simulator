/**
 * Focus, dimming and highlights for the 3D parts (PLAN §2.6, G11).
 *  - Dimming comes only from dimmedParts(focus, model) (contracts/stage.ts): every material of a
 *    dimmed part becomes transparent at opacity 0.25. Scenery that is not a PartId (case body,
 *    axle) dims whenever anything is dimmed.
 *  - Highlights (stage store: hint L1, rollback) tint the part's materials in the tone's colour and
 *    draw a halo; the tint and halo pulse, or stay static under reduced motion.
 * Parts get their materials through usePartMaterial(), which also records them in a per-scene
 * registry (read by the e2e debug hook and the unit tests).
 */

import { useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type JSX, type ReactNode } from 'react'
import { Color, type Material, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import type { Highlight, PartId } from '../contracts/stage'
import { markChange } from './monitor'

/** A part of the machine, or 'scenery' for geometry that is not a PartId. */
export type PartKey = PartId | 'scenery'

export const DIM_OPACITY = 0.25

export const TONE_COLORS: Readonly<Record<Highlight['tone'], string>> = {
  hint: '#fbbf24',
  error: '#f87171',
  ok: '#34d399',
}

export interface FocusState {
  readonly dimmed: ReadonlySet<PartId>
  readonly highlight: ReadonlyMap<PartId, Highlight['tone']>
  readonly reducedMotion: boolean
}

interface Registry {
  readonly materials: Map<Material, PartKey>
}

interface FocusContextValue extends FocusState {
  readonly registry: Registry
}

const FocusContext = createContext<FocusContextValue>({
  dimmed: new Set(),
  highlight: new Map(),
  reducedMotion: false,
  registry: { materials: new Map() },
})

export function FocusProvider({
  dimmed,
  highlight,
  reducedMotion,
  registry,
  children,
}: FocusState & { registry: Registry; children: ReactNode }): JSX.Element {
  const value = useMemo(
    () => ({ dimmed, highlight, reducedMotion, registry }),
    [dimmed, highlight, reducedMotion, registry],
  )
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}

export function createRegistry(): Registry {
  return { materials: new Map() }
}

export function useFocus(): FocusContextValue {
  return useContext(FocusContext)
}

/** Whether `part` is dimmed; scenery dims whenever anything does. */
export function isPartDimmed(f: FocusState, part: PartKey): boolean {
  return part === 'scenery' ? f.dimmed.size > 0 : f.dimmed.has(part)
}

export function usePartState(part: PartKey): { dimmed: boolean; tone: Highlight['tone'] | null } {
  const f = useFocus()
  return { dimmed: isPartDimmed(f, part), tone: part === 'scenery' ? null : (f.highlight.get(part) ?? null) }
}

interface BaseState {
  opacity: number
  transparent: boolean
  depthWrite: boolean
  emissive: Color | null
  emissiveIntensity: number
}

const hasEmissive = (m: Material): m is MeshStandardMaterial => 'emissive' in m && (m as MeshStandardMaterial).emissive instanceof Color

function baseOf(m: Material): BaseState {
  const data = m.userData as { base?: BaseState }
  data.base ??= {
    opacity: m.opacity,
    transparent: m.transparent,
    depthWrite: m.depthWrite,
    emissive: hasEmissive(m) ? m.emissive.clone() : null,
    emissiveIntensity: hasEmissive(m) ? m.emissiveIntensity : 0,
  }
  return data.base
}

/** Static highlight strength and halo opacity (reduced motion); pulses swing around them. */
const STATIC_GLOW = 0.7
export const HALO_OPACITY = 0.9

/** Applies the part's dimming and highlight to a material (idempotent). */
export function applyPartState(m: Material, dimmed: boolean, tone: Highlight['tone'] | null): void {
  const base = baseOf(m)
  const transparent = dimmed || base.transparent
  if (m.transparent !== transparent) m.needsUpdate = true
  m.transparent = transparent
  m.opacity = dimmed ? base.opacity * DIM_OPACITY : base.opacity
  m.depthWrite = dimmed ? false : base.depthWrite
  m.userData.dimmed = dimmed
  m.userData.tone = tone
  if (hasEmissive(m) && base.emissive) {
    if (tone) {
      m.emissive.set(TONE_COLORS[tone])
      m.emissiveIntensity = STATIC_GLOW
    } else {
      m.emissive.copy(base.emissive)
      m.emissiveIntensity = base.emissiveIntensity
    }
  }
}

/**
 * A material for one part: created once per `deps`, disposed on unmount, kept in step with the
 * part's dimming and highlight, and registered for the debug hook.
 */
export function usePartMaterial<M extends Material>(part: PartKey, create: () => M, deps: readonly unknown[] = []): M {
  const material = useMemo(create, deps)
  const { dimmed, tone } = usePartState(part)
  const { registry } = useFocus()
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    applyPartState(material, dimmed, tone)
    invalidate()
  }, [material, dimmed, tone, invalidate])
  useEffect(() => {
    registry.materials.set(material, part)
    return () => {
      registry.materials.delete(material)
      material.dispose()
    }
  }, [material, part, registry])
  return material
}

/** Parts present in the scene and whether each is dimmed (every one of its materials is). */
export function scenePartStates(registry: Registry): Map<PartKey, { dimmed: boolean; tone: Highlight['tone'] | null }> {
  const out = new Map<PartKey, { dimmed: boolean; tone: Highlight['tone'] | null }>()
  for (const [m, part] of registry.materials) {
    if (m.userData.halo) continue
    const d = !!m.userData.dimmed
    const tone = (m.userData.tone as Highlight['tone'] | null | undefined) ?? null
    const prev = out.get(part)
    out.set(part, { dimmed: prev ? prev.dimmed && d : d, tone: prev?.tone ?? tone })
  }
  return out
}

/**
 * Pulses the tint of highlighted materials (and every registered halo material) while any highlight
 * is shown and motion is allowed. Each pulse frame counts as a change for framesWhileIdle.
 */
export function HighlightPulse(): null {
  const { highlight, reducedMotion, registry } = useFocus()
  const invalidate = useThree((s) => s.invalidate)
  const active = highlight.size > 0 && !reducedMotion
  useEffect(() => {
    if (active) {
      invalidate()
      return
    }
    // Not pulsing (reduced motion, or no highlight): back to the static tint and outline.
    for (const [m] of registry.materials) {
      const tone = m.userData.tone as Highlight['tone'] | null | undefined
      if (!tone) continue
      if (hasEmissive(m)) m.emissiveIntensity = STATIC_GLOW
      else if (m.userData.halo) m.opacity = HALO_OPACITY
    }
    invalidate()
  }, [active, invalidate, registry])
  const phase = useRef(0)
  useFrame((_, delta) => {
    if (!active) return
    // The first frame after an idle spell has a long delta: cap it so the pulse does not jump.
    phase.current += Math.min(delta, 0.1)
    const k = 0.5 + 0.5 * Math.sin(phase.current * Math.PI * 2 * 0.8)
    for (const [m] of registry.materials) {
      const tone = m.userData.tone as Highlight['tone'] | null | undefined
      if (!tone) continue
      if (hasEmissive(m)) m.emissiveIntensity = 0.25 + 0.9 * k
      else if (m.userData.halo) (m as MeshBasicMaterial).opacity = 0.35 + 0.65 * k
    }
    markChange()
    invalidate()
  })
  return null
}
