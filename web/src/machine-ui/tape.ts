/**
 * The paper tape's memory: where the current tape began. A tape is enciphered from the windows the
 * rotors showed before its first letter; reading the ciphertext back from those windows returns the
 * plaintext, and the share link encodes them. The store keeps only the configured start
 * (config.positions), which differs once the windows have been turned by hand, so each store's
 * first press after an empty tape is recorded here.
 */

import type { MachineStoreHook } from '../contracts/machine'
import { isLetter, positionsToString, type Letter, type MachineConfig } from '../engine'
import { useMachineStore } from '../state/machineStore'

const starts = new WeakMap<MachineStoreHook, string>()
const tracked = new WeakSet<MachineStoreHook>()

/** Start recording where `api`'s tapes begin (idempotent). */
export function trackTape(api: MachineStoreHook): void {
  if (tracked.has(api)) return
  tracked.add(api)
  api.subscribe((s, prev) => {
    if (s.input === '') starts.delete(api)
    else if (prev.input === '' && s.last) starts.set(api, positionsToString(s.last.stepping.before))
  })
}

// The default store is tracked from the moment the machine UI loads.
trackTape(useMachineStore)

/** The windows where the current tape began; the current windows when the tape is empty. */
export function tapeStart(api: MachineStoreHook): string {
  const s = api.getState()
  if (s.input === '') return positionsToString(s.machine)
  return starts.get(api) ?? s.machine.config.positions.join('')
}

/** The current setting with the windows where the tape began (what a recipient needs to read it). */
export function tapeStartConfig(api: MachineStoreHook): MachineConfig {
  const { config } = api.getState().machine
  return { ...config, positions: tapeStart(api).split('') as Letter[] }
}

/**
 * Clear the tape and turn the rotors back to where it began. When the windows are locked (or the
 * tape began at the configured start) this is the store's reset().
 */
export function rewindTape(api: MachineStoreHook): void {
  const s = api.getState()
  const start = tapeStart(api)
  if (!s.locks.positions && start !== s.machine.config.positions.join('')) {
    s.setConfig({ ...s.machine.config, positions: start })
  } else {
    s.reset()
  }
}

/** Type `text` key by key (letters only; everything else is skipped). Returns the number of keys pressed. */
export function typeText(api: MachineStoreHook, text: string): number {
  let typed = 0
  for (const ch of text.toUpperCase()) {
    if (!isLetter(ch)) continue
    const s = api.getState()
    if (s.locks.keyboard) break
    s.pressKey(ch)
    typed++
  }
  return typed
}
