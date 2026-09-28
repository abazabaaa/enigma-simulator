/**
 * Learner-facing names for every part of the machine (review round 2): hints, rollbacks and part pickers never
 * show a raw id such as "notch-right". partName is for running text ("the right rotor's notch"); partLabel
 * capitalises it for buttons and list items.
 */

import type { RotorSlot } from '../contracts/core'
import type { PartId } from '../contracts/stage'

const FIXED: Readonly<Record<string, string>> = {
  battery: 'battery',
  keyboard: 'keyboard',
  lampboard: 'lampboard',
  plugboard: 'plugboard',
  etw: 'entry wheel',
  reflector: 'reflector',
  lid: 'lid',
}

const SLOT: Readonly<Record<RotorSlot, string>> = { right: 'right', middle: 'middle', left: 'left', greek: 'Greek' }

const SUB: Readonly<Record<string, (slot: string) => string>> = {
  rotor: (s) => `${s} rotor`,
  ring: (s) => `${s} rotor's alphabet ring`,
  core: (s) => `${s} rotor's wiring core`,
  notch: (s) => `${s} rotor's notch`,
  pawl: (s) => `${s} pawl`,
}

/** "right rotor's notch", "middle pawl", "entry wheel", … (an unknown id comes back as it is). */
export function partName(p: PartId | string): string {
  if (FIXED[p]) return FIXED[p]!
  const [sub, slot] = String(p).split('-') as [string, RotorSlot]
  const s = SLOT[slot]
  const name = SUB[sub]
  return s && name ? name(s) : String(p)
}

/** partName with a capital first letter. */
export function partLabel(p: PartId | string): string {
  const n = partName(p)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** "the right rotor's notch and the middle pawl". */
export function partList(parts: readonly (PartId | string)[]): string {
  const names = [...new Set(parts.map(partName))]
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
