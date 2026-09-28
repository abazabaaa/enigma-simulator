/**
 * Bet gating (G10) on the default machine store and the playback clock. Before the first reveal of a scene
 * its bet is pending: sync.setPendingBet(true) locks the keyboard and pins playback at t = 0. Once a reveal
 * has fired and the next reveal's bet is not committed yet, only the keyboard stays locked (so the result of
 * the reveal that just happened stays on screen); the playback is gated again as soon as the learner starts
 * that next bet. Committing calls setPendingBet(false).
 */

import { positionsToString } from '../../engine'
import { useMachineStore } from '../../state/machineStore'
import { isBetPending, setPendingBet } from '../../state/sync'
import { useToyStore } from '../../state/toyStore'

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

/**
 * A newly gated playback pins t at 0, where every display shows the last press's "before" windows (ADU while
 * the machine stands at ADV). So before gating, the last press is cleared, keeping the machine, its windows and
 * the tape: the displays then show the machine as it is now (review round 2). Views need no workaround.
 */
export function clearLastPress(): void {
  const m = useMachineStore.getState()
  if (m.last) {
    const { locks } = m
    // setPositions is the only action that clears `last` and keeps the tape; lift its lock for this one call.
    if (locks.positions) m.setLocks({ ...locks, positions: false })
    try {
      useMachineStore.getState().setPositions(positionsToString(m.machine))
    } finally {
      if (locks.positions) useMachineStore.getState().setLocks({ ...useMachineStore.getState().locks, positions: true })
    }
  }
  if (useToyStore.getState().last) useToyStore.setState({ last: null })
}

/** Bring the locks in line with the scene's reveal state. */
export function applyGating(want: { lock: boolean; gate: boolean }): void {
  if (!want.gate && isBetPending()) setPendingBet(false)
  if (want.gate && !isBetPending()) {
    clearLastPress()
    setPendingBet(true)
  }
  if (want.lock && !want.gate) lockKeyboardOnly()
  if (!want.lock) unlockKeyboardOnly()
}

export function releaseGating(): void {
  applyGating({ lock: false, gate: false })
}
