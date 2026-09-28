/**
 * The signal layer's materials. Only the live wire glows (PLAN §2.6): its tube and head use the
 * signal colour with emissive intensity above 1 and toneMapped false — the lit lamp's recipe — so
 * Bloom (luminanceThreshold 1) catches them and the lit lamp, and nothing else. Where the tube runs
 * along a reflector pair or a plug cable, that wire glows with it. The ghost and the reference are
 * flat colours below 1: they never bloom.
 */

import { MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { swatch } from '../palette'

/** Emissive intensity of the live wire (the lit lamp uses 3). */
export const GLOW_INTENSITY = 2.6

/** The glowing material of the live wire. */
export function glowMaterial(intensity = GLOW_INTENSITY): MeshStandardMaterial {
  const c = swatch('signal')
  return new MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: intensity,
    toneMapped: false,
    roughness: 0.35,
    metalness: 0,
  })
}

/** A flat, see-through material drawn over the machine (no depth test). */
export function overlayMaterial(color: string, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}
