/**
 * Colours of the 3D machine. Slot and component colours come from lib/symbols (SYMBOL_COLORS, dark
 * scheme: the app is dark), so the right rotor's contacts have the colour of N in every equation.
 */

import type { PartId } from '../contracts/stage'
import type { RotorSlot } from '../engine'
import { SYM_FOR_PART, symbolColor, type Swatch } from '../lib/symbols'

export const PALETTE = {
  wood: '#7a4f2c',
  metal: '#47413c',
  metalDark: '#302b27',
  steel: '#8f8a84',
  brass: '#b8955b',
  keyCap: '#1f1c1a',
  keyStem: '#6b6560',
  glyphLight: '#f5f5f4',
  glyphDark: '#1c1917',
  ringBand: '#ece6d8',
  ringNumber: '#6b6560',
  lampOff: '#a39a8f',
  lampLit: '#fbbf24',
  socket: '#0f0d0c',
  core: '#2c2826',
} as const

export const swatch = (s: Swatch): string => symbolColor(s, 'dark')

/** The symbol colour of a part (plugboard S, etw H, rotors N/M/L/G, reflector U), else steel. */
export function partColor(part: PartId): string {
  const s = SYM_FOR_PART[part]
  return s ? swatch(s) : PALETTE.steel
}

export const slotColor = (slot: RotorSlot): string => partColor(`rotor-${slot}`)
