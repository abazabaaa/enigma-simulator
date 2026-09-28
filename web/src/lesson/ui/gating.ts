/**
 * Bet gating (G10) on the default machine store and the playback clock. Before the first reveal of a scene
 * its bet is pending: sync.setPendingBet(true) locks the keyboard and pins playback at t = 0. Once a reveal
 * has fired and the next reveal's bet is not committed yet, only the keyboard stays locked (so the result of
 * the reveal that just happened stays on screen); the playback is gated again as soon as the learner starts
 * that next bet. Committing calls setPendingBet(false).
 */

import { useMachineStore } from '../../state/machineStore'
import { isBetPending, setPendingBet } from '../../state/sync'

let keyboardSaved: boolean | undefined

function lockKeyboardOnly(): void {
  if (keyboardSaved !== undefined) return
  const m = useMachineStore.getState()
  keyboardSaved = !!m.locks.keyboard
  if (!m.locks.keyboard) m.setLocks({ ...m.locks, keyboard: true })
}

function unlockKeyboardOnly(): void {
  if (keyboardSaved === undefined) return
  const m = useMachineStore.getState()
  m.setLocks({ ...m.locks, keyboard: keyboardSaved })
  keyboardSaved = undefined
}

/** Bring the locks in line with the scene's reveal state. */
export function applyGating(want: { lock: boolean; gate: boolean }): void {
  if (!want.gate && isBetPending()) setPendingBet(false)
  if (want.gate && !isBetPending()) setPendingBet(true)
  if (want.lock && !want.gate) lockKeyboardOnly()
  if (!want.lock) unlockKeyboardOnly()
}

export function releaseGating(): void {
  applyGating({ lock: false, gate: false })
}
