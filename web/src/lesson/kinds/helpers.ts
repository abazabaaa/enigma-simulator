/**
 * Pure helpers for writing item logic (checks, rollbacks and hint highlights). Chapters import them
 * through lesson/kinds; everything here is allowed by the L4 purity lint.
 */

import type { Letter, MachineConfig, TraceStage } from '../../contracts/core'
import type { CheckResult, Rollback } from '../../contracts/lesson'
import type { Ghost, PartId, PathHop } from '../../contracts/stage'
import { LETTERS, createMachine, positionsToString, pressKey, type MachineConfigInput } from '../../engine'

/** The machine part a trace stage passes through (rotor stages name the rotor). */
export function partForStage(stage: TraceStage): PartId {
  if (stage === 'plugboard-in' || stage === 'plugboard-out') return 'plugboard'
  if (stage === 'etw-in' || stage === 'etw-out') return 'etw'
  if (stage === 'reflector') return 'reflector'
  return `rotor-${stage.split('-')[1]}` as PartId
}

/** The first index where two sequences differ (by ===), or −1 when they are equal (length included). */
export function firstDiff<T>(a: readonly T[], b: readonly T[]): number {
  const n = Math.max(a.length, b.length)
  for (let k = 0; k < n; k++) if (a[k] !== b[k]) return k
  return -1
}

/** A correct result, or a wrong one with this rollback and feedback. */
export function verdict(correct: boolean, rollback: Rollback = { kind: 'none' }, feedback?: string): CheckResult {
  if (correct) return { correct: true, rollback: { kind: 'none' } }
  return feedback === undefined ? { correct: false, rollback } : { correct: false, rollback, feedback }
}

/**
 * The learner's chain of letters as a ghost path: the reference hops with the learner's outputs, each hop's
 * input being the previous hop's (ghost) output. `divergeAt` is the first hop whose output is wrong.
 */
export function ghostFromOutputs(reference: readonly PathHop[], outputs: readonly string[]): Ghost {
  const hops: PathHop[] = []
  let input = reference[0]?.input ?? ('A' as Letter)
  reference.forEach((ref, k) => {
    const out = (outputs[k] ?? '?').toUpperCase()
    const output = (LETTERS.includes(out as Letter) ? out : ref.output) as Letter
    hops.push({ ...ref, input, output, inputIndex: LETTERS.indexOf(input), outputIndex: LETTERS.indexOf(output) })
    input = output
  })
  const divergeAt = reference.findIndex((ref, k) => (outputs[k] ?? '').toUpperCase() !== ref.output)
  return { hops, divergeAt: divergeAt === -1 ? reference.length : divergeAt }
}

/**
 * The learner's (wrong) lamp traced BACKWARDS through the inverse of each hop's permutation, as a ghost.
 * `stagePerms[k]` is the forward permutation hop k applies. The ghost replaces the reference from the end
 * back to the first component (skipping pass-through stages such as an empty plugboard) where its wire
 * touches a letter on the reference path; `divergeAt` marks that hop. With no such crossing it marks the
 * reflector (or the first hop).
 */
export function backwardGhost(
  reference: readonly PathHop[],
  stagePerms: readonly (readonly number[])[],
  wrong: number,
): Ghost {
  const onPath = new Set<number>()
  for (const h of reference) {
    onPath.add(h.inputIndex)
    onPath.add(h.outputIndex)
  }
  const hops = [...reference]
  let x = wrong
  let divergeAt = Math.max(
    0,
    reference.findIndex((h) => h.kind === 'reflector'),
  )
  for (let k = reference.length - 1; k >= 0; k--) {
    const perm = stagePerms[k]!
    const prev = perm.indexOf(x)
    hops[k] = {
      ...reference[k]!,
      input: LETTERS[prev]!,
      output: LETTERS[x]!,
      inputIndex: prev,
      outputIndex: x,
    }
    const passThrough = perm.every((v, i) => v === i)
    if (!passThrough && onPath.has(prev)) {
      divergeAt = k
      break
    }
    x = prev
  }
  return { hops, divergeAt }
}

/** Split a string of window triples ('ADVAEWBFX') into windows of `width` ('ADV', 'AEW', 'BFX'). */
export function splitWindows(s: string, width = 3): string[] {
  const out: string[] = []
  for (let k = 0; k < s.length; k += width) out.push(s.slice(k, k + width))
  return out
}

/** The windows after each of `presses` key presses from `from` (any key: stepping does not depend on it). */
export function windowsAfterPresses(from: MachineConfigInput, presses: number): string[] {
  let state = createMachine(from)
  const out: string[] = []
  for (let k = 0; k < presses; k++) {
    state = pressKey(state, 'A').state
    out.push(positionsToString(state))
  }
  return out
}

/** A 'windows' rollback: expected and typed windows side by side, from the first wrong press. */
export function windowsRollback(from: MachineConfig, expected: readonly string[], got: readonly string[]): Rollback {
  const firstWrong = Math.max(0, firstDiff(expected, got))
  return { kind: 'windows', from, expected: [...expected], got: [...got], firstWrong }
}

/** An 'order' rollback: the first misplaced block. */
export function orderRollback(expected: readonly string[], got: readonly string[]): Rollback {
  return { kind: 'order', firstWrong: Math.max(0, firstDiff(expected, got)) }
}
