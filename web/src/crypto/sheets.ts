/**
 * Zygalski sheets (PLAN §4.4 II.8). PURE. A female is an indicator whose k-th and (k+3)-th letters are equal; it
 * can occur at a Grundstellung only if the product of the machine permutations at presses k and k + 3 has a fixed
 * point. A sheet belongs to one rotor order and one left-rotor position; its 51 × 51 grid repeats the 26 × 26
 * middle × right positions (a–z, a–y) and has an aperture wherever a female is possible (rings AAA).
 */

import { letterToIndex, type Letter, type ReflectorName, type RotorName } from '../engine'
import { scramblerTables } from './tables'

export const SHEET_SIZE = 51

/**
 * The sheet for `rotors` (LEFT → RIGHT) with the left rotor at `left`: cell (row i, column j), stored at
 * i · 51 + j, is the Grundstellung (left, middle = i mod 26, right = j mod 26); true = aperture (a k-(k+3) female
 * is possible there, with the engine's stepping). `pair` k is 1 (1-4 females, default), 2 or 3.
 */
export function femaleSheet(o: { rotors: readonly RotorName[]; reflector: ReflectorName; left: Letter
  pair?: 1 | 2 | 3 }): boolean[] {
  const t = scramblerTables(o.rotors, o.reflector)
  const k = o.pair ?? 1
  const l0 = letterToIndex(o.left)
  const square = new Array<boolean>(676)
  const p = new Uint8Array(26)
  const q = new Uint8Array(26)
  for (let m0 = 0; m0 < 26; m0++) {
    for (let r0 = 0; r0 < 26; r0++) {
      let l = l0
      let m = m0
      let r = r0
      for (let press = 1; press <= k + 3; press++) {
        const rightAt = t.right.turnover[r] === 1
        const middleAt = t.middle.turnover[m] === 1
        r = (r + 1) % 26
        if (rightAt || middleAt) m = (m + 1) % 26
        if (middleAt) l = (l + 1) % 26
        if (press === k) t.perm(l, m, r, p)
        if (press === k + 3) t.perm(l, m, r, q)
      }
      let fixed = false
      for (let x = 0; x < 26 && !fixed; x++) fixed = q[p[x]!] === x
      square[m0 * 26 + r0] = fixed
    }
  }
  const out = new Array<boolean>(SHEET_SIZE * SHEET_SIZE)
  for (let i = 0; i < SHEET_SIZE; i++) {
    for (let j = 0; j < SHEET_SIZE; j++) out[i * SHEET_SIZE + j] = square[(i % 26) * 26 + (j % 26)]!
  }
  return out
}
