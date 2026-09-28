/**
 * The share codec (PLAN §3.10): a whole machine setting as one URL-safe string for #/machine?k=…
 *
 *   <model>.<reflector>.<rotors L→R, '-'>.<rings 01–26, '-'>.<windows>.<plug pairs, '-'>
 *   'I.B.I-II-III.01-01-01.ADU.AV-BS'
 *   'M4.B-thin.Beta-II-IV-I.01-01-01-22.VJNA.AT-BL'   (the M4 has 4 rotors and 4 rings)
 *   'I.B.I-II-III.01-01-01.AAA.'                      (no plugs: the last field is empty)
 *
 * Rings are always numbers 01–26 and windows always letters. decodeConfig returns null for anything
 * that is not exactly this shape or that fails validateConfig for its model.
 */

import { LETTERS, normalizeConfig, validateConfig, type MachineConfig, type MachineConfigInput } from '../engine'
import type { ModelName, ReflectorName, RotorName } from '../engine'

const pad2 = (n: number): string => String(n).padStart(2, '0')

export function encodeConfig(c: MachineConfig): string {
  const rings = c.rings.map((r) => pad2(r.toUpperCase().charCodeAt(0) - 64)).join('-')
  return [
    c.model,
    c.reflector,
    c.rotors.join('-'),
    rings,
    c.positions.join('').toUpperCase(),
    c.plugboard.map((p) => p.toUpperCase()).join('-'),
  ].join('.')
}

const SHAPE =
  /^(I|M3|M4)\.(A|B|C|B-thin|C-thin)\.([A-Za-z]+(?:-[A-Za-z]+){2,3})\.(\d\d(?:-\d\d){2,3})\.([A-Za-z]{3,4})\.((?:[A-Za-z]{2}(?:-[A-Za-z]{2}){0,12})?)$/

export function decodeConfig(s: string): MachineConfig | null {
  if (typeof s !== 'string') return null
  const m = SHAPE.exec(s.trim())
  if (!m) return null
  const [, model, reflector, rotors, rings, windows, plugs] = m as unknown as [string, string, string, string, string, string, string]
  const ringNumbers = rings.split('-').map(Number)
  if (ringNumbers.some((r) => r < 1 || r > 26)) return null
  const input: MachineConfigInput = {
    model: model as ModelName,
    reflector: reflector as ReflectorName,
    rotors: rotors.split('-') as RotorName[],
    rings: ringNumbers.map((r) => LETTERS[r - 1]!),
    positions: windows.toUpperCase(),
    plugboard: plugs === '' ? [] : plugs.toUpperCase().split('-'),
  }
  return validateConfig(input).length === 0 ? normalizeConfig(input) : null
}
