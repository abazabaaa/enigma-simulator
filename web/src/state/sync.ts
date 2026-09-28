/**
 * One write path, many readers (PLAN §2.5). installSync() — called once in main.tsx — watches the
 * default machine store's and the toy store's `seq` and starts the playback animation for each new
 * press. setPendingBet() keeps locks.keyboard and playback.gated in step with a pending bet (G10).
 */

import { useMachineStore } from './machineStore'
import { usePlaybackStore } from './playbackStore'
import { useToyStore } from './toyStore'

let installed = false

export function installSync(): void {
  if (installed) return
  installed = true
  useMachineStore.subscribe((s, prev) => {
    if (s.seq !== prev.seq && s.last) usePlaybackStore.getState().play('machine', s.seq, s.last.trace.length)
  })
  useToyStore.subscribe((s, prev) => {
    if (s.seq !== prev.seq && s.last) usePlaybackStore.getState().play('toy', s.seq, s.last.hops.length)
  })
}

/** The keyboard lock to restore when the pending bet is resolved; undefined when no bet is pending. */
let savedKeyboard: boolean | undefined

/** true: remember the current locks.keyboard, set it, and set playback.gated; false: restore both. */
export function setPendingBet(pending: boolean): void {
  const machine = useMachineStore.getState()
  const playback = usePlaybackStore.getState()
  if (pending) {
    if (savedKeyboard === undefined) savedKeyboard = !!machine.locks.keyboard
    machine.setLocks({ ...machine.locks, keyboard: true })
    playback.setGated(true)
    return
  }
  if (savedKeyboard === undefined) return
  machine.setLocks({ ...machine.locks, keyboard: savedKeyboard })
  savedKeyboard = undefined
  playback.setGated(false)
}

/** Whether a bet is pending (for tests and the runtime). */
export function isBetPending(): boolean {
  return savedKeyboard !== undefined
}
